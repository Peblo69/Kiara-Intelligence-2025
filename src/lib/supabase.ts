import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 300;
const MAX_BACKOFF_MS = 5000;
const CONNECTION_TIMEOUT = 10000; // 10 seconds

let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: 'pkce',
    debug: true,
    redirectTo: `https://kiaravision.com/auth/verify`,
    emailAuth: {
      passwordReset: {
        redirectTo: `https://kiaravision.com/auth/reset-password`
      },
      emailConfirm: {
        redirectTo: `https://kiaravision.com/auth/verify`
      }
    },
    onAuthStateChange: (event: string, session: any) => {
      console.log('🔍 DEBUG: Auth state changed:', { event, session });
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'kiara-chat@1.0.0'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  },
  fetch: (url: string, options: RequestInit = {}) => {
    const fetchWithRetry = async (attempt = 0): Promise<Response> => {
      try {
        // Wait for initialization on first request
        if (!isInitialized) {
          await initializeSupabase();
        }

        const cacheBuster = `_cb=${Date.now()}`;
        const urlWithCacheBuster = url.includes('?') 
          ? `${url}&${cacheBuster}` 
          : `${url}?${cacheBuster}`;
        
        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

        const response = await fetch(urlWithCacheBuster, {
          ...options,
          headers: {
            ...options.headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (!response.ok && attempt < MAX_RETRIES) {
          const backoff = Math.min(
            INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 100,
            MAX_BACKOFF_MS
          );
          
          console.log(`🔄 Retrying request (${attempt + 1}/${MAX_RETRIES}) after ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          return fetchWithRetry(attempt + 1);
        }
        
        return response;
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          const backoff = Math.min(
            INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 100,
            MAX_BACKOFF_MS
          );
          
          console.log(`🔄 Retrying request after network error (${attempt + 1}/${MAX_RETRIES}) after ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          return fetchWithRetry(attempt + 1);
        }
        throw error;
      }
    };
    
    return fetchWithRetry();
  }
};

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, supabaseOptions);

// Initialize Supabase connection
async function initializeSupabase(): Promise<boolean> {
  if (isInitialized) return true;
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise(async (resolve) => {
    try {
      console.log('🔍 DEBUG: Initializing Supabase connection...');
      
      // Test connection with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        console.error('❌ DEBUG: Connection test failed:', error);
        resolve(false);
        return;
      }

      console.log('✅ DEBUG: Connection test successful');
      isInitialized = true;
      resolve(true);
    } catch (error) {
      console.error('❌ DEBUG: Connection test error:', error);
      resolve(false);
    } finally {
      initializationPromise = null;
    }
  });

  return initializationPromise;
}

// Function to check connection status
export async function checkSupabaseConnection() {
  try {
    console.log('🔍 DEBUG: Testing Supabase connection...');
    return await initializeSupabase();
  } catch (error) {
    console.error('❌ DEBUG: Connection test error:', error);
    return false;
  }
}

// Function to get connection status
export async function getConnectionStatus(forceCheck = false) {
  if (forceCheck) {
    return await checkSupabaseConnection();
  }
  return isInitialized;
}

export async function ensureUserDocument(userId: string, email: string) {
  try {
    console.log('🔍 DEBUG: Ensuring user document exists:', { userId, email });

    // Wait for initialization
    if (!isInitialized) {
      await initializeSupabase();
    }

    // First try to get the user
    const { data: user, error: selectError } = await supabase
      .from('users')
      .select()
      .eq('id', userId)
      .single();

    // If user exists, we're done
    if (user) {
      console.log('✅ DEBUG: User document already exists');
      return;
    }

    // If the error is anything other than "not found", log and throw
    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ DEBUG: Error checking user:', selectError);
      throw selectError;
    }

    // User not found, create a new one with retries
    console.log('🔍 DEBUG: Creating new user document');
    
    let retries = 0;
    const maxRetries = 3;
    let success = false;
    
    while (!success && retries < maxRetries) {
      try {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email,
            display_name: email.split('@')[0],
            tokens_used: 0,
            active_subscription: 'free'
          });

        if (!insertError) {
          success = true;
          console.log('✅ DEBUG: User document created successfully');
        } else {
          console.error(`❌ DEBUG: Error creating user (attempt ${retries + 1}):`, insertError);
          retries++;
          
          // Try to create using the RPC function instead on subsequent attempts
          if (retries >= 1) {
            console.log('🔍 DEBUG: Trying alternative user creation method');
            const { error: rpcError } = await supabase.rpc('get_or_create_user_profile', {
              user_id: userId
            });
            
            if (!rpcError) {
              success = true;
              console.log('✅ DEBUG: User document created via RPC');
              break;
            } else {
              console.error('❌ DEBUG: RPC error creating user:', rpcError);
            }
          }
          
          // Wait between retries
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      } catch (error) {
        console.error(`❌ DEBUG: Exception creating user (attempt ${retries + 1}):`, error);
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }

    // Create default preferences if success
    if (success) {
      try {
        const { error: prefsError } = await supabase
          .from('preferences')
          .insert({
            user_id: userId,
            theme: 'dark',
            font_size: 14,
            language: 'en',
            notifications: {
              email: true,
              push: true,
              desktop: true
            },
            ai_preferences: {
              defaultModel: 'dominator',
              temperature: 0.7,
              maxTokens: 2048
            }
          });

        if (prefsError) {
          console.error('❌ DEBUG: Error creating preferences:', prefsError);
        }

        const { error: quotaError } = await supabase
          .from('quotas')
          .insert({
            user_id: userId,
            plan: 'free',
            limits: {
              maxChats: 10,
              maxTokensPerDay: 1000,
              maxMemories: 50,
              maxFileSize: 5 * 1024 * 1024 // 5MB
            },
            usage: {
              currentTokens: 0
            }
          });

        if (quotaError) {
          console.error('❌ DEBUG: Error creating quota:', quotaError);
        }
      } catch (error) {
        console.error('❌ DEBUG: Error setting up user preferences:', error);
      }
    } else {
      console.error('❌ DEBUG: Failed to create user after maximum retries');
    }
  } catch (error) {
    console.error('❌ DEBUG: Error in ensureUserDocument:', error);
  }
}

export async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return !!session;
  } catch (error) {
    console.error('❌ DEBUG: Error checking auth:', error);
    return false;
  }
}

export async function safeSupabaseOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  errorMessage: string
): Promise<T> {
  try {
    try {
      return await operation();
    } catch (error) {
      throw error;
    }
    
  } catch (error) {
    console.error(`❌ DEBUG: ${errorMessage}:`, error);
    return fallback;
  }
}

// Initial connection check

import { supabase } from './supabase';
import { ensureUserDocument } from './supabase';
import { generateTOTP, verifyTOTP } from './totp';
import { networkManager } from './network';

// Error message mapping
const getErrorMessage = (code: string): string => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Invalid email or password';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later';
    case 'auth/operation-not-allowed':
      return 'This login method is not enabled';
    default:
      return 'An error occurred. Please try again';
  }
};

// 2FA functions
export async function setup2FA(): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
  try {
    // Generate TOTP secret
    const { secret, qrCode } = await generateTOTP();
    
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Cannot setup 2FA while offline');
    }
    
    // Store in database
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data: selectError } = await supabase
      .from('user_2fa')
      .select()
      .eq('user_id', user.id)
      .single();

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    if (!selectError) {
      // Create new 2FA record
      const { error: insertError } = await supabase
        .from('user_2fa')
        .insert({
          user_id: user.id,
          secret,
          backup_codes: backupCodes,
          enabled: false
        });

      if (insertError) {
        console.error('❌ DEBUG: Error setting up 2FA:', insertError);
        throw insertError;
      }
    } else {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_2fa')
        .update({
          secret,
          backup_codes: backupCodes,
          enabled: false
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('❌ DEBUG: Error updating 2FA:', updateError);
        throw updateError;
      }
    }

    return {
      secret,
      qrCode,
      backupCodes
    };
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    throw new Error('Failed to setup 2FA');
  }
}

export async function enable2FA(code: string): Promise<boolean> {
  try {
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Cannot enable 2FA while offline');
    }
    
    const { data, error } = await supabase.rpc('enable_2fa', {
      p_code: code
    });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    throw new Error('Failed to enable 2FA');
  }
}

export async function verify2FA(code: string): Promise<boolean> {
  try {
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Cannot verify 2FA while offline');
    }
    
    const { data, error } = await supabase.rpc('verify_2fa', {
      p_code: code
    });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    throw new Error('Failed to verify 2FA');
  }
}

export async function disable2FA(): Promise<void> {
  try {
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Cannot disable 2FA while offline');
    }
    
    const { error } = await supabase.rpc('disable_2fa');
    if (error) throw error;
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    throw new Error('Failed to disable 2FA');
  }
}

export async function is2FAEnabled(): Promise<boolean> {
  try {
    // Check if we're online first
    if (!navigator.onLine) {
      console.warn('Network offline, assuming 2FA is not enabled');
      return false;
    }
    
    const { data, error } = await supabase.rpc('is_2fa_enabled');
    if (error) {
      console.error('Error checking 2FA status:', error);
      return false;
    }
    return data || false;
  } catch (error) {
    console.error('Error checking 2FA status:', error);
    return false;
  }
}

export const signUp = async (email: string, password: string) => {
  try {
    console.log('🔍 DEBUG: Starting signup process');
    
    // Get current origin and path for redirect
    const redirectTo = `https://scintillating-arithmetic-d0bbfb.netlify.app/auth/verify`;
    console.log('🔍 DEBUG: Redirect URL:', redirectTo);
    
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Cannot sign up while offline');
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          email_confirm_required: true
        }
      }
    });

    if (error) {
      console.error('❌ DEBUG: Signup error:', error);
      throw error;
    }

    // Create user document even if email is not confirmed
    if (data.user && data.user.id) {
      await ensureUserDocument(data.user.id, email);
    }

    console.log('✅ DEBUG: Signup successful');
    return data;
  } catch (error: any) {
    console.error('❌ DEBUG: Signup error:', error);
    throw new Error(getErrorMessage(error.code));
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    console.log('🔍 DEBUG: Starting signin process');
        
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Cannot sign in while offline');
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ DEBUG: Signin error:', error);
      throw error;
    }

    // Create user document even if email is not confirmed
    if (data.user && data.user.id) {
      await ensureUserDocument(data.user.id, email);
    }

    console.log('✅ DEBUG: Signin successful');
    return data;
  } catch (error: any) {
    console.error('❌ DEBUG: Signin error:', error);
    throw new Error(getErrorMessage(error.code));
  }
};

// Function to request password reset
export const requestPasswordReset = async (email: string): Promise<boolean> => {
  try {
    console.log('🔍 DEBUG: Requesting password reset');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `https://scintillating-arithmetic-d0bbfb.netlify.app/auth/reset-password`
    });

    if (error) {
      console.error('❌ DEBUG: Password reset request error:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return false;
  }
};

// Function to update password with reset token
export const resetPassword = async (newPassword: string): Promise<boolean> => {
  try {
    console.log('🔍 DEBUG: Resetting password');

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('❌ DEBUG: Password reset error:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  }
};

export const logOut = async () => {
  try {
    console.log('🔍 DEBUG: Starting logout process');
    
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Cannot logout while offline');
    }
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ DEBUG: Signout error:', error);
      throw error;
    }

    console.log('✅ DEBUG: Logout successful');
  } catch (error: any) {
    console.error('❌ DEBUG: Logout error:', error);
    throw new Error(getErrorMessage(error.code));
  }
};

export const onAuthChange = (callback: (user: any | null) => void) => {
  console.log('🔍 DEBUG: Setting up auth change listener');
  
  return supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user;
    
    if (user?.email) {
      try {
        await ensureUserDocument(user.id, user.email);
      } catch (error) {
        console.error('❌ DEBUG: Error ensuring user document:', error);
        // Continue anyway, as this could be due to network issues
      }
    }
    
    callback(user);
  });
};

// Function to check if email is verified
export const isEmailVerified = async (userId?: string): Promise<boolean> => {
  try {
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
      
      if (!userId) {
        return false;
      }
    }
    
    // Check using server-side function
    const { data, error } = await supabase.rpc('is_email_verified', {
      p_user_id: userId
    });
    
    if (error) {
      console.error('❌ DEBUG: Error checking email verification:', error);
      
      // Fallback to checking session data
      const { data: { session } } = await supabase.auth.getSession();
      return !!(session?.user?.email_confirmed_at && session?.user?.confirmed_at);
    }
    
    return !!data;
  } catch (error) {
    console.error('❌ DEBUG: Error checking email verification status:', error);
    return false;
  }
};

// Function to resend verification email
export const resendVerificationEmail = async (email?: string): Promise<boolean> => {
  try {
    if (!email) {
      const { data: { session } } = await supabase.auth.getSession();
      email = session?.user?.email;
      
      if (!email) {
        throw new Error('No email address available');
      }
    }
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `https://scintillating-arithmetic-d0bbfb.netlify.app/auth/verify`
      }
    });
    
    if (error) {
      console.error('❌ DEBUG: Error resending verification email:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('❌ DEBUG: Error in resendVerificationEmail:', error);
    return false;
  }
};
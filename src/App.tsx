import React, { useEffect } from 'react';
import { Chat } from './components/Chat';
import { Login } from './components/Login';
import { Docs } from './components/Docs';
import { EmailVerification } from './components/EmailVerification';
import { useStore } from './lib/store';
import { supabase } from './lib/supabase';
import { NetworkStatus } from './components/NetworkStatus';
import { OfflineModal } from './components/OfflineModal';

function App() {
  const { 
    isAuthenticated, 
    setIsAuthenticated,
    isEmailVerified,
    setIsEmailVerified,
    isDocsOpen,
    setIsDocsOpen,
    isOffline,
    setupTokenSync
  } = useStore();

  useEffect(() => {
    console.log('🔍 DEBUG: Setting up auth state listener');
    
    // Handle auth redirect
    const handleAuthRedirect = async () => {
      const { hash } = window.location;
      if (hash && hash.includes('access_token')) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session?.user) {
          const isConfirmed = session.user.email_confirmed_at !== null && 
                            session.user.confirmed_at !== null;
          
          setIsAuthenticated(true);
          setIsEmailVerified(isConfirmed);
          setupTokenSync();
        }
      }
    };
    
    handleAuthRedirect();
    
    // Get initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 DEBUG: Initial auth state:', !!session);
      
      if (session?.user) {
        // Check if email is confirmed by looking at email_confirmed_at
        const isConfirmed = session.user.email_confirmed_at !== null && 
                          session.user.confirmed_at !== null;
        
        setIsAuthenticated(true);
        setIsEmailVerified(isConfirmed);
        setupTokenSync(); // Set up token sync when authenticated
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 DEBUG: Auth state changed:', event);
      console.log('🔍 DEBUG: New session:', session);
      
      if (session?.user) {
        // Check both email_confirmed_at and confirmed_at
        const isConfirmed = session.user.email_confirmed_at !== null && 
                          session.user.confirmed_at !== null;
        
        setIsAuthenticated(true);
        setIsEmailVerified(isConfirmed);
        setupTokenSync(); // Set up token sync on auth change
      } else {
        setIsAuthenticated(false);
        setIsEmailVerified(false);
      }
    });

    // Cleanup subscription
    return () => {
      console.log('🔍 DEBUG: Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, [setIsAuthenticated]);

  return (
    <>
      <NetworkStatus />
      
      {/* Main app content */}
      {isAuthenticated ? (
        isEmailVerified ? (
          <Chat />
        ) : (
          <EmailVerification />
        )
      ) : (
        <Login />
      )}
      
      {/* Modal popups */}
      {isDocsOpen && <Docs onClose={() => setIsDocsOpen(false)} />}
      {isOffline && <OfflineModal />}
    </>
  );
}

export default App;
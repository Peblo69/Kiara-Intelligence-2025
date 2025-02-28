import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import { resendVerificationEmail } from '../lib/auth';

export function EmailVerification() {
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [countdown, setCountdown] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { checkEmailVerification } = useStore();

  // Check if the email has been verified on component mount and periodically
  useEffect(() => {
    // Get user email
    const getUserEmail = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        setUserEmail(data.user.email);
      }
    };
    
    getUserEmail();
    
    // Check email verification status immediately
    checkEmailVerification();
    
    // Set up periodic checks (every 10 seconds)
    const interval = setInterval(() => {
      checkEmailVerification();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [checkEmailVerification]);

  // Handle countdown for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setTimeout(() => {
      setCountdown(c => c - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResendEmail = async () => {
    try {
      setIsResending(true);
      setResendStatus('idle');

      const success = await resendVerificationEmail(userEmail || undefined);
      
      if (success) {
        console.log('✅ DEBUG: Verification email resent successfully');
        setResendStatus('success');
        // Set 60 second cooldown
        setCountdown(60);
        setTimeout(() => setResendStatus('idle'), 5000);
      } else {
        console.error('❌ DEBUG: Error resending verification email');
        setResendStatus('error');
        setTimeout(() => setResendStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      setResendStatus('error');
      setTimeout(() => setResendStatus('idle'), 5000);
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => { 
    try {
      console.log('🔍 DEBUG: Logging out unverified user');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('❌ DEBUG: Error during logout:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-black">
      <div className="w-full max-w-md p-8 bg-[#0a0505] rounded-lg shadow-xl border border-red-500/20">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-red-900/20 rounded-full">
            <Mail className="w-12 h-12 text-red-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-white mb-4">
          Verify Your Email
        </h2>

        <p className="text-red-300 text-center mb-6">
          We've sent a verification link to <span className="font-semibold">{userEmail || 'your email'}</span>. You need to verify your email before continuing.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleResendEmail}
            disabled={isResending || countdown > 0}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg transition-colors ${
              resendStatus === 'success'
                ? 'bg-green-600 hover:bg-green-700'
                : resendStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-red-600 hover:bg-red-700'
            } text-white disabled:opacity-50`}
          >
            {isResending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {resendStatus === 'success' ? (
                  <>
                    <Check className="w-5 h-5" />
                    Verification Email Sent!
                  </>
                ) : resendStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Failed to Send - Try Again
                  </>
                ) : countdown > 0 ? (
                  `Resend in ${countdown}s`
                ) : (
                  'Resend Verification Email'
                )}
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-3 text-red-400 hover:text-red-300 transition-colors"
          >
            Back to Login
          </button>
        </div>

        {resendStatus === 'success' && (
          <p className="mt-4 text-sm text-green-500 text-center">
            Verification email sent! Please check your inbox.
          </p>
        )}
        {resendStatus === 'error' && (
          <p className="mt-4 text-sm text-red-500 text-center">
            Failed to send verification email. Please try again.
          </p>
        )}

        <div className="mt-8 text-sm text-red-400/60 text-center">
          <p>
            Can't find the email? Check your spam folder or click resend above.
          </p>
        </div>
      </div>
    </div>
  );
}
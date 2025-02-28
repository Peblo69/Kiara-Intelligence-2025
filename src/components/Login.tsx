import React, { useState } from 'react';
import { useStore } from '../lib/store'; 
import { supabase } from '../lib/supabase';

type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-success';

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [view, setView] = useState<AuthView>('login');
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    if (!email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (view === 'signup' && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormErrors({});

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      switch (view) {
        case 'login': {
          console.log('🔍 DEBUG: Attempting login');
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });
          if (error) {
            console.error('❌ DEBUG: Login error:', error);
            throw error;
          }
          console.log('✅ DEBUG: Login successful');
          break;
        }

        case 'signup': {
          console.log('🔍 DEBUG: Attempting signup');
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });
          if (error) {
            console.error('❌ DEBUG: Signup error:', error);
            throw error;
          }
          
          // Show verification message
          setError('Please check your email to verify your account before logging in.');
          setView('login');
          break;
        }

        case 'forgot-password': {
          console.log('🔍 DEBUG: Attempting password reset');
          const success = await requestPasswordReset(email);
          if (success) {
            setView('reset-success');
          } else {
            setError('Failed to send reset instructions. Please try again.');
          }
          break;
        }
      }
    } catch (error: any) {
      console.error('❌ DEBUG: Auth error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    type: string,
    placeholder: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    error?: string
  ) => (
    <div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 rounded-lg bg-white/10 border ${
          error 
            ? 'border-red-500/50 focus:ring-red-500' 
            : 'border-purple-500/30 focus:ring-purple-500'
        } text-white placeholder-purple-300/50 focus:ring-2 focus:border-transparent transition-all`}
        disabled={isLoading}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );

  const renderForm = () => {
    switch (view) {
      case 'signup':
        return (
          <>
            {renderInput('email', 'Email', email, (e) => setEmail(e.target.value), formErrors.email)}
            {renderInput('password', 'Password', password, (e) => setPassword(e.target.value), formErrors.password)}
            {renderInput('password', 'Confirm Password', confirmPassword, (e) => setConfirmPassword(e.target.value), formErrors.confirmPassword)}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 rounded-lg hover:from-purple-700 hover:to-purple-900 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError('');
                  setFormErrors({});
                }}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                disabled={isLoading}
              >
                Already have an account? Log in
              </button>
            </div>
          </>
        );

      case 'forgot-password':
        return (
          <>
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-white">Reset Password</h3>
              <p className="text-sm text-purple-200/80">
                Enter your email address and we'll send you instructions to reset your password.
              </p>
            </div>

            {renderInput('email', 'Email', email, (e) => setEmail(e.target.value), formErrors.email)}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 rounded-lg hover:from-purple-700 hover:to-purple-900 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
                disabled={isLoading}
              >
                Back to Login
              </button>
            </div>
          </>
        );

      case 'reset-success':
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Check Your Email</h3>
              <p className="text-purple-200/80 text-sm mb-6">
                We've sent password reset instructions to:
                <br />
                <span className="font-medium text-purple-300">{email}</span>
              </p>
            </div>

            <button
              onClick={() => {
                setView('login');
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 rounded-lg hover:from-purple-700 hover:to-purple-900 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-purple-500/25"
            >
              Return to Login
            </button>

            <p className="mt-6 text-sm text-purple-300/60">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => {
                  setView('forgot-password');
                  setError('');
                }}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                try again
              </button>
            </p>
          </div>
        );

      default: // login
        return (
          <>
            {renderInput('email', 'Email', email, (e) => setEmail(e.target.value), formErrors.email)}
            {renderInput('password', 'Password', password, (e) => setPassword(e.target.value), formErrors.password)}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 rounded-lg hover:from-purple-700 hover:to-purple-900 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Log in'}
            </button>

            <div className="space-y-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setView('signup');
                  setError('');
                  setFormErrors({});
                }}
                className="w-full text-purple-400 hover:text-purple-300 text-sm transition-colors"
                disabled={isLoading}
              >
                Create New Account
              </button>

              <button
                type="button"
                onClick={() => {
                  setView('forgot-password');
                  setError('');
                  setFormErrors({});
                }}
                className="w-full text-purple-400 hover:text-purple-300 text-sm transition-colors"
                disabled={isLoading}
              >
                Forgot Password?
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-purple-900 to-black">
      {/* Left side - Hero Image */}
      <div className="hidden lg:block lg:w-[60%] relative overflow-hidden">
        {/* Infinity Logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 z-10">
          <div className="infinity-logo vision w-full h-full"></div>
        </div>

        <div className="absolute inset-0">
          <img 
            src="https://files.catbox.moe/22dv4o.webp" 
            alt="AI Background" 
            className="absolute inset-0 w-full h-full object-cover will-change-transform"
            loading="eager"
            fetchpriority="high"
            decoding="sync"
            style={{
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              perspective: '1000px'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-black/80" />
        </div>
        
        {/* Content overlay */}
        <div className="relative w-full flex flex-col justify-center px-16 text-white">
          {/* Logo */}
          <div className="absolute top-8 left-8">
            <h1 className="text-xl font-orbitron text-white tracking-wider bg-black/30 px-4 py-2 rounded-lg backdrop-blur-sm">
              Kiara Intelligence
            </h1>
          </div>
          
          {/* Innovation text */}
          <div className="absolute bottom-32 left-12 max-w-lg">
            <p className="text-xl font-orbitron text-white/90 tracking-wide leading-relaxed">
              Where AI Meets Innovation – Elevate Your Experience
            </p>
          </div>
          
          {/* Main text */}
          <h1 className="text-3xl font-orbitron font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-purple-400 tracking-wider absolute bottom-24 right-12">
            Unleash the power of AI
          </h1>
          <p className="text-base text-purple-200/90 font-orbitron tracking-wide absolute bottom-16 right-12">
            Unlock Limitless Possibilities
          </p>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-8 relative">
        <div className="absolute -left-32 inset-y-0 w-32 bg-gradient-to-r from-transparent to-black pointer-events-none" />
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm pointer-events-none" />
        
        <div className="w-full max-w-md relative">
          <div className="text-center mb-8">
            <div className="infinity-logo w-24 h-24 mx-auto mb-6"></div>
            <h2 className="text-3xl font-semibold mb-2 text-white">
              {view === 'signup' ? 'Create your account' : 
               view === 'forgot-password' ? 'Reset your password' : 
               view === 'reset-success' ? 'Password Reset' :
               'Welcome to Kiara Intelligence'}
            </h2>
            {view === 'login' && (
              <p className="text-purple-200/80">
                Don't have an account? 
                <button
                  onClick={() => {
                    setView('signup');
                    setError('');
                    setFormErrors({});
                  }}
                  className="text-purple-400 hover:text-purple-300 ml-1 transition-colors"
                  disabled={isLoading}
                >
                  Sign up for free
                </button>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 backdrop-blur-sm">
            {renderForm()}
          </form>
        </div>
      </div>
    </div>
  );
}
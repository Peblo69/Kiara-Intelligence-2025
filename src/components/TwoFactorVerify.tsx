import React, { useState } from 'react';
import { verify2FA } from '../lib/auth';
import { Shield } from 'lucide-react';

interface TwoFactorVerifyProps {
  onVerify: () => void;
  onCancel: () => void;
}

export function TwoFactorVerify({ onVerify, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    try {
      setIsLoading(true);
      setError('');

      const success = await verify2FA(code);
      if (success) {
        onVerify();
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (error) {
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0a0505] w-full max-w-md rounded-lg shadow-lg border border-red-500/20 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-center">
            <Shield className="w-16 h-16 text-red-500" />
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-2">
              Two-Factor Authentication
            </h3>
            <p className="text-red-300 text-sm">
              Enter the verification code from your authenticator app.
            </p>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <p className="text-xs text-red-400">
              You can also use one of your backup codes.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleVerify}
              disabled={isLoading || !code}
              className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={onCancel}
              className="w-full text-red-400 hover:text-red-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
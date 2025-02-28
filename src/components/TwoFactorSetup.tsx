import React, { useState } from 'react';
import { setup2FA, enable2FA } from '../lib/auth';
import { Shield, Copy, Check } from 'lucide-react';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'intro' | 'setup' | 'verify'>('intro');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  const handleSetup = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const { secret, qrCode, backupCodes } = await setup2FA();
      
      setSecret(secret);
      setQrCode(qrCode);
      setBackupCodes(backupCodes);
      setStep('setup');
    } catch (error) {
      setError('Failed to setup 2FA. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setIsLoading(true);
      setError('');

      const success = await enable2FA(verificationCode);
      if (success) {
        onComplete();
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (error) {
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackupCodes(true);
    setTimeout(() => setCopiedBackupCodes(false), 2000);
  };

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <Shield className="w-16 h-16 text-red-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-2">
                Enable Two-Factor Authentication
              </h3>
              <p className="text-red-300 text-sm">
                Add an extra layer of security to your account by requiring both your password and an authentication code to sign in.
              </p>
            </div>
            <div className="space-y-4">
              <button
                onClick={handleSetup}
                disabled={isLoading}
                className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Setting up...' : 'Get Started'}
              </button>
              <button
                onClick={onCancel}
                className="w-full text-red-400 hover:text-red-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case 'setup':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-2">
                Setup Two-Factor Authentication
              </h3>
              <p className="text-red-300 text-sm">
                Scan the QR code with your authenticator app or enter the code manually.
              </p>
            </div>

            <div className="flex justify-center">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
            </div>

            <div className="bg-red-900/20 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-red-300">Secret Code</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(secret);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="block text-center text-white bg-red-900/30 p-2 rounded font-mono text-sm">
                {secret}
              </code>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-red-300">
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="bg-red-900/20 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-red-300">Backup Codes</span>
                <button
                  onClick={copyBackupCodes}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  {copiedBackupCodes ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copiedBackupCodes ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <code
                    key={i}
                    className="text-center text-white bg-red-900/30 p-1 rounded font-mono text-sm"
                  >
                    {code}
                  </code>
                ))}
              </div>
              <p className="mt-2 text-xs text-red-400">
                Save these backup codes in a secure place. You can use them to access your account if you lose your authenticator device.
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
                disabled={isLoading || !verificationCode}
                className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Enable 2FA'}
              </button>
              <button
                onClick={onCancel}
                className="w-full text-red-400 hover:text-red-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0a0505] w-full max-w-md rounded-lg shadow-lg border border-red-500/20 p-6">
        {renderStep()}
      </div>
    </div>
  );
}
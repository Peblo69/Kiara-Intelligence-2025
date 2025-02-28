import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { adminService } from '../lib/admin';
import { AdminDashboard } from './admin/AdminDashboard';
import { is2FAEnabled, disable2FA } from '../lib/auth';
import { User, CreditCard, Shield, Settings, Palette, LifeBuoy, X, Download, AlertTriangle, FileText, Menu } from 'lucide-react';
import { TwoFactorSetup } from './TwoFactorSetup';
import { TwoFactorVerify } from './TwoFactorVerify';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ isOpen, title, message, confirmText, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0a0505] w-full max-w-md rounded-lg shadow-lg border border-red-500/20 p-6">
        <h3 className="text-xl font-semibold mb-4 text-white">{title}</h3>
        <p className="text-red-200 mb-6">{message}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-white hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FAQDialogProps {
  isOpen: boolean;
  question: string;
  answer: string;
  onClose: () => void;
}

function FAQDialog({ isOpen, question, answer, onClose }: FAQDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0a0505] w-full max-w-md rounded-lg shadow-lg border border-red-500/20 p-6">
        <h3 className="text-xl font-semibold mb-4 text-white">{question}</h3>
        <p className="text-red-200 mb-6">{answer}</p>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

interface PrivacyPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

function PrivacyPolicy({ isOpen, onClose }: PrivacyPolicyProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0a0505] w-full max-w-4xl max-h-[80vh] rounded-lg shadow-lg border border-red-500/20 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-red-500/20">
            <div className="flex items-center gap-4">
              <div className="infinity-logo w-12 h-12"></div>
              <h2 className="text-2xl font-bold title-gradient">Kiara Intelligence Privacy Policy</h2>
            </div>
            <button
              onClick={onClose}
              className="text-red-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 text-red-200/90">
            <section>
              <h3 className="text-xl font-semibold text-white mb-4">1. Introduction</h3>
              <p className="leading-relaxed">
                We at Kiara Intelligence ("we", "our", "us") are committed to protecting your privacy and ensuring the security of any personal information you provide when using our website and services ("Services"). This Privacy Policy explains how we collect, use, and safeguard your Personal Data. By using our Services, you agree to the terms set forth in this Privacy Policy.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-red-300 mb-2">Personal Data You Provide:</h4>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Account Information: When you create an account, we collect information such as your name, email address, and account credentials.</li>
                    <li>User Content: We collect the content you input into our Services (e.g., prompts, files, images) to generate responses from our AI models.</li>
                    <li>Communication Information: When you contact us via email or social media, we may collect your name, email address, and the content of your messages.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-red-300 mb-2">Information Collected Automatically:</h4>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Log Data: We automatically record details such as your IP address, browser type, pages visited, and the date/time of your access.</li>
                    <li>Usage Data: We track how you interact with our Services to improve our offerings.</li>
                    <li>Device Information: Information about the device you use may be collected to enhance your experience.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white mb-4">3. How We Use Your Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Providing, maintaining, and improving our Services.</li>
                <li>Personalizing your experience, including tailoring responses from our AI models.</li>
                <li>Communicating with you regarding your account, updates to our Services, and promotional offers.</li>
                <li>Analyzing usage trends to enhance our Services.</li>
                <li>Ensuring compliance with legal obligations and protecting the rights and safety of our users.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white mb-4">4. Data Retention</h3>
              <p className="leading-relaxed">
                We retain your Personal Data only for as long as necessary to provide our Services and for legitimate business purposes, such as resolving disputes or complying with legal obligations. For instance, temporary chat data may be stored for up to 30 days for troubleshooting and security purposes.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white mb-4">5. Your Rights</h3>
              <p className="leading-relaxed mb-4">
                Depending on your jurisdiction, you may have certain rights regarding your Personal Data, including:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The right to access, update, or correct your Personal Data.</li>
                <li>The right to request deletion of your Personal Data.</li>
                <li>The right to data portability.</li>
                <li>The right to restrict or object to the processing of your Personal Data.</li>
                <li>The right to withdraw your consent, where applicable.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white mb-4">6. Security</h3>
              <p className="leading-relaxed">
                We implement commercially reasonable technical, administrative, and organizational measures to protect your Personal Data from unauthorized access, disclosure, or misuse. However, no internet transmission or storage system is completely secure, so please exercise caution when sharing sensitive information.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white mb-4">7. Changes to This Privacy Policy</h3>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. When changes occur, we will post the updated version on our website along with the effective date. Your continued use of our Services after any modifications constitutes your acceptance of the updated policy.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Close button */}
      <div className="fixed top-4 right-4 z-[61]">
        <button
          onClick={() => setIsSettingsOpen(false)}
          className="p-2 rounded-lg hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    theme,
    setTheme,
    fontSize,
    setFontSize,
    notifications,
    setNotifications,
    activeSettingsTab,
    setActiveSettingsTab,
    userProfile,
    updateUserProfile,
    tokens,
    codeTheme,
    setCodeTheme,
    chats,
    deleteChat,
  } = useStore();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isFAQOpen, setIsFAQOpen] = useState(false);
  const [currentFAQ, setCurrentFAQ] = useState({ question: '', answer: '' });
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportStatus, setSupportStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [is2FASetup, setIs2FASetup] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [showTwoFactorVerify, setShowTwoFactorVerify] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const isAdmin = await adminService.checkAdminStatus();
      setIsAdmin(isAdmin);
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const check2FAStatus = async () => {
      const enabled = await is2FAEnabled();
      setIs2FASetup(enabled);
    };
    check2FAStatus();
  }, []);

  const handlePasswordChange = async () => {
    try {
      setPasswordError('');
      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match');
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError('Password must be at least 6 characters');
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordChangeOpen(false);
      alert('Password updated successfully');
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to update password');
    }
  };

  const handleSupportMessage = async () => {
    if (!supportMessage.trim()) return;
    try {
      const message = supportMessage; // Store message before clearing
      setSupportStatus('sending');
      setSupportMessage(''); // Clear message immediately

      const { error } = await supabase
        .from('support_messages')
        .insert({
          user_id: userProfile.id,
          message,
          status: 'pending',
        });

      if (error) throw error;

      setSupportStatus('success');
      setTimeout(() => setSupportStatus('idle'), 3000);
    } catch (error) {
      console.error('Error sending support message:', error);
      setSupportStatus('error');
      setSupportMessage(supportMessage); // Restore message on error
      setTimeout(() => setSupportStatus('idle'), 3000);
    }
  };

  const handleExportChats = async () => {
    const chatData = chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      messages: chat.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    }));
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiara-chats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearData = async () => {
    setIsConfirmOpen(true);
  };

  const confirmClearData = async () => {
    try {
      for (const chat of chats) {
        await deleteChat(chat.id);
      }
      setIsConfirmOpen(false);
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  };

  const showFAQ = (question: string, answer: string) => {
    setCurrentFAQ({ question, answer });
    setIsFAQOpen(true);
  };

  if (!isSettingsOpen) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'app', label: 'App Settings', icon: Settings },
    { id: 'personalization', label: 'Personalization', icon: Palette },
    { id: 'support', label: 'Support', icon: LifeBuoy },
  ] as const;

  const renderPasswordChangeModal = () => {
    if (!isPasswordChangeOpen) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[#0a0505] w-full max-w-md rounded-lg shadow-lg border border-red-500/20 p-6">
          <h3 className="text-xl font-semibold mb-4 text-white">Change Password</h3>
          {passwordError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {passwordError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-red-300 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-white"
              />
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setIsPasswordChangeOpen(false)}
                className="px-4 py-2 text-white hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleImageUpload = async (file: File) => {
    try {
      setIsUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user profile
      await updateUserProfile({ avatarUrl: publicUrl });

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;

    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeSettingsTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="relative group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <div 
                  className="w-20 h-20 rounded-full overflow-hidden cursor-pointer group-hover:opacity-90 transition-opacity"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {userProfile.avatarUrl ? (
                    <img 
                      src={userProfile.avatarUrl} 
                      alt={userProfile.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-red-900/30 border-2 border-red-500/30 flex items-center justify-center text-2xl text-red-300">
                      {userProfile.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <span className="text-white text-sm">Change</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white cursor-pointer hover:text-red-300 transition-colors">
                  {userProfile.displayName}
                </h3>
                <p className="text-red-300">{userProfile.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-red-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={userProfile.displayName}
                  onChange={(e) => updateUserProfile({ displayName: e.target.value })}
                  className="w-full px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-300 mb-1">Email</label>
                <input
                  type="email"
                  value={userProfile.email}
                  disabled
                  className="w-full px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-white opacity-50 cursor-not-allowed"
                />
              </div>
            </div>
            <div className="border-t border-red-500/20 pt-6">
              <h4 className="text-sm font-medium text-red-300 mb-4">Account Statistics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-900/20 p-4 rounded-lg">
                  <div className="text-sm text-red-300">Tokens Used</div>
                  <div className="text-2xl font-semibold text-white">{userProfile.tokensUsed}</div>
                </div>
                <div className="bg-red-900/20 p-4 rounded-lg">
                  <div className="text-sm text-red-300">Tokens Available</div>
                  <div className="text-2xl font-semibold text-white">{tokens}</div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'subscription':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 p-6 rounded-lg border border-red-500/30">
              <h3 className="text-lg font-semibold text-white mb-2">Current Plan</h3>
              <div className="text-red-300 capitalize">{userProfile.activeSubscription || 'Free'}</div>
            </div>
            <div className="grid gap-4">
              <div className="bg-red-900/20 p-6 rounded-lg border border-red-500/30">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-white">Starter Plan</h4>
                  <div className="text-red-300">Free</div>
                </div>
                <ul className="list-disc pl-6 space-y-2 text-red-300 text-sm mb-4">
                  <li>• 40 tokens per day</li>
                  <li>• Standard response time</li>
                  <li>• Limited access to new features</li>
                </ul>
                {userProfile.activeSubscription === 'free' ? (
                  <div className="text-red-400 text-sm">Current Plan</div>
                ) : (
                  <button className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors">
                    Downgrade to Free
                  </button>
                )}
              </div>
              <div className="bg-red-900/20 p-6 rounded-lg border border-red-500/30">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-white">Plus Plan</h4>
                  <div className="text-red-300">$19.99/month</div>
                </div>
                <ul className="list-disc pl-6 space-y-2 text-red-300 text-sm mb-4">
                  <li>• 1500 tokens per month</li>
                  <li>• Priority support</li>
                  <li>• Advanced features</li>
                </ul>
                {userProfile.activeSubscription === 'plus' ? (
                  <div className="text-red-400 text-sm">Current Plan</div>
                ) : (
                  <a 
                    href="https://buy.stripe.com/bIY3er1vXaWy4y46oq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors text-center"
                  >
                    Upgrade to Plus
                  </a>
                )}
              </div>
              <div className="bg-red-900/20 p-6 rounded-lg border border-red-500/30">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-white">Infinity Plan</h4>
                  <div className="text-red-300">$49.99/month</div>
                </div>
                <ul className="list-disc pl-6 space-y-2 text-red-300 text-sm mb-4">
                  <li>• 4300 tokens per month</li>
                  <li>• Priority support</li>
                  <li>• All advanced features</li>
                </ul>
                {userProfile.activeSubscription === 'infinity' ? (
                  <div className="text-red-400 text-sm">Current Plan</div>
                ) : (
                  <a 
                    href="https://buy.stripe.com/fZe4ivcaB1lY3u0eUY"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors text-center"
                  >
                    Upgrade to Infinity
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Security Settings</h3>
              <div className="space-y-4">
                <button 
                  onClick={() => setIsPasswordChangeOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-white"
                >
                  <span>Change Password</span>
                  <Shield className="w-5 h-5 text-red-400" />
                </button>
                <button 
                  onClick={() => is2FASetup ? setShowTwoFactorVerify(true) : setShowTwoFactorSetup(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-white"
                >
                  <div>
                    <span>Two-Factor Authentication</span>
                    {is2FASetup && (
                      <span className="ml-2 text-xs text-red-400">Enabled</span>
                    )}
                  </div>
                  <Shield className="w-5 h-5 text-red-400" />
                </button>
                {is2FASetup && (
                  <button
                    onClick={async () => {
                      try {
                        await disable2FA();
                        setIs2FASetup(false);
                      } catch (error) {
                        console.error('Error disabling 2FA:', error);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
                  >
                    <span>Disable Two-Factor Authentication</span>
                    <Shield className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <div className="border-t border-red-500/20 pt-6">
              <h4 className="text-sm font-medium text-red-300 mb-4">Active Sessions</h4>
              <div className="bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white">Current Session</div>
                    <div className="text-sm text-red-300">Last active: Just now</div>
                  </div>
                  <button className="text-red-400 hover:text-red-300 transition-colors">
                    End Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'app':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Application Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-red-300">Auto-save chats</span>
                  <button className="w-12 h-6 bg-red-900/50 rounded-full p-1 cursor-pointer">
                    <div className="w-4 h-4 bg-red-400 rounded-full transform translate-x-6"></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-red-300">Desktop notifications</span>
                  <button className="w-12 h-6 bg-red-900/50 rounded-full p-1 cursor-pointer">
                    <div className="w-4 h-4 bg-red-400 rounded-full"></div>
                  </button>
                </div>
              </div>
            </div>
            <div className="border-t border-red-500/20 pt-6">
              <h4 className="text-sm font-medium text-red-300 mb-4">Data Management</h4>
              <div className="space-y-2">
                <button 
                  onClick={handleExportChats}
                  className="w-full flex items-center justify-between px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-white"
                >
                  <span>Export Chat History</span>
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleClearData}
                  className="w-full flex items-center justify-between px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
                >
                  <span>Clear All Data</span>
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      case 'personalization':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Code Theme</h3>
              <div className="grid grid-cols-2 gap-4">
                {['dark', 'light'].map((themeOption) => (
                  <button
                    key={themeOption}
                    onClick={() => setTheme(themeOption as 'dark' | 'light')}
                    className={`w-full flex items-center space-x-2 p-2 rounded-lg border ${
                      theme === themeOption ? 'border-red-500' : 'border-red-500/30'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full ${themeOption === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'}`}></div>
                    <span className="text-red-300 capitalize">{themeOption}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-red-500/20 pt-6">
              <h4 className="text-sm font-medium text-red-300 mb-4">Chat Display</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-red-300 mb-2">Message Density</label>
                  <label className="block text-sm text-red-300 mb-2">Font Size</label>
                  <input 
                    type="range" 
                    min="12" 
                    max="20" 
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-red-500" 
                  />
                  <div className="text-center mt-2 text-red-300">{fontSize}px</div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'support':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Help & Support</h3>
              <div className="space-y-4">
                <div className="bg-red-900/20 p-4 rounded-lg">
                  <h4 className="text-white font-medium mb-2">Contact Support</h4>
                  <p className="text-red-300 text-sm mb-4">
                    Having issues? Our support team is here to help.
                  </p>
                  <textarea
                    placeholder="Describe your issue..."
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    className="w-full h-32 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-white resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  ></textarea>
                  <button 
                    onClick={handleSupportMessage}
                    disabled={supportStatus === 'sending'}
                    className={`mt-2 w-full py-2 rounded-lg transition-colors disabled:opacity-50 ${
                      supportStatus === 'success'
                        ? 'bg-green-600 hover:bg-green-700'
                        : supportStatus === 'error'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {supportStatus === 'sending'
                      ? 'Sending...'
                      : supportStatus === 'success'
                      ? '✓ Message Sent Successfully!'
                      : supportStatus === 'error'
                      ? 'Failed to Send'
                      : 'Submit'}
                  </button>
                  {supportStatus === 'success' && (
                    <p className="mt-2 text-sm text-green-500 text-center">
                      Thank you for your message. Our support team will respond shortly.
                    </p>
                  )}
                  {supportStatus === 'error' && (
                    <p className="mt-2 text-sm text-red-500 text-center">
                      Failed to send message. Please try again.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full h-full md:h-[600px] md:max-w-[1000px] bg-[#0a0505] md:rounded-xl shadow-2xl border border-red-500/20 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile menu button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden fixed top-4 left-4 z-[61] p-2 rounded-lg bg-black/20 backdrop-blur-sm text-white hover:bg-black/30 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed md:relative inset-y-0 left-0 z-50 w-64 bg-[#050202] border-r border-red-900/20
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}>
          {/* Header */}
          <div className="p-4 border-b border-red-900/20">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-red-500" />
              Settings
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex-1 p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  activeSettingsTab === tab.id
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                    : 'text-gray-400 hover:bg-red-900/20 hover:text-red-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:ml-0 pt-16 md:pt-0">
          {/* Content Header */}
          <div className="p-4 border-b border-red-900/20 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">
              {tabs.find(t => t.id === activeSettingsTab)?.label}
            </h3>
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="p-2 rounded-lg hover:bg-red-900/20 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
      {renderPasswordChangeModal()}
      <ConfirmDialog 
        isOpen={isConfirmOpen}
        title="Clear All Data"
        message="Are you sure you want to clear all your chat data? This action cannot be undone."
        confirmText="Clear Data"
        onConfirm={confirmClearData}
        onCancel={() => setIsConfirmOpen(false)}
      />
      <FAQDialog 
        isOpen={isFAQOpen}
        question={currentFAQ.question}
        answer={currentFAQ.answer}
        onClose={() => setIsFAQOpen(false)}
      />
      <PrivacyPolicy 
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />
    </div>
  );
}

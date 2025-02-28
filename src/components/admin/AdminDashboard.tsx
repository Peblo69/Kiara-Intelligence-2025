import React, { useState, useEffect } from 'react';
import { adminService, UserDetails } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { Search, Users, Settings, Activity, CreditCard, Shield, ArrowLeft } from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Set up real-time subscriptions
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const users = await adminService.searchUsers('', 20, 0);
        const logs = await adminService.getAuditLogs(50, 0);
        setUsers(users);
        setAuditLogs(logs);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Subscribe to users table changes
    const usersSubscription = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        async (payload) => {
          // Reload users data when changes occur
          const updatedUsers = await adminService.searchUsers('', 20, 0);
          setUsers(updatedUsers);

          // If we have a selected user that was updated, refresh their details
          if (selectedUser && payload.new.id === selectedUser.user.id) {
            const details = await adminService.getUserDetails(payload.new.id);
            setSelectedUser(details);
          }
        }
      )
      .subscribe();

    // Subscribe to audit logs
    const logsSubscription = supabase
      .channel('audit-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_audit_logs'
        },
        async () => {
          // Reload audit logs when new entries are added
          const updatedLogs = await adminService.getAuditLogs(50, 0);
          setAuditLogs(updatedLogs);
        }
      )
      .subscribe();

    return () => {
      usersSubscription.unsubscribe();
      logsSubscription.unsubscribe();
    };
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const results = await adminService.searchUsers(searchQuery);
      setUsers(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = async (userId: string) => {
    setIsLoading(true);
    try {
      const details = await adminService.getUserDetails(userId);
      setSelectedUser(details);
    } catch (error) {
      console.error('Error getting user details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTokens = async (userId: string, tokens: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_update_user_tokens', {
        p_user_id: userId,
        p_tokens: tokens
      });

      if (error) {
        throw error;
      }

      // Refresh user details after token update
      const details = await adminService.getUserDetails(userId);
      setSelectedUser(details);

    } catch (error) {
      console.error('Error updating tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderUserDetails = () => {
    if (!selectedUser) return null;

    const tokenHistory = selectedUser.token_history?.map((tx: any) => ({
      date: new Date(tx.date).toLocaleString(),
      amount: tx.amount,
      reason: tx.reason,
      balance: tx.running_balance
    })) || [];

    return (
      <div className="bg-red-900/10 rounded-lg p-6 border border-red-500/20">
        <h3 className="text-xl font-semibold text-red-300 mb-4">
          User Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-red-400">Email</label>
            <p className="text-white">{selectedUser.user.email}</p>
          </div>
          <div>
            <label className="text-sm text-red-400">Display Name</label>
            <p className="text-white">{selectedUser.user.display_name}</p>
          </div>
          <div>
            <label className="text-sm text-red-400">Tokens</label>
            <div className="flex items-center gap-2">
              <p className="text-white">{selectedUser.user.tokens_used || 0}</p>
              <button
                onClick={() => handleUpdateTokens(selectedUser.user.id, selectedUser.user.tokens_used + 100)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Add 100
              </button>
            </div>
            {tokenHistory.length > 0 && (
              <div className="mt-4">
                <label className="text-sm text-red-400">Token History</label>
                <div className="mt-2 space-y-2">
                  {tokenHistory.map((tx: any, i: number) => (
                    <div key={i} className="text-sm flex justify-between items-center">
                      <span className="text-red-300">{tx.date}</span>
                      <span className={`${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount}
                      </span>
                      <span className="text-white">{tx.balance}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-red-400">Subscription</label>
            <p className="text-white capitalize">{selectedUser.user.active_subscription || 'None'}</p>
          </div>
          {selectedUser.subscription && (
            <div>
              <label className="text-sm text-red-400">Subscription Details</label>
              <div className="text-white">
                <p>Status: {selectedUser.subscription.status}</p>
                <p>Expires: {new Date(selectedUser.subscription.period_end).toLocaleDateString()}</p>
              </div>
            </div>
          )}
          {selectedUser.chats && (
            <div>
              <label className="text-sm text-red-400">Chat Statistics</label>
              <p className="text-white">Total Chats: {selectedUser.chats.total_count}</p>
              {selectedUser.chats.recent.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-red-400">Recent Chats:</p>
                  <div className="space-y-2 mt-2">
                    {selectedUser.chats.recent.map(chat => (
                      <div key={chat.id} className="text-sm text-white">
                        {chat.title} ({chat.message_count} messages)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return (
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search users..."
                    className="w-full px-4 py-2 bg-red-900/10 border border-red-500/20 rounded-lg text-white placeholder-red-300/50"
                  />
                  <button
                    onClick={handleSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user.id)}
                    className="w-full text-left p-4 bg-red-900/10 border border-red-500/20 rounded-lg hover:bg-red-900/20"
                  >
                    <div className="text-white font-medium">{user.display_name}</div>
                    <div className="text-sm text-red-400">{user.email}</div>
                  </button>
                ))}
              </div>

              <div>
                {renderUserDetails()}
              </div>
            </div>
          </div>
        );

      case 'audit':
        return (
          <div className="space-y-4">
            {auditLogs.map(log => (
              <div
                key={log.id}
                className="p-4 bg-red-900/10 border border-red-500/20 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-red-400">{log.action}</span>
                  <span className="text-sm text-red-300">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 text-sm text-white">
                  <p>Table: {log.target_table}</p>
                  {log.old_data && (
                    <pre className="mt-2 text-xs bg-black/30 p-2 rounded">
                      {JSON.stringify(log.old_data, null, 2)}
                    </pre>
                  )}
                  {log.new_data && (
                    <pre className="mt-2 text-xs bg-black/30 p-2 rounded">
                      {JSON.stringify(log.new_data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0a0505]">
      {/* Sidebar */}
      <div className="w-64 border-r border-red-900/20 bg-[#050202] flex flex-col">
        {/* Header with back button */}
        <div className="p-4 border-b border-red-900/20">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Chat</span>
          </button>
          <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-bold text-white">Admin Panel</h2>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'users' 
                ? 'bg-red-900/30 text-red-300' 
                : 'text-gray-400 hover:bg-red-900/20 hover:text-red-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'audit'
                ? 'bg-red-900/30 text-red-300'
                : 'text-gray-400 hover:bg-red-900/20 hover:text-red-300'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Audit Log</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'payments'
                ? 'bg-red-900/30 text-red-300'
                : 'text-gray-400 hover:bg-red-900/20 hover:text-red-300'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payments</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-red-900/30 text-red-300'
                : 'text-gray-400 hover:bg-red-900/20 hover:text-red-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
}
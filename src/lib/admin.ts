import { supabase } from './supabase';
import { safeSupabaseOperation } from './supabase';

export interface AdminUser {
  id: string;
  role: 'super_admin' | 'admin' | 'support';
  permissions: Record<string, boolean>;
}

export interface UserDetails {
  user: {
    id: string;
    email: string;
    display_name: string;
    tokens_used: number;
    active_subscription: string;
    created_at: string;
  };
  subscription?: {
    tier: string;
    status: string;
    period_end: string;
  };
  payments?: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  chats?: {
    total_count: number;
    recent: Array<{
      id: string;
      title: string;
      model: string;
      message_count: number;
      created_at: string;
    }>;
  };
}

class AdminService {
  private static instance: AdminService;
  private currentAdmin: AdminUser | null = null;

  private constructor() {}

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  public async getAdminStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalChats: number;
    totalTokensUsed: number;
  }> {
    return safeSupabaseOperation(
      async () => {
        const { data, error } = await supabase.rpc('get_admin_stats');
        if (error) throw error;
        return data || {
          totalUsers: 0,
          activeUsers: 0,
          totalChats: 0,
          totalTokensUsed: 0
        };
      },
      {
        totalUsers: 0,
        activeUsers: 0,
        totalChats: 0,
        totalTokensUsed: 0
      },
      'Error getting admin stats'
    );
  }

  public async getUserSubscriptionDetails(userId: string): Promise<{
    tier: string;
    status: string;
    periodEnd: string;
    features: Record<string, any>;
  }> {
    return safeSupabaseOperation(
      async () => {
        const { data, error } = await supabase.rpc('check_subscription_status', {
          p_user_id: userId
        });
        if (error) throw error;
        return data;
      },
      {
        tier: 'free',
        status: 'inactive',
        periodEnd: new Date().toISOString(),
        features: {}
      },
      'Failed to get subscription details'
    );
  }

  public async updateUserSubscription(
    userId: string,
    tier: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('admin_update_subscription', {
        p_user_id: userId,
        p_tier: tier
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  public async banUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('admin_ban_user', {
        p_user_id: userId
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error banning user:', error);
      throw new Error('Failed to ban user');
    }
  }

  public async unbanUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('admin_unban_user', {
        p_user_id: userId
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error unbanning user:', error);
      throw new Error('Failed to unban user');
    }
  }

  public async checkAdminStatus(): Promise<boolean> {
    return safeSupabaseOperation(
      async () => {
        // First check if we're online
        if (!navigator.onLine) {
          console.log('❌ Offline, cannot check admin status');
          return false;
        }
        
        const { data, error } = await supabase.rpc('is_admin');
        if (error) throw error;
        return data || false;
      },
      false,
      'Error checking admin status'
    );
  }

  public async loadAdminUser(): Promise<AdminUser | null> {
    return safeSupabaseOperation(
      async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: admin, error } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        if (!admin) return null;

        this.currentAdmin = admin;
        return admin;
      },
      null,
      'Error loading admin user'
    );
  }

  public async checkPermission(permission: string): Promise<boolean> {
    return safeSupabaseOperation(
      async () => {
        const { data, error } = await supabase.rpc('check_admin_permission', {
          permission
        });
        if (error) throw error;
        return data || false;
      },
      false,
      'Error checking permission'
    );
  }

  public async getUserDetails(userId: string): Promise<UserDetails | null> {
    return safeSupabaseOperation(
      async () => {
        const { data, error } = await supabase.rpc('admin_get_user_details', {
          p_user_id: userId
        });
        if (error) throw error;
        return data;
      },
      null,
      'Error getting user details'
    );
  }

  public async searchUsers(query: string, limit = 20, offset = 0): Promise<any[]> {
    return safeSupabaseOperation(
      async () => {
        const { data, error } = await supabase.rpc('admin_search_users', {
          p_query: query,
          p_limit: limit,
          p_offset: offset
        });
        if (error) throw error;
        return data || [];
      },
      [],
      'Error searching users'
    );
  }

  public async updateUserTokens(userId: string, tokens: number): Promise<boolean> {
    return safeSupabaseOperation(
      async () => {
        const { data, error } = await supabase.rpc('admin_update_user_tokens', {
          p_user_id: userId,
          p_tokens: tokens
        });
        if (error) throw error;
        return data.success;
      },
      false,
      'Error updating user tokens'
    );
  }

  public async getAuditLogs(limit = 50, offset = 0): Promise<any[]> {
    return safeSupabaseOperation(
      async () => {
        console.log('🔍 DEBUG: Getting audit logs:', { limit, offset });

        // First check if user has admin access
        const isAdmin = await this.checkAdminStatus();
        if (!isAdmin) {
          console.error('❌ DEBUG: User does not have admin access');
          return [];
        }

        const { data, error } = await supabase.rpc('get_audit_logs', {
          p_limit: limit,
          p_offset: offset
        });

        if (error) throw error;
        
        console.log('✅ DEBUG: Successfully retrieved audit logs:', data?.length || 0);
        return data || [];
      },
      [],
      'Error getting audit logs'
    );
  }

  public async getAuditLogSummary(days = 30): Promise<any> {
    return safeSupabaseOperation(
      async () => {
        console.log('🔍 DEBUG: Getting audit log summary');

        const { data, error } = await supabase.rpc('get_audit_log_summary', {
          p_days: days
        });

        if (error) throw error;
        return data;
      },
      null,
      'Error getting audit log summary'
    );
  }

  public isAdmin(): boolean {
    return !!this.currentAdmin;
  }

  public isSuperAdmin(): boolean {
    return this.currentAdmin?.role === 'super_admin';
  }

  public hasPermission(permission: string): boolean {
    if (this.isSuperAdmin()) return true;
    return !!this.currentAdmin?.permissions[permission];
  }
}

export const adminService = AdminService.getInstance();
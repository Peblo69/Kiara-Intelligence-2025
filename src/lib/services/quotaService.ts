import { supabase } from '../supabase';

export class QuotaService {
  static async getUserQuota(userId: string) {
    try {
      const { data, error } = await supabase
        .from('quotas')
        .select()
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Initialize free tier quota
        const defaultQuota = {
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
        };
        
        const { error: insertError } = await supabase
          .from('quotas')
          .insert(defaultQuota);

        if (insertError) throw insertError;
        return defaultQuota;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting quota:', error);
      throw new Error('Failed to fetch quota');
    }
  }

  static async checkAndUpdateQuota(userId: string, tokensToUse: number): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_and_update_quota', {
        p_user_id: userId,
        p_tokens_to_use: tokensToUse
      });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking quota:', error);
      throw new Error('Failed to check quota');
    }
  }
}
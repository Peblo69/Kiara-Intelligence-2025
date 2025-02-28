import { supabase } from '../supabase';

export class AnalyticsService {
  static async trackEvent(
    userId: string,
    chatId: string,
    type: 'chat' | 'vision' | 'memory',
    metrics: {
      tokensUsed: number;
      responseTime: number;
      promptLength: number;
      completionLength: number;
      modelUsed: string;
    }
  ) {
    try {
      const { error } = await supabase
        .from('analytics')
        .insert({
          user_id: userId,
          chat_id: chatId,
          type,
          metrics,
          metadata: {}
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error tracking analytics:', error);
    }
  }

  static async getUserAnalytics(userId: string, type?: string) {
    try {
      let query = supabase
        .from('analytics')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw new Error('Failed to fetch analytics');
    }
  }
}
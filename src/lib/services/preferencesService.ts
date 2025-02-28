import { supabase } from '../supabase';

export class PreferencesService {
  static async getUserPreferences(userId: string) {
    try {
      const { data, error } = await supabase
        .from('preferences')
        .select()
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Create default preferences
        const defaultPrefs = {
          user_id: userId,
          theme: 'system',
          font_size: 14,
          language: 'en',
          notifications: {
            email: true,
            push: true,
            desktop: true
          },
          ai_preferences: {
            defaultModel: 'dominator',
            temperature: 0.7,
            maxTokens: 2048
          }
        };
        
        const { error: insertError } = await supabase
          .from('preferences')
          .insert(defaultPrefs);

        if (insertError) throw insertError;
        return defaultPrefs;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting preferences:', error);
      throw new Error('Failed to fetch preferences');
    }
  }

  static async updatePreferences(userId: string, preferences: Partial<any>) {
    try {
      const { error } = await supabase
        .from('preferences')
        .update(preferences)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw new Error('Failed to update preferences');
    }
  }
}
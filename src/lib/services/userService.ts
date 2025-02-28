import { supabase } from '../supabase';
import { UserProfile } from '../../types';

export class UserService {
  static async createUserProfile(userId: string, email: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          display_name: email.split('@')[0]
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select()
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  static async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  static async incrementTokensUsed(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_tokens_used', {
        p_user_id: userId
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error incrementing tokens used:', error);
      throw new Error('Failed to update tokens used');
    }
  }
}
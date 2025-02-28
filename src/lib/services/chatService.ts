import { supabase, safeSupabaseOperation } from '../supabase';
import { Message } from '../../types';

export class ChatService {
  static async createChat(userId: string, title: string, model: 'dominator' | 'vision'): Promise<string> {
    try {
      console.log('🔍 DEBUG: Creating chat:', { userId, title, model });

      const { data, error } = await supabase
        .rpc('create_new_chat', {
          title,
          model
        });

      if (error) {
        console.error('❌ DEBUG: Error creating chat:', error);
        throw error;
      }

      console.log('✅ DEBUG: Chat created:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ DEBUG: Error in createChat:', error);
      throw new Error('Failed to create chat');
    }
  }

  static async getChats(userId: string): Promise<any[]> {
    return safeSupabaseOperation(
      async () => {
        console.log('🔍 DEBUG: Getting chats for user:', userId);

        // Check auth session first
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
          throw new Error('Not authenticated');
        }

        const { data, error } = await supabase
          .from('chats')
          .select(`
            id,
            title,
            model,
            last_message,
            message_count,
            created_at,
            updated_at
          `)
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('❌ DEBUG: Error getting chats:', error);
          throw error;
        }

        console.log('✅ DEBUG: Retrieved chats:', data.length);
        return data;
      },
      [], // Empty array as fallback if operation fails
      'Error getting chats'
    );
  }

  static async updateChatTitle(chatId: string, title: string): Promise<void> {
    try {
      console.log('🔍 DEBUG: Updating chat title:', { chatId, title });

      // Check auth session first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('chats')
        .update({ title })
        .eq('id', chatId);

      if (error) {
        console.error('❌ DEBUG: Error updating chat title:', error);
        throw error;
      }

      console.log('✅ DEBUG: Chat title updated');
    } catch (error) {
      console.error('❌ DEBUG: Error in updateChatTitle:', error);
      throw error;
    }
  }

  static async deleteChat(chatId: string): Promise<void> {
    try {
      console.log('🔍 DEBUG: Deleting chat:', chatId);

      // Check auth session first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);

      if (error) {
        console.error('❌ DEBUG: Error deleting chat:', error);
        throw error;
      }

      console.log('✅ DEBUG: Chat deleted');
    } catch (error) {
      console.error('❌ DEBUG: Error in deleteChat:', error);
      throw error;
    }
  }

  static async addMessage(chatId: string, userId: string, message: Message): Promise<string> {
    try {
      console.log('🔍 DEBUG: Adding message:', { chatId, userId });

      // Check auth session first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .rpc('add_message', {
          chat_id: chatId,
          content: message.content,
          role: message.role,
          is_streaming: message.isStreaming || false,
          error: message.error || false
        });

      if (error) {
        console.error('❌ DEBUG: Error adding message:', error);
        throw error;
      }

      console.log('✅ DEBUG: Message added:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ DEBUG: Error in addMessage:', error);
      throw error;
    }
  }

  static async getMessages(chatId: string, userId: string): Promise<Message[]> {
    return safeSupabaseOperation(
      async () => {
        console.log('🔍 DEBUG: Getting messages:', { chatId, userId });

        // Check auth session first
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
          throw new Error('Not authenticated');
        }

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('❌ DEBUG: Error getting messages:', error);
          throw error;
        }

        if (!data) {
          console.log('🔍 DEBUG: No messages found');
          return [];
        }

        console.log('✅ DEBUG: Retrieved messages:', data.length);
        return data.map(msg => ({
          id: msg.id,
          content: msg.content || '',
          role: msg.role,
          isStreaming: msg.is_streaming,
          error: msg.error,
          timestamp: new Date(msg.created_at)
        }));
      },
      [], // Empty array as fallback if operation fails
      'Error getting messages'
    );
  }

  static async updateMessageStreamingState(messageId: string, content: string, isStreaming: boolean): Promise<void> {
    try {
      console.log('🔍 DEBUG: Updating message streaming state:', { messageId, isStreaming });

      // Check auth session first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .rpc('update_message_streaming_state', {
          p_message_id: messageId,
          p_is_streaming: isStreaming,
          p_content: content
        });

      if (error) {
        console.error('❌ DEBUG: Error updating message streaming state:', error);
        throw error;
      }

      console.log('✅ DEBUG: Message streaming state updated');
    } catch (error) {
      console.error('❌ DEBUG: Error in updateMessageStreamingState:', error);
      throw error;
    }
  }
}
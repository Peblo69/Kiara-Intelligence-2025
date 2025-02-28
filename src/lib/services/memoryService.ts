import { supabase, safeSupabaseOperation } from '../supabase';
import type { Memory } from '../../types';

export class MemoryService {
  static async initializeMemoryStore(userId: string): Promise<void> {
    try {
      console.log('🔍 DEBUG: Initializing memory store for user:', userId);

      // Check if memory store exists
      const { data: store, error: selectError } = await supabase
        .from('memory_stores')
        .select()
        .eq('user_id', userId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('❌ DEBUG: Error checking memory store:', selectError);
        throw selectError;
      }

      if (!store) {
        console.log('🔍 DEBUG: Creating new memory store');

        // Create memory store using direct update instead of increment_counter
        const { error: insertError } = await supabase
          .from('memory_stores')
          .insert({
            user_id: userId,
            memory_count: 0,
            last_processed: new Date().toISOString()
          });

        if (insertError) {
          console.error('❌ DEBUG: Error creating memory store:', insertError);
          throw insertError;
        }

        // Create initial system memory
        await this.addMemory({
          userId,
          chatId: null,
          content: 'User preferences and context will be stored here',
          type: 'context',
          category: 'system',
          confidence: 1.0,
          source: 'system',
          isActive: true,
          memoryContext: {
            timestamp: new Date().toISOString(),
            system: true
          }
        });
      }

      console.log('✅ DEBUG: Memory store initialization complete');
    } catch (error) {
      console.error('❌ DEBUG: Error in initializeMemoryStore:', error);
    }
  }

  static async addMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('🔍 DEBUG: Adding memory:', memory);

      // Check for duplicate memories to avoid clutter
      const { data: existingMemories, error: checkError } = await supabase
        .from('memories')
        .select('id, content, confidence')
        .eq('user_id', memory.userId)
        .eq('is_active', true)
        .ilike('content', memory.content)
        .limit(1);

      if (checkError) {
        console.error('❌ DEBUG: Error checking for duplicate memories:', checkError);
      }

      if (existingMemories && existingMemories.length > 0) {
        const existingMemory = existingMemories[0];
        
        if (memory.confidence > existingMemory.confidence) {
          const { data: updatedMemory, error: updateError } = await supabase
            .from('memories')
            .update({
              confidence: memory.confidence,
              updated_at: new Date().toISOString(),
              memory_context: memory.memoryContext || {}
            })
            .eq('id', existingMemory.id)
            .select()
            .single();

          if (updateError) {
            console.error('❌ DEBUG: Error updating existing memory:', updateError);
            throw updateError;
          }

          console.log('✅ DEBUG: Updated existing memory with higher confidence');
          return updatedMemory.id;
        }

        console.log('✅ DEBUG: Similar memory already exists with higher confidence, skipping');
        return existingMemory.id;
      }

      // Use the add_memory RPC function which will safely update memory_store
      const { data, error } = await supabase.rpc('add_memory', {
        content: memory.content,
        type: memory.type,
        category: memory.category || null,
        confidence: memory.confidence,
        source: memory.source,
        chat_id: memory.chatId,
        metadata: memory.memoryContext || {}
      });

      if (error) {
        console.error('❌ DEBUG: Error adding memory:', error);

        // Fallback - direct insert without memory store update
        const { data: insertData, error: insertError } = await supabase
          .from('memories')
          .insert({
            user_id: memory.userId,
            chat_id: memory.chatId,
            content: memory.content,
            type: memory.type,
            category: memory.category,
            confidence: memory.confidence,
            source: memory.source,
            is_active: memory.isActive,
            metadata: {},
            memory_context: memory.memoryContext || {}
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        return insertData.id;
      }

      console.log('✅ DEBUG: Memory added successfully');
      return data.id;
    } catch (error) {
      console.error('❌ DEBUG: Error in addMemory:', error);
      throw new Error('Failed to add memory');
    }
  }

  static async getMemories(
    userId: string,
    options?: {
      type?: Memory['type'];
      category?: string;
      chatId?: string;
      confidence?: number;
      limit?: number;
    }
  ): Promise<Memory[]> {
    return safeSupabaseOperation(
      async () => {
        console.log('🔍 DEBUG: Getting memories:', { userId, options });

        let query = supabase
          .from('memories')
          .select()
          .eq('user_id', userId)
          .eq('is_active', true);

        if (options?.type) {
          query = query.eq('type', options.type);
        }
        if (options?.category) {
          query = query.eq('category', options.category);
        }
        if (options?.chatId) {
          query = query.eq('chat_id', options.chatId);
        }
        if (options?.confidence) {
          query = query.gte('confidence', options.confidence);
        }
        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
          console.error('❌ DEBUG: Error retrieving memories:', error);
          throw error;
        }

        console.log('✅ DEBUG: Retrieved memories:', data.length);
        return data;
      },
      [],
      'Error retrieving memories'
    );
  }
}
import { supabase } from '../supabase';
import { personalityManager } from './personality-manager';

interface GlobalMemory {
  facts: Map<string, { content: string; confidence: number; timestamp: string }>;
  preferences: Map<string, { content: string; confidence: number; timestamp: string }>;
  context: Map<string, { content: string; confidence: number; timestamp: string }>;
}

interface Memory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'context';
  confidence: number;
  timestamp: string;
}

class MemoryManager {
  private static instance: MemoryManager;
  private memories: Map<string, Memory[]> = new Map();
  private shortTermMemory: Map<string, any[]> = new Map();
  private globalMemory: Map<string, GlobalMemory> = new Map();

  private constructor() {}

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  public async addMemory(
    userId: string,
    content: string,
    type: 'fact' | 'preference' | 'context',
    confidence: number = 0.8
  ): Promise<void> {
    try {
      // Initialize global memory for user if not exists
      if (!this.globalMemory.has(userId)) {
        this.globalMemory.set(userId, {
          facts: new Map(),
          preferences: new Map(),
          context: new Map()
        });
      }

      const userGlobalMemory = this.globalMemory.get(userId)!;

      // Add to database
      const { data, error } = await supabase
        .from('memories')
        .insert({
          user_id: userId,
          content,
          type,
          confidence,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local cache
      if (!this.memories.has(userId)) {
        this.memories.set(userId, []);
      }

      this.memories.get(userId)?.push({
        id: data.id,
        content,
        type,
        confidence,
        timestamp: new Date().toISOString()
      });

      // Update global memory
      if (type === 'fact') {
        // Handle name corrections
        const nameMatch = content.match(/User's name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
        if (nameMatch) {
          const name = nameMatch[1];
          userGlobalMemory.facts.set('name', {
            content: `User's name is ${name}`,
            confidence,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Store in appropriate global memory category
      const memoryMap = userGlobalMemory[type === 'fact' ? 'facts' : type === 'preference' ? 'preferences' : 'context'];
      const key = this.getMemoryKey(content);
      memoryMap.set(key, {
        content,
        confidence,
        timestamp: new Date().toISOString()
      });

      // Update personality traits based on memory
      personalityManager.getInstance().updateUserProfile(userId, {
        lastMemory: content,
        memoryType: type
      });

    } catch (error) {
      console.error('Error adding memory:', error);
    }
  }

  public getGlobalMemories(userId: string): GlobalMemory | null {
    return this.globalMemory.get(userId) || null;
  }

  public getUserName(userId: string): string | null {
    const globalMemory = this.globalMemory.get(userId);
    if (!globalMemory) return null;

    const nameFact = globalMemory.facts.get('name');
    if (!nameFact) return null;

    const match = nameFact.content.match(/User's name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
    return match ? match[1] : null;
  }

  public async getRelevantMemories(
    userId: string,
    context: string,
    limit: number = 5
  ): Promise<Memory[]> {
    try {
      // First check global memories
      const globalMemories = this.getGlobalMemories(userId);
      let memories: Memory[] = [];

      if (globalMemories) {
        // Add relevant global memories
        for (const [type, memoryMap] of Object.entries(globalMemories)) {
          for (const [_, memory] of memoryMap) {
            memories.push({
              id: `global-${Date.now()}`,
              content: memory.content,
              type: type as 'fact' | 'preference' | 'context',
              confidence: memory.confidence,
              timestamp: memory.timestamp
            });
          }
        }
      }

      // Then get database memories
      const { data, error } = await supabase.rpc('get_relevant_memories', {
        p_user_id: userId,
        p_content: context,
        p_limit: limit
      });

      if (error) throw error;
      
      // Combine and deduplicate memories
      memories = [...memories, ...(data || [])];
      return this.deduplicateMemories(memories);

    } catch (error) {
      console.error('Error getting relevant memories:', error);
      return [];
    }
  }

  private getMemoryKey(content: string): string {
    // Create a unique key based on content
    return content.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private deduplicateMemories(memories: Memory[]): Memory[] {
    const seen = new Set<string>();
    return memories.filter(memory => {
      const key = this.getMemoryKey(memory.content);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  public addToShortTermMemory(
    userId: string,
    content: any,
    duration: number = 1800000 // 30 minutes
  ): void {
    if (!this.shortTermMemory.has(userId)) {
      this.shortTermMemory.set(userId, []);
    }

    const memory = {
      content,
      expiry: Date.now() + duration
    };

    this.shortTermMemory.get(userId)?.push(memory);

    // Clean up expired memories
    this.cleanupShortTermMemory(userId);
  }

  public getShortTermMemories(userId: string): any[] {
    this.cleanupShortTermMemory(userId);
    return this.shortTermMemory.get(userId) || [];
  }

  private cleanupShortTermMemory(userId: string): void {
    const memories = this.shortTermMemory.get(userId);
    if (!memories) return;

    const now = Date.now();
    this.shortTermMemory.set(
      userId,
      memories.filter(m => m.expiry > now)
    );
  }

  public async updateMemoryConfidence(
    userId: string,
    memoryId: string,
    newConfidence: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('memories')
        .update({ confidence: newConfidence })
        .eq('id', memoryId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local cache
      const userMemories = this.memories.get(userId);
      if (userMemories) {
        const memory = userMemories.find(m => m.id === memoryId);
        if (memory) {
          memory.confidence = newConfidence;
        }
      }

    } catch (error) {
      console.error('Error updating memory confidence:', error);
    }
  }

  public async invalidateMemory(userId: string, memoryId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('memories')
        .update({ is_active: false })
        .eq('id', memoryId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local cache
      const userMemories = this.memories.get(userId);
      if (userMemories) {
        this.memories.set(
          userId,
          userMemories.filter(m => m.id !== memoryId)
        );
      }

    } catch (error) {
      console.error('Error invalidating memory:', error);
    }
  }

  public async consolidateMemories(userId: string): Promise<void> {
    try {
      const memories = this.memories.get(userId) || [];
      const shortTermMemories = this.getShortTermMemories(userId);

      // Group related memories
      const groups = new Map<string, Memory[]>();
      for (const memory of memories) {
        const key = this.getMemoryGroupKey(memory.content);
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)?.push(memory);
      }

      // Consolidate each group
      for (const [key, groupMemories] of groups) {
        if (groupMemories.length > 1) {
          // Find the memory with highest confidence
          const bestMemory = groupMemories.reduce((a, b) => 
            a.confidence > b.confidence ? a : b
          );

          // Invalidate others
          for (const memory of groupMemories) {
            if (memory.id !== bestMemory.id) {
              await this.invalidateMemory(userId, memory.id);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error consolidating memories:', error);
    }
  }

  private getMemoryGroupKey(content: string): string {
    // Simple grouping by first 3 words
    return content.toLowerCase().split(' ').slice(0, 3).join(' ');
  }
}

export const memoryManager = MemoryManager.getInstance();
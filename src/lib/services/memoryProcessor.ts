import { MemoryService } from './memoryService';
import { supabase } from '../supabase';

interface ExtractedMemory {
  content: string;
  type: 'fact' | 'preference' | 'context' | 'personality';
  category?: string;
  confidence: number;
}

export class MemoryProcessor {
  static async processMessage(
    chatId: string, 
    message: string, 
    role: 'user' | 'assistant'
  ): Promise<void> {
    try {
      console.log('🔍 DEBUG: Processing message for memories:', {
        chatId,
        messageLength: message.length,
        role
      });

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session?.user) {
        console.error('❌ DEBUG: Auth error or no session:', authError);
        return;
      }

      const userId = session.user.id;
      console.log('🔍 DEBUG: Authenticated user:', userId);

      // Initialize memory store
      await MemoryService.initializeMemoryStore(userId);

      // Extract memories with improved extraction logic
      const memories = await this.extractMemories(message, role);
      console.log('🔍 DEBUG: Extracted memories:', memories.length);
      
      for (const memory of memories) {
        try {
          console.log('🔍 DEBUG: Adding memory:', memory);
          
          // Add context to the memory
          const memoryContext = {
            chatId,
            timestamp: new Date().toISOString(),
            role,
            extractedFrom: message.substring(0, 100) + (message.length > 100 ? '...' : '')
          };
          
          await MemoryService.addMemory({
            userId,
            chatId,
            content: memory.content,
            type: memory.type,
            category: memory.category,
            confidence: memory.confidence,
            source: role === 'user' ? 'user' : 'system',
            isActive: true,
            memoryContext
          });

          console.log('✅ DEBUG: Memory added successfully');
        } catch (error) {
          console.error('❌ DEBUG: Error adding individual memory:', {
            error,
            memory,
            userId,
            chatId
          });
        }
      }
    } catch (error) {
      console.error('❌ DEBUG: Error in processMessage:', {
        error,
        chatId,
        messageLength: message.length,
        role
      });
    }
  }

  private static async extractMemories(text: string, role: 'user' | 'assistant'): Promise<ExtractedMemory[]> {
    try {
      console.log('🔍 DEBUG: Extracting memories from text:', text.length, 'characters');
      const memories: ExtractedMemory[] = [];

      // Extract personal facts (name, preferences, etc.)
      const nameMatch = text.match(/(?:I am|I'm|my name is|call me) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
      if (nameMatch) {
        console.log('🔍 DEBUG: Found name:', nameMatch[1]);
        memories.push({
          content: `User's name is ${nameMatch[1]}`,
          type: 'fact',
          category: 'personal',
          confidence: 0.9
        });
      }

      // Extract preferences with improved pattern matching
      const likeMatches = text.match(/(?:I (?:really )?(?:like|love|enjoy|prefer)) (.+?)(?:\.|\n|$)/gi);
      if (likeMatches) {
        console.log('🔍 DEBUG: Found preferences:', likeMatches.length);
        likeMatches.forEach(match => {
          memories.push({
            content: match,
            type: 'preference',
            category: 'interests',
            confidence: 0.8
          });
        });
      }

      // Extract dislike preferences
      const dislikeMatches = text.match(/(?:I (?:really )?(?:dislike|hate|don't like|don't enjoy)) (.+?)(?:\.|\n|$)/gi);
      if (dislikeMatches) {
        console.log('🔍 DEBUG: Found dislikes:', dislikeMatches.length);
        dislikeMatches.forEach(match => {
          memories.push({
            content: match,
            type: 'preference',
            category: 'dislikes',
            confidence: 0.8
          });
        });
      }

      // Extract context information
      const contextMatches = text.match(/(?:I am|I'm) (?:a|an) ([^.,!?]+)/gi);
      if (contextMatches) {
        console.log('🔍 DEBUG: Found context info:', contextMatches.length);
        contextMatches.forEach(match => {
          memories.push({
            content: match,
            type: 'context',
            category: 'background',
            confidence: 0.7
          });
        });
      }

      // Extract personality traits
      const personalityMatches = text.match(/(?:I tend to|I usually|I often|I always) ([^.,!?]+)/gi);
      if (personalityMatches) {
        console.log('🔍 DEBUG: Found personality traits:', personalityMatches.length);
        personalityMatches.forEach(match => {
          memories.push({
            content: match,
            type: 'personality',
            category: 'traits',
            confidence: 0.6
          });
        });
      }

      // Extract work/project related information
      const workMatches = text.match(/(?:we|I) (?:worked on|developed|created|built|implemented) ([^.,!?]+)/gi);
      if (workMatches) {
        console.log('🔍 DEBUG: Found work info:', workMatches.length);
        workMatches.forEach(match => {
          memories.push({
            content: match,
            type: 'context',
            category: 'work',
            confidence: 0.85
          });
        });
      }

      // Extract technical discussions
      const techMatches = text.match(/(?:using|with|in) (?:React|Vue|Angular|Node\.js|Python|JavaScript|TypeScript|SQL|Supabase)([^.,!?]*)/gi);
      if (techMatches) {
        console.log('🔍 DEBUG: Found technical info:', techMatches.length);
        techMatches.forEach(match => {
          memories.push({
            content: match,
            type: 'context',
            category: 'technical',
            confidence: 0.9
          });
        });
      }

      // Extract questions asked by the user
      if (role === 'user' && text.includes('?')) {
        const questionMatches = text.match(/[^.!?]+\?/g);
        if (questionMatches) {
          console.log('🔍 DEBUG: Found questions:', questionMatches.length);
          questionMatches.forEach(match => {
            memories.push({
              content: `User asked: ${match.trim()}`,
              type: 'context',
              category: 'questions',
              confidence: 0.85
            });
          });
        }
      }

      // Extract answers provided by the assistant
      if (role === 'assistant' && text.length > 50) {
        // Look for definitive statements that might be answers
        const answerMatches = text.match(/(?:The|This|It is|There are) [^.!?]+(\.)/g);
        if (answerMatches) {
          console.log('🔍 DEBUG: Found potential answers:', answerMatches.length);
          // Only keep the most significant answers (first 2)
          answerMatches.slice(0, 2).forEach(match => {
            if (match.length > 20) { // Only meaningful answers
              memories.push({
                content: `Assistant provided information: ${match.trim()}`,
                type: 'context',
                category: 'answers',
                confidence: 0.75
              });
            }
          });
        }
      }

      // Extract specific entities (people, places, things)
      const entityMatches = text.match(/(?:(?:the|a|an) ([A-Z][a-z]+(?: [A-Z][a-z]+)*))/g);
      if (entityMatches) {
        console.log('🔍 DEBUG: Found entities:', entityMatches.length);
        // Filter and deduplicate entities
        const uniqueEntities = [...new Set(entityMatches.map(m => m.trim()))];
        uniqueEntities.slice(0, 3).forEach(entity => {
          memories.push({
            content: `Mentioned ${entity}`,
            type: 'context',
            category: 'entities',
            confidence: 0.6
          });
        });
      }

      // Extract image descriptions if present
      if (text.includes('image') && (text.includes('shows') || text.includes('displays') || text.includes('contains'))) {
        const imageDescMatches = text.match(/(?:image|picture|photo) (?:shows|displays|contains|depicts) ([^.!?]+)/i);
        if (imageDescMatches) {
          console.log('🔍 DEBUG: Found image description');
          memories.push({
            content: `Image described as: ${imageDescMatches[1].trim()}`,
            type: 'context',
            category: 'visual',
            confidence: 0.9
          });
        }
      }

      console.log('✅ DEBUG: Extracted memories:', memories.length);
      return memories;
    } catch (error) {
      console.error('❌ DEBUG: Error extracting memories:', {
        error,
        textLength: text.length
      });
      return [];
    }
  }

  static async getRelevantMemories(
    userId: string,
    chatId: string,
    message: string
  ): Promise<any[]> {
    try {
      console.log('🔍 DEBUG: Getting relevant memories:', {
        userId,
        chatId,
        messageLength: message.length
      });

      // First try to get chat-specific memories
      const { data: chatMemories, error: chatError } = await supabase.rpc('get_relevant_memories', {
        p_chat_id: chatId,
        p_content: message,
        p_limit: 5,
        p_min_confidence: 0.6
      });

      if (chatError) {
        console.error('❌ DEBUG: Error getting chat-specific memories:', chatError);
      }

      // Then get user-global memories
      const { data: userMemories, error: userError } = await supabase.rpc('get_relevant_memories', {
        p_chat_id: null, // null to get global memories
        p_content: message,
        p_limit: 3,
        p_min_confidence: 0.7
      });

      if (userError) {
        console.error('❌ DEBUG: Error getting user-global memories:', userError);
      }

      // Combine and deduplicate memories
      const allMemories = [...(chatMemories || []), ...(userMemories || [])];
      const uniqueMemories = this.deduplicateMemories(allMemories);
      
      // Sort by relevance and confidence
      const sortedMemories = uniqueMemories.sort((a, b) => {
        // First by relevance if available
        if (a.relevance && b.relevance) {
          return b.relevance - a.relevance;
        }
        // Then by confidence
        return b.confidence - a.confidence;
      });

      console.log('✅ DEBUG: Found relevant memories:', sortedMemories.length);
      return sortedMemories.slice(0, 7); // Limit to top 7 memories
    } catch (error) {
      console.error('❌ DEBUG: Error in getRelevantMemories:', error);
      return [];
    }
  }

  private static deduplicateMemories(memories: any[]): any[] {
    const seen = new Set();
    return memories.filter(memory => {
      // Create a key based on content
      const key = memory.content.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  static async summarizeMemories(memories: any[]): Promise<string> {
    if (!memories || memories.length === 0) {
      return '';
    }

    // Group memories by type and category
    const grouped: Record<string, any[]> = {};
    
    memories.forEach(memory => {
      const key = `${memory.type}:${memory.category || 'general'}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(memory);
    });

    // Create a summary for each group
    const summaries: string[] = [];
    
    for (const [key, memoryGroup] of Object.entries(grouped)) {
      const [type, category] = key.split(':');
      
      if (memoryGroup.length === 1) {
        // Single memory
        summaries.push(`${memoryGroup[0].content}`);
      } else {
        // Multiple memories of the same type/category
        const contentList = memoryGroup.map(m => m.content.replace(/^User's name is /, '')
                                                          .replace(/^User asked: /, '')
                                                          .replace(/^Assistant provided information: /, '')
                                                          .replace(/^Mentioned /, '')
                                                          .replace(/^Image described as: /, ''));
        
        if (type === 'fact' && category === 'personal') {
          summaries.push(`Personal facts: ${contentList.join(', ')}`);
        } else if (type === 'preference') {
          summaries.push(`Preferences: ${contentList.join(', ')}`);
        } else if (type === 'context' && category === 'questions') {
          summaries.push(`Previous questions: ${contentList.join(', ')}`);
        } else if (type === 'context' && category === 'visual') {
          summaries.push(`Visual context: ${contentList.join(', ')}`);
        } else {
          summaries.push(`${category || type} information: ${contentList.join(', ')}`);
        }
      }
    }

    return summaries.join('\n');
  }
}
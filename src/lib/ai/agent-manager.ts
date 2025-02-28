import { personalityManager } from './personality-manager';
import { memoryManager } from './memory-manager';
import { createBehaviorAdapter } from './behavior-adapter';

interface AgentConfig {
  model: 'dominator' | 'vision';
  userId: string;
  chatId: string;
}

class AgentManager {
  private static instance: AgentManager;
  private activeAgents: Map<string, AgentConfig> = new Map();

  private constructor() {}

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  public async initializeAgent(config: AgentConfig): Promise<void> {
    const key = `${config.userId}-${config.chatId}`;
    this.activeAgents.set(key, config);

    // Initialize behavior adapter
    const adapter = createBehaviorAdapter(config.model);

    // Load user profile and memories
    const userProfile = personalityManager.getInstance().getUserProfile(config.userId);
    const memories = await memoryManager.getRelevantMemories(config.userId, '', 10);

    // Update adapter with user context
    if (userProfile) {
      Object.entries(userProfile).forEach(([key, value]) => {
        adapter.updateUserPreference(key, value);
      });
    }

    // Add memories to short-term memory
    memories.forEach(memory => {
      memoryManager.addToShortTermMemory(config.userId, memory.content);
    });
  }

  public async processMessage(
    userId: string,
    chatId: string,
    message: string,
    isUser: boolean
  ): Promise<void> {
    const key = `${userId}-${chatId}`;
    const config = this.activeAgents.get(key);
    if (!config) return;

    const adapter = createBehaviorAdapter(config.model);

    // Extract and store memories from user messages
    if (isUser) {
      // Extract facts (e.g., "My name is John")
      const nameMatch = message.match(/(?:I am|I'm|my name is|call me) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
      if (nameMatch) {
        await memoryManager.addMemory(
          userId,
          `User's name is ${nameMatch[1]}`,
          'fact',
          0.9
        );
      }

      // Extract preferences
      const prefMatch = message.match(/I (?:like|love|enjoy|prefer) (.+?)(?:\.|\n|$)/i);
      if (prefMatch) {
        await memoryManager.addMemory(
          userId,
          `User likes ${prefMatch[1]}`,
          'preference',
          0.8
        );
      }

      // Extract context
      const contextMatch = message.match(/I am (?:a|an) (.+?)(?:\.|\n|$)/i);
      if (contextMatch) {
        await memoryManager.addMemory(
          userId,
          `User is ${contextMatch[1]}`,
          'context',
          0.7
        );
      }
    }

    // Add interaction to behavior adapter
    adapter.addInteraction({
      message,
      isUser,
      timestamp: new Date().toISOString()
    });

    // Update personality manager
    personalityManager.getInstance().updateUserProfile(userId, {
      lastMessage: message,
      lastInteraction: new Date().toISOString()
    });

    // Periodically consolidate memories
    if (Math.random() < 0.1) { // 10% chance
      await memoryManager.consolidateMemories(userId);
    }
  }

  public async getEnhancedPrompt(
    userId: string,
    chatId: string,
    basePrompt: string
  ): Promise<string> {
    const key = `${userId}-${chatId}`;
    const config = this.activeAgents.get(key);
    if (!config) return basePrompt;

    // Get relevant memories
    const memories = await memoryManager.getRelevantMemories(userId, basePrompt);
    const shortTermMemories = memoryManager.getShortTermMemories(userId);

    // Get personality adaptations
    const adapter = createBehaviorAdapter(config.model);
    const responseStyle = adapter.adaptResponseStyle('intermediate', basePrompt);

    // Build enhanced prompt
    let enhancedPrompt = basePrompt + '\n\n';

    // Add memory context
    if (memories.length > 0) {
      enhancedPrompt += 'User Context:\n';
      memories.forEach(memory => {
        enhancedPrompt += `- ${memory.content}\n`;
      });
    }

    // Add recent context
    if (shortTermMemories.length > 0) {
      enhancedPrompt += '\nRecent Context:\n';
      shortTermMemories.slice(-3).forEach(memory => {
        enhancedPrompt += `- ${memory.content}\n`;
      });
    }

    // Add response guidelines
    enhancedPrompt += '\nResponse Guidelines:\n';
    enhancedPrompt += `- Detail Level: ${responseStyle.detailLevel}\n`;
    enhancedPrompt += `- Technical Terms: ${responseStyle.technicalTerms}\n`;
    enhancedPrompt += `- Step by Step: ${responseStyle.stepByStep}\n`;

    return enhancedPrompt;
  }

  public removeAgent(userId: string, chatId: string): void {
    const key = `${userId}-${chatId}`;
    this.activeAgents.delete(key);
  }
}

export const agentManager = AgentManager.getInstance();
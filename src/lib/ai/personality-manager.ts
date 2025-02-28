import { createBehaviorAdapter } from './behavior-adapter';

class PersonalityManager {
  private static instance: PersonalityManager;
  private dominatorAdapter = createBehaviorAdapter('dominator');
  private visionAdapter = createBehaviorAdapter('vision');
  private userProfiles: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): PersonalityManager {
    if (!PersonalityManager.instance) {
      PersonalityManager.instance = new PersonalityManager();
    }
    return PersonalityManager.instance;
  }

  public getAdapter(model: 'dominator' | 'vision') {
    return model === 'dominator' ? this.dominatorAdapter : this.visionAdapter;
  }

  public updateUserProfile(userId: string, data: any) {
    const currentProfile = this.userProfiles.get(userId) || {};
    this.userProfiles.set(userId, {
      ...currentProfile,
      ...data,
      lastUpdated: new Date().toISOString()
    });
  }

  public getUserProfile(userId: string) {
    return this.userProfiles.get(userId);
  }

  public enhancePrompt(basePrompt: string, userId: string, model: 'dominator' | 'vision'): string {
    const adapter = this.getAdapter(model);
    const userProfile = this.getUserProfile(userId);
    const traits = adapter.getPersonalityTraits();
    const memoryWeights = adapter.getMemoryWeights();

    let enhancedPrompt = basePrompt;

    // Add personality context
    enhancedPrompt += '\n\nPersonality Traits:';
    Object.entries(traits).forEach(([trait, value]) => {
      enhancedPrompt += `\n- ${trait}: ${value}`;
    });

    // Add user-specific adaptations if available
    if (userProfile) {
      enhancedPrompt += '\n\nUser Context:';
      Object.entries(userProfile).forEach(([key, value]) => {
        if (key !== 'lastUpdated') {
          enhancedPrompt += `\n- ${key}: ${value}`;
        }
      });
    }

    // Add memory importance weights
    enhancedPrompt += '\n\nMemory Importance:';
    Object.entries(memoryWeights).forEach(([type, weight]) => {
      enhancedPrompt += `\n- ${type}: ${weight}`;
    });

    return enhancedPrompt;
  }
}

export const personalityManager = PersonalityManager.getInstance();
import dominatorPersonality from './dominator-personality.json';
import visionPersonality from './vision-personality.json';

interface Personality {
  name: string;
  version: string;
  core_traits: Record<string, number>;
  communication_style: Record<string, number>;
  behavioral_patterns: Record<string, any>;
  expertise_areas: Record<string, any>;
  adaptation_rules: Record<string, any>;
  memory_weights: Record<string, number>;
  response_guidelines: Record<string, any>;
}

class BehaviorAdapter {
  private personality: Personality;
  private userPreferences: Map<string, any> = new Map();
  private interactionHistory: any[] = [];

  constructor(model: 'dominator' | 'vision') {
    this.personality = model === 'dominator' ? dominatorPersonality : visionPersonality;
  }

  public adaptResponseStyle(userLevel: 'beginner' | 'intermediate' | 'expert', context: string): any {
    const adaptationRules = this.personality.adaptation_rules;
    const userRules = adaptationRules.user_expertise?.[userLevel] || adaptationRules.user_needs?.quick_help;

    return {
      detailLevel: userRules.explanation_detail || userRules.detail_level,
      technicalTerms: userRules.technical_terms,
      stepByStep: userRules.step_by_step || userRules.step_breakdown,
      formality: this.personality.communication_style.formality_level
    };
  }

  public updateUserPreference(key: string, value: any): void {
    this.userPreferences.set(key, value);
  }

  public addInteraction(interaction: any): void {
    this.interactionHistory.push({
      ...interaction,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 interactions
    if (this.interactionHistory.length > 50) {
      this.interactionHistory.shift();
    }
  }

  public getResponseGuidelines(context: string): any {
    const { response_guidelines } = this.personality;
    const contextType = this.determineContextType(context);

    return {
      ...response_guidelines,
      adaptedStyle: this.getAdaptedStyle(contextType)
    };
  }

  public getExpertiseLevel(domain: string): number {
    const expertise = this.personality.expertise_areas;
    for (const area in expertise) {
      if (expertise[area].capabilities?.includes(domain) || 
          expertise[area].types?.includes(domain) ||
          expertise[area].areas?.includes(domain)) {
        return expertise[area].proficiency;
      }
    }
    return 0.5; // Default middle proficiency
  }

  private determineContextType(context: string): string {
    // Simple context detection
    if (context.includes('code') || context.includes('programming')) return 'technical';
    if (context.includes('learn') || context.includes('explain')) return 'educational';
    return 'casual';
  }

  private getAdaptedStyle(contextType: string): any {
    const baseStyle = this.personality.communication_style;
    const contextRules = this.personality.adaptation_rules.conversation_context?.[contextType] ||
                        this.personality.adaptation_rules.image_context?.[contextType];

    return {
      ...baseStyle,
      ...contextRules
    };
  }

  public getPersonalityTraits(): Record<string, number> {
    return this.personality.core_traits;
  }

  public getMemoryWeights(): Record<string, number> {
    return this.personality.memory_weights;
  }
}

export const createBehaviorAdapter = (model: 'dominator' | 'vision'): BehaviorAdapter => {
  return new BehaviorAdapter(model);
};
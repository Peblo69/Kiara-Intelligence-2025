export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp?: Date;
  isStreaming?: boolean;
  error?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  tokensUsed: number;
  activeSubscription: 'free' | 'basic' | 'enterprise' | null;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: 'dominator' | 'vision';
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
  messageCount?: number;
}

export interface Memory {
  id: string;
  userId: string;
  chatId: string | null;
  content: string;
  type: 'fact' | 'preference' | 'context' | 'personality';
  category?: string;
  confidence: number;
  source: 'user' | 'system' | 'inference';
  isActive: boolean;
  metadata?: Record<string, any>;
  memoryContext?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
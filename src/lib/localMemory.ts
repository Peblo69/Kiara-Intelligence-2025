// Types for memory storage
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp?: string;
  imageUrl?: string;
}

interface ChatMemory {
  id: string;
  title: string;
  model: 'dominator' | 'vision';
  messages: ChatMessage[];
  lastUpdated: string;
  facts: string[];
  preferences: string[];
  context: string[];
}

interface UserMemory {
  userId: string;
  chats: Record<string, ChatMemory>;
  globalFacts: string[];
  globalPreferences: string[];
  lastActive: string;
}

const MEMORY_KEY = 'kiara_memory_';

// Initialize user memory
export const initUserMemory = (userId: string): UserMemory => {
  const memoryKey = `${MEMORY_KEY}${userId}`;
  
  try {
    const storedMemory = localStorage.getItem(memoryKey);
    if (storedMemory) {
      return JSON.parse(storedMemory);
    }
  } catch (error) {
    console.error('❌ Failed to read user memory:', error);
  }
  
  // Create new user memory
  const newMemory: UserMemory = {
    userId,
    chats: {},
    globalFacts: [],
    globalPreferences: [],
    lastActive: new Date().toISOString()
  };
  
  // Save new memory
  saveUserMemory(newMemory);
  
  return newMemory;
};

// Save user memory
export const saveUserMemory = (memory: UserMemory): void => {
  const memoryKey = `${MEMORY_KEY}${memory.userId}`;
  
  try {
    localStorage.setItem(memoryKey, JSON.stringify(memory));
  } catch (error) {
    console.error('❌ Failed to save user memory:', error);
  }
};

// Add message to chat memory
export const addMessageToMemory = (
  userId: string,
  chatId: string,
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    imageUrl?: string;
  }
): void => {
  // Get user memory
  const userMemory = initUserMemory(userId);
  
  // Check if chat exists
  if (!userMemory.chats[chatId]) {
    userMemory.chats[chatId] = {
      id: chatId,
      title: 'New Chat',
      model: 'dominator', // Default model
      messages: [],
      lastUpdated: new Date().toISOString(),
      facts: [],
      preferences: [],
      context: []
    };
  }
  
  // Add message to chat
  userMemory.chats[chatId].messages.push({
    ...message,
    timestamp: new Date().toISOString()
  });
  
  // Update last updated
  userMemory.chats[chatId].lastUpdated = new Date().toISOString();
  userMemory.lastActive = new Date().toISOString();
  
  // Extract facts, preferences, and context
  if (message.role === 'user') {
    extractMemoryItems(message.content, userMemory, chatId);
  }
  
  // Save user memory
  saveUserMemory(userMemory);
};

// Extract memory items from message
const extractMemoryItems = (
  content: string,
  userMemory: UserMemory,
  chatId: string
): void => {
  // Extract facts (e.g., "My name is John")
  const nameMatch = content.match(/(?:I am|I'm|my name is|call me) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
  if (nameMatch) {
    const fact = `User's name is ${nameMatch[1]}`;
    
    // Update existing name fact or add new one
    const nameFactIndex = userMemory.globalFacts.findIndex(f => f.startsWith("User's name is"));
    if (nameFactIndex >= 0) {
      userMemory.globalFacts[nameFactIndex] = fact;
    } else {
      userMemory.globalFacts.push(fact);
    }
    
    // Update chat-specific name fact
    const chatNameFactIndex = userMemory.chats[chatId].facts.findIndex(f => f.startsWith("User's name is"));
    if (chatNameFactIndex >= 0) {
      userMemory.chats[chatId].facts[chatNameFactIndex] = fact;
    } else {
      userMemory.chats[chatId].facts.push(fact);
    }
  }
  
  // Extract preferences (e.g., "I like pizza")
  const likeMatches = content.match(/(?:I (?:really )?(?:like|love|enjoy|prefer)) (.+?)(?:\.|\n|$)/gi);
  if (likeMatches) {
    likeMatches.forEach(match => {
      if (!userMemory.globalPreferences.includes(match)) {
        userMemory.globalPreferences.push(match);
      }
      if (!userMemory.chats[chatId].preferences.includes(match)) {
        userMemory.chats[chatId].preferences.push(match);
      }
    });
  }
  
  // Extract context (e.g., "I am a developer")
  const contextMatches = content.match(/(?:I am|I'm) (?:a|an) ([^.,!?]+)/gi);
  if (contextMatches) {
    contextMatches.forEach(match => {
      if (!userMemory.chats[chatId].context.includes(match)) {
        userMemory.chats[chatId].context.push(match);
      }
    });
  }

  // Extract name corrections (e.g., "No, my name is John")
  const nameCorrection = content.match(/(?:no,?\s+)?(?:actually,?\s+)?my (?:real |actual )?name is not ([A-Z][a-z]+(?: [A-Z][a-z]+)*),? (?:it'?s|it is) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
  if (nameCorrection) {
    const oldName = nameCorrection[1];
    const newName = nameCorrection[2];
    const newFact = `User's name is ${newName}`;
    
    // Remove old name fact and add new one
    userMemory.globalFacts = userMemory.globalFacts.filter(f => !f.startsWith("User's name is"));
    userMemory.globalFacts.push(newFact);
    
    userMemory.chats[chatId].facts = userMemory.chats[chatId].facts.filter(f => !f.startsWith("User's name is"));
    userMemory.chats[chatId].facts.push(newFact);
  }

  // Handle direct name corrections
  const directCorrection = content.match(/(?:no,?\s+)?(?:actually,?\s+)?my name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
  if (directCorrection && !nameMatch) {
    const newName = directCorrection[1];
    const newFact = `User's name is ${newName}`;
    
    // Update name fact
    userMemory.globalFacts = userMemory.globalFacts.filter(f => !f.startsWith("User's name is"));
    userMemory.globalFacts.push(newFact);
    
    userMemory.chats[chatId].facts = userMemory.chats[chatId].facts.filter(f => !f.startsWith("User's name is"));
    userMemory.chats[chatId].facts.push(newFact);
  }
};

// Get chat memory
export const getChatMemory = (
  userId: string,
  chatId: string
): ChatMemory | null => {
  const userMemory = initUserMemory(userId);
  return userMemory.chats[chatId] || null;
};

// Get chat history
export const getChatHistory = (
  userId: string,
  chatId: string
): ChatMessage[] => {
  const chatMemory = getChatMemory(userId, chatId);
  return chatMemory ? chatMemory.messages : [];
};

// Get memory summary for AI context
export const getMemorySummary = (
  userId: string,
  chatId: string
): string => {
  const userMemory = initUserMemory(userId);
  const chatMemory = userMemory.chats[chatId];
  
  if (!chatMemory) {
    return '';
  }
  
  const summary: string[] = [];
  
  // Add facts
  if (userMemory.globalFacts.length > 0) {
    summary.push(`User Facts: ${userMemory.globalFacts.join(', ')}`);
  }
  
  // Add preferences
  if (userMemory.globalPreferences.length > 0) {
    summary.push(`User Preferences: ${userMemory.globalPreferences.join(', ')}`);
  }
  
  // Add chat-specific context
  if (chatMemory.context.length > 0) {
    summary.push(`Chat Context: ${chatMemory.context.join(', ')}`);
  }
  
  // Add recent conversation summary
  const recentMessages = chatMemory.messages.slice(-5);
  if (recentMessages.length > 0) {
    summary.push('Recent Conversation:');
    recentMessages.forEach(msg => {
      summary.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    });
  }
  
  return summary.join('\n');
};

// Update chat title
export const updateChatTitle = (
  userId: string,
  chatId: string,
  title: string
): void => {
  const userMemory = initUserMemory(userId);
  
  if (userMemory.chats[chatId]) {
    userMemory.chats[chatId].title = title;
    userMemory.chats[chatId].lastUpdated = new Date().toISOString();
    saveUserMemory(userMemory);
  }
};

// Delete chat
export const deleteChat = (
  userId: string,
  chatId: string
): void => {
  const userMemory = initUserMemory(userId);
  
  if (userMemory.chats[chatId]) {
    delete userMemory.chats[chatId];
    saveUserMemory(userMemory);
  }
};

// Get all user chats
export const getUserChats = (
  userId: string
): { id: string; title: string; model: string; lastUpdated: string }[] => {
  const userMemory = initUserMemory(userId);
  
  return Object.values(userMemory.chats).map(chat => ({
    id: chat.id,
    title: chat.title,
    model: chat.model,
    lastUpdated: chat.lastUpdated
  }));
};

// Add image description to memory
export const addImageDescription = (
  userId: string,
  chatId: string,
  description: string
): void => {
  const userMemory = initUserMemory(userId);
  
  if (userMemory.chats[chatId]) {
    const context = `Image described as: ${description}`;
    if (!userMemory.chats[chatId].context.includes(context)) {
      userMemory.chats[chatId].context.push(context);
      saveUserMemory(userMemory);
    }
  }
};
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatService } from './services/chatService';
import { UserService } from './services/userService';
import { supabase } from './supabase';
import { isEmailVerified } from './auth';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
  error?: boolean;
  timestamp?: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: 'dominator' | 'vision';
  lastMessage?: string;
  messageCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  isLoading?: boolean;
}

interface ComputingMetrics {
  codeAnalysis: number;
  patternMatching: number;
  processingSpeed: number;
  neuralLoad: number;
}

interface UserProfile {
  id?: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  tokensUsed: number;
  activeSubscription: 'free' | 'basic' | 'enterprise' | null;
}

interface Store {
  chats: Chat[];
  activeChat: string | null;
  activeModel: 'dominator' | 'vision';
  isEmailVerified: boolean;
  tokens: number;
  isUltraMode: boolean;
  codeTheme: 'dark' | 'light' | 'dracula' | 'nord';
  computingMetrics: ComputingMetrics;
  isAuthenticated: boolean;
  isSettingsOpen: boolean;
  isPricingOpen: boolean;
  isDocsOpen: boolean;
  theme: 'dark' | 'light';
  fontSize: number;
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  activeSettingsTab: 'profile' | 'subscription' | 'security' | 'app' | 'personalization' | 'support';
  userProfile: UserProfile;
  isLoading: boolean;
  authError: string | null;
  isOffline: boolean;

  setTokens: (tokens: number) => void;
  setUltraMode: (isUltra: boolean) => void;
  setActiveChat: (chatId: string | null) => void;
  setActiveModel: (model: 'dominator' | 'vision') => void;
  setCodeTheme: (theme: 'dark' | 'light' | 'dracula' | 'nord') => void;
  setIsEmailVerified: (isVerified: boolean) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setIsPricingOpen: (isOpen: boolean) => void;
  setIsDocsOpen: (isOpen: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setFontSize: (size: number) => void;
  setNotifications: (notifications: { email: boolean; push: boolean; desktop: boolean }) => void;
  setActiveSettingsTab: (tab: 'profile' | 'subscription' | 'security' | 'app' | 'personalization' | 'support') => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  setAuthError: (error: string | null) => void;
  setIsOffline: (isOffline: boolean) => void;
  
  createChat: (model: 'dominator' | 'vision') => Promise<string>;
  deleteChat: (chatId: string) => Promise<void>;
  updateChatTitle: (chatId: string, title: string) => Promise<void>;
  addMessageToChat: (chatId: string, message: Message) => Promise<void>;
  updateLastMessage: (chatId: string, content: string) => void;
  getActiveChat: () => Chat | null;
  updateComputingMetrics: (metrics: Partial<ComputingMetrics>) => void;
  loadUserChats: () => Promise<void>;
  loadChatMessages: (chatId: string) => Promise<void>;
  resetStore: () => void;
  setupTokenSync: () => void;
  checkEmailVerification: () => Promise<boolean>;
}

const initialState = {
  chats: [],
  activeChat: null,
  activeModel: 'vision',
  isEmailVerified: false,
  tokens: 0,
  isUltraMode: false,
  codeTheme: 'dark',
  isAuthenticated: false,
  isSettingsOpen: false,
  isPricingOpen: false,
  isDocsOpen: false,
  theme: 'dark',
  fontSize: 14,
  notifications: {
    email: true,
    push: true,
    desktop: true
  },
  activeSettingsTab: 'profile',
  userProfile: {
    displayName: 'User',
    email: 'user@example.com',
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    tokensUsed: 0,
    activeSubscription: 'free'
  },
  computingMetrics: {
    codeAnalysis: 0,
    patternMatching: 0,
    processingSpeed: 0,
    neuralLoad: 0,
  },
  isLoading: false,
  authError: null,
  isOffline: false
};

const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTokens: (tokens) => set({ tokens }),
      setUltraMode: (isUltra) => set({ isUltraMode: isUltra }),
      setAuthError: (error) => set({ authError: error }),
      setIsEmailVerified: (isVerified) => set({ isEmailVerified: isVerified }),
      setIsOffline: (isOffline) => set({ isOffline }),
      
      setupTokenSync: () => {
        const setupSync = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            console.log('🔍 DEBUG: No session found for token sync');
            return;
          }

          // Get initial token balance
          try {
            // First ensure user profile exists
            const { data: profile, error: profileError } = await supabase
              .rpc('get_or_create_user_profile', { user_id: session.user.id });
            
            if (profileError) {
              console.error('❌ DEBUG: Error getting/creating profile:', profileError);
              return;
            }
          
            // Now safely get token balance
            const { data: balanceData } = await supabase
              .rpc('get_user_token_balance', { p_user_id: session.user.id });
            
            if (balanceData) {
              set({ tokens: balanceData.current_balance });
            }
          } catch (error) {
            console.error('❌ DEBUG: Error in token sync:', error);
            return;
          }

          // Subscribe to token transactions
          const subscription = supabase
            .channel('token-changes')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'token_transactions',
                filter: `user_id=eq.${session.user.id}`
              },
              async () => {
                try {
                  const { data: balanceData } = await supabase
                    .rpc('get_user_token_balance', { p_user_id: session.user.id });
                
                  if (balanceData) {
                    set({ tokens: balanceData.current_balance });
                  }
                } catch (error) {
                  console.error('❌ DEBUG: Error updating token balance:', error);
                }
              }
            )
            .subscribe();

          return () => {
            subscription.unsubscribe();
          };
        };

        setupSync();
      },
      
      checkEmailVerification: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ isEmailVerified: false });
            return false;
          }
          
          const verified = await isEmailVerified(session.user.id);
          set({ isEmailVerified: verified });
          return verified;
        } catch (error) {
          console.error('Error checking email verification:', error);
          return get().isEmailVerified;
        }
      },
      
      setActiveChat: async (chatId) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            set({ authError: 'Not authenticated' });
            return;
          }

          const { chats, activeModel } = get();
          const chat = chats.find(c => c.id === chatId);
          
          // Update active chat immediately
          set(state => ({
            activeChat: chatId || state.activeChat,
            chats: state.chats.map(c => 
              c.id === chatId ? { ...c, isLoading: true } : { ...c, isLoading: false }
            )
          }));

          // Load messages if chat exists
          if (chat) {
            await get().loadChatMessages(chatId);
          }
        } catch (error) {
          console.error('Error setting active chat:', error);
          set({ authError: 'Failed to load chat' });
        }
      },
      
      setActiveModel: async (model) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            set({ authError: 'Not authenticated' });
            return;
          }

          const { chats } = get();
          const modelChats = chats.filter(chat => chat.model === model);
          const mostRecentChat = modelChats.length > 0 
            ? modelChats.reduce((a, b) => {
                const aDate = new Date(a.updatedAt || 0);
                const bDate = new Date(b.updatedAt || 0);
                return aDate > bDate ? a : b;
              })
            : null;

          set({ 
            activeModel: model,
            activeChat: mostRecentChat?.id || null
          });

          if (mostRecentChat?.id) {
            await get().loadChatMessages(mostRecentChat.id);
          }
        } catch (error) {
          console.error('Error setting active model:', error);
          set({ authError: 'Failed to load model' });
        }
      },
      
      setCodeTheme: (theme) => set({ codeTheme: theme }),
      
      setIsAuthenticated: async (isAuthenticated) => {
        if (!isAuthenticated) {
          set(initialState);
        } else {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              // Check email verification status
              const isVerified = await isEmailVerified(session.user.id);
              
              set({ 
                isAuthenticated,
                isEmailVerified: isVerified,
                authError: null
              });
              
              // Only load chats if email is verified
              if (isVerified) {
                await get().loadUserChats();
                get().setupTokenSync();
              }
            } else {
              set({ 
                isAuthenticated: false,
                authError: 'Session expired'
              });
            }
          } catch (error) {
            console.error('Error setting authentication:', error);
            set({ 
              isAuthenticated: false,
              authError: 'Authentication failed'
            });
          }
        }
      },

      setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setIsPricingOpen: (isOpen) => set({ isPricingOpen: isOpen }),
      setIsDocsOpen: (isOpen) => set({ isDocsOpen: isOpen }),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setNotifications: (notifications) => set({ notifications }),
      setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),
      updateUserProfile: (profile) => set((state) => ({
        userProfile: { ...state.userProfile, ...profile }
      })),

      createChat: async (model) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ authError: 'Not authenticated' });
            throw new Error('User not authenticated');
          }

          // Make sure email is verified
          if (!get().isEmailVerified) {
            set({ authError: 'Email not verified' });
            throw new Error('Email not verified');
          }

          set({ isLoading: true });
          const chatId = await ChatService.createChat(session.user.id, 'New Chat', model);
          
          const newChat: Chat = {
            id: chatId,
            title: 'New Chat',
            messages: [],
            model,
            createdAt: new Date(),
            updatedAt: new Date(),
            messageCount: 0
          };

          set((state) => ({
            chats: [newChat, ...state.chats],
            activeChat: chatId,
            isLoading: false,
            authError: null
          }));

          return chatId;
        } catch (error) {
          console.error('Error creating chat:', error);
          set({ 
            isLoading: false,
            authError: 'Failed to create chat'
          });
          throw error;
        }
      },

      deleteChat: async (chatId) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ authError: 'Not authenticated' });
            throw new Error('User not authenticated');
          }

          set({ isLoading: true });
          await ChatService.deleteChat(chatId);
          
          set((state) => {
            const newChats = state.chats.filter((chat) => chat.id !== chatId);
            const newActiveChat = state.activeChat === chatId
              ? newChats.find(chat => chat.model === state.activeModel)?.id || null
              : state.activeChat;

            return {
              chats: newChats,
              activeChat: newActiveChat,
              isLoading: false,
              authError: null
            };
          });
        } catch (error) {
          console.error('Error deleting chat:', error);
          set({ 
            isLoading: false,
            authError: 'Failed to delete chat'
          });
          throw error;
        }
      },

      updateChatTitle: async (chatId, title) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ authError: 'Not authenticated' });
            throw new Error('User not authenticated');
          }

          await ChatService.updateChatTitle(chatId, title);
          set((state) => ({
            chats: state.chats.map((chat) =>
              chat.id === chatId ? { ...chat, title } : chat
            ),
            authError: null
          }));
        } catch (error) {
          console.error('Error updating chat title:', error);
          set({ authError: 'Failed to update chat title' });
          throw error;
        }
      },

      addMessageToChat: async (chatId, message) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ authError: 'Not authenticated' });
            throw new Error('User not authenticated');
          }

          const messageId = await ChatService.addMessage(chatId, session.user.id, message);
          
          set((state) => ({
            chats: state.chats.map((chat) => {
              if (chat.id === chatId) {
                const updatedMessages = [...chat.messages];
                
                if (message.role === 'assistant' && message.isStreaming) {
                  const streamingIndex = updatedMessages.findIndex(
                    m => m.role === 'assistant' && m.isStreaming
                  );
                  if (streamingIndex !== -1) {
                    updatedMessages[streamingIndex] = {
                      ...message,
                      id: messageId,
                      timestamp: new Date()
                    };
                  } else {
                    updatedMessages.push({
                      ...message,
                      id: messageId,
                      timestamp: new Date()
                    });
                  }
                } else {
                  updatedMessages.push({
                    ...message,
                    id: messageId,
                    timestamp: new Date()
                  });
                }

                return {
                  ...chat,
                  messages: updatedMessages,
                  lastMessage: message.content,
                  messageCount: (chat.messageCount || 0) + 1,
                  updatedAt: new Date()
                };
              }
              return chat;
            }),
            authError: null
          }));
        } catch (error) {
          console.error('Error adding message:', error);
          set({ authError: 'Failed to add message' });
          throw error;
        }
      },

      updateLastMessage: (chatId, content) => {
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id === chatId && chat.messages.length > 0) {
              const messages = [...chat.messages];
              const lastMessage = messages[messages.length - 1];
              
              if (lastMessage.role === 'assistant') {
                messages[messages.length - 1] = {
                  ...lastMessage,
                  content,
                  isStreaming: false,
                  timestamp: new Date()
                };
              }
              
              return { 
                ...chat, 
                messages,
                lastMessage: content,
                updatedAt: new Date()
              };
            }
            return chat;
          })
        }));
      },

      getActiveChat: () => {
        const state = get();
        return state.chats.find((chat) => chat.id === state.activeChat) || null;
      },

      updateComputingMetrics: (metrics) =>
        set((state) => ({
          computingMetrics: {
            ...state.computingMetrics,
            ...metrics,
          },
        })),

      loadUserChats: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ authError: 'Not authenticated' });
            return;
          }

          // Make sure email is verified
          if (!get().isEmailVerified) {
            await get().checkEmailVerification();
            if (!get().isEmailVerified) {
              return;
            }
          }

          set({ isLoading: true });
          const chats = await ChatService.getChats(session.user.id);
          
          const sortedChats = chats.map(chat => ({
            ...chat,
            messages: [],
            createdAt: new Date(chat.created_at),
            updatedAt: new Date(chat.updated_at)
          })).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

          const { activeChat, activeModel } = get();
          let newActiveChat = activeChat;
          
          if (!activeChat) {
            const mostRecentChat = sortedChats.find(chat => chat.model === activeModel);
            newActiveChat = mostRecentChat?.id || null;
          }

          set({ 
            chats: sortedChats,
            activeChat: newActiveChat,
            isLoading: false,
            authError: null
          });

          if (newActiveChat) {
            await get().loadChatMessages(newActiveChat);
          }
        } catch (error) {
          console.error('Error loading user chats:', error);
          set({ 
            isLoading: false,
            authError: 'Failed to load chats'
          });
        }
      },

      loadChatMessages: async (chatId) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ authError: 'Not authenticated' });
            return;
          }

          // Set loading state for this chat
          set(state => ({
            chats: state.chats.map(chat => 
              chat.id === chatId ? { ...chat, isLoading: true } : chat
            )
          }));

          // Load messages
          const messages = await ChatService.getMessages(chatId, session.user.id);
          
          // Update messages for this chat
          set(state => ({
            chats: state.chats.map(chat => 
              chat.id === chatId 
                ? { 
                    ...chat, 
                    messages: messages.map(msg => ({
                      ...msg,
                      timestamp: new Date(msg.timestamp)
                    })),
                    isLoading: false 
                  } 
                : chat
            ),
            authError: null
          }));
        } catch (error) {
          console.error('Error loading chat messages:', error);
          set(state => ({
            chats: state.chats.map(chat => 
              chat.id === chatId ? { ...chat, isLoading: false } : chat
            ),
            authError: 'Failed to load messages'
          }));
        }
      },

      resetStore: () => set(initialState)
    }),
    {
      name: 'kiara-chat-storage',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        const state = persistedState as Store;
        return {
          ...state,
          chats: state.chats.map(chat => ({
            ...chat,
            messages: chat.messages.map(msg => ({
              ...msg,
              timestamp: new Date(msg.timestamp || Date.now())
            })),
            isLoading: false
          }))
        };
      }
    }
  )
);

export { useStore };
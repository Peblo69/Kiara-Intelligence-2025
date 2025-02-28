export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string
          avatar_url: string | null
          tokens_used: number
          active_subscription: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          display_name: string
          avatar_url?: string | null
          tokens_used?: number
          active_subscription?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          avatar_url?: string | null
          tokens_used?: number
          active_subscription?: string
          created_at?: string
          updated_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          user_id: string
          title: string
          model: 'dominator' | 'vision'
          last_message: string | null
          message_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          model: 'dominator' | 'vision'
          last_message?: string | null
          message_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          model?: 'dominator' | 'vision'
          last_message?: string | null
          message_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          content: string
          role: 'user' | 'assistant'
          is_streaming: boolean
          error: boolean
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          content: string
          role: 'user' | 'assistant'
          is_streaming?: boolean
          error?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          content?: string
          role?: 'user' | 'assistant'
          is_streaming?: boolean
          error?: boolean
          created_at?: string
        }
      }
      memories: {
        Row: {
          id: string
          user_id: string
          chat_id: string
          content: string
          type: 'fact' | 'preference' | 'context' | 'personality'
          category: string | null
          confidence: number
          source: 'user' | 'system' | 'inference'
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chat_id: string
          content: string
          type: 'fact' | 'preference' | 'context' | 'personality'
          category?: string | null
          confidence: number
          source: 'user' | 'system' | 'inference'
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          chat_id?: string
          content?: string
          type?: 'fact' | 'preference' | 'context' | 'personality'
          category?: string | null
          confidence?: number
          source?: 'user' | 'system' | 'inference'
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      memory_stores: {
        Row: {
          id: string
          user_id: string
          memory_count: number
          last_processed: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          memory_count?: number
          last_processed?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          memory_count?: number
          last_processed?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      preferences: {
        Row: {
          id: string
          user_id: string
          theme: string
          font_size: number
          language: string
          notifications: Json
          ai_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string
          font_size?: number
          language?: string
          notifications?: Json
          ai_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme?: string
          font_size?: number
          language?: string
          notifications?: Json
          ai_preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      quotas: {
        Row: {
          id: string
          user_id: string
          plan: string
          limits: Json
          usage: Json
          period_start: string
          period_end: string
          reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan?: string
          limits?: Json
          usage?: Json
          period_start?: string
          period_end?: string
          reset_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan?: string
          limits?: Json
          usage?: Json
          period_start?: string
          period_end?: string
          reset_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      analytics: {
        Row: {
          id: string
          user_id: string
          chat_id: string
          type: 'chat' | 'vision' | 'memory'
          metrics: Json
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chat_id: string
          type: 'chat' | 'vision' | 'memory'
          metrics: Json
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          chat_id?: string
          type?: 'chat' | 'vision' | 'memory'
          metrics?: Json
          metadata?: Json
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          amount: number
          currency: string
          status: 'pending' | 'succeeded' | 'failed'
          type: 'subscription' | 'tokens'
          stripe_payment_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          currency?: string
          status: 'pending' | 'succeeded' | 'failed'
          type: 'subscription' | 'tokens'
          stripe_payment_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          currency?: string
          status?: 'pending' | 'succeeded' | 'failed'
          type?: 'subscription' | 'tokens'
          stripe_payment_id?: string | null
          metadata?: Json
          created_at?: string
        }
      }
    }
  }
}
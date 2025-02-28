import { supabase } from '../supabase';

export interface PaymentTransaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  type: 'subscription' | 'token_purchase';
  provider: string;
  providerTransactionId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  tokenLimit: number;
  features: Record<string, any>;
}

export interface UserSubscription {
  active: boolean;
  tier: string;
  tokenLimit: number;
  periodEnd?: Date;
  features?: Record<string, any>;
}

export class PaymentService {
  static async processPayment(
    userId: string,
    amount: number,
    type: 'subscription' | 'token_purchase',
    provider: string,
    providerTransactionId: string,
    metadata: Record<string, any> = {}
  ): Promise<PaymentTransaction> {
    try {
      console.log('🔍 DEBUG: Processing payment:', {
        userId,
        amount,
        type,
        provider
      });

      const { data, error } = await supabase.rpc('process_payment', {
        p_user_id: userId,
        p_amount: amount,
        p_type: type,
        p_provider: provider,
        p_provider_transaction_id: providerTransactionId,
        p_metadata: metadata
      });

      if (error) {
        console.error('❌ DEBUG: Error processing payment:', error);
        throw error;
      }

      console.log('✅ DEBUG: Payment processed successfully');
      return data;
    } catch (error) {
      console.error('❌ DEBUG: Error in processPayment:', error);
      throw new Error('Failed to process payment');
    }
  }

  static async getSubscriptionStatus(userId: string): Promise<UserSubscription> {
    try {
      console.log('🔍 DEBUG: Getting subscription status:', userId);

      const { data, error } = await supabase.rpc('check_subscription_status', {
        p_user_id: userId
      });

      if (error) {
        console.error('❌ DEBUG: Error checking subscription:', error);
        throw error;
      }

      console.log('✅ DEBUG: Got subscription status:', data);
      return data;
    } catch (error) {
      console.error('❌ DEBUG: Error in getSubscriptionStatus:', error);
      throw new Error('Failed to get subscription status');
    }
  }

  static async getTokenBalance(userId: string): Promise<number> {
    try {
      console.log('🔍 DEBUG: Getting token balance:', userId);

      const { data, error } = await supabase.rpc('get_token_balance', {
        p_user_id: userId
      });

      if (error) {
        console.error('❌ DEBUG: Error getting token balance:', error);
        throw error;
      }

      console.log('✅ DEBUG: Got token balance:', data);
      return data;
    } catch (error) {
      console.error('❌ DEBUG: Error in getTokenBalance:', error);
      throw new Error('Failed to get token balance');
    }
  }

  static async canUseTokens(userId: string, tokensNeeded: number): Promise<boolean> {
    try {
      console.log('🔍 DEBUG: Checking if can use tokens:', {
        userId,
        tokensNeeded
      });

      const { data, error } = await supabase.rpc('can_use_tokens', {
        p_user_id: userId,
        p_tokens_needed: tokensNeeded
      });

      if (error) {
        console.error('❌ DEBUG: Error checking tokens:', error);
        throw error;
      }

      console.log('✅ DEBUG: Token check result:', data);
      return data;
    } catch (error) {
      console.error('❌ DEBUG: Error in canUseTokens:', error);
      throw new Error('Failed to check token usage');
    }
  }

  static async getSubscriptionTiers(): Promise<SubscriptionTier[]> {
    try {
      console.log('🔍 DEBUG: Getting subscription tiers');

      const { data, error } = await supabase
        .from('subscription_tiers')
        .select()
        .order('price');

      if (error) {
        console.error('❌ DEBUG: Error getting tiers:', error);
        throw error;
      }

      console.log('✅ DEBUG: Got subscription tiers:', data.length);
      return data;
    } catch (error) {
      console.error('❌ DEBUG: Error in getSubscriptionTiers:', error);
      throw new Error('Failed to get subscription tiers');
    }
  }

  static async getPaymentHistory(userId: string): Promise<PaymentTransaction[]> {
    try {
      console.log('🔍 DEBUG: Getting payment history:', userId);

      const { data, error } = await supabase
        .from('payment_transactions')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ DEBUG: Error getting payment history:', error);
        throw error;
      }

      console.log('✅ DEBUG: Got payment history:', data.length);
      return data;
    } catch (error) {
      console.error('❌ DEBUG: Error in getPaymentHistory:', error);
      throw new Error('Failed to get payment history');
    }
  }
}
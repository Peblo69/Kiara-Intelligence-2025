/**
 * Network resilience utilities for handling offline states and connection issues
 */

import { useStore } from './store';

// Queue for storing operations that need to be processed when online
type QueuedOperation = {
  id: string;
  type: 'message' | 'memory' | 'auth';
  payload: any;
  timestamp: number;
  retryCount: number;
};

// Singleton instance for managing network operations
class NetworkManager {
  private static instance: NetworkManager;
  private operationQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private maxRetries =
    process.env.NODE_ENV === 'production' ? 5 : 3;
  private netEventListenersAdded = false;

  private constructor() {
    this.setupNetworkListeners();
    
    // Load saved operations from localStorage
    this.loadQueueFromStorage();
    
    // Process queue immediately if we're online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined' || this.netEventListenersAdded) return;
    
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.netEventListenersAdded = true;
    
    // Custom reconnection event
    window.addEventListener('supabase:reconnected', this.handleOnline);
  }

  private handleOnline = (): void => {
    console.log('🔍 Network: Online, processing queued operations...');
    useStore.getState().setIsOffline(false);
    this.processQueue();
  };

  private handleOffline = (): void => {
    console.log('🔍 Network: Offline, operations will be queued');
    useStore.getState().setIsOffline(true);
  };

  private saveQueueToStorage(): void {
    try {
      localStorage.setItem('operationQueue', JSON.stringify(this.operationQueue));
    } catch (error) {
      console.error('Failed to save operation queue to storage:', error);
    }
  }

  private loadQueueFromStorage(): void {
    try {
      const savedQueue = localStorage.getItem('operationQueue');
      if (savedQueue) {
        this.operationQueue = JSON.parse(savedQueue);
        console.log(`🔍 Network: Loaded ${this.operationQueue.length} queued operations from storage`);
      }
    } catch (error) {
      console.error('Failed to load operation queue from storage:', error);
    }
  }

  public enqueueOperation(type: 'message' | 'memory' | 'auth', payload: any): string {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation: QueuedOperation = {
      id,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.operationQueue.push(operation);
    this.saveQueueToStorage();
    
    // If we're online, try processing immediately
    if (navigator.onLine && !this.isProcessingQueue) {
      this.processQueue();
    }
    
    return id;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0 || !navigator.onLine) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`🔍 Network: Processing ${this.operationQueue.length} queued operations`);

    // Process all operations in the queue
    const opsToProcess = [...this.operationQueue];
    const remainingOps: QueuedOperation[] = [];

    for (const op of opsToProcess) {
      try {
        await this.processOperation(op);
        // Operation successful, remove from queue
      } catch (error) {
        console.error(`❌ Network: Failed to process operation ${op.id}:`, error);
        
        // Increment retry count and keep in queue if under retry limit
        op.retryCount++;
        if (op.retryCount <= this.maxRetries) {
          remainingOps.push(op);
        } else {
          console.warn(`⚠️ Network: Operation ${op.id} exceeded max retries and was dropped`);
          // Could notify user here about failed operation
        }
      }
    }

    // Update queue with remaining operations
    this.operationQueue = remainingOps;
    this.saveQueueToStorage();
    this.isProcessingQueue = false;

    // If there are still operations and we're online, process again
    if (this.operationQueue.length > 0 && navigator.onLine) {
      setTimeout(() => this.processQueue(), 5000);
    }
  }

  private async processOperation(operation: QueuedOperation): Promise<void> {
    // Implement your processing logic here based on operation type
    switch (operation.type) {
      case 'message':
        // Process message operation
        console.log('🔍 Network: Processing message operation', operation.id);
        break;
      case 'memory':
        // Process memory operation
        console.log('🔍 Network: Processing memory operation', operation.id);
        break;
      case 'auth':
        // Process auth operation
        console.log('🔍 Network: Processing auth operation', operation.id);
        break;
      default:
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
    
    // Add actual implementation for each operation type
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulated processing
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }
}

// Custom hook for network status
export function useNetwork() {
  const networkManager = NetworkManager.getInstance();
  const { isOffline } = useStore();
  
  return {
    isOnline: !isOffline,
    enqueueOperation: networkManager.enqueueOperation.bind(networkManager)
  };
}

export const networkManager = NetworkManager.getInstance();
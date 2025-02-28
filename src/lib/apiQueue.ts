/**
 * API operation queue for offline mode
 */

import { networkManager } from './network';
import { useStore } from './store';

export interface ApiOperation {
  id: string;
  operation: string;
  params: any;
  createdAt: Date;
}

// Singleton queue manager for API operations
class ApiQueueManager {
  private static instance: ApiQueueManager;
  private queue: ApiOperation[] = [];
  private isProcessing = false;
  private localStorageKey = 'kiara_api_queue';

  private constructor() {
    this.loadQueueFromStorage();
    
    // Check for pending operations on startup
    if (this.queue.length > 0 && navigator.onLine) {
      this.processQueue();
    }
    
    // Setup network event listeners
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('supabase:reconnected', this.handleOnline);
  }

  public static getInstance(): ApiQueueManager {
    if (!ApiQueueManager.instance) {
      ApiQueueManager.instance = new ApiQueueManager();
    }
    return ApiQueueManager.instance;
  }

  private handleOnline = (): void => {
    if (this.queue.length > 0 && !this.isProcessing) {
      console.log(`🔍 Online: Processing ${this.queue.length} queued API operations`);
      this.processQueue();
    }
  };

  public enqueue(operation: string, params: any): string {
    const id = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const apiOp: ApiOperation = {
      id,
      operation,
      params,
      createdAt: new Date()
    };
    
    this.queue.push(apiOp);
    this.saveQueueToStorage();
    
    // Process immediately if online
    if (navigator.onLine && !this.isProcessing) {
      this.processQueue();
    } else {
      console.log(`🔍 Offline: Queued ${operation} operation for later processing`);
    }
    
    return id;
  }

  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.localStorageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Convert string dates back to Date objects
        this.queue.forEach(op => {
          op.createdAt = new Date(op.createdAt);
        });
        console.log(`🔍 Loaded ${this.queue.length} operations from storage`);
      }
    } catch (error) {
      console.error('Error loading API queue from storage:', error);
      this.queue = [];
    }
  }

  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving API queue to storage:', error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔍 Processing ${this.queue.length} queued operations`);

    // Create a local copy of the queue to work with
    const queueCopy = [...this.queue];
    this.queue = [];
    
    try {
      // Process all operations in sequence
      for (const op of queueCopy) {
        try {
          await this.processOperation(op);
          console.log(`✅ Successfully processed operation: ${op.operation}`);
        } catch (error) {
          console.error(`❌ Failed to process operation ${op.id}:`, error);
          // Re-queue failed operations
          this.queue.push(op);
        }
      }
    } finally {
      this.isProcessing = false;
      this.saveQueueToStorage();
      
      // If there are still operations in the queue, try again later
      if (this.queue.length > 0 && navigator.onLine) {
        setTimeout(() => this.processQueue(), 5000);
      }
    }
  }

  private async processOperation(operation: ApiOperation): Promise<void> {
    // Implementation would depend on the specific operations
    // This is a placeholder - real implementation would call appropriate services
    switch (operation.operation) {
      case 'send_message':
        // Handle sending messages
        break;
        
      case 'create_chat':
        // Handle chat creation
        break;
        
      case 'update_profile':
        // Handle profile updates
        break;
        
      default:
        console.warn(`Unknown operation type: ${operation.operation}`);
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public clearQueue(): void {
    this.queue = [];
    this.saveQueueToStorage();
  }
}

export const apiQueue = ApiQueueManager.getInstance();

// React hook for using the API queue
export function useApiQueue() {
  const { isOffline } = useStore();
  
  return {
    enqueue: apiQueue.enqueue.bind(apiQueue),
    queueLength: apiQueue.getQueueLength(),
    isOffline
  };
}
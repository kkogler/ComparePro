/**
 * Request Queue Service
 * Prevents concurrent vendor API requests from overwhelming external services
 * and causing server crashes due to resource exhaustion
 */

export class RequestQueue {
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private processing = false;
  private maxConcurrent: number;
  private currentlyProcessing = 0;

  constructor(maxConcurrent: number = 1) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a request to the queue
   * @param fn The async function to execute
   * @returns Promise that resolves when the function completes
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.currentlyProcessing >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    const item = this.queue.shift();
    
    if (item) {
      this.currentlyProcessing++;
      console.log(`🔄 REQUEST QUEUE: Processing request (${this.currentlyProcessing}/${this.maxConcurrent} concurrent, ${this.queue.length} queued)`);
      
      try {
        const result = await item.fn();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      } finally {
        this.currentlyProcessing--;
        console.log(`✅ REQUEST QUEUE: Request completed (${this.currentlyProcessing}/${this.maxConcurrent} concurrent, ${this.queue.length} queued)`);
      }
    }

    this.processing = false;
    
    // Process next items in queue
    if (this.queue.length > 0 && this.currentlyProcessing < this.maxConcurrent) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Get current queue status
   */
  getStatus(): { queueLength: number; processing: number; maxConcurrent: number } {
    return {
      queueLength: this.queue.length,
      processing: this.currentlyProcessing,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Clear the queue (useful for testing or emergency stops)
   */
  clear(): void {
    const remaining = this.queue.length;
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    console.log(`🗑️  REQUEST QUEUE: Cleared ${remaining} pending requests`);
  }
}

// Singleton instance for vendor connection tests
// Only allow 2 concurrent connection tests to prevent overwhelming external APIs
export const vendorTestConnectionQueue = new RequestQueue(2);


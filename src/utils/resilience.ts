/**
 * Resilience utilities for handling network failures and retries.
 */

interface RetryOptions {
  retries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (error: any, attempt: number) => void;
}

/**
 * Retries an asynchronous function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === retries) break;
      
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      if (onRetry) {
        onRetry(error, attempt + 1);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Extracts data from PromiseSettledResult or returns a default fallback.
 */
export function getSettledValue<T>(result: PromiseSettledResult<T>, defaultValue: T): T {
  return result.status === 'fulfilled' ? result.value : defaultValue;
}

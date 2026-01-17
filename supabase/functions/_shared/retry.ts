/**
 * Retry wrapper for AI API calls with exponential backoff
 * 
 * Handles rate limits (429) and transient errors with configurable retry logic.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is a rate limit error (429)
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Response) {
    return error.status === 429;
  }
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.includes('rate limit');
  }
  return false;
}

/**
 * Extract retry-after delay from error (for 429 errors)
 */
function getRetryAfterDelay(error: unknown): number | null {
  if (error instanceof Response) {
    const retryAfter = error.headers.get('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!Number.isNaN(seconds)) {
        return seconds * 1000; // Convert to milliseconds
      }
    }
  }
  return null;
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn Function to retry
 * @param options Retry configuration
 * @returns Result of the function
 * @throws Error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw the error
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if it's a rate limit error
      const isRateLimit = isRateLimitError(error);
      
      // Calculate delay
      if (isRateLimit) {
        // For rate limits, use retry-after header if available, otherwise use longer delay
        const retryAfter = getRetryAfterDelay(error);
        if (retryAfter) {
          delay = Math.min(retryAfter, opts.maxDelayMs);
          console.log(
            `Rate limit exceeded. Retrying after ${delay}ms (from retry-after header). ` +
            `Attempt ${attempt + 1}/${opts.maxRetries + 1}`
          );
        } else {
          // Use exponential backoff with longer initial delay for rate limits
          delay = Math.min(delay * opts.backoffMultiplier * 2, opts.maxDelayMs);
          console.log(
            `Rate limit exceeded. Retrying in ${delay}ms. ` +
            `Attempt ${attempt + 1}/${opts.maxRetries + 1}`
          );
        }
      } else {
        // Regular exponential backoff for other errors
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
        console.log(
          `Error occurred: ${error instanceof Error ? error.message : String(error)}. ` +
          `Retrying in ${delay}ms. Attempt ${attempt + 1}/${opts.maxRetries + 1}`
        );
      }

      await sleep(delay);
    }
  }

  // All retries exhausted, throw the last error
  throw new Error(
    `Failed after ${opts.maxRetries + 1} attempts: ` +
    `${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/**
 * Get retry options from environment variables
 */
export function getRetryOptionsFromEnv(): RetryOptions {
  const maxRetries = Deno.env.get('MAX_RETRIES');
  const retryDelayMs = Deno.env.get('RETRY_DELAY_MS');

  return {
    maxRetries: maxRetries ? parseInt(maxRetries, 10) : undefined,
    initialDelayMs: retryDelayMs ? parseInt(retryDelayMs, 10) : undefined,
  };
}








// src/utils/timeout.ts - Utility for handling operation timeouts

import { PROCESS_TIMEOUT } from '../constants';

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap with a timeout
 * @param timeoutMs Timeout in milliseconds
 * @returns The original promise result or rejects if timeout occurs
 */
export async function withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs = PROCESS_TIMEOUT
): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => clearTimeout(timeoutId));
} 
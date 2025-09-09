// src/utils/validation.ts - Utilities for URL validation and filtering

import picomatch from 'picomatch';

/**
 * Creates a URL filter based on include and exclude glob patterns
 * @param includeGlobs Glob patterns to include
 * @param excludeGlobs Glob patterns to exclude
 * @returns A filter function that returns true if URL should be included
 */
export function createFilter(
    includeGlobs: string[] = [], 
    excludeGlobs: string[] = []
): (url: string) => boolean {
    const isExcluded = picomatch(excludeGlobs);
    const isIncluded = picomatch(includeGlobs, { ignore: excludeGlobs });
    
    return (url: string) => {
        if (isExcluded(url)) return false;
        if (includeGlobs.length > 0 && !isIncluded(url)) return false;
        return true;
    };
}

/**
 * Validates and normalizes a URL
 * @param url The URL to validate
 * @returns The normalized URL or null if invalid
 */
export function validateUrl(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.toString();
    } catch (error) {
        return null;
    }
} 
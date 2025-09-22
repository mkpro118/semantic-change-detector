import { z } from 'zod';
import { createHash } from 'crypto';

// Generic utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type NonNullable<T> = T extends null | undefined ? never : T;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  pagination?: {
    total: number;
    pages: number;
    current: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  metadata?: Record<string, any>;
}

// Enhanced validation schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(13).max(120).optional(),
  isActive: z.boolean().default(true),
  roles: z.array(z.enum(['admin', 'user', 'moderator', 'guest'])).default(['user']),
  metadata: z.record(z.any()).optional(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'auto']).default('light'),
      language: z.string().default('en'),
      timezone: z.string().default('UTC'),
    })
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// Enhanced data transformation utilities
export class DataTransformer {
  static normalizeString(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  static generateHash(input: string, algorithm: string = 'sha256'): string {
    return createHash(algorithm).update(input).digest('hex');
  }

  static parseCSV<T>(csvData: string, validator?: z.ZodSchema<T>): T[] {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());

    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map((v) => v.trim());
      const obj = headers.reduce((acc, header, i) => {
        let value: any = values[i];

        // Enhanced type parsing
        if (!isNaN(Number(value)) && value !== '') {
          value = Number(value);
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (value === 'null' || value === '') {
          value = null;
        }

        acc[header] = value;
        return acc;
      }, {} as any);

      if (validator) {
        try {
          return validator.parse(obj);
        } catch (error) {
          throw new Error(`Validation failed at line ${index + 2}: ${error}`);
        }
      }

      return obj as T;
    });
  }

  static groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const groupKey = String(item[key]);
        groups[groupKey] = groups[groupKey] || [];
        groups[groupKey].push(item);
        return groups;
      },
      {} as Record<string, T[]>,
    );
  }

  static sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  static multiSort<T>(array: T[], sorts: Array<{ key: keyof T; order: 'asc' | 'desc' }>): T[] {
    return [...array].sort((a, b) => {
      for (const sort of sorts) {
        const aVal = a[sort.key];
        const bVal = b[sort.key];

        if (aVal !== bVal) {
          if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
          if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
        }
      }
      return 0;
    });
  }

  static chunk<T>(array: T[], size: number): T[][] {
    if (size <= 0) throw new Error('Chunk size must be positive');

    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
    if (!keyFn) {
      return [...new Set(array)];
    }

    const seen = new Set();
    return array.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  static flatten<T>(array: (T | T[])[]): T[] {
    return array.reduce((flat, item) => {
      return flat.concat(Array.isArray(item) ? this.flatten(item) : item);
    }, [] as T[]);
  }

  static pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  static omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }
}

// Enhanced async utilities
export class AsyncUtils {
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out',
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  static async parallel<T>(tasks: (() => Promise<T>)[], concurrency: number = 5): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      const execute = async (index: number) => {
        const result = await task();
        results[index] = result;
      };

      const promise = execute(i);
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((p) => p === promise),
          1,
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  static async series<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
    const results: T[] = [];
    for (const task of tasks) {
      const result = await task();
      results.push(result);
    }
    return results;
  }

  static async waterfall<T>(tasks: Array<(prev?: any) => Promise<T>>): Promise<T> {
    let result: any;
    for (const task of tasks) {
      result = await task(result);
    }
    return result;
  }
}

// Enhanced cache implementation with TTL
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, { value: V; expiry?: number }>;
  private defaultTTL?: number;

  constructor(capacity: number, defaultTTL?: number) {
    if (capacity <= 0) {
      throw new Error('Cache capacity must be positive');
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    const expiry = ttl || this.defaultTTL ? Date.now() + (ttl || this.defaultTTL!) : undefined;

    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, expiry });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Clean expired entries first
    this.cleanExpired();
    return this.cache.size;
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry && now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Export commonly used functions
export const {
  normalizeString,
  generateHash,
  parseCSV,
  groupBy,
  sortBy,
  multiSort,
  chunk,
  unique,
  flatten,
  pick,
  omit,
} = DataTransformer;

export const { withRetry, delay, withTimeout, parallel, series, waterfall } = AsyncUtils;

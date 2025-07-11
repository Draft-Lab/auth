/**
 * Universal storage adapter for Draft Auth using Unstorage drivers.
 * Provides seamless integration with any Unstorage-compatible backend including
 * Redis, Cloudflare KV, Vercel KV, and more.
 *
 * @packageDocumentation
 */

import { createStorage, type Driver as UnstorageDriver } from "unstorage"
import { joinKey, type StorageAdapter, splitKey } from "./storage"

/**
 * Internal storage entry format with expiration support.
 * Wraps values with metadata for TTL management.
 */
interface StorageEntry {
	/** The actual stored value */
	readonly value: Record<string, unknown> | undefined
	/** Optional expiration timestamp in milliseconds */
	readonly expiry?: number
}

/**
 * Creates a Draft Auth storage adapter using Unstorage drivers.
 * Supports automatic expiration, error handling, and any Unstorage driver.
 *
 * @param options - Configuration options
 * @param options.driver - Optional Unstorage driver (defaults to memory)
 * @returns Storage adapter compatible with Draft Auth
 *
 * @example
 * ```ts
 * import { UnStorage } from "@draftlab/auth/storage/unstorage"
 * import redisDriver from "unstorage/drivers/redis"
 *
 * // Using Redis driver
 * const storage = UnStorage({
 *   driver: redisDriver({
 *     host: process.env.REDIS_HOST,
 *     port: parseInt(process.env.REDIS_PORT || "6379"),
 *     password: process.env.REDIS_PASSWORD
 *   })
 * })
 *
 * // Using default memory driver (development only)
 * const memoryStorage = UnStorage()
 * ```
 */
export const UnStorage = ({ driver }: { driver?: UnstorageDriver } = {}): StorageAdapter => {
	const store = createStorage<StorageEntry>({
		driver: driver
	})

	return {
		/**
		 * Retrieves a value by its key path with automatic expiration handling.
		 * Expired entries are automatically removed during access.
		 */
		async get(key: string[]) {
			try {
				const keyPath = joinKey(key)
				const entry = await store.getItem(keyPath)

				if (!entry) {
					return undefined
				}

				// Check if entry has expired
				if (entry.expiry && Date.now() >= entry.expiry) {
					// Remove expired entry asynchronously to avoid blocking
					store.removeItem(keyPath).catch(() => {})
					return undefined
				}

				return entry.value
			} catch (error) {
				console.error("UnStorage get error:", error)
				return undefined
			}
		},

		/**
		 * Stores a value with optional expiration.
		 * Values are wrapped with metadata for TTL management.
		 */
		async set(key: string[], value: unknown, expiry?: Date) {
			try {
				const keyPath = joinKey(key)
				const entry: StorageEntry = {
					value: value as Record<string, unknown>,
					expiry: expiry ? expiry.getTime() : undefined
				}

				await store.setItem(keyPath, entry)
			} catch (error) {
				console.error("UnStorage set error:", error)
				throw error
			}
		},

		/**
		 * Removes a value from storage by its key path.
		 */
		async remove(key: string[]) {
			try {
				const keyPath = joinKey(key)
				await store.removeItem(keyPath)
			} catch (error) {
				console.error("UnStorage remove error:", error)
			}
		},

		/**
		 * Scans for entries matching a key prefix with automatic expiration cleanup.
		 * Expired entries are removed during scan to keep storage clean.
		 */
		async *scan(prefix: string[]) {
			try {
				const now = Date.now()
				const prefixPath = joinKey(prefix)

				// Get all keys matching the prefix
				let keys = await store.getKeys(prefixPath)

				// Fallback for drivers that don't support prefix search properly
				// Check if we have keys in storage but prefix search returned empty
				if (keys.length === 0) {
					const allKeys = await store.getKeys()
					if (allKeys.length > 0) {
						// Only use fallback if there are keys in storage
						keys = allKeys.filter((key) => key.startsWith(prefixPath))
					}
				}

				// Limit scan results to prevent memory issues
				const limitedKeys = keys.slice(0, 1000)

				for (const keyPath of limitedKeys) {
					try {
						const entry = await store.getItem(keyPath)

						if (!entry || !entry.value) continue

						// Skip expired entries and clean them up
						if (entry.expiry && now >= entry.expiry) {
							// Remove expired entry asynchronously
							store.removeItem(keyPath).catch(() => {})
							continue
						}

						yield [splitKey(keyPath), entry.value] as const
					} catch {
						// Skip invalid entries
					}
				}
			} catch (error) {
				console.error("UnStorage scan error:", error)
			}
		}
	}
}

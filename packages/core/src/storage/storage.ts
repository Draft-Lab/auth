/**
 * Storage abstraction layer for Draft Auth persistence operations.
 * Provides a unified interface for different storage backends with key encoding,
 * TTL support, and type-safe operations.
 */

/**
 * Abstract storage adapter interface that must be implemented by all storage backends.
 * Defines the core operations needed for OAuth data persistence.
 */
export interface StorageAdapter {
	/**
	 * Retrieves a value by its key path.
	 *
	 * @param key - Array of key segments forming the storage path
	 * @returns Promise resolving to the stored value or undefined if not found
	 */
	get(key: string[]): Promise<Record<string, unknown> | undefined>

	/**
	 * Removes a value by its key path.
	 *
	 * @param key - Array of key segments forming the storage path
	 * @returns Promise that resolves when removal is complete
	 */
	remove(key: string[]): Promise<void>

	/**
	 * Stores a value with an optional expiration date.
	 *
	 * @param key - Array of key segments forming the storage path
	 * @param value - The value to store
	 * @param expiry - Optional expiration date for automatic cleanup
	 * @returns Promise that resolves when storage is complete
	 */
	set(key: string[], value: unknown, expiry?: Date): Promise<void>

	/**
	 * Scans for keys matching a prefix pattern.
	 *
	 * @param prefix - Array of key segments to use as prefix filter
	 * @returns Async iterable of key-value pairs matching the prefix
	 */
	scan(prefix: string[]): AsyncIterable<readonly [string[], unknown]>
}

/**
 * ASCII unit separator character used to join key segments.
 * Using a control character ensures it won't conflict with user data.
 */
const SEPARATOR = String.fromCharCode(0x1f)

/**
 * Escape character used to escape SEPARATOR characters in key segments.
 * Uses backslash as the escape character, which is then itself escaped when appearing.
 */
const ESCAPE = "\\"

/**
 * Joins an array of already-encoded key segments into a single storage key.
 *
 * @param key - Array of key segments to join
 * @returns Single string representing the full key path
 */
export const joinKey = (key: string[]): string => {
	return key.join(SEPARATOR)
}

/**
 * Splits a joined storage key back into its encoded component segments.
 *
 * @param key - Joined key string to split
 * @returns Array of individual key segments
 */
export const splitKey = (key: string): string[] => {
	return key.split(SEPARATOR)
}

/**
 * Checks whether a decoded storage key belongs to the provided prefix.
 */
export const hasKeyPrefix = (key: string[], prefix: string[]): boolean => {
	return (
		prefix.length <= key.length && prefix.every((segment, index) => key[index] === segment)
	)
}

/**
 * Encodes a single key segment by escaping special characters.
 * Prevents collisions by properly escaping separator and escape characters.
 *
 * @param segment - The key segment to encode
 * @returns Encoded segment with special characters escaped
 * @throws {Error} If segment is empty or whitespace-only
 *
 * @internal
 */
const encodeSegment = (segment: string): string => {
	// Validate segment is not empty
	if (!segment.trim()) {
		throw new Error(`Storage key segment cannot be empty or whitespace-only: "${segment}"`)
	}

	// Escape backslashes first, then escape separators
	// This prevents double-escaping issues
	return segment.replaceAll(ESCAPE, ESCAPE + ESCAPE).replaceAll(SEPARATOR, ESCAPE + SEPARATOR)
}

/**
 * Decodes a key segment by unescaping special characters.
 * Reverse of encodeSegment operation.
 *
 * @param segment - The encoded segment to decode
 * @returns Decoded segment with special characters restored
 *
 * @internal
 */
const decodeSegment = (segment: string): string => {
	// Unescape separators first, then unescape backslashes
	// This matches the order in encodeSegment
	return segment.replaceAll(ESCAPE + SEPARATOR, SEPARATOR).replaceAll(ESCAPE + ESCAPE, ESCAPE)
}

/**
 * High-level storage operations with key encoding and type safety.
 * Provides a convenient interface over storage adapters with additional features
 * like TTL validation and secure key encoding to prevent collisions.
 */
export const Storage = {
	/**
	 * Encodes key segments by escaping special characters.
	 * Ensures storage keys don't contain unescaped separator characters that could cause collisions.
	 *
	 * @param key - Array of key segments to encode
	 * @returns Array of properly escaped key segments
	 *
	 * @throws {Error} If any segment is empty or whitespace-only
	 *
	 * @example
	 * ```ts
	 * const encoded = Storage.encode(["user", "data with separators"])
	 * const roundTrip = Storage.decode(encoded)
	 * // roundTrip === ["user", "data with separators"]
	 * ```
	 */
	encode: (key: string[]): string[] => {
		return key.map(encodeSegment)
	},

	/**
	 * Decodes key segments by unescaping special characters.
	 * Reverse operation of encode().
	 *
	 * @param key - Array of encoded key segments
	 * @returns Array of decoded key segments
	 *
	 * @internal
	 */
	decode: (key: string[]): string[] => {
		return key.map(decodeSegment)
	},

	/**
	 * Retrieves a typed value from storage.
	 *
	 * @template T - Expected type of the stored value
	 * @param adapter - Storage adapter to use
	 * @param key - Array of key segments identifying the value
	 * @returns Promise resolving to the typed value or undefined if not found
	 *
	 * @example
	 * ```ts
	 * interface UserSession {
	 *   userId: string
	 *   expiresAt: number
	 * }
	 *
	 * const session = await Storage.get<UserSession>(adapter, ['sessions', sessionId])
	 * if (session) {
	 *   // Fully typed: session.userId
	 * }
	 * ```
	 */
	get: <T = Record<string, unknown>>(
		adapter: StorageAdapter,
		key: string[]
	): Promise<T | undefined> => {
		return adapter.get(Storage.encode(key)) as Promise<T | undefined>
	},

	/**
	 * Stores a value with optional time-to-live in seconds.
	 * Validates that TTL is a positive integer to prevent edge cases like negative or overflow values.
	 *
	 * @param adapter - Storage adapter to use
	 * @param key - Array of key segments identifying where to store
	 * @param value - The value to store
	 * @param ttlSeconds - Optional TTL in seconds for automatic expiration
	 * @returns Promise that resolves when storage is complete
	 *
	 * @throws {RangeError} If TTL is invalid (negative, non-integer, or exceeds maximum)
	 *
	 * @example
	 * ```ts
	 * // Store with 1 hour TTL
	 * await Storage.set(adapter, ['sessions', sessionId], sessionData, 3600)
	 *
	 * // Store permanently (no expiration)
	 * await Storage.set(adapter, ['users', userId], userData)
	 * ```
	 */
	set: (
		adapter: StorageAdapter,
		key: string[],
		value: unknown,
		ttlSeconds?: number
	): Promise<void> => {
		// Validate TTL if provided
		if (ttlSeconds !== undefined && ttlSeconds !== null) {
			if (!Number.isInteger(ttlSeconds)) {
				throw new RangeError(
					`Storage TTL must be an integer in seconds, received ${typeof ttlSeconds}`
				)
			}
			if (ttlSeconds <= 0) {
				throw new RangeError(`Storage TTL must be positive, received ${ttlSeconds}`)
			}
			// Cap at 10 years to prevent overflow and catch configuration mistakes
			const maxTtlSeconds = 60 * 60 * 24 * 365 * 10
			if (ttlSeconds > maxTtlSeconds) {
				throw new RangeError(
					`Storage TTL exceeds maximum (${maxTtlSeconds}s = 10 years), received ${ttlSeconds}s`
				)
			}
		}

		const expiry = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : undefined
		return adapter.set(Storage.encode(key), value, expiry)
	},

	/**
	 * Removes a value from storage.
	 *
	 * @param adapter - Storage adapter to use
	 * @param key - Array of key segments identifying the value to remove
	 * @returns Promise that resolves when removal is complete
	 *
	 * @example
	 * ```ts
	 * await Storage.remove(adapter, ['sessions', expiredSessionId])
	 * ```
	 */
	remove: (adapter: StorageAdapter, key: string[]): Promise<void> => {
		return adapter.remove(Storage.encode(key))
	},

	/**
	 * Scans for entries matching a key prefix with type safety.
	 *
	 * @template T - Expected type of the stored values
	 * @param adapter - Storage adapter to use
	 * @param prefix - Array of key segments to use as prefix filter
	 * @returns Async iterable of typed key-value pairs using decoded key segments
	 *
	 * @example
	 * ```ts
	 * // Find all user sessions
	 * for await (const [key, session] of Storage.scan<UserSession>(adapter, ['sessions'])) {
	 *   // Session: `${key.join('/')} expires at ${session.expiresAt}`
	 * }
	 * ```
	 */
	scan: <T = Record<string, unknown>>(
		adapter: StorageAdapter,
		prefix: string[]
	): AsyncIterable<readonly [string[], T]> => {
		const encodedPrefix = Storage.encode(prefix)

		return {
			async *[Symbol.asyncIterator]() {
				for await (const [key, value] of adapter.scan(encodedPrefix)) {
					yield [Storage.decode(key), value as T] as const
				}
			}
		}
	}
} as const

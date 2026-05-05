import type { Client } from "@libsql/client"
import { hasKeyPrefix, joinKey, type StorageAdapter, splitKey } from "./storage"

/**
 * Turso/LibSQL storage adapter for Draft Auth with persistent key-value storage semantics.
 * Expiration is handled by Draft Auth at read/scan time rather than by native database TTL.
 *
 * ## Features
 *
 * - **Edge database**: Fast global access through Turso's distributed architecture
 * - **Read-time expiration handling**: Expired entries are skipped and opportunistically cleaned up
 * - **SQL-backed persistence**: Suitable for durable server-side auth state
 * - **Efficient scanning**: Optimized prefix-based queries
 *
 * @example
 * ```ts
 * import { createClient } from "@libsql/client"
 * import { TursoStorage } from "@draftlab/auth/storage/turso"
 *
 * const client = createClient({
 *   url: "libsql://your-database.turso.io",
 *   authToken: "your-auth-token"
 * })
 *
 * const storage = TursoStorage(client)
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 */

/**
 * Database row structure for the key-value storage table.
 */
interface StorageRow {
	readonly key: string
	readonly value: string
	readonly expiry: number | null
}

/**
 * Creates a Turso storage adapter using the provided LibSQL client.
 * The adapter initializes its backing table/indexes in the background and implements the
 * StorageAdapter interface using straightforward SQL operations.
 *
 * @param client - Configured LibSQL client for database operations
 * @returns Storage adapter implementing the StorageAdapter interface
 *
 * @example
 * ```ts
 * import { createClient } from "@libsql/client"
 *
 * const client = createClient({
 *   url: process.env.TURSO_DATABASE_URL,
 *   authToken: process.env.TURSO_AUTH_TOKEN
 * })
 *
 * const storage = TursoStorage(client)
 *
 * // Now ready to use with Draft Auth
 * const app = issuer({ storage, ... })
 * ```
 */
export const TursoStorage = (client: Client): StorageAdapter => {
	const TABLE_NAME = "__draftauth__kv_storage"

	// Initialize the storage table with optimized schema
	client
		.execute(`
		CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
			key TEXT PRIMARY KEY, 
			value TEXT NOT NULL, 
			expiry INTEGER
		)
	`)
		.catch(() => console.log(`Failed to create storage table: ${TABLE_NAME}`))

	// Create index for efficient prefix scanning
	client
		.execute(`
		CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_key_prefix 
		ON ${TABLE_NAME} (key)
	`)
		.catch(() => console.log(`Failed to create index prefix for table: ${TABLE_NAME}`))

	// Create index for efficient expiry-based cleanup
	client
		.execute(`
		CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_expiry 
		ON ${TABLE_NAME} (expiry) 
		WHERE expiry IS NOT NULL
	`)
		.catch(() => console.log(`Failed to create index expiry-based for table: ${TABLE_NAME}`))

	return {
		async get(key: string[]): Promise<Record<string, unknown> | undefined> {
			const joinedKey = joinKey(key)

			const { rows } = await client.execute({
				sql: `SELECT value, expiry FROM ${TABLE_NAME} WHERE key = ?`,
				args: [joinedKey]
			})

			const row = rows[0] as StorageRow | undefined
			if (!row) {
				return
			}

			// Check and handle expiration
			if (row.expiry && row.expiry < Date.now()) {
				// Clean up expired entry asynchronously
				await client.execute({
					sql: `DELETE FROM ${TABLE_NAME} WHERE key = ?`,
					args: [joinedKey]
				})
				return
			}

			try {
				return JSON.parse(row.value) as Record<string, unknown>
			} catch {
				return
			}
		},

		async set(key: string[], value: unknown, expiry?: Date): Promise<void> {
			const joinedKey = joinKey(key)
			const expiryTimestamp = expiry?.getTime() ?? null

			try {
				const serializedValue = JSON.stringify(value)
				await client.execute({
					sql: `INSERT OR REPLACE INTO ${TABLE_NAME} (key, value, expiry) VALUES (?, ?, ?)`,
					args: [joinedKey, serializedValue, expiryTimestamp]
				})
			} catch {
				throw new Error("Storage operation failed")
			}
		},

		async remove(key: string[]): Promise<void> {
			const joinedKey = joinKey(key)

			await client.execute({
				sql: `DELETE FROM ${TABLE_NAME} WHERE key = ?`,
				args: [joinedKey]
			})
		},

		async *scan(
			prefix: string[]
		): AsyncGenerator<readonly [string[], Record<string, unknown>], void, unknown> {
			const joinedPrefix = joinKey(prefix)
			const now = Date.now()

			const { rows } = await client.execute({
				sql: `
					SELECT key, value, expiry 
					FROM ${TABLE_NAME} 
					WHERE key LIKE ? 
					AND (expiry IS NULL OR expiry >= ?)
					ORDER BY key
				`,
				args: [`${joinedPrefix}%`, now]
			})

			for (const row of rows as unknown as StorageRow[]) {
				try {
					const decodedKey = splitKey(row.key)
					if (!hasKeyPrefix(decodedKey, prefix)) {
						continue
					}

					const parsedValue = JSON.parse(row.value) as Record<string, unknown>
					yield [decodedKey, parsedValue] as const
				} catch {
					// Skip malformed entries rather than failing the entire scan
				}
			}

			// Opportunistic cleanup of expired entries (non-blocking)
			client
				.execute({
					sql: `DELETE FROM ${TABLE_NAME} WHERE expiry IS NOT NULL AND expiry < ?`,
					args: [now]
				})
				.catch(() => {
					// Background cleanup failed - continue silently
				})
		}
	}
}

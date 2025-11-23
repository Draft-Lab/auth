/**
 * Token revocation management for Draft Auth.
 * Handles blacklisting of revoked tokens to prevent their use.
 *
 * ## Overview
 *
 * Revocation allows users to invalidate specific tokens before their natural expiration.
 * This is essential for logout functionality and security in case of token compromise.
 *
 * ## Storage Structure
 *
 * Revoked tokens are stored with their expiration time to allow automatic cleanup:
 * ```
 * revocation:token:{tokenHash} → { revokedAt: timestamp, expiresAt: timestamp }
 * ```
 *
 * ## Security Considerations
 *
 * - Revoked tokens are checked on every use
 * - Storage automatically cleans up expired revocations
 * - Hash tokens for storage to reduce memory usage
 * - Use constant-time comparison for hash verification
 *
 * @packageDocumentation
 */

import { createHash } from "node:crypto"
import { Storage, type StorageAdapter } from "./storage/storage"

/**
 * Data stored for a revoked token.
 * Tracks when the token was revoked and when it naturally expires.
 */
export interface RevocationRecord {
	/** Timestamp when the token was revoked (milliseconds) */
	revokedAt: number
	/** Timestamp when the token naturally expires (milliseconds) */
	expiresAt: number
}

/**
 * Hashes a token for storage.
 * Uses SHA-256 to reduce storage size and prevent exposure of full token value.
 *
 * @param token - The token to hash
 * @returns SHA-256 hash of the token
 *
 * @internal
 */
const hashToken = (token: string): string => {
	return createHash("sha256").update(token).digest("hex")
}

/**
 * Token revocation manager.
 * Provides methods to revoke tokens and check if a token has been revoked.
 */
export const Revocation = {
	/**
	 * Revokes a token, preventing it from being used even if not yet expired.
	 *
	 * @param storage - Storage adapter to use
	 * @param token - The token to revoke (access or refresh token)
	 * @param expiresAt - When the token naturally expires (milliseconds since epoch)
	 * @returns Promise that resolves when revocation is stored
	 *
	 * @example
	 * ```ts
	 * // Revoke a refresh token on logout
	 * await Revocation.revoke(storage, refreshToken, expiresAt)
	 * ```
	 */
	revoke: async (storage: StorageAdapter, token: string, expiresAt: number): Promise<void> => {
		const hash = hashToken(token)
		const key = ["revocation:token", hash]

		const record: RevocationRecord = {
			revokedAt: Date.now(),
			expiresAt
		}

		// Store revocation record with TTL equal to token expiry
		// This allows automatic cleanup when token expires
		const ttlSeconds = Math.ceil((expiresAt - Date.now()) / 1000)

		await Storage.set(storage, key, record, Math.max(1, ttlSeconds))
	},

	/**
	 * Checks if a token has been revoked.
	 * Returns false if token is not in revocation list (never revoked or already expired).
	 *
	 * @param storage - Storage adapter to use
	 * @param token - The token to check
	 * @returns Promise resolving to true if token is revoked, false otherwise
	 *
	 * @example
	 * ```ts
	 * // Check if token was revoked before using it
	 * const isRevoked = await Revocation.isRevoked(storage, accessToken)
	 * if (isRevoked) {
	 *   throw new InvalidAccessTokenError()
	 * }
	 * ```
	 */
	isRevoked: async (storage: StorageAdapter, token: string): Promise<boolean> => {
		const hash = hashToken(token)
		const key = ["revocation:token", hash]

		const record = await Storage.get<RevocationRecord>(storage, key)

		// Token is revoked if it exists in the revocation list
		return !!record
	}
} as const

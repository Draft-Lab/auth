/**
 * Universal utilities for the OAuth toolkit.
 * These functions work in both browser and Node.js environments.
 */

/**
 * Generates a cryptographically secure random string using Web Crypto API.
 * Works in both browser and Node.js environments (Node 15+).
 *
 * @param length - Length of random data in bytes (default: 32 for 256-bit security)
 * @returns Base64url-encoded secure random string
 *
 * @example
 * ```ts
 * const state = generateSecureRandom(16) // 128-bit random state
 * const token = generateSecureRandom(32) // 256-bit random token
 * ```
 */
export const generateSecureRandom = (length = 32): string => {
	if (length <= 0 || !Number.isInteger(length)) {
		throw new RangeError("Length must be a positive integer")
	}

	const randomBytes = new Uint8Array(length)
	crypto.getRandomValues(randomBytes)

	// Convert to base64url (URL-safe base64 without padding)
	// This works in both browser and Node.js
	let base64 = ""
	if (typeof btoa !== "undefined") {
		// Browser
		base64 = btoa(String.fromCharCode(...randomBytes))
	} else {
		// Node.js
		base64 = Buffer.from(randomBytes).toString("base64")
	}

	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

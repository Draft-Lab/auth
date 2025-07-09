import { timingSafeEqual } from "node:crypto"

/**
 * Cryptographic utilities for secure random generation and comparison operations.
 * These functions are designed to prevent timing attacks and provide unbiased randomness.
 */

/**
 * Generates a cryptographically secure token with enhanced entropy.
 * Uses Web Crypto API and provides 256 bits of entropy
 *
 * @param length - Length of random data in bytes (default: 32 for 256-bit security)
 * @returns Base64url-encoded secure token
 *
 * @example
 * ```ts
 * const authCode = generateSecureToken()
 * // Returns: "7B8kJ9mN3pQ2rS5tU8vW0xY1zA3bC6dE9fG2hI5jK8lM" (example)
 *
 * const refreshToken = generateSecureToken(24) // 192-bit token
 * // Returns: "4A7bC9dF2gH5iJ8kL1mN4pQ7rS0tU" (example)
 * ```
 */
export const generateSecureToken = (length: number = 32): string => {
	if (length <= 0 || !Number.isInteger(length)) {
		throw new RangeError("Token length must be a positive integer")
	}

	const randomBytes = new Uint8Array(length)
	crypto.getRandomValues(randomBytes)

	// Convert to base64url (URL-safe base64 without padding)
	const base64 = btoa(String.fromCharCode.apply(null, Array.from(randomBytes)))
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/**
 * Generates a cryptographically secure string of random digits without modulo bias.
 * Uses rejection sampling to ensure each digit (0-9) has an equal probability of being selected.
 *
 * @param length - Number of digits to generate (must be positive)
 * @returns String containing exactly the specified number of random digits
 *
 * @example
 * ```ts
 * const pinCode = generateUnbiasedDigits(6)
 * // Returns: "492847" (example - actual result is random)
 *
 * const shortCode = generateUnbiasedDigits(4)
 * // Returns: "7291" (example - actual result is random)
 * ```
 *
 * @throws {RangeError} If length is not a positive number
 */
export const generateUnbiasedDigits = (length: number): string => {
	if (length <= 0 || !Number.isInteger(length)) {
		throw new RangeError("Length must be a positive integer")
	}

	const result: number[] = []
	while (result.length < length) {
		const buffer = crypto.getRandomValues(new Uint8Array(length * 2))
		for (const byte of buffer) {
			if (byte < 250 && result.length < length) {
				result.push(byte % 10)
			}
		}
	}
	return result.join("")
}

/**
 * Performs a timing-safe comparison of two strings to prevent timing attacks.
 * Always takes the same amount of time regardless of where the strings differ,
 * making it safe for comparing sensitive values like tokens or passwords.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are identical, false otherwise
 *
 * @example
 * ```ts
 * // Safe for comparing sensitive values
 * const isValidToken = timingSafeCompare(userToken, expectedToken)
 *
 * // Safe for password verification
 * const isValidPassword = timingSafeCompare(hashedInput, storedHash)
 *
 * // Returns false for different types or lengths
 * timingSafeCompare("abc", 123 as any) // false
 * timingSafeCompare("abc", "abcd") // false
 * ```
 */
export const timingSafeCompare = (a: string, b: string): boolean => {
	if (typeof a !== "string" || typeof b !== "string") {
		return false
	}
	if (a.length !== b.length) {
		return false
	}
	return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

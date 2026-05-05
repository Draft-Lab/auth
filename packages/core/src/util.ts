import type { Context } from "hono"

/**
 * Utility type that flattens complex types for better IntelliSense display.
 * Converts intersections and complex mapped types into cleaner object types.
 *
 * @template T - The type to prettify
 *
 * @example
 * ```ts
 * type Complex = { a: string } & { b: number }
 * type Clean = Prettify<Complex> // { a: string; b: number }
 * ```
 */
export type Prettify<T> = {
	[K in keyof T]: T[K]
} & {}

/**
 * Constructs a complete URL relative to the current request context.
 * Handles proxy headers (x-forwarded-*) to ensure correct URL generation
 * in containerized and load-balanced environments.
 *
 * @param c - Hono context containing request information
 * @param path - Relative path to append to the base URL
 * @returns Complete URL string with proper protocol, host, and port
 *
 * @example
 * ```ts
 * const callbackUrl = getRelativeUrl(c, "/callback")
 * // Returns: "https://myapp.com/auth/callback"
 * ```
 */
export const getRelativeUrl = (c: Context, path: string): string => {
	const result = new URL(path, c.req.url)
	result.host = c.req.header("x-forwarded-host") || result.host
	result.protocol = c.req.header("x-forwarded-proto") || result.protocol
	result.port = c.req.header("x-forwarded-port") || result.port
	return result.toString()
}

/**
 * Determines if two hostnames should be treated as belonging to the same site for Draft Auth's
 * default allow policy.
 *
 * This is intentionally a lightweight heuristic that allows exact matches and direct subdomains of
 * the same registrable-looking suffix. It is not a full public-suffix implementation.
 *
 * @param a - First domain name to compare
 * @param b - Second domain name to compare
 * @returns True if domains are considered a security match
 *
 * @example
 * ```ts
 * isDomainMatch("app.example.com", "auth.example.com") // true
 * isDomainMatch("example.com", "auth.example.com") // true
 * isDomainMatch("example.com", "evil.com") // false
 * ```
 */
export const isDomainMatch = (a: string, b: string): boolean => {
	if (a === b) {
		return true
	}

	const partsA = a.split(".")
	const partsB = b.split(".")
	const tailA = partsA.slice(-2).join(".")
	const tailB = partsB.slice(-2).join(".")

	return tailA === tailB
}

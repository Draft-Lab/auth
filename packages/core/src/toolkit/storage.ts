/**
 * Storage adapters for PKCE state management across different runtime environments.
 * Provides implementations for browser (sessionStorage/localStorage), server (cookies),
 * and custom storage backends.
 */

/**
 * PKCE state data stored during OAuth flow.
 */
export interface PKCEState {
	/** Random state parameter for CSRF protection */
	readonly state: string
	/** PKCE code verifier for token exchange */
	readonly verifier: string
	/** OAuth provider identifier */
	readonly provider: string
	/** Optional nonce for additional security */
	readonly nonce?: string
}

/**
 * Storage interface for persisting PKCE state during OAuth flow.
 * Implement this interface to provide custom storage backends.
 */
export interface AuthStorage {
	/**
	 * Store PKCE state data.
	 * @param state - PKCE state to persist
	 */
	set(state: PKCEState): void | Promise<void>

	/**
	 * Retrieve stored PKCE state data.
	 * @returns Stored state or null if not found
	 */
	get(): PKCEState | null | Promise<PKCEState | null>

	/**
	 * Clear stored PKCE state data.
	 */
	clear(): void | Promise<void>
}

const STORAGE_KEY = "draftauth.pkce"

/**
 * Creates a browser sessionStorage adapter for PKCE state.
 * Suitable for client-side SPAs where state should only persist during the browser session.
 *
 * @returns AuthStorage implementation using sessionStorage
 *
 * @example
 * ```ts
 * const storage = createSessionStorage()
 *
 * // Use in toolkit client
 * const client = createOAuthClient({
 *   storage,
 *   providers: { ... }
 * })
 * ```
 */
export const createSessionStorage = (): AuthStorage => ({
	set: (data: PKCEState): void => {
		if (typeof sessionStorage === "undefined") {
			throw new Error("sessionStorage is not available in this environment")
		}
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
	},

	get: (): PKCEState | null => {
		if (typeof sessionStorage === "undefined") {
			return null
		}
		const data = sessionStorage.getItem(STORAGE_KEY)
		return data ? (JSON.parse(data) as PKCEState) : null
	},

	clear: (): void => {
		if (typeof sessionStorage === "undefined") {
			return
		}
		sessionStorage.removeItem(STORAGE_KEY)
	}
})

/**
 * Creates a browser localStorage adapter for PKCE state.
 * Suitable for client-side SPAs where state should persist across browser sessions.
 *
 * ⚠️ Warning: localStorage persists data indefinitely. Consider using sessionStorage
 * for better security, as it automatically clears on browser close.
 *
 * @returns AuthStorage implementation using localStorage
 *
 * @example
 * ```ts
 * const storage = createLocalStorage()
 *
 * // Use in toolkit client
 * const client = createOAuthClient({
 *   storage,
 *   providers: { ... }
 * })
 * ```
 */
export const createLocalStorage = (): AuthStorage => ({
	set: (data: PKCEState): void => {
		if (typeof localStorage === "undefined") {
			throw new Error("localStorage is not available in this environment")
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
	},

	get: (): PKCEState | null => {
		if (typeof localStorage === "undefined") {
			return null
		}
		const data = localStorage.getItem(STORAGE_KEY)
		return data ? (JSON.parse(data) as PKCEState) : null
	},

	clear: (): void => {
		if (typeof localStorage === "undefined") {
			return
		}
		localStorage.removeItem(STORAGE_KEY)
	}
})

/**
 * Creates a memory-based storage adapter for PKCE state.
 * Suitable for server-side rendering or testing environments.
 * State is lost when the process terminates or page reloads.
 *
 * @returns AuthStorage implementation using in-memory storage
 *
 * @example
 * ```ts
 * // Server-side or testing
 * const storage = createMemoryStorage()
 *
 * const client = createOAuthClient({
 *   storage,
 *   providers: { ... }
 * })
 * ```
 */
export const createMemoryStorage = (): AuthStorage => {
	let state: PKCEState | null = null

	return {
		set: (data: PKCEState): void => {
			state = data
		},

		get: (): PKCEState | null => {
			return state
		},

		clear: (): void => {
			state = null
		}
	}
}

/**
 * Creates a cookie-based storage adapter for PKCE state.
 * Suitable for server-side OAuth flows (Next.js, Remix, etc.) where you need
 * to persist state across requests.
 *
 * @param options - Cookie configuration options
 * @returns AuthStorage implementation using cookies
 *
 * @example
 * ```ts
 * // Next.js App Router
 * import { cookies } from 'next/headers'
 *
 * const storage = createCookieStorage({
 *   getCookie: (name) => cookies().get(name)?.value ?? null,
 *   setCookie: (name, value, opts) => {
 *     cookies().set(name, value, {
 *       httpOnly: true,
 *       secure: true,
 *       sameSite: 'lax',
 *       maxAge: opts.maxAge
 *     })
 *   },
 *   deleteCookie: (name) => cookies().delete(name)
 * })
 *
 * // TanStack Start
 * import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
 *
 * const storage = createCookieStorage({
 *   getCookie,
 *   setCookie: (name, value, opts) => setCookie(name, value, opts),
 *   deleteCookie
 * })
 * ```
 */
export const createCookieStorage = (options: {
	getCookie: (name: string) => string | null | Promise<string | null>
	setCookie: (
		name: string,
		value: string,
		options: { maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }
	) => void | Promise<void>
	deleteCookie: (name: string) => void | Promise<void>
}): AuthStorage => ({
	set: async (data: PKCEState): Promise<void> => {
		await options.setCookie(STORAGE_KEY, JSON.stringify(data), {
			maxAge: 60 * 10, // 10 minutes (typical OAuth flow duration)
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax"
		})
	},

	get: async (): Promise<PKCEState | null> => {
		const value = await options.getCookie(STORAGE_KEY)
		return value ? (JSON.parse(value) as PKCEState) : null
	},

	clear: async (): Promise<void> => {
		await options.deleteCookie(STORAGE_KEY)
	}
})

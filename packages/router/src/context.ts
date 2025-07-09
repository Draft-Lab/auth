import type { CookieOptions, RouterContext, VariableMap } from "./types"
import { ContextVariableManager } from "./variables"

const parseCookies = (request: Request): Map<string, string> => {
	const cookies = new Map<string, string>()
	const cookieHeader = request.headers.get("cookie")
	if (!cookieHeader) return cookies

	try {
		for (const cookie of cookieHeader.split(";")) {
			const trimmedCookie = cookie.trim()
			if (!trimmedCookie) continue

			const [name, ...valueParts] = trimmedCookie.split("=")
			if (!name || name.trim() === "") continue

			const trimmedName = name.trim()
			if (!/^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(trimmedName)) {
				console.warn(`Invalid cookie name: ${trimmedName}`)
				continue
			}

			const value = valueParts.join("=")
			try {
				cookies.set(trimmedName, decodeURIComponent(value))
			} catch {
				cookies.set(trimmedName, value)
			}
		}
	} catch (error) {
		console.error("Failed to parse cookies:", error)
	}

	return cookies
}

const serializeCookie = (name: string, value: string, options: CookieOptions = {}): string => {
	if (!/^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(name)) {
		throw new Error(`Invalid cookie name: ${name}`)
	}

	const parts = [`${name}=${encodeURIComponent(value)}`]
	if (options.domain) parts.push(`Domain=${options.domain}`)
	if (options.path) parts.push(`Path=${options.path}`)
	if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
	if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`)
	if (options.httpOnly) parts.push("HttpOnly")
	if (options.secure) parts.push("Secure")
	if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)

	return parts.join("; ")
}

const validateRedirectStatus = (
	status: number
): status is 300 | 301 | 302 | 303 | 307 | 308 => {
	const validStatuses = [300, 301, 302, 303, 307, 308]
	if (!validStatuses.includes(status)) {
		throw new Error(`Invalid redirect status code: ${status}.`)
	}

	return true
}

export class ContextBuilder<TVariables extends VariableMap = VariableMap> {
	private readonly request: Request
	private readonly matchedParams: Record<string, string>
	private readonly searchParams: URLSearchParams
	private readonly cookies: Map<string, string>
	private readonly variableManager: ContextVariableManager<TVariables>

	private readonly responseHeaders = new Headers()
	private status: number = 200
	private finalized = false

	constructor(
		request: Request,
		matchedParams: Record<string, string>,
		initialVariables?: Partial<TVariables>
	) {
		if (!(request instanceof Request)) {
			throw new Error("Invalid request object provided to ContextBuilder.")
		}

		this.request = request
		this.matchedParams = matchedParams
		const url = new URL(request.url)
		this.searchParams = url.searchParams
		this.cookies = parseCookies(request)
		this.variableManager = new ContextVariableManager(initialVariables)

		Object.freeze(this.matchedParams)
	}

	build<TParams extends Record<string, string>>(): RouterContext<TParams, TVariables> {
		return {
			request: this.request,
			params: this.matchedParams as TParams,
			searchParams: this.searchParams,

			query: (key) => this.searchParams.get(key) ?? undefined,
			header: (key) => this.request.headers.get(key) ?? undefined,
			cookie: (key) => this.cookies.get(key),

			formData: () => {
				if (this.request.bodyUsed) {
					throw new Error("Request body has already been consumed.")
				}

				return this.request.formData()
			},

			parseJson: async <T>() => {
				if (this.request.bodyUsed) {
					throw new Error("Request body has already been consumed.")
				}
				try {
					const text = await this.request.text()
					if (!text) throw new Error("Request body is empty.")
					return JSON.parse(text) as T
				} catch (error) {
					throw new Error(
						`Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`
					)
				}
			},

			parseText: () => {
				if (this.request.bodyUsed) {
					throw new Error("Request body has already been consumed.")
				}
				return this.request.text()
			},

			redirect: (url, status = 302) => {
				validateRedirectStatus(status)
				const location = url instanceof URL ? url.toString() : url
				return this.newResponse(undefined, {
					status,
					headers: { location }
				})
			},

			json: <T>(data: T, init?: ResponseInit) => {
				const finalInit = {
					...init,
					headers: {
						"content-type": "application/json; charset=utf-8",
						...init?.headers
					}
				}
				return this.newResponse(JSON.stringify(data), finalInit)
			},

			text: (data, init) => {
				const finalInit = {
					...init,
					headers: {
						"content-type": "text/plain; charset=utf-8",
						...init?.headers
					}
				}
				return this.newResponse(data, finalInit)
			},

			html: (data, init) => {
				const finalInit = {
					...init,
					headers: {
						"content-type": "text/html; charset=utf-8",
						...init?.headers
					}
				}
				return this.newResponse(data, finalInit)
			},

			setCookie: (name, value, options) => {
				try {
					const cookie = serializeCookie(name, value, options)
					this.responseHeaders.append("Set-Cookie", cookie)
				} catch (error) {
					console.error(`Failed to set cookie "${name}":`, error)
				}
			},

			deleteCookie: (name, options) => {
				try {
					const cookie = serializeCookie(name, "", { ...options, expires: new Date(0) })
					this.responseHeaders.append("Set-Cookie", cookie)
				} catch (error) {
					console.error(`Failed to delete cookie "${name}":`, error)
				}
			},

			newResponse: (body?: BodyInit, init?: ResponseInit) => this.newResponse(body, init),

			set: <K extends keyof TVariables>(key: K, value: TVariables[K]): void => {
				this.variableManager.set(key, value)
			},

			get: <K extends keyof TVariables>(key: K): TVariables[K] => {
				return this.variableManager.get(key)
			},

			has: <K extends keyof TVariables>(key: K): key is K => {
				return this.variableManager.has(key)
			}
		}
	}

	getVariableManager(): ContextVariableManager<TVariables> {
		return this.variableManager
	}

	setResponseHeader(name: string, value: string): void {
		this.responseHeaders.set(name, value)
	}

	newResponse(body?: BodyInit, init?: ResponseInit): Response {
		if (this.finalized) {
			throw new Error("Response already finalized")
		}

		const finalHeaders = new Headers(this.responseHeaders)

		if (init?.headers) {
			const providedHeaders = new Headers(init.headers)
			providedHeaders.forEach((value, key) => {
				if (key.toLowerCase() === "set-cookie") {
					finalHeaders.append(key, value)
				} else {
					finalHeaders.set(key, value)
				}
			})
		}

		const response = new Response(body, {
			status: init?.status || this.status,
			statusText: init?.statusText,
			headers: finalHeaders
		})

		this.finalized = true
		return response
	}

	getResponseHeaders(): Headers {
		return new Headers(this.responseHeaders)
	}
}

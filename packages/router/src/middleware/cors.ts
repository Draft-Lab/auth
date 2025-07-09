import type { MiddlewareHandler, RouterContext, VariableMap } from "../types"

export interface CORSOptions {
	origin?:
		| "*"
		| string
		| readonly string[]
		| ((
				origin: string,
				ctx: RouterContext<Record<string, string>, VariableMap>
		  ) => string | null)
	allowMethods?:
		| readonly string[]
		| ((
				origin: string,
				ctx: RouterContext<Record<string, string>, VariableMap>
		  ) => readonly string[])
	allowHeaders?: readonly string[]
	maxAge?: number
	credentials?: boolean
	exposeHeaders?: readonly string[]
	preflightHandler?: <TVariables extends VariableMap>(
		ctx: RouterContext<Record<string, string>, TVariables>
	) => Promise<Response> | Response
}

const DEFAULT_CORS_OPTIONS = {
	origin: "*" as const,
	allowMethods: [
		"GET",
		"HEAD",
		"PUT",
		"POST",
		"DELETE",
		"PATCH",
		"OPTIONS"
	] as readonly string[],
	allowHeaders: [] as readonly string[],
	maxAge: 86400,
	credentials: false,
	exposeHeaders: [] as readonly string[]
}

type OriginResolver = (
	origin: string,
	ctx: RouterContext<Record<string, string>, VariableMap>
) => string | null

type MethodsResolver = (
	origin: string,
	ctx: RouterContext<Record<string, string>, VariableMap>
) => readonly string[]

const createOriginResolver = (origin: CORSOptions["origin"]): OriginResolver => {
	if (!origin || origin === "*") {
		return () => "*"
	}

	if (typeof origin === "string") {
		return (requestOrigin: string) => (origin === requestOrigin ? origin : null)
	}

	if (typeof origin === "function") {
		return origin
	}

	if (Array.isArray(origin)) {
		const allowedOrigins = new Set(origin)
		return (requestOrigin: string) =>
			allowedOrigins.has(requestOrigin) ? requestOrigin : null
	}

	return () => null
}

const createMethodsResolver = (methods: CORSOptions["allowMethods"]): MethodsResolver => {
	if (typeof methods === "function") {
		return methods
	}

	if (Array.isArray(methods)) {
		return () => methods
	}

	return () => DEFAULT_CORS_OPTIONS.allowMethods
}

const normalizeCORSOptions = (
	options: CORSOptions = {}
): CORSOptions & {
	_originResolver: OriginResolver
	_methodsResolver: MethodsResolver
} => {
	const opts = { ...DEFAULT_CORS_OPTIONS, ...options }

	if (opts.maxAge < 0) {
		throw new Error("CORS maxAge must be non-negative")
	}

	if (Array.isArray(opts.allowMethods)) {
		const validMethods = new Set(["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"])
		const invalidMethods = opts.allowMethods.filter(
			(method) => !validMethods.has((method as string).toUpperCase())
		)
		if (invalidMethods.length > 0) {
			console.warn(`CORS: Invalid HTTP methods detected: ${invalidMethods.join(", ")}`)
		}
	}

	return {
		...opts,
		_originResolver: createOriginResolver(options.origin),
		_methodsResolver: createMethodsResolver(options.allowMethods)
	}
}

export const cors = <TVariables extends VariableMap = VariableMap>(
	options: CORSOptions = {}
): MiddlewareHandler<Record<string, string>, TVariables> => {
	const opts = normalizeCORSOptions(options)

	return async (ctx, next) => {
		const requestOrigin = ctx.header("origin") || ""
		const requestMethod = ctx.request.method.toUpperCase()

		const allowedOrigin = opts._originResolver(requestOrigin, ctx)

		const corsHeaders: Record<string, string> = {}

		if (allowedOrigin) {
			corsHeaders["Access-Control-Allow-Origin"] = allowedOrigin
		}

		if (opts.origin !== "*" && allowedOrigin) {
			const existingVary = ctx.header("vary")
			corsHeaders.Vary = existingVary ? `${existingVary}, Origin` : "Origin"
		}

		if (opts.credentials) {
			corsHeaders["Access-Control-Allow-Credentials"] = "true"
		}

		if (opts.exposeHeaders && opts.exposeHeaders.length > 0) {
			corsHeaders["Access-Control-Expose-Headers"] = opts.exposeHeaders.join(",")
		}

		if (requestMethod === "OPTIONS") {
			if (opts.preflightHandler) {
				return await opts.preflightHandler(ctx)
			}

			if (opts.maxAge != null) {
				corsHeaders["Access-Control-Max-Age"] = opts.maxAge.toString()
			}

			const allowedMethods = opts._methodsResolver(requestOrigin, ctx)
			if (allowedMethods.length > 0) {
				corsHeaders["Access-Control-Allow-Methods"] = allowedMethods.join(",")
			}

			let allowedHeaders = opts.allowHeaders
			if (!allowedHeaders || allowedHeaders.length === 0) {
				const requestHeaders = ctx.header("access-control-request-headers")
				if (requestHeaders) {
					allowedHeaders = requestHeaders.split(/\s*,\s*/)
				}
			}

			if (allowedHeaders && allowedHeaders.length > 0) {
				corsHeaders["Access-Control-Allow-Headers"] = allowedHeaders.join(",")
				const existingVary = corsHeaders.Vary || ctx.header("vary")
				corsHeaders.Vary = existingVary
					? `${existingVary}, Access-Control-Request-Headers`
					: "Access-Control-Request-Headers"
			}

			const headers = new Headers()
			Object.entries(corsHeaders).forEach(([key, value]) => {
				headers.set(key, value)
			})

			return new Response(null, {
				status: 204,
				statusText: "No Content",
				headers
			})
		}

		const response = await next()

		return applyCORSHeaders(response, corsHeaders)
	}
}

const applyCORSHeaders = (
	response: Response,
	corsHeaders: Record<string, string>
): Response => {
	if (Object.keys(corsHeaders).length === 0) {
		return response
	}

	const newHeaders = new Headers(response.headers)
	Object.entries(corsHeaders).forEach(([key, value]) => {
		newHeaders.set(key, value)
	})

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders
	})
}

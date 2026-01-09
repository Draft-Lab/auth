export type ExtractParams<T extends string> = string extends T
	? Record<string, string>
	: T extends `${string}:${infer Param}/${infer Rest}`
		? { readonly [K in Param]: string } & ExtractParams<`/${Rest}`>
		: T extends `${string}:${infer Param}`
			? { readonly [K in Param]: string }
			: Record<string, never>

export type VariableMap = Record<string, unknown>

export interface RouterEnvironment<TVariables extends VariableMap = VariableMap> {
	Variables: TVariables
}

export interface CookieOptions {
	domain?: string
	path?: string
	expires?: Date
	maxAge?: number
	httpOnly?: boolean
	secure?: boolean
	sameSite?: "Strict" | "Lax" | "None"
}

export interface RouterContext<
	TParams extends Record<string, string> = Record<string, string>,
	TVariables extends VariableMap = VariableMap
> {
	readonly request: Request
	readonly params: Readonly<TParams>
	readonly searchParams: Readonly<URLSearchParams>

	query<K extends string>(key: K): string | undefined
	header<K extends string>(key: K): string | undefined
	cookie<K extends string>(key: K): string | undefined

	formData(): Promise<FormData>
	parseJson<T = unknown>(): Promise<T>

	json<T>(data: T, init?: ResponseInit): Response
	redirect(url: string | URL, status?: 300 | 301 | 302 | 303 | 307 | 308): Response
	text(data: string, init?: ResponseInit): Response

	setCookie(name: string, value: string, options?: CookieOptions): void
	deleteCookie(name: string, options?: Pick<CookieOptions, "domain" | "path">): void

	newResponse(body?: BodyInit, init?: ResponseInit): Response

	set<K extends keyof TVariables>(key: K, value: TVariables[K]): void
	get<K extends keyof TVariables>(key: K): TVariables[K]
	has<K extends keyof TVariables>(key: K): key is K
}

export type RouteHandler<
	TParams extends Record<string, string> = Record<string, string>,
	TVariables extends VariableMap = VariableMap
> = (ctx: RouterContext<TParams, TVariables>) => Promise<Response> | Response

export type MiddlewareHandler<
	TParams extends Record<string, string> = Record<string, string>,
	TVariables extends VariableMap = VariableMap
> = (
	ctx: RouterContext<TParams, TVariables>,
	next: () => Promise<Response> | Response
) => Promise<Response> | Response

export type EnhancedRouteHandler<
	TParams extends Record<string, string> = Record<string, string>,
	TVariables extends VariableMap = VariableMap
> = {
	handler: RouteHandler<TParams, TVariables>
	middleware?: MiddlewareHandler<TParams, TVariables>[]
}

export type AnyHandler<
	TParams extends Record<string, string>,
	TVariables extends VariableMap = VariableMap
> = RouteHandler<TParams, TVariables> | EnhancedRouteHandler<TParams, TVariables>

export type HttpMethod = "GET" | "POST"

export interface CompiledRoute {
	regex: RegExp
	paramNames: string[]
	pattern: string
}

export interface MatchResult {
	params: Record<string, string>
	pattern: string
}

export interface RouteDefinition<TVariables extends VariableMap = VariableMap> {
	method: HttpMethod
	pattern: string
	handler: RouteHandler<Record<string, string>, TVariables>
	middleware: MiddlewareHandler<Record<string, string>, TVariables>[]
	compiled: CompiledRoute
}

export interface RouterOptions {
	caseSensitive?: boolean
	strict?: boolean
	basePath?: string
}

export type ErrorHandler<TVariables extends VariableMap = VariableMap> = (
	error: Error,
	ctx: RouterContext<Record<string, string>, TVariables>
) => Promise<Response> | Response

export type GlobalMiddleware<TVariables extends VariableMap = VariableMap> = (
	ctx: RouterContext<Record<string, string>, TVariables>,
	next: () => Promise<Response> | Response
) => Promise<Response> | Response

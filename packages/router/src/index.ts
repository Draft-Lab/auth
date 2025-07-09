import { ContextBuilder } from "./context"
import { RouteMatcher } from "./matcher"
import type {
	AnyHandler,
	ErrorHandler,
	ExtractParams,
	GlobalMiddleware,
	HttpMethod,
	MiddlewareHandler,
	RouteDefinition,
	RouteHandler,
	RouterContext,
	RouterEnvironment,
	RouterOptions
} from "./types"

export class Router<TEnvironment extends RouterEnvironment = RouterEnvironment> {
	private readonly routes = new Map<HttpMethod, RouteDefinition<TEnvironment["Variables"]>[]>()
	private readonly matcher: RouteMatcher
	private readonly routerOptions: RouterOptions
	private readonly globalMiddleware: GlobalMiddleware<TEnvironment["Variables"]>[] = []
	private errorHandler?: ErrorHandler<TEnvironment["Variables"]>

	constructor(routerOptions: RouterOptions = {}) {
		this.routerOptions = routerOptions
		this.matcher = new RouteMatcher(routerOptions)
	}

	private addRoute<TPath extends string>(
		method: HttpMethod,
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		const {
			handler: mainHandler,
			middleware = [],
			metadata
		} = typeof handler === "function" ? { handler } : handler

		if (typeof mainHandler !== "function") {
			throw new Error(`Handler for ${method} ${path} must be a function.`)
		}

		const route: RouteDefinition<TEnvironment["Variables"]> = {
			method,
			pattern: path,
			handler: mainHandler as RouteHandler<Record<string, string>, TEnvironment["Variables"]>,
			middleware: [
				...(this.globalMiddleware as MiddlewareHandler<
					Record<string, string>,
					TEnvironment["Variables"]
				>[]),
				...(middleware as MiddlewareHandler<
					Record<string, string>,
					TEnvironment["Variables"]
				>[])
			],
			compiled: this.matcher.compile(path),
			metadata
		}

		const methodRoutes = this.routes.get(method) ?? []
		if (methodRoutes.some((r) => r.pattern === path)) {
			console.warn(`Route already exists: ${method} ${path}. Overwriting.`)
		}

		const newRoutes = [...methodRoutes.filter((r) => r.pattern !== path), route]
		const sortedPatterns = this.matcher.sortRoutesBySpecificity(
			newRoutes.map((r) => r.pattern)
		)
		newRoutes.sort(
			(a, b) => sortedPatterns.indexOf(a.pattern) - sortedPatterns.indexOf(b.pattern)
		)

		this.routes.set(method, newRoutes)
		return this
	}

	get<TPath extends string>(
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		return this.addRoute("GET", path, handler)
	}

	post<TPath extends string>(
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		return this.addRoute("POST", path, handler)
	}

	put<TPath extends string>(
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		return this.addRoute("PUT", path, handler)
	}

	delete<TPath extends string>(
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		return this.addRoute("DELETE", path, handler)
	}

	patch<TPath extends string>(
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		return this.addRoute("PATCH", path, handler)
	}

	head<TPath extends string>(
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		return this.addRoute("HEAD", path, handler)
	}

	options<TPath extends string>(
		path: TPath,
		handler: AnyHandler<ExtractParams<TPath>, TEnvironment["Variables"]>
	): this {
		return this.addRoute("OPTIONS", path, handler)
	}

	use(middleware: GlobalMiddleware<TEnvironment["Variables"]>): this {
		this.globalMiddleware.push(middleware)
		return this
	}

	onError(handler: ErrorHandler<TEnvironment["Variables"]>): this {
		this.errorHandler = handler
		return this
	}

	mount<TMountedEnvironment extends RouterEnvironment>(
		path: string,
		router: Router<TMountedEnvironment>
	): this {
		const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path

		for (const [method, routes] of router.routes) {
			for (const route of routes) {
				this.addRoute(method, `${normalizedPath}${route.pattern}`, {
					handler: route.handler as RouteHandler<
						Record<string, string>,
						TEnvironment["Variables"]
					>,
					middleware: route.middleware as MiddlewareHandler<
						Record<string, string>,
						TEnvironment["Variables"]
					>[],
					metadata: route.metadata
				})
			}
		}

		return this
	}

	group<TGroupEnvironment extends RouterEnvironment = TEnvironment>(
		prefix: string,
		callback: (router: Router<TGroupEnvironment>) => void
	): this {
		const groupRouter = new Router<TGroupEnvironment>(this.routerOptions)
		callback(groupRouter)
		this.mount(prefix, groupRouter)
		return this
	}

	async handle(
		request: Request,
		initialVariables?: Partial<TEnvironment["Variables"]>
	): Promise<Response> {
		try {
			const url = new URL(request.url)
			const method = request.method.toUpperCase() as HttpMethod
			const pathname = this.matcher.normalizePath(url.pathname)

			const methodRoutes = this.routes.get(method)
			if (!methodRoutes) {
				return this.createErrorResponse("Not Found", 404)
			}

			for (const route of methodRoutes) {
				const match = this.matcher.match(route.pattern, pathname)
				if (match) {
					const contextBuilder = new ContextBuilder<TEnvironment["Variables"]>(
						request,
						match.params,
						initialVariables
					)
					const context = contextBuilder.build()

					const allMiddleware = [...this.globalMiddleware, ...route.middleware]

					const run = async (
						index: number,
						ctx: RouterContext<Record<string, string>, TEnvironment["Variables"]>
					): Promise<Response> => {
						if (index < allMiddleware.length) {
							const middleware = allMiddleware[index]
							if (middleware) {
								return middleware(ctx, () => run(index + 1, ctx))
							}
						}
						return route.handler(ctx)
					}

					return await run(0, context)
				}
			}

			return this.createErrorResponse(`Route not found: ${method} ${pathname}`, 404)
		} catch (error) {
			console.error("Router handle error:", error)

			if (this.errorHandler) {
				try {
					const contextBuilder = new ContextBuilder<TEnvironment["Variables"]>(
						request,
						{},
						initialVariables
					)
					const errorContext = contextBuilder.build()
					return await this.errorHandler(error as Error, errorContext)
				} catch (handlerError) {
					console.error("Error handler failed:", handlerError)
				}
			}

			const message = error instanceof Error ? error.message : "Internal Server Error"
			return this.createErrorResponse(message, 500)
		}
	}

	get fetch() {
		return (request: Request): Promise<Response> => {
			return this.handle(request)
		}
	}

	async request(
		requestOrUrl: Request | string,
		optionsOrInitialVariables?: RequestInit | Partial<TEnvironment["Variables"]>
	): Promise<Response> {
		let request: Request
		let initialVariables: Partial<TEnvironment["Variables"]> | undefined

		if (typeof requestOrUrl === "string") {
			request = new Request(requestOrUrl, optionsOrInitialVariables as RequestInit)
			initialVariables = undefined
		} else {
			request = requestOrUrl
			initialVariables = optionsOrInitialVariables as Partial<TEnvironment["Variables"]>
		}

		return this.handle(request, initialVariables)
	}

	private createErrorResponse(message: string, status: number): Response {
		return new Response(JSON.stringify({ error: message, status }), {
			status,
			headers: { "Content-Type": "application/json" }
		})
	}

	getRoutes(): ReadonlyMap<HttpMethod, readonly RouteDefinition<TEnvironment["Variables"]>[]> {
		const routesCopy = new Map<
			HttpMethod,
			readonly RouteDefinition<TEnvironment["Variables"]>[]
		>()
		for (const [method, routes] of this.routes) {
			routesCopy.set(method, [...routes])
		}
		return routesCopy
	}

	hasErrorHandler(): boolean {
		return this.errorHandler !== undefined
	}

	getStats(): {
		totalRoutes: number
		routesByMethod: Record<HttpMethod, number>
		hasErrorHandler: boolean
	} {
		const routesByMethod = {} as Record<HttpMethod, number>
		let totalRoutes = 0

		for (const [method, routes] of this.routes) {
			routesByMethod[method] = routes.length
			totalRoutes += routes.length
		}

		return {
			totalRoutes,
			routesByMethod,
			hasErrorHandler: this.hasErrorHandler()
		}
	}
}

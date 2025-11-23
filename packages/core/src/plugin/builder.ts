import type { PluginBuilder } from "./plugin"
import type {
	Plugin,
	PluginAuthorizeHook,
	PluginErrorHook,
	PluginInitHook,
	PluginRoute,
	PluginRouteHandler,
	PluginSuccessHook
} from "./types"

/**
 * Create a new plugin builder.
 * Plugins are built using a fluent API that supports routes and lifecycle hooks.
 *
 * @param id - Unique identifier for the plugin
 * @returns Plugin builder with chainable methods
 *
 * @example
 * ```ts
 * const analytics = plugin("analytics")
 *   .onSuccess(async (ctx) => {
 *     await ctx.storage.set(`success:${ctx.clientID}`, ctx.subject)
 *   })
 *   .post("/stats", async (ctx) => {
 *     const stats = await ctx.pluginStorage.get("stats")
 *     return ctx.json(stats)
 *   })
 *   .build()
 * ```
 */
export const plugin = (id: string): PluginBuilder => {
	if (!id || typeof id !== "string") {
		throw new Error("Plugin id must be a non-empty string")
	}

	const routes: PluginRoute[] = []
	const registeredPaths = new Set<string>()
	let initHook: PluginInitHook | undefined
	let authorizeHook: PluginAuthorizeHook | undefined
	let successHook: PluginSuccessHook | undefined
	let errorHook: PluginErrorHook | undefined

	const validatePath = (path: string) => {
		if (!path || typeof path !== "string") {
			throw new Error("Route path must be a non-empty string")
		}
		if (!path.startsWith("/")) {
			throw new Error("Route path must start with '/'")
		}
	}

	return {
		get(path: string, handler: PluginRouteHandler) {
			validatePath(path)
			const routeKey = `GET ${path}`

			if (registeredPaths.has(routeKey)) {
				throw new Error(`Route ${routeKey} already registered in plugin '${id}'`)
			}

			registeredPaths.add(routeKey)
			routes.push({ method: "GET", path, handler })
			return this
		},

		post(path: string, handler: PluginRouteHandler) {
			validatePath(path)
			const routeKey = `POST ${path}`

			if (registeredPaths.has(routeKey)) {
				throw new Error(`Route ${routeKey} already registered in plugin '${id}'`)
			}

			registeredPaths.add(routeKey)
			routes.push({ method: "POST", path, handler })
			return this
		},

		onInit(handler: PluginInitHook) {
			if (initHook) {
				throw new Error(`onInit hook already defined for plugin '${id}'`)
			}
			initHook = handler
			return this
		},

		onAuthorize(handler: PluginAuthorizeHook) {
			if (authorizeHook) {
				throw new Error(`onAuthorize hook already defined for plugin '${id}'`)
			}
			authorizeHook = handler
			return this
		},

		onSuccess(handler: PluginSuccessHook) {
			if (successHook) {
				throw new Error(`onSuccess hook already defined for plugin '${id}'`)
			}
			successHook = handler
			return this
		},

		onError(handler: PluginErrorHook) {
			if (errorHook) {
				throw new Error(`onError hook already defined for plugin '${id}'`)
			}
			errorHook = handler
			return this
		},

		build(): Plugin {
			// Routes are optional - plugins can be hooks-only
			return {
				id,
				routes: routes.length > 0 ? routes : undefined,
				onInit: initHook,
				onAuthorize: authorizeHook,
				onSuccess: successHook,
				onError: errorHook
			}
		}
	}
}

import type { PluginBuilder } from "./plugin"
import type { PluginRoute, PluginRouteHandler } from "./types"

/**
 * Create a new plugin
 */
export const plugin = (id: string): PluginBuilder => {
	// Validate plugin id
	if (!id || typeof id !== "string") {
		throw new Error("Plugin id must be a non-empty string")
	}

	const routes: PluginRoute[] = []
	const registeredPaths = new Set<string>()

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
		build() {
			if (routes.length === 0) {
				throw new Error(`Plugin '${id}' has no routes defined`)
			}

			return {
				id,
				routes
			}
		}
	}
}

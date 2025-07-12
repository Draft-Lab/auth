import type { CompiledRoute, MatchResult, RouterOptions } from "./types"

export class RouteMatcher {
	private readonly compiledRoutes = new Map<string, CompiledRoute>()
	private readonly options: Required<RouterOptions>

	constructor(options: RouterOptions = {}) {
		this.options = {
			caseSensitive: false,
			strict: false,
			basePath: "",
			...options
		}
	}

	compile(pattern: string): CompiledRoute {
		const cacheKey = `${pattern}:${this.options.caseSensitive}:${this.options.strict}`
		const cached = this.compiledRoutes.get(cacheKey)
		if (cached) return cached

		const paramNames: string[] = []
		let regexPattern = pattern.replace(/:([^/]+)/g, (_, name) => {
			paramNames.push(name)
			return "([^/]+)"
		})

		regexPattern = regexPattern.replace(/\*/g, "(.*)")

		const finalPattern =
			this.options.strict || pattern === "/"
				? regexPattern
				: `${regexPattern.replace(/\/$/, "")}/?`

		const regex = new RegExp(`^${finalPattern}$`, this.options.caseSensitive ? "" : "i")

		const compiled: CompiledRoute = { regex, paramNames, pattern }
		this.compiledRoutes.set(cacheKey, compiled)
		return compiled
	}

	match(pattern: string, pathname: string): MatchResult | null {
		const compiled = this.compile(pattern)
		const match = pathname.match(compiled.regex)

		if (!match) return null

		const params: Record<string, string> = {}
		for (let i = 0; i < compiled.paramNames.length; i++) {
			const name = compiled.paramNames[i]
			const value = match[i + 1]

			if (name && value !== undefined) {
				try {
					params[name] = decodeURIComponent(value)
				} catch {
					params[name] = value
				}
			}
		}

		return { params: Object.freeze(params), pattern }
	}

	sortRoutesBySpecificity(patterns: string[]): string[] {
		return [...patterns].sort((a, b) => {
			const aScore = this.calculateSpecificity(a)
			const bScore = this.calculateSpecificity(b)
			return bScore - aScore
		})
	}

	private calculateSpecificity(pattern: string): number {
		const segments = pattern.split("/").filter(Boolean)
		let score = 0
		for (const segment of segments) {
			if (segment.startsWith(":")) {
				score += 2
			} else if (segment === "*") {
				score += 1
			} else {
				score += 4
			}
		}
		return score
	}

	normalizePath(pathname: string): string {
		let normalized = pathname
		const { basePath, strict } = this.options

		if (basePath && normalized.startsWith(basePath)) {
			normalized = normalized.slice(basePath.length) || "/"
		}

		if (!normalized.startsWith("/")) {
			normalized = `/${normalized}`
		}

		if (!strict && normalized.length > 1 && normalized.endsWith("/")) {
			normalized = normalized.slice(0, -1)
		}

		return normalized
	}
}

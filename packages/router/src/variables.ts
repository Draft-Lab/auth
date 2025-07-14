import type { VariableMap } from "./types"

export class ContextVariableManager<TVariables extends VariableMap = VariableMap> {
	private readonly state = new Map<string, unknown>()

	constructor(initialVariables?: Partial<TVariables>) {
		if (initialVariables) {
			for (const [key, value] of Object.entries(initialVariables)) {
				this.state.set(key, value)
			}
		}
	}

	set<K extends keyof TVariables>(key: K, value: TVariables[K]): void {
		if (typeof key !== "string" || key.length === 0) {
			throw new Error("Variable key must be a non-empty string")
		}
		this.state.set(key as string, value)
	}

	get<K extends keyof TVariables>(key: K): TVariables[K] {
		return this.state.get(key as string) as TVariables[K]
	}

	has<K extends keyof TVariables>(key: K): key is K {
		return this.state.has(key as string)
	}
}

import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["src/**/*.ts", "src/**/*.tsx", "!src/css.d.ts"],
	format: ["esm"],
	target: "esnext",
	dts: true,
	clean: true,
	unbundle: true
})

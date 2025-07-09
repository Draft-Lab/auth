import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/**/*.ts", "!src/**/*.test.ts", "!src/css.d.ts"],
	format: ["esm"],
	target: "esnext",
	dts: true,
	clean: true
})

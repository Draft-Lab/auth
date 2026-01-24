import { $, Glob } from "bun"
import pkg from "../package.json"

await $`rm -rf dist`

const files = new Glob("./src/**/*.{ts,tsx}").scan()

for await (const file of files) {
	await Bun.build({
		root: "src",
		format: "esm",
		external: ["*"],
		outdir: "dist/esm",
		entrypoints: [file]
	})
}

await Bun.build({
	root: "src",
	format: "esm",
	outdir: "dist/esm",
	entrypoints: ["./src/ui/base.tsx"],
	external: [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)]
})

await $`tsc --outDir dist/types --declaration --emitDeclarationOnly --declarationMap --noEmit false`

console.log("Build complete!")

import { issuer } from "@draftlab/auth/core"
import { CodeProvider } from "@draftlab/auth/provider/code"
import { MagicLinkProvider } from "@draftlab/auth/provider/magiclink"
import { PasskeyProvider } from "@draftlab/auth/provider/passkey"
import { PasswordProvider } from "@draftlab/auth/provider/password"
import { TOTPProvider } from "@draftlab/auth/provider/totp"
import { MemoryStorage } from "@draftlab/auth/storage/memory"
import { CodeUI } from "@draftlab/auth/ui/code"
import { MagicLinkUI } from "@draftlab/auth/ui/magiclink"
import { PasskeyUI } from "@draftlab/auth/ui/passkey"
import { PasswordUI } from "@draftlab/auth/ui/password"
import { Select } from "@draftlab/auth/ui/select"
import { TOTPUI } from "@draftlab/auth/ui/totp"
import { createServerFileRoute } from "@tanstack/react-start/server"
import { subjects } from "@/libs/auth"

export const auth = issuer({
	subjects,
	basePath: "/auth",
	select: Select({
		copy: { button_provider: " " },
		displays: {
			passkey: "Passkey",
			code: "One-Time Code",
			magiclink: "Magic Link",
			password: "Email/Password",
			totp: "Time-Based One-Time Password"
		}
	}),
	storage: MemoryStorage({
		persist: "./persist.json"
	}),
	providers: {
		passkey: PasskeyProvider(
			PasskeyUI({
				rpName: "My Application"
			})
		),
		magiclink: MagicLinkProvider(
			MagicLinkUI({
				sendLink: async (claims, code) => {
					console.log(claims, code)
					return undefined
				}
			})
		),
		code: CodeProvider(
			CodeUI({
				sendCode: async (claims, code) => {
					console.log(claims, code)
					return undefined
				}
			})
		),
		password: PasswordProvider(
			PasswordUI({
				async sendCode(email, code) {
					console.log(email, code)
				}
			})
		),
		totp: TOTPProvider({
			window: 5,
			issuer: "My App",
			...TOTPUI({ qrSize: 250 })
		})
	},
	success: (ctx, value) => {
		if (value.provider === "password") {
			return ctx.subject("user", {
				email: value.email
			})
		}

		if (value.provider === "passkey") {
			return ctx.subject("user", {
				email: value.userId
			})
		}

		if (value.provider === "code") {
			return ctx.subject("user", {
				email: value.claims.email as string
			})
		}

		if (value.provider === "totp") {
			return ctx.subject("user", {
				email: value.email
			})
		}

		if (value.provider === "magiclink") {
			return ctx.subject("user", {
				email: value.claims.email
			})
		}

		throw new Error("Unknown provider")
	}
})

export const ServerRoute = createServerFileRoute("/auth/$").methods({
	GET: ({ request }) => auth.fetch(request),
	POST: ({ request }) => auth.fetch(request)
})

import { issuer } from "@draftlab/auth/core"
import { CodeProvider } from "@draftlab/auth/provider/code"
import { MagicLinkProvider } from "@draftlab/auth/provider/magiclink"
import { PasswordProvider } from "@draftlab/auth/provider/password"
import { MemoryStorage } from "@draftlab/auth/storage/memory"
import { CodeUI } from "@draftlab/auth/ui/code"
import { MagicLinkUI } from "@draftlab/auth/ui/magiclink"
import { PasswordUI } from "@draftlab/auth/ui/password"
import { Select } from "@draftlab/auth/ui/select"
import { createFileRoute } from "@tanstack/react-router"
import { subjects } from "@/libs/auth"

export const auth = issuer({
	subjects,
	basePath: "/auth",
	ttl: {
		reuse: 0,
		access: 3600,
		refresh: 604800,
		retention: 1209600
	},
	select: Select({
		copy: { button_provider: " " },
		displays: {
			code: "One-Time Code",
			magiclink: "Magic Link",
			password: "Email/Password"
		}
	}),
	storage: MemoryStorage({
		persist: "./persist.json"
	}),
	providers: {
		magiclink: MagicLinkProvider(
			MagicLinkUI({
				sendLink: async (claims, link) => {
					console.log(claims, link)
				}
			})
		),
		code: CodeProvider(
			CodeUI({
				sendCode: async (claims, code) => {
					console.log(claims, code)
				}
			})
		),
		password: PasswordProvider(
			PasswordUI({
				async sendCode(email, code, context) {
					console.log(`[${context}] Code for ${email}: ${code}`)
				}
			})
		)
	},
	success: (ctx, value) => {
		if (value.provider === "password") {
			return ctx.subject("user", {
				email: value.email
			})
		}

		if (value.provider === "code") {
			return ctx.subject("user", {
				email: value.claims.email as string
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

export const Route = createFileRoute("/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => auth.fetch(request),
			POST: ({ request }) => auth.fetch(request)
		}
	}
})

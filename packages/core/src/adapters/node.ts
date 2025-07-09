/**
 * Node.js adapter for Draft Auth
 * Converts Node.js IncomingMessage to Web Standards Request
 */
import type { IncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"

/**
 * Converts Node.js IncomingMessage to Web Standards Request
 */
export const nodeRequestAdapter = (req: IncomingMessage): Request => {
	const host = req.headers.host || "localhost"
	const sanitizedHost = host.split(",")[0]?.trim() // Take first host if multiple

	const url = new URL(req.url || "/", `http://${sanitizedHost}`)

	const headers = new Headers()
	for (const [key, value] of Object.entries(req.headers)) {
		if (value !== undefined) {
			if (Array.isArray(value)) {
				for (const v of value) {
					headers.append(key, v)
				}
			} else {
				headers.set(key, value)
			}
		}
	}

	// Convert body for non-GET/HEAD methods
	let body: ReadableStream | undefined
	if (req.method !== "GET" && req.method !== "HEAD") {
		body = Readable.toWeb(req) as ReadableStream
	}

	return new Request(url.toString(), {
		method: req.method || "GET",
		headers,
		body,
		duplex: "half"
	} as RequestInit)
}

/**
 * Writes Web Standards Response to Node.js ServerResponse
 */
export const nodeResponseAdapter = async (
	response: Response,
	res: ServerResponse
): Promise<void> => {
	res.statusCode = response.status
	res.statusMessage = response.statusText

	response.headers.forEach((value, key) => {
		res.setHeader(key, value)
	})

	if (response.body) {
		const reader = response.body.getReader()
		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				// Handle backpressure
				if (!res.write(value)) {
					await new Promise((resolve) => res.once("drain", resolve))
				}
			}
		} finally {
			reader.releaseLock()
		}
	}

	res.end()
}

/**
 * Creates a Node.js HTTP handler from a Web Standards fetch function
 */
export const createNodeHandler = (
	fetchHandler: (request: Request) => Promise<Response>
): ((req: IncomingMessage, res: ServerResponse) => void) => {
	return (req: IncomingMessage, res: ServerResponse) => {
		try {
			const request = nodeRequestAdapter(req)
			fetchHandler(request)
				.then((response) => nodeResponseAdapter(response, res))
				.catch((error) => {
					console.error(
						"Handler error:",
						error instanceof Error ? error.message : "Unknown error"
					)

					// Avoid sending response if already sent
					if (!res.headersSent) {
						res.statusCode = 500
						res.end("Internal Server Error")
					}
				})
		} catch (error) {
			console.error(
				"Request adapter error:",
				error instanceof Error ? error.message : "Unknown error"
			)

			if (!res.headersSent) {
				res.statusCode = 400
				res.end("Bad Request")
			}
		}
	}
}

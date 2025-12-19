/**
 * SafeRequest wraps a Request to cache the body and allow multiple reads.
 * This solves issues with Request implementations that don't support multiple body reads.
 */

interface SafeRequestOptions {
	cache?: RequestCache
	credentials?: RequestCredentials
	destination?: RequestDestination
	integrity?: string
	keepalive?: boolean
	mode?: RequestMode
	redirect?: RequestRedirect
	referrer?: string
	referrerPolicy?: ReferrerPolicy
	signal?: AbortSignal
}

export class SafeRequest implements Request {
	private cachedBody: ReadableStream<Uint8Array> | null = null
	private bodyBuffer: ArrayBuffer | null = null

	readonly cache: RequestCache
	readonly credentials: RequestCredentials
	readonly destination: RequestDestination
	readonly headers: Headers
	readonly integrity: string
	readonly keepalive: boolean
	readonly method: string
	readonly mode: RequestMode
	readonly redirect: RequestRedirect
	readonly referrer: string
	readonly referrerPolicy: ReferrerPolicy
	readonly signal: AbortSignal
	readonly url: string

	constructor(
		url: string,
		method: string,
		headers: Headers,
		body: ArrayBuffer | null,
		options?: SafeRequestOptions
	) {
		this.url = url
		this.method = method
		this.headers = headers
		this.bodyBuffer = body
		this.cache = options?.cache ?? "default"
		this.credentials = options?.credentials ?? "same-origin"
		this.destination = options?.destination ?? ""
		this.integrity = options?.integrity ?? ""
		this.keepalive = options?.keepalive ?? false
		this.mode = options?.mode ?? "cors"
		this.redirect = options?.redirect ?? "follow"
		this.referrer = options?.referrer ?? ""
		this.referrerPolicy = options?.referrerPolicy ?? ""
		this.signal = options?.signal ?? new AbortController().signal
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		return this.bodyBuffer ?? new ArrayBuffer(0)
	}

	async blob(): Promise<Blob> {
		const buffer = await this.arrayBuffer()
		return new Blob([buffer])
	}

	async formData(): Promise<FormData> {
		const buffer = await this.arrayBuffer()
		const blob = new Blob([buffer], {
			type: this.headers.get("content-type") || "application/x-www-form-urlencoded"
		})
		const tempRequest = new Request(this.url, {
			method: this.method,
			headers: this.headers,
			body: blob
		})
		return tempRequest.formData()
	}

	async json<T = unknown>(): Promise<T> {
		const text = await this.text()
		return JSON.parse(text) as T
	}

	async text(): Promise<string> {
		const buffer = await this.arrayBuffer()
		return new TextDecoder().decode(buffer)
	}

	async bytes(): Promise<Uint8Array<ArrayBuffer>> {
		return this.arrayBuffer().then((buffer) => new Uint8Array(buffer))
	}

	get body(): ReadableStream<Uint8Array<ArrayBuffer>> | null {
		if (this.cachedBody) return this.cachedBody as ReadableStream<Uint8Array<ArrayBuffer>>

		if (this.bodyBuffer) {
			const buffer = this.bodyBuffer
			this.cachedBody = new ReadableStream({
				start(controller) {
					controller.enqueue(new Uint8Array(buffer))
					controller.close()
				}
			})
			return this.cachedBody as ReadableStream<Uint8Array<ArrayBuffer>>
		}

		return null
	}

	get bodyUsed(): boolean {
		return false // Always false since we can read multiple times
	}

	clone(): Request {
		return new SafeRequest(this.url, this.method, this.headers, this.bodyBuffer, {
			cache: this.cache,
			credentials: this.credentials,
			destination: this.destination,
			integrity: this.integrity,
			keepalive: this.keepalive,
			mode: this.mode,
			redirect: this.redirect,
			referrer: this.referrer,
			referrerPolicy: this.referrerPolicy,
			signal: this.signal
		}) as unknown as Request
	}
}

/**
 * Extracts data from a Request and creates a SafeRequest.
 * Uses ReadableStream to safely read the body and avoid issues with certain Request implementations.
 */
export async function makeSafeRequest(request: Request): Promise<Request> {
	if (request instanceof SafeRequest) {
		return request
	}

	// Extract basic properties that should be safe to access
	const url = request.url
	const method = request.method
	const headers = new Headers(request.headers)

	// For requests with body, read it via stream for maximum compatibility
	let bodyBuffer: ArrayBuffer | null = null
	const requestMethod = method.toUpperCase()

	if (requestMethod === "POST" || requestMethod === "PUT" || requestMethod === "PATCH") {
		try {
			// Read body via stream for better compatibility with different Request implementations
			const body = request.body
			if (body) {
				const reader = body.getReader()
				const chunks: Uint8Array[] = []

				while (true) {
					const { done, value } = await reader.read()
					if (done) break
					if (value) chunks.push(value)
				}

				// Combine chunks into single ArrayBuffer
				const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
				const combined = new Uint8Array(totalLength)
				let offset = 0
				for (const chunk of chunks) {
					combined.set(chunk, offset)
					offset += chunk.length
				}
				bodyBuffer = combined.buffer
			}
		} catch (error) {
			console.warn("Failed to read request body via stream:", error)
			// Continue without body
		}
	}

	// Extract other properties safely with fallback values
	const options: SafeRequestOptions = {}
	try {
		options.cache = request.cache
	} catch {}
	try {
		options.credentials = request.credentials
	} catch {}
	try {
		options.destination = request.destination
	} catch {}
	try {
		options.integrity = request.integrity
	} catch {}
	try {
		options.keepalive = request.keepalive
	} catch {}
	try {
		options.mode = request.mode
	} catch {}
	try {
		options.redirect = request.redirect
	} catch {}
	try {
		options.referrer = request.referrer
	} catch {}
	try {
		options.referrerPolicy = request.referrerPolicy
	} catch {}
	try {
		options.signal = request.signal
	} catch {}

	return new SafeRequest(url, method, headers, bodyBuffer, options) as unknown as Request
}

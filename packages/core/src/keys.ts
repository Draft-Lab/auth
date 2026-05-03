import {
	type CryptoKey,
	exportJWK,
	exportPKCS8,
	exportSPKI,
	generateKeyPair,
	importPKCS8,
	importSPKI,
	type JWK
} from "jose"
import { Mutex } from "./mutex"
import { generateSecureToken } from "./random"
import { Storage, type StorageAdapter } from "./storage/storage"

/**
 * Cryptographic key management for JWT signing and encryption operations.
 * Handles automatic key generation, rotation, and storage for OAuth operations.
 */

/** Elliptic Curve algorithm used for JWT signing operations */
const signingAlg = "ES256"

/** RSA algorithm used for token encryption operations */
const encryptionAlg = "RSA-OAEP-512"

/** Mutex to prevent concurrent key generation (race condition with eventually consistent storage) */
const signingKeyMutex = new Mutex()
const encryptionKeyMutex = new Mutex()

/**
 * Serialized key pair format for persistent storage.
 * Contains PEM-encoded keys and metadata for reconstruction.
 */
interface SerializedKeyPair {
	/** Unique identifier for the key pair */
	readonly id: string
	/** PEM-encoded public key */
	readonly publicKey: string
	/** PEM-encoded private key */
	readonly privateKey: string
	/** Timestamp when the key was created */
	readonly created: number
	/** Algorithm used for this key pair */
	readonly alg: string
	/** Optional expiration timestamp */
	readonly expired?: number
}

export interface KeyRotationPolicy {
	/**
	 * Keep retired keys usable for this many seconds after a rotation.
	 *
	 * For signing keys, this should be at least as long as the maximum access token lifetime plus a
	 * small safety margin. For encryption keys, this should cover the longest-lived encrypted state
	 * you expect browsers to send back.
	 */
	readonly overlap?: number
	/**
	 * Rotate the active key after this many seconds.
	 *
	 * Defaults to 30 days when omitted.
	 */
	readonly rotateEvery?: number
}

/**
 * Runtime key pair with loaded cryptographic keys and metadata.
 * Ready for immediate use in signing and encryption operations.
 */
export interface KeyPair {
	/** Unique identifier for the key pair */
	readonly id: string
	/** Algorithm used for this key pair */
	readonly alg: string
	/** Loaded public key for verification/encryption */
	readonly public: CryptoKey
	/** Loaded private key for signing/decryption */
	readonly private: CryptoKey
	/** Date when the key was created */
	readonly created: Date
	/** Optional expiration date */
	readonly expired?: Date
	/** JSON Web Key representation for JWKS endpoints */
	readonly jwk: JWK
}

/** Default overlap for signing keys: enough to verify already-issued short-lived access tokens. */
const DEFAULT_SIGNING_OVERLAP_SECONDS = 60 * 60
/** Default rotation cadence for all key types. */
const DEFAULT_ROTATE_EVERY_SECONDS = 60 * 60 * 24 * 30
/** Default overlap for encryption keys: enough to decrypt short-lived encrypted state safely. */
const DEFAULT_ENCRYPTION_OVERLAP_SECONDS = 60 * 60 * 24 + 60 * 5

/**
 * Resolves an effective rotation policy using library defaults when the caller omits values.
 */
const getRotationPolicy = (
	policy: KeyRotationPolicy | undefined,
	defaults: { overlap: number }
) => {
	return {
		overlap: policy?.overlap ?? defaults.overlap,
		rotateEvery: policy?.rotateEvery ?? DEFAULT_ROTATE_EVERY_SECONDS
	}
}

/**
 * Returns true when a key has reached the configured rotation age.
 */
const shouldRotateKey = (created: Date, rotateEverySeconds: number) => {
	return created.getTime() + rotateEverySeconds * 1000 <= Date.now()
}

/**
 * Reconstructs a runtime key pair from its serialized representation.
 * Returns undefined when the stored material is malformed.
 */
const buildRuntimeKeyPair = async (value: SerializedKeyPair): Promise<KeyPair | undefined> => {
	try {
		const publicKey = await importSPKI(value.publicKey, value.alg, {
			extractable: true
		})
		const privateKey = await importPKCS8(value.privateKey, value.alg)
		const jwk = await exportJWK(publicKey)
		jwk.kid = value.id
		if (value.alg === signingAlg) {
			jwk.use = "sig"
		}

		return {
			jwk,
			id: value.id,
			alg: value.alg,
			public: publicKey,
			private: privateKey,
			created: new Date(value.created),
			expired: value.expired ? new Date(value.expired) : undefined
		}
	} catch {
		return undefined
	}
}

/**
 * Removes retired keys that have fully expired and returns the remaining entries sorted with the
 * newest key first.
 */
const pruneExpiredKeys = async (
	storage: StorageAdapter,
	prefix: string[],
	entries: SerializedKeyPair[]
) => {
	const now = Date.now()
	const active: SerializedKeyPair[] = []

	for (const entry of entries) {
		if (entry.expired && entry.expired <= now) {
			await Storage.remove(storage, [...prefix, entry.id])
			continue
		}

		active.push(entry)
	}

	active.sort((left, right) => right.created - left.created)
	return active
}

/**
 * Marks a key as retired while keeping it available for verification/decryption during the
 * configured overlap window.
 */
const rotateExistingKey = async (
	storage: StorageAdapter,
	prefix: string[],
	entry: SerializedKeyPair,
	overlapSeconds: number
) => {
	const retired: SerializedKeyPair = {
		...entry,
		expired: Date.now() + overlapSeconds * 1000
	}

	await Storage.set(storage, [...prefix, retired.id], retired)
	return retired
}

/**
 * Generates and serializes a fresh key pair for the given algorithm.
 */
const generateSerializedKeyPair = async (alg: typeof signingAlg | typeof encryptionAlg) => {
	const key = await generateKeyPair(alg, {
		extractable: true
	})

	const serialized: SerializedKeyPair = {
		id: generateSecureToken(16),
		publicKey: await exportSPKI(key.publicKey),
		privateKey: await exportPKCS8(key.privateKey),
		created: Date.now(),
		alg
	}

	return { key, serialized }
}

/**
 * Loads every serialized key stored under a prefix, pruning any entries whose overlap window has
 * already elapsed.
 */
const loadSerializedKeys = async (storage: StorageAdapter, prefix: string[]) => {
	const results: SerializedKeyPair[] = []
	const scanner = Storage.scan<SerializedKeyPair>(storage, prefix)

	for await (const [, value] of scanner) {
		results.push(value)
	}

	return pruneExpiredKeys(storage, prefix, results)
}

/**
 * Ensures there is always one active key ready for immediate use and rotates it when it reaches
 * the configured age.
 */
const ensureActiveSerializedKey = async (
	storage: StorageAdapter,
	prefix: string[],
	alg: typeof signingAlg | typeof encryptionAlg,
	rotation: { overlap: number; rotateEvery: number }
) => {
	let entries = await loadSerializedKeys(storage, prefix)
	const current = entries.find((item) => !item.expired)

	if (!current) {
		const generated = await generateSerializedKeyPair(alg)
		await Storage.set(storage, [...prefix, generated.serialized.id], generated.serialized)
		return [generated.serialized, ...entries]
	}

	if (!shouldRotateKey(new Date(current.created), rotation.rotateEvery)) {
		return entries
	}

	await rotateExistingKey(storage, prefix, current, rotation.overlap)
	const generated = await generateSerializedKeyPair(alg)
	await Storage.set(storage, [...prefix, generated.serialized.id], generated.serialized)

	entries = await loadSerializedKeys(storage, prefix)
	return [
		generated.serialized,
		...entries.filter((item) => item.id !== generated.serialized.id)
	]
}

/**
 * Loads runtime keys for a prefix, applying the configured rotation policy first.
 */
const loadKeyPairs = async (
	storage: StorageAdapter,
	input: {
		alg: typeof signingAlg | typeof encryptionAlg
		defaultOverlap: number
		policy?: KeyRotationPolicy
		prefix: string[]
	}
) => {
	const rotation = getRotationPolicy(input.policy, {
		overlap: input.defaultOverlap
	})
	const entries = await ensureActiveSerializedKey(storage, input.prefix, input.alg, rotation)
	const runtime = await Promise.all(entries.map((entry) => buildRuntimeKeyPair(entry)))
	return runtime.filter((entry): entry is KeyPair => Boolean(entry))
}

/**
 * Loads or generates signing keys for JWT operations.
 * Returns existing valid keys, or generates new ones if none are available.
 * Keys are automatically sorted by creation date (newest first).
 *
 * @param storage - Storage adapter for persistent key storage
 * @param policy - Optional rotation policy. Lets callers tune rotation cadence and overlap
 * windows while keeping the same KV-backed lifecycle.
 * @returns Promise resolving to array of available signing key pairs
 *
 * @example
 * ```ts
 * const keys = await signingKeys(storage)
 * const currentKey = keys[0] // Most recent key
 *
 * // Use for JWT signing
 * const jwt = await new SignJWT(payload)
 *   .setProtectedHeader({ alg: currentKey.alg, kid: currentKey.id })
 *   .sign(currentKey.private)
 * ```
 */
export const signingKeys = async (
	storage: StorageAdapter,
	policy?: KeyRotationPolicy
): Promise<KeyPair[]> => {
	return signingKeyMutex.runExclusive(async () => {
		return loadKeyPairs(storage, {
			policy,
			alg: signingAlg,
			prefix: ["signing:key"],
			defaultOverlap: DEFAULT_SIGNING_OVERLAP_SECONDS
		})
	})
}

/**
 * Loads or generates encryption keys for token encryption operations.
 * Returns existing valid keys, or generates new ones if none are available.
 * Keys are automatically sorted by creation date (newest first).
 *
 * @param storage - Storage adapter for persistent key storage
 * @param policy - Optional rotation policy. Lets callers tune rotation cadence and overlap
 * windows for encrypted browser state.
 * @returns Promise resolving to array of available encryption key pairs
 *
 * @example
 * ```ts
 * const keys = await encryptionKeys(storage)
 * const currentKey = keys[0] // Most recent key
 *
 * // Use for token encryption
 * const encrypted = await new EncryptJWT(payload)
 *   .setProtectedHeader({ alg: 'RSA-OAEP-512', enc: 'A256GCM' })
 *   .encrypt(currentKey.public)
 * ```
 */
export const encryptionKeys = async (
	storage: StorageAdapter,
	policy?: KeyRotationPolicy
): Promise<KeyPair[]> => {
	return encryptionKeyMutex.runExclusive(async () => {
		return loadKeyPairs(storage, {
			policy,
			alg: encryptionAlg,
			prefix: ["encryption:key"],
			defaultOverlap: DEFAULT_ENCRYPTION_OVERLAP_SECONDS
		})
	})
}

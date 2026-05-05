/**
 * Subjects define the structure of data stored in access tokens after successful authentication.
 * They represent the kinds of authenticated subjects your app can encode into access tokens (for
 * example users or admins) and are stored in the resulting access token payload.
 *
 * ## Quick Start
 *
 * ### 1. Define your subjects
 * ```ts title="subjects.ts"
 * import { array, number, object, string } from "valibot"
 * import { createSubjects } from "@draftlab/auth/subject"
 *
 * export const subjects = createSubjects({
 *   user: object({
 *     userID: string()
 *   }),
 *   admin: object({
 *     userID: string(),
 *     workspaceID: string()
 *   })
 * })
 * ```
 *
 * ### 2. Use in your issuer
 * ```ts title="issuer.ts"
 * import { subjects } from "./subjects"
 *
 * const app = issuer({
 *   providers: { ... },
 *   subjects,
 *   async success(ctx, value) {
 *     const userID = await lookupUser(value.email)
 *     return ctx.subject("user", { userID }, { subject: `user:${userID}` })
 *   }
 * })
 * ```
 *
 * ### 3. Verify tokens in your app
 * ```ts title="middleware.ts"
 * import { subjects } from "./subjects"
 *
 * const verified = await client.verify(subjects, accessToken)
 * if (verified.success) {
 *  // Fully typed: verified.data.subject.properties.userID
 * }
 * ```
 *
 * ## Important Notes
 *
 * - Prefer stable properties such as internal IDs. Avoid properties that may change, such as
 *   usernames or email addresses, unless you are comfortable with token subject data changing
 *   over time.
 * - Keep payload small as it's embedded in every access token
 * - Provide an explicit stable `subject` value when completing sign-in flows if you need the
 *   token subject identifier (`sub`) to remain stable across profile changes and repeated
 *   sign-ins
 * - Use any validation library compatible with standard-schema specification
 *
 * @packageDocumentation
 */
import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { Prettify } from "./util"

/**
 * Schema definition for subjects, mapping subject type names to their validation schemas.
 * Each key represents a subject type, and each value is a schema that validates
 * the properties for that subject type.
 *
 * @example
 * ```ts
 * const schema: SubjectSchema = {
 *   user: object({ userID: string() }),
 *   admin: object({ userID: string(), workspaceID: string() })
 * }
 * ```
 */
export type SubjectSchema = Record<string, StandardSchemaV1>

/**
 * Internal type that transforms a SubjectSchema into a union of subject payload objects.
 * Each payload contains the subject type and its validated properties.
 *
 * @template T - The subject schema to transform
 * @internal
 */
export type SubjectPayload<T extends SubjectSchema> = Prettify<
	{
		[K in keyof T & string]: {
			type: K
			properties: StandardSchemaV1.InferOutput<T[K]>
		}
	}[keyof T & string]
>

/**
 * Extracts the properties type for a specific subject from a subject schema.
 * Useful for creating type aliases for your application's domain models.
 *
 * @template Schema - The subject schema
 * @template Type - The subject type key to extract properties from
 *
 * @example
 * ```ts
 * import { createSubjects, InferSubjectProperties } from "@draftlab/auth/subject"
 * import { object, string } from "valibot"
 *
 * const subjects = createSubjects({
 *   user: object({
 *     userID: string(),
 *     email: string()
 *   })
 * })
 *
 * // Extract the user properties type
 * type User = InferSubjectProperties<typeof subjects, "user">
 * // Result: { userID: string; email: string }
 * ```
 */
export type InferSubjectProperties<
	Schema extends SubjectSchema,
	Type extends keyof Schema & string
> = Extract<SubjectPayload<Schema>, { type: Type }>["properties"]

/**
 * Creates a strongly-typed subject schema that can be used throughout your application.
 * The returned schema maintains type information for excellent IDE support and runtime validation.
 *
 * @template Schema - The subject schema type being created
 * @param types - Object mapping subject type names to their validation schemas
 * @returns The same schema object with preserved type information
 *
 * @example
 * ```ts
 * import { object, string, number } from "valibot"
 *
 * const subjects = createSubjects({
 *   user: object({
 *     userID: string(),
 *     createdAt: number()
 *   }),
 *   admin: object({
 *     userID: string(),
 *     workspaceID: string(),
 *     permissions: array(string())
 *   }),
 *   service: object({
 *     serviceID: string(),
 *     apiVersion: string()
 *   })
 * })
 * ```
 */
export const createSubjects = <Schema extends SubjectSchema>(types: Schema): Schema => {
	return { ...types }
}

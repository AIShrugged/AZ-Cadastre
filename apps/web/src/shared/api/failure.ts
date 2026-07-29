/**
 * Reading a refusal out of whatever the transport handed back.
 *
 * The core service answers every refused rule with `{ statusCode, code, message }`
 * (`ErrorBody` in the contract), and `code` is the part that is promised to be
 * stable. So the UI branches on the code and nothing else — never on the status,
 * which cannot tell "no such profile" from "a package needs a document", and
 * never on the message, which is written for a human and free to be reworded.
 *
 * Two transports reach this service, so this takes `unknown`: RTK Query hands
 * back `{ status, data }` and axios an error with `response.data`. Both carry the
 * same body, and neither shape is worth teaching a caller.
 */
import { ErrorBodySchema, type ErrorBody } from "@cadastre/contracts"

/** The refusal the server described, or null when it never got to describe one. */
export function apiFailure(error: unknown): ErrorBody | null {
  const body = bodyOf(error)
  if (body === undefined) return null

  const parsed = ErrorBodySchema.safeParse(body)
  return parsed.success ? parsed.data : null
}

/** The refused rule's stable code, or null — a network drop, a 500, a CORS wall. */
export function failureCode(error: unknown): string | null {
  return apiFailure(error)?.code ?? null
}

function bodyOf(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined

  // RTK Query: the parsed body sits on `data`.
  if ("data" in error) return (error as { data: unknown }).data

  // axios: on the response it rejected with.
  if ("response" in error) {
    const response = (error as { response: unknown }).response
    if (typeof response === "object" && response !== null && "data" in response) {
      return (response as { data: unknown }).data
    }
  }

  return undefined
}

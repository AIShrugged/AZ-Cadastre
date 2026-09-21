/**
 * Whose submissions a call may see or touch: the account that owns them, or
 * `null` for every submission the office holds.
 *
 * Not part of any request body and never sent by a client — it is what the edge
 * works out from the session and passes alongside. An applicant is scoped to
 * their own account; the office is scoped to nothing, because the whole
 * register of cases is what its work is.
 *
 * A required argument rather than an optional filter, and that is the whole
 * point: a call that forgot to name a scope would compile, run, and hand one
 * applicant somebody else's papers. Spelling `null` is a decision somebody made
 * on purpose; a missing argument is one nobody made at all.
 *
 * A package whose owner is `null` — every submission taken in before accounts
 * existed — is outside every account's scope and inside the office's.
 */
export type PackageScope = { readonly ownerAccountId: string } | null;

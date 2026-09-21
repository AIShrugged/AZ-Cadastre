# Accounts are a context of their own, and the session is the edge's

Date: 2026-09-21. Status: accepted.

Follows [ADR-0006](./0006-contexts-contracts-edge-and-composition-root.md),
which says what a context may import and where a binding is made, and
[ADR-0005](./0005-bounded-context-packages.md), which says what makes a package
a context. It closes the sentence
[ADR-0016](../../packages/verification/docs/adr/0016-the-approval-of-an-archive-search-is-an-event-and-it-is-spent.md)
left open — that an archive-search approval carries no author "because there are
no accounts to read one from" — only halfway: there are accounts now, and the
approval still carries no author. Who may approve and who did approve are two
questions, and this answers the first.

## Context

Until now there was one anonymous user. `apps/web`'s shell says so in its header
comment, and `PackagesController.approveArchiveSearch` says the restriction on
who may approve an archive search is "written down and unenforced rather than
faked, and this is the one place a guard attaches when accounts arrive". The
product now gets accounts and two roles:

- **operator** — the office. Everything the API does today: intake, the whole
  register of cases, the overview, the archive search and its approval.
- **user** — the applicant. Files a package, sees **only their own**
  submissions, and sends in a document one of them is short of. Nothing else.

Four things had to be decided, and each of them has a cheaper wrong answer.

**Where the accounts code lives.** `CONTEXT-MAP.md` says one context on purpose,
and it also says that when accounts arrive the other Profile is "a **Member** or
an **Account**, never a profile". The cheap answer is a folder under
`packages/verification`, which would put a second language — account, role,
credential — inside a context whose language is about papers, and would make the
verification database the place a password hash is kept.

**Where a session lives.** The cheap answer is for the accounts context to issue
one, because that is the class that just checked the password. But a session is
a thing a _browser_ carries: a cookie, with flags, a lifetime and a signature.
A context that issued one would know it was being called over HTTP.

**How an applicant is stopped from reading somebody else's case.** The cheap
answer is a check in the controller after the package has been read. That is a
check somebody forgets on the fourth route, and the failure is silent.

**What answer a stranger gets.** The cheap answer is 403 — it is accurate. It is
also an oracle: a 403 on a case that exists and a 404 on one that does not tell
a caller, one guessed id at a time, which ids are real.

## Decision

1. **A second bounded context, `packages/accounts`.** Its job is one paragraph
   with no "and also": who may use this system, the credential they sign in
   with, and the role they do it in. Its language is in
   `packages/accounts/CONTEXT.md`; its published surface is
   `libs/api-contracts/accounts` — `AccountRole`, `AccountDto`, and one area
   interface, `AccountDirectoryApi`, with `register`, `authenticate` and
   `findOne`.

2. **It owns a database of its own, `cadastre-accounts`.** Not a schema in
   `cadastre-db`: a context owns its database, and two contexts on one is how a
   join across the boundary gets written by accident. A transaction therefore
   cannot span accounts and verification, which is the property RULE.md §3 is
   after.

3. **The session belongs to `libs/api-gateway`.** The context answers _who
   somebody is_; the edge decides how that answer travels. It is an
   **httpOnly, SameSite=Lax cookie** and not a bearer token the client stores —
   the web client is a browser app, and a token JavaScript can read is a token
   every XSS can read. `enableCors` carries `credentials: true` and one named
   origin, because the two cannot be combined with a wildcard.

   The cookie holds a signed statement of the account id and an expiry:
   `<payload>.<signature>`, base64url, HMAC-SHA256. That is a JWT with the
   header left out, and leaving it out is the point — a header is a field that
   says which algorithm to verify with, and a verifier that believes it is the
   oldest bug in the format. There is one algorithm and the token does not get
   to negotiate it.

   The token carries the id and **not the role**. The account is read from the
   accounts context on every request — one primary-key lookup — so an account
   whose role changed, or that was removed, stops being what it was at the next
   request rather than at the next expiry.

4. **Two global guards, denying by default.** `SessionGuard` answers "who is
   this" and refuses **401**; `RolesGuard` answers "may they" and refuses
   **403**. Everything under `/api` is behind them, so a controller written
   tomorrow is behind a session because nobody did anything. The way out is
   `@AllowsAnonymous()` on the route — one word, next to the route, visible in
   review. A list of public paths kept somewhere else fails the other way: a
   route is open until somebody remembers to close it.

5. **A package carries its owner, and the scope is part of the read.**
   `VerificationPackage` gains a nullable `ownerAccountId` — a plain column with
   no foreign key, because the other side is another context's database. Every
   packages operation takes a `PackageScope`: `null` for the office, an account
   id for an applicant. It is a **required argument**, not an optional filter —
   a call that forgot it would compile, run, and hand one applicant somebody
   else's papers. The scope goes into the WHERE clause, so there is no moment
   where a row has been fetched and then discarded.

6. **Out of scope is a 404, out of role is a 403.** A submission that is not
   this applicant's is answered exactly as one that does not exist. 403 is used
   only for a route an applicant has no business calling at all — the overview,
   the archive search, the approval — and that reveals nothing: that the office
   has an archive search is not a secret about anybody's papers.

7. **The owner is fixed at intake and the package does not change hands.**
   `ownerAccountId` is written on insert and never in an update, like the
   declaration beside it. Nullable **on purpose and permanently**: every
   submission taken in before this change has no owner, which makes it invisible
   to every applicant and unchanged for the office.

8. **Two accounts, seeded at start-up.** `operator@cadastre.az` and
   `user@cadastre.az`, idempotent by leaving an existing account alone —
   never by resetting its password to whatever the environment now says. At
   start-up rather than behind a `db:seed` command, because a stand where the
   migration ran and the seed did not is a stand nobody can open. The addresses
   are fixed in the code; only the passwords are configured, and they have **no
   default**: a default would be a password published in this repository. An
   account with no password configured is not seeded, and the log says so by
   name.

## Alternatives rejected

**A folder under `packages/verification`.** It is where the code would have been
smallest. It would also put "account", "role" and "password hash" inside a
context whose language is about papers and confidences, keep a credential in the
database that holds scans of identity cards, and make "who may use the system" a
thing that changes whenever the verification model does. `CONTEXT-MAP.md` had
already named the collision.

**An edge-level module in `libs/api-gateway`.** Tempting, because the guard and
the cookie are there anyway. But an account is a stored aggregate with an
invariant and a migration history, and the edge is transport with no database —
putting one there would make `type:edge` mean something new, and the first
question asked of the next reader would be why the gateway owns a table.

**A bearer token in `localStorage`.** Simpler for the client and conventional.
It is also readable by any script the page ever loads, and this API serves scans
of people's identity documents.

**An opaque session id in a table.** It buys revocation — `POST /auth/logout`
could end a session everywhere rather than only in the browser that asked. It
costs a table, a write per sign-in, a read per request beyond the account
lookup, and a sweeper for expired rows. Deferred rather than refused, and the
gap it leaves is written down (TECH_DEBT §16): a signed token taken off the wire
goes on being accepted until it expires.

**Role in the token.** One lookup cheaper per request. It also means a role
change takes effect up to a week later, on a system where the difference between
the two roles is the whole archive.

**403 for somebody else's package.** Accurate, and an enumeration oracle.

## Consequences

**Every call to this API now needs a session, and that is a breaking change.**
Nine routes that answered an anonymous caller yesterday answer 401 today. The
API test set carries the whole table of who may call what, one case per row.

**The contract's packages area changed shape.** `create` gained an owner
argument and `findMany`, `findOne`, `addFiles` and `supplyDocument` gained a
`PackageScope`. Every consumer's build breaks at once, which is what
`libs/api-contracts` is for — but it means the frontend cannot be updated
separately from the server.

**There are three databases now, not two.** A deployment creates
`cadastre-accounts`, and the migrator image grew a third target. The compose
init script makes it on a new data directory; on an existing volume it is one
`createdb`.

**An extra dependency, and a native one.** `@node-rs/argon2` is a prebuilt napi
binary, in the same family as `@napi-rs/canvas`, which the verification context
already carries.

**A read per request.** Every authenticated call reads the account by primary
key before the handler runs. That is the price of item 3's last paragraph, and
it is the cheapest read in the system.

**What this does not do.** No password reset, no email verification, no
refresh-token rotation, no screen for managing accounts, and no record of _who_
approved an archive search — ADR-0016 still stands, and adding an author is a
change to the approval rather than to a guard. The archive register itself is
still unauthenticated, and `TECH_DEBT.md` §10 says so.

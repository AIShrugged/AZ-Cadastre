# Accounts

Who may use this system, the credential they sign in with, and the role they do
it in. Nothing else: an account here answers two questions — is this person who
they say they are, and what job do they hold — and everything a system
eventually keeps about a person (a telephone number, a preferred language, when
they last signed in) is a different question that would bring its own rules with
it.

Why this is a context of its own and not a folder in `verification`, and what
follows from it: [ADR-0029](../../docs/adr/0029-accounts-are-a-context-of-their-own-and-a-session-is-the-edges.md).

## Language

**Account**:
Somebody who may use the system. Found by one thing — the login it answers to —
and holds exactly four things beside its identity: that login, the person's
name, the role they hold, and the digest of their password. It is the word
`CONTEXT-MAP.md` reserved for this the day it said a user is never a "profile".
_Avoid_: user, profile, member, principal, identity

**Login**:
The name an account answers to, and the only thing it is found by. A plain
string — trimmed, folded to lower case, three to sixty-four characters, unique
— and **never an email address**: the office's own account is
`cadastre-operator`, nothing here validates the field as an address, and nothing
in this system sends mail. An applicant who types their address in has a login
that happens to contain an `@`, and it is compared as the characters they typed.
The column is called `login` for the same reason the value object is.
_Avoid_: email, address, username, user id, handle

**Person Name**:
What the person is called, in two parts: a given name and a family name, each
one to a hundred characters, both required. Kept apart because the form asks for
two and the office sorts by the second. This context never joins them — which
order, whether a patronymic sits between, what to drop in a narrow column are
display decisions, and the display is elsewhere.
_Avoid_: full name, display name, title

**Role**:
The job an account holds: **operator** — the office, which does everything the
API does — or **user** — the applicant, who files a package, sees their own
submissions and sends in a document one of them is short of. Two values and not
a list of permissions: the table of who may call what is written against the
job, and adding a third role is a change to that table and to the enum together.
_Avoid_: permission, scope, claim, group, access level

**Password Hash**:
What is kept instead of a password: the argon2id digest, carrying its own
parameters so a row written under older ones goes on verifying. A value and not
a string, so the type system says where a credential is — it has no `toJSON`,
and printing it says what it is rather than what it holds. The context never
computes one: hashing is an algorithm with a cost parameter and a native library
behind it, which is infrastructure.
_Avoid_: password, credential (when meaning the stored value), secret, digest

**Registration**:
Opening an account for an applicant. Always a `user`: the office's own accounts
are seeded or made by the office, and a public form that could name its own role
would be a form that hands out the office's authority.
_Avoid_: sign-up, onboarding, invitation

**Authentication**:
Answering whether a pair of credentials is somebody's, and whose. One refusal
for both of the ways it can fail — a login no account answers to and the wrong
password against one that exists — because two would be a way to enumerate this
system's accounts without knowing a single password.

This is the context's word for the **act**. `login` in here is always the noun
above and never the verb; the published route is `POST /api/auth/login` because
that is what a route is called, and it reaches `authenticate`.
_Avoid_: login (as a verb or as the name of an operation), sign-in (as a noun in
code), verification

## What is deliberately not here

**Session.** How the answer to an authentication travels from one request to the
next — a cookie, its flags, its lifetime, the key it is signed with — is
transport, and it lives at the edge in `libs/api-gateway`. This context says who
somebody is; it does not know that anything is a browser.
_Avoid_: token, cookie, JWT, session — none of these words appears in this
package, and a class that needed one would be a class in the wrong package.

**Ownership of a submission.** A `VerificationPackage` carries the id of the
account that filed it, as a plain value with no foreign key behind it. That
column is verification's, the rule about who may read it is verification's, and
this context does not know that packages exist (ADR-0029).

## Invariants

- A login answers to at most one account. Folded to lower case by the value
  object, so the uniqueness index means what a person means by "already taken".
- A password is never stored, never logged and never answered with. The
  published `AccountDto` has five fields and none of them is a credential.
- A role is one of two, checked against the contract's own enum on the way in
  and on the way out.
- The rule about a login is the contract's rule and nothing more. A check this
  context made that `RegisterAccountRequestSchema` does not is a request the
  edge accepts and this refuses, which reaches the caller as a 422 nobody wrote
  down.
- An account's login, role and credential are fixed once written. There is no
  operation here that changes any of them — changing a password, changing a
  role and closing an account are three operations this context does not have
  yet, and each is a decision rather than a setter (TECH_DEBT §16).

# Logging is a port, its lines are structured, and today they go to the console

Date: 2026-08-25. Status: accepted.

Follows [ADR-0003](../../packages/verification/docs/adr/0003-external-capabilities-behind-ports.md),
which put every external capability behind a port, and
[ADR-0006](./0006-contexts-contracts-edge-and-composition-root.md), which says
what a context may import. This one says how the system accounts for what it
did.

## Context

The pipeline decides things. It reads a sheet, decides it is an identity card,
reads a name off it, and holds that name against an application — five stages,
each of which can be wrong in a way nothing downstream detects. When an
inspector says a report is wrong, the only answer that helps is what actually
happened: which model answered, how sure it said it was, what the route
returned, how long it took.

What we had was `new Logger(X.name)` from Nest, writing sentences:

```
Package a3f…: "erize.pdf" → 12 page(s)
OCR uploads/a3f/page-3.png via qwen/qwen2.5-vl-72b-instruct: 4212 chars, confidence 0.812 (logprobs 0.812, legibility 0.94)
```

Everything in those lines is a field that has been flattened into prose. You
cannot ask "which sheets were read below 0.5 today", or "what did this run cost
in tokens" — you can only read them, one at a time, and only while they are
still on screen. And half of what matters was not in them at all: which
upstream provider OpenRouter routed to (the one thing `docs/MODELS.md` says
determines whether a confidence means anything), how long a stage took, the
generation id that ties a line here to a request in the provider's own records.

There is no log collector to ship to. There will not be one this month.

## Decision

1. **A `Logger` port, in `libs/logger`, tagged `type:adapter`.** An abstract
   class — the injection token, as every port here is — with `log`, `error`,
   `warn`, `debug`, `verbose` and `child`. Every method takes a constant
   message and a context object: `('Sheet transcribed', { characters,
confidence, … })`, never a sentence with the values baked into it.
2. **pino behind it, in the same package.** Streams are attached in-process
   rather than through `pino.transport()`: transport runs on worker threads,
   and thread-stream crashes under `node --watch`, which is how `pnpm dev`
   runs.
3. **The console, and only the console.** `LOG_PRETTY=true` gives a terminal
   colour and indentation; false gives one JSON object per line, which is what
   the container runs. Where those lines are collected is a deployment decision
   and is not made here — when it is made, it is one more entry in
   `pino.multistream` in `pino.factory.ts` and nothing else changes.
4. **Registered once, globally, at the composition root.** Logging is not a
   dependency worth declaring on every module that has something to say. The
   context, the edge and Nest itself — through `app.useLogger` — write through
   one instance.
5. **A context may import it; `domain/` may not.** It is a technical adapter
   with no domain meaning, so `.oxlintrc.json` allows `@cadastre/logger`
   alongside `@cadastre/event-publisher` in `packages/*/**` and the edge. The
   `domain/**` override does not list it: a rule that logs is a rule that has
   grown a collaborator.
6. **Levels mean who is reading.** `info` is the run — a package started, a
   file split, a document classified, a check answered, a request served.
   `debug` is for the person looking into one run: every stage as it starts,
   every object read or written, every SQL statement, every request as it
   arrives. `trace` is SQL parameters, which are the data itself.
7. **No values in the log.** These packages are somebody's identity card, deed
   and address. A field is logged as its key, whether it was read, and how
   confident the reading was — never as what it said. The same rule puts SQL
   parameters a level below the statement that carried them.

## Consequences

**Every class that logs now takes a constructor parameter, and the adapter
factories thread it through.** `VERIFICATION_ADAPTERS` picks between a
model-backed adapter and its offline stand-in in a `useFactory`, so the logger
is injected into the factory and passed to the constructor by hand. A spec that
builds its subject directly passes `new SilentLogger()`, which is exported for
exactly that and is never registered by the module.

**The offline adapters stay silent.** They run the domain rules in
`domain/services/` with nothing to report that the use case does not already
report about them, and giving them a logger would have meant a logger in six
more specs for no line anyone would read.

**A run is correlated by its package, a request by its id — and the two are not
tied together.** Every line of a run carries `packageId`; every line of a
request carries a `requestId`, which is also returned as `x-request-id`. The
submission that starts a run is the last thing that request does, and after
that the pipeline outlives it (ADR-0001), so nothing carries the request id into
the run. Threading it would mean async local storage through the command bus,
which is a larger change than the question it answers.

**Nest's own lines go through pino, including the ones from before it exists.**
`bufferLogs: true` holds start-up output until `app.useLogger` is called; the
lines that say why a container did not build are the ones that were previously
in the framework's format and are now in ours.

**pino-pretty is a runtime dependency, not a dev one.** The default is a
terminal, and a default that needs an extra install is not a default.

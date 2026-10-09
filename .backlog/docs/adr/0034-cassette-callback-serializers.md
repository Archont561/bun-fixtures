# 0034 — Cassette callback serializers: reversible, versioned, fixture-local

- **Status:** accepted
- **Date:** 2026-10-09

## Context

ADR 0026 made `cassette.record(callback)` refuse any result JSON cannot
round-trip — `Date`, `BigInt`, `Map`, `Set`, `Error`, `RegExp`, typed arrays,
class instances, `NaN`, `±Infinity`, `-0`, cycles, nested `undefined` — and
deferred *supporting* them to task_050: "an encoding is an extension point and
an on-disk format", i.e. a public contract. Spec 0012 R4 puts
`record(callback)`/`replay(callback)` on the stable `0.1.x` surface and
promises "the recorded serializable result"; a `Map` is serializable in any
ordinary sense, so the stable surface promises what it cannot keep.

The snapshot capability already has serializers (spec 0013 R7/R9–R12), but
they are one-way: they render values for display and comparison. A cassette
serializer must be two-way — `replay` has to hand back a value that
`expect(...).toEqual(original)` accepts — and it must be versioned, because
encoded payloads are meant to outlive the code that wrote them once callback
persistence exists.

Two decisions bound the design:

- Callback identity and the per-test in-memory registry (ADR 0027) are
  settled; `replay` must reconstruct values without executing the callback,
  and the registry stores one serialized text per recording.
- `save()`/`load()` persist HTTP entries only, and the on-disk schema is not
  yet a stable public format (spec 0012 R2) — but raw HTTP replay is the part
  of the cassette consumers already rely on, so its bytes must not move as a
  side effect of this work.

The open questions were the serializer contract and encoding, the built-in
set, the registration scope, the error surface when a serializer is missing
or fails, the explicit settlement of persistence and versioning, and where
consumers get the types.

## Decision

**`cassette.record` encodes callback results through an ordered chain of
reversible, versioned serializers. A value no serializer claims must be plain
data or is refused as in ADR 0026. Callback results stay in memory in
`0.1.x`; the cassette on-disk schema does not change.**

1. **Contract.** A `CallbackSerializer` is `{ name, version, test, serialize,
   deserialize }`: `name` is a stable string id recorded in the payload;
   `version` is an integer ≥ 1, starting at 1; `test(value)` claims values;
   `serialize(value)` returns data the encoder re-encodes recursively (a
   `Map` of `Date`s needs no special handling); `deserialize(data)`
   reconstructs the value. A serializer must not claim its own output; the
   encoder guards this and wraps the violation. The encode walk is also
   bounded (512 levels), so a serializer that re-claims values *nested
   inside* its output is refused with the coded depth diagnostic instead of
   overflowing the stack.

2. **Envelope.** A serialized position holds
   `{ "__bunTestUtils": { "name", "version", "data" } }` inside the otherwise
   plain JSON payload. Plain data whose own key is the reserved
   `__bunTestUtils` is refused, which keeps the encoding injective: every
   stored text decodes to exactly one value. A top-level `undefined` keeps
   the existing `"__undefined__"` sentinel. A value accepted as plain data
   today encodes byte-identically — stored texts for existing users do not
   change.

3. **Order.** Fixture-local user serializers run newest-first, then the
   built-ins, then the plain-data rules, then refusal. The ADR 0026 refusal
   survives as the fallback for anything unclaimed: class instances without a
   serializer, nested functions, symbols and `undefined`, sparse arrays,
   cycles, invalid `Date`s, `DataView`.

4. **Built-ins, all version 1.**

   | name | claims | encodes as | documented loss |
   |------|--------|-----------|-----------------|
   | `date` | valid `Date` | ISO 8601 string | — |
   | `bigint` | `bigint` | decimal string | — |
   | `number` | `NaN`, `±Infinity`, `-0` | exact token | — (`Object.is` round-trip) |
   | `map` | `Map` | insertion-ordered pairs | — |
   | `set` | `Set` | insertion-ordered items | — |
   | `regexp` | `RegExp` | `{ source, flags }` | `lastIndex` |
   | `error` | `Error` | `{ ctor?, message, stack?, own enumerable properties }`; reconstructed through the whitelisted global constructors (`Error`, `TypeError`, `RangeError`, `SyntaxError`, `ReferenceError`, `EvalError`, `URIError`) | unknown subclass constructors (reconstructed as `Error`), non-enumerable own properties such as `cause`, symbol-keyed properties |
   | `typed-array` | every `TypedArray` constructor | `{ constructor, base64 }` of the raw bytes | cross-endian portability |
   | `array-buffer` | `ArrayBuffer` | base64 | cross-endian portability |

5. **Registration is fixture-local.** `cassette.addSerializer(serializer)`
   validates the shape at add time (a malformed serializer throws
   `CassetteError` `INVALID_API_USAGE`) and lives exactly as long as the
   test-scoped cassette. There is no global registry and no removal: unlike
   snapshot serializers, which `expect().toMatchSnapshot()` needs process-wide
   (spec 0013 R9, task_049's `Symbol.for` machinery), cassette serializers
   have no consumer outside the fixture. Global registration is deferred
   until preload-driven demand appears.

6. **Errors.**
   - A refusal keeps code `CALLBACK_NOT_SERIALIZABLE` with `path` and
     `valueType` details; its hint now names `cassette.addSerializer(...)`
     and the `/vcr` helper alongside the convert-inside-the-callback fix.
   - Decoding an envelope with no exactly matching `(name, version)`
     registration throws `CALLBACK_SERIALIZER_NOT_FOUND`; details carry
     `name`, `version`, the value `path`, and the registered pairs. Exact
     matching also finds a shadowed older registration, so bumping a
     serializer's version mid-test still decodes recordings made under the
     old one.
   - A serializer whose `test`, `serialize`, or `deserialize` throws — or
     that re-claims its own output — is wrapped in
     `CALLBACK_SERIALIZER_FAILED` with the path, serializer name, phase, and
     the original thrown value as `cause`, mirroring
     `SNAPSHOT_SERIALIZER_FAILED` (spec 0013 R12).
   - Both new codes join the public `BunTestUtilsErrorCode` union and the
     `CassetteError` constructor union: additive, therefore compatible under
     ADR 0018. Messages carry the `[bun-test-utils/vcr]` prefix; none joins
     the contractual message templates.

7. **Identity is untouched (ADR 0027).** The registry still keys recorded
   objects in a `WeakMap` and matches unrecorded ones by exact source text;
   agreement and ambiguity compare the stored encoded texts; `record` still
   runs every object it has not recorded, and the first-settled concurrency
   rule stands. Replay returns a structural reconstruction: nested object
   identity was never preserved (ADR 0026 point 6 — repeated non-cyclic
   references serialize as copies), and serializer-backed types follow the
   same rule.

8. **Persistence and versioning, settled explicitly.** Callback results
   remain in memory per test in `0.1.x`. `save()`, `load()`, and the fetch
   interception are not touched, so raw HTTP cassette replay is
   byte-compatible; golden-file characterization tests pin the file format
   (a bare array written as `JSON.stringify(entries, null, 2)`) and prove
   callback results never reach disk. The envelope carries `name` and
   `version` from day one, so persisting callbacks later needs no
   re-encoding. Persisting callback results is deferred until cross-run
   callback replay is demanded, and will be designed together with the
   explicit-keys decision ADR 0027 point 6 deferred: both change what
   `replay` matches and therefore the stable callback surface (spec 0012
   R4/R8).

9. **Public surface.** `CassetteHelper.addSerializer` is additive. A new
   capability-scoped typed helper subpath `@archont561/bun-test-utils/vcr`
   exports `defineCallbackSerializer` — an identity wrapper following the
   `define*` naming of ADR 0023 — and the `CallbackSerializer` type. This
   amends the subpath list of ADR 0022 (`/pbt`, `/bdd`, then `/snap` under
   ADR 0024 and task_057, now `/vcr`). The root runtime API remains exactly
   `describe`, `expect`, `test`.

10. **Generators.** The vcr property suites drop ADR 0026 point 8's `-0`
    normalization — the `number` built-in round-trips `-0` exactly — and gain
    encode→decode identity properties over serializer-backed arbitraries.

## Consequences

**Good**

- `Date`, `Map`, `Set`, `BigInt`, `RegExp`, `Error`, typed arrays, `NaN`,
  `±Infinity`, and `-0` round-trip exactly through record→replay: the stable
  surface keeps its promise.
- Class instances and any other shape become userland-opt-in with five
  fields, instead of impossible.
- Encoded payloads are self-describing (`name` + `version`) before anything
  touches disk; future persistence and migration tooling can read them.
- Unclaimed shapes are still refused loudly with the code, path, and now a
  hint that names the extension point. ADR 0026's guarantee — `replay` never
  returns a value that differs from what the callback returned — is
  preserved, not weakened.
- The HTTP cassette byte stream is provably unchanged.

**Bad**

- The encoder walks the result and re-encodes serializer output; the small
  API-result cost stance of ADR 0026 is accepted unchanged.
- Documented losses ship with the built-ins: unknown `Error` subclass
  constructors and non-enumerable own properties (measured against
  `bun:test`'s `toEqual`, which compares the error class and own enumerable
  properties), `RegExp.lastIndex`, cross-endian typed-array portability,
  shared-reference identity.
- `CALLBACK_SERIALIZER_NOT_FOUND` is a forward-compatibility guard: with no
  removal API and no persistence it is unreachable through the public
  fixture surface in `0.1.x` and is exercised at the internal test boundary.
- One more public subpath (`/vcr`) to maintain and pin in the public-API
  conformance suite.

## Alternatives considered

- **Hardcoded encoders, no extension point.** Rejected: class instances are
  inherently userland, and an encoding nobody can extend cannot be versioned
  in any useful sense.
- **Global serializer registry like snapshot R9.** Deferred: no consumer
  outside the fixture exists, and the bundled-copy/isolation machinery of
  task_049 would be paid for nothing.
- **String sentinels via a `JSON.stringify` replacer** (e.g. dates as tagged
  strings). Rejected: ambiguous against real strings, not injective, no room
  for a version.
- **Persist callbacks now, in a sidecar or an in-file envelope.** Rejected:
  it changes what `replay` matches across tests and runs — ADR 0027
  semantics and spec 0012 R8 — and needs its own decision together with
  explicit keys. The byte-compatibility of the stable HTTP surface would
  carry migration risk for no `0.1.x` gain.
- **Version ranges or `migrate` hooks at decode.** Rejected for `0.1.x`:
  ADR 0018 defers cassette migration tooling; exact `(name, version)`
  matching keeps decoding honest, and recording the version now is what
  makes a later migration possible at all.
- **Lookup by name, newest wins, with a version-mismatch error.** Rejected:
  exact matching is strictly kinder — an older registration still decodes
  its own envelopes after a newer one shadows it — and equally actionable
  when a serializer is genuinely missing.
- **Type-only export from the root entrypoint.** Rejected in favour of the
  capability-scoped subpath: ADR 0022 groups typed helpers by capability,
  and `defineCallbackSerializer` gives reusable serializer modules the same
  contextual-typing wrapper `defineArbitraries` gives PBT.

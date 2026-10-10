# 0012 — HTTP Cassette / VCR Testing Fixture

- **Status:** implemented
- **Implementation:** `packages/vcr/`
- **Tests:** `packages/vcr/tests/` (including `serializers.test.ts` and `http-compat.test.ts`), `packages/bun-test-utils/tests/conformance/capabilities.test.ts`, `packages/bun-test-utils/tests/conformance/cassette-serializers.test.ts`
- **Compatibility:** [ADR 0018](../adr/0018-release-compatibility-contract.md)

## Problem

Integration tests hitting 3rd-party HTTP APIs (Stripe, GitHub, OpenAI) are slow, flaky, subject to rate limits, and fail in offline or air-gapped CI environments.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `cassette` fixture MUST intercept global `fetch` during test execution. |
| R2 | In **record mode** (`VCR_MODE=record`, and in `auto` mode when no cassette exists, R11), HTTP requests and responses MUST be serialized under the `__cassettes__/` convention and written at teardown. Recordings are committed in place (ADR 0036). The on-disk schema is not yet a stable public format. Callback recordings persist to a sidecar in the same unstable schema (R10). |
| R3 | In **replay mode** (`VCR_MODE=replay`, and in `auto` mode when the cassette exists, R11), the stable matcher MUST compare the uppercase method and full URL exactly and MUST fulfill a match without network traffic. |
| R4 | The stable callback surface MUST consist of `record(callback)`, `replay(callback)`, and `addSerializer(serializer)`; replay MUST return the recorded result without executing the callback. |
| R5 | Original `globalThis.fetch` MUST be restored upon fixture teardown. |
| R6 | Matcher DSLs, configurable redaction, and cassette migration tooling MUST remain explicitly deferred from the stable `0.1.x` contract. |
| R7 | `record(callback)` MUST refuse a callback result that is neither plain data nor claimed by a registered serializer, as defined in [ADR 0026](../adr/0026-refuse-callback-results-that-cannot-round-trip.md) (amended by [ADR 0034](../adr/0034-cassette-callback-serializers.md)). The refusal MUST be a `CassetteError` with code `CALLBACK_NOT_SERIALIZABLE`, the `[bun-test-utils/vcr]` prefix, and the offending path, and MUST register nothing. A circular structure MUST be refused with the same code. |
| R8 | A callback object that the test has recorded MUST be identified by that object. A callback object the test has not recorded MUST be matched by its exact source text only when every recording with that text holds the same result; otherwise `replay` MUST refuse with `CALLBACK_AMBIGUOUS` and MUST NOT run the callback. `record(callback)` MUST run any callback object it has not recorded, as defined in [ADR 0027](../adr/0027-identify-callbacks-by-object-then-source.md). A recording an earlier run persisted (R10) counts as a recording for this rule. |
| R9 | `record(callback)` MUST encode a serializer-claimed value as a versioned envelope that `replay(callback)` MUST reconstruct, as defined in [ADR 0034](../adr/0034-cassette-callback-serializers.md). Built-in serializers MUST cover `Date`, `BigInt`, `Map`, `Set`, `RegExp`, `Error`, typed arrays, `ArrayBuffer`, and `NaN`/`±Infinity`/`-0`. User serializers registered with `addSerializer` MUST run before the built-ins, newest first. Decoding an envelope with no exactly matching `(name, version)` registration MUST fail with `CALLBACK_SERIALIZER_NOT_FOUND`; a serializer hook that throws MUST be wrapped with `CALLBACK_SERIALIZER_FAILED` and the original cause. Callback results MUST persist only in the per-test sidecar (R10), the HTTP cassette schema MUST NOT change, and raw HTTP cassette replay MUST remain byte-compatible. |
| R10 | Callback recordings MUST persist per test to `__cassettes__/<test>.callbacks.json`, format 1, as defined in [ADR 0035](../adr/0035-persist-callback-results-across-runs.md). `record` MUST write this run's recordings at teardown and MUST NOT read persisted recordings. `replay` MUST read them only in replay mode. A missing sidecar means no recordings. A sidecar that does not parse, is not format 1, or holds a malformed recording MUST fail at setup with `CALLBACK_STORE_INVALID`. A persisted source text recorded from more than one closure MUST NOT be matched for an unrecorded callback object; `replay` MUST refuse with `CALLBACK_AMBIGUOUS`. A run that writes a cassette and records no callbacks MUST remove a stale sidecar. |
| R11 | `VCR_MODE` MUST accept `auto`, which is the default, as defined in [ADR 0036](../adr/0036-auto-cassette-mode-and-cache-clearing.md). `auto` is resolved per test at setup. A present cassette file MUST replay, and a request with no entry MUST fail with `CASSETTE_MISMATCH`, whose message names the `bunx test-utils cache clear --file <file> --test "<name>"` command. An absent cassette MUST record. When `CI` is set and the cassette is absent, `auto` MUST fail with `CASSETTE_NOT_FOUND` before the body runs and MUST record nothing. In `auto`, teardown MUST write the cassette and sidecar only when the test body resolved, so a failed body writes nothing. Explicit `record`, `replay`, and `passthrough` keep their meaning. |
| R12 | `bunx test-utils cache clear` MUST take exactly one scope: `--file <path>` (every test in that file, found by a static scan of its literal test names), `--file <path> --test <name>` (one test, with the runtime slug), or `--all` (every `__cassettes__/` and `__snapshots__/` directory under the nearest `package.json` project root at or above the working directory, skipping `node_modules`, per [ADR 0037](../adr/0037-cli-workspace-and-prompts.md)). `--dry-run` MUST delete nothing and never prompt; `--yes` skips interactive TTY prompts. With no scope, or with two, it MUST exit with a usage error. It MUST delete only files matching these conventions (`<slug>.json`, `<slug>.callbacks.json`, `<slug>.snap.json`) and MUST NOT delete a directory. |

## Verification

- Tests verifying record then replay sequence against an ephemeral Bun HTTP server.
- Tests verifying that unmatched requests in replay mode throw informative mismatch errors.
- Tests verifying `auto` mode resolution, the CI refusal, the cache-miss hint, and that a failed body writes nothing (`packages/vcr/tests/auto-mode.test.ts`), and end to end in a scratch project (`packages/vcr/e2e/bdd/features/auto-mode.feature`).
- Tests verifying the clear command's scopes, project-root resolution, interactive prompts, dry run, usage errors, and deletion rules (`packages/cli/tests/{cache,commands,prompts,root}.test.ts`).
- Tests verifying that a callback result no serializer claims and that is not plain data is refused with `CALLBACK_NOT_SERIALIZABLE`, and that replay then reports `CALLBACK_NOT_RECORDED` (`packages/vcr/tests/cassette.test.ts`).
- Tests verifying that two closures from one factory each run and record their own result, that each replays its own result in any order, and that a fresh closure whose recordings disagree is refused with `CALLBACK_AMBIGUOUS` without running (`packages/vcr/tests/cassette.test.ts`).
- Tests verifying that each built-in serializer round-trips its type exactly, that user serializers run before built-ins newest-first, that envelopes pin `name`+`version`, and that missing or throwing serializers fail with `CALLBACK_SERIALIZER_NOT_FOUND`/`CALLBACK_SERIALIZER_FAILED` (`packages/vcr/tests/serializers.test.ts`, `packages/vcr/tests/cassette.test.ts`).
- Property tests verifying encode→decode identity over generated JSON values including `-0`, and over serializer-backed arbitraries (`packages/vcr/tests/invariants.test.ts`).
- Golden-file characterization tests verifying the cassette file stays a bare array of HTTP entries, save/load round-trips byte-identically, legacy files replay unchanged, and callback results never reach disk (`packages/vcr/tests/http-compat.test.ts`).
- Public-boundary conformance for the root `cassette` fixture and the `/vcr` subpath (`packages/bun-test-utils/tests/conformance/cassette-serializers.test.ts`), a behavioural scenario driving the subpath from a scratch consumer project (`packages/vcr/e2e/bdd/features/cassette-serializers.feature`), and an installed-consumer boundary proof: the `/vcr` subpath through the packed tarball, with a preload module defining a `CallbackSerializer` and the consumer test round-tripping built-in and custom values via `cassette.record`/`replay` (`packages/bun-test-utils/e2e/vcr-serializer.test.ts`).

## 2026-10-06 API revision — explicit callback registry

The cassette is exposed as a test-scoped fixture, not as `test.cassette` and not
as a third test kind:

```ts
const test = base.extend(cassetteFixtures);

test("loads a user", async ({ api, cassette }) => {
  const user = await cassette.replay(() => api.users.get("user-1"));
  expect(user.id).toBe("user-1");
});
```

The public helper has only the two cassette-specific operations:

```ts
interface Cassette {
  record<T>(callback: () => T | Promise<T>): Promise<T>;
  replay<T>(callback: () => T | Promise<T>): Promise<T>;
}
```

For intercepted HTTP traffic, replay uses one stable matching rule only: both
the uppercase method and full URL must be equal. Header/body matching,
regular-expression or predicate DSLs, configurable redaction, and on-disk
migration tooling are not part of the stable surface.

A direct API call is live and does not need a `live()` wrapper:

```ts
const health = await api.health.check();
```

`record(callback)` executes the callback, resolves its callback identity, stores
the serialized output in the cassette registry, and returns that output.
`replay(callback)` resolves the same identity, returns the stored output, and
MUST NOT execute the live callback. Replay must find the output before executing
the callback, so the lookup never uses the output. How a callback resolves to a
registry entry is defined in the 2026-10-09 section below and in ADR 0027.

The same fixture is available in normal tests, `test.prop`,
`test.scenario`, and `test.scenario.prop`. Property tests should normally use
`replay`; recording an unbounded generated input space is not a supported default.

The implementation MUST restore any interception and close the cassette at test
teardown, including when a callback throws.

## 2026-10-09 — refuse results JSON cannot round-trip

`record(callback)` refuses a result that JSON cannot represent exactly, instead of
storing a corrupted copy (R7). A result is accepted only when it is plain data:
`null`, booleans, strings, finite numbers other than `-0`, arrays without holes or
extra properties, and objects whose prototype is `Object.prototype` or `null` and
whose own properties are all enumerable string keys. `Date`, `BigInt`, `Map`, `Set`,
`Error`, `RegExp`, typed arrays, class instances, `NaN`, `Infinity`, `-0`, cycles,
and nested `undefined`, functions, or symbols are refused. A top-level function or
symbol uses the same code, and a top-level `undefined` is still accepted.

The check runs on the first `record` call, after the callback runs and before anything
is stored, so `replay` reports `CALLBACK_NOT_RECORDED` and never returns a rejected
value. The on-disk schema does not change. Supporting these values is deferred to
task_050. The decision and its alternatives are in
[ADR 0026](../adr/0026-refuse-callback-results-that-cannot-round-trip.md).

## 2026-10-09 — identify callbacks by object, then by source

A callback is identified by its object once the test has recorded it. Only an
unrecorded callback is matched by its exact source text (R8), and only when every
recording with that text holds the same result. `record(callback)` runs any
callback object it has not recorded, even when its source text matches a
recording. A source match with disagreeing recordings is refused with
`CALLBACK_AMBIGUOUS`, and the callback does not run. Two closures from one factory
therefore keep their own results. A fresh closure whose source text matches
agreeing recordings still returns the agreed result, because captured values
cannot be read without running the callback. Explicit callback keys are deferred.
The decision and its alternatives are in
[ADR 0027](../adr/0027-identify-callbacks-by-object-then-source.md).

## 2026-10-09 — reversible serializers for callback values

`record(callback)` encodes its result through reversible, versioned serializers
(R9, [ADR 0034](../adr/0034-cassette-callback-serializers.md)). A
`CallbackSerializer` is `{ name, version, test, serialize, deserialize }`; a
serialized position holds a `{ "__bunTestUtils": { name, version, data } }`
envelope inside the otherwise plain JSON payload, and a serializer's output is
re-encoded recursively. User serializers registered with
`cassette.addSerializer(...)` run newest-first, ahead of nine built-ins
(`date`, `bigint`, `number` for `NaN`/`±Infinity`/`-0`, `map`, `set`, `regexp`,
`error`, `typed-array`, `array-buffer`), ahead of the plain-data rules, ahead
of the ADR 0026 refusal — which survives, with a hint naming the extension
point, for every value nothing claims. Plain data and the top-level
`"__undefined__"` sentinel encode byte-identically to before.

Reusable serializers are defined with `defineCallbackSerializer` from the
public `@archont561/bun-test-utils/vcr` typed-helper subpath. Decoding looks
up the exact `(name, version)` pair: a missing registration fails with
`CALLBACK_SERIALIZER_NOT_FOUND`, and a serializer hook that throws is wrapped
with `CALLBACK_SERIALIZER_FAILED` and the original cause.

Callback identity (ADR 0027) is unchanged; the registry stores the encoded
text and its agreement checks compare it. Callback results remain in memory
per test — persistence is explicitly deferred until cross-run replay is
demanded, and the envelope's `name`+`version` make recorded payloads
self-describing for that future. The cassette file stays a bare array of HTTP
entries: raw HTTP replay is byte-compatible, pinned by golden-file
characterization tests.

## Implementation status

The callback registry is implemented on `CassetteHelper`: a recorded callback object
is identified by that object, and an unrecorded one matches its source text only when
every recording with that text agrees (R8). `record()` runs any callback object it has
not recorded, encodes and stores one result through the serializer codec, and refuses a
result that nothing claims and that is not plain data (R7). `replay()` returns the
reconstructed result without invoking the callback, and refuses a disagreeing source
match with `CALLBACK_AMBIGUOUS`. `addSerializer()` registers a reversible, versioned
serializer for the test-scoped cassette; the nine built-ins, the
`__bunTestUtils` envelope, the exact-`(name, version)` decode lookup, and the
`CALLBACK_SERIALIZER_NOT_FOUND`/`CALLBACK_SERIALIZER_FAILED` diagnostics implement R9.
Callback persistence (R10, [ADR 0035](../adr/0035-persist-callback-results-across-runs.md))
writes the per-test sidecar at teardown, reads it in replay mode only, and refuses a
corrupt file with `CALLBACK_STORE_INVALID`.
HTTP replay compares the uppercase method and full URL exactly, and the on-disk
format is unchanged. Coverage lives in the VCR unit, property, byte-compatibility,
and behavioural suites and in the public root `cassette` fixture and `/vcr`
subpath conformance suites.

The implementation still contains provisional storage, codec, and redaction helpers
used by workspace tests (including `createSerializerCodec`). They are deliberately
outside the stable release contract and MUST NOT be presented as compatibility
guarantees.

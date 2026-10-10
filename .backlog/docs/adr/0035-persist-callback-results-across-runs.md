# 0035 — Persist cassette callback results across runs: sidecar, exact-source staleness, internal in 0.1.x

- **Status:** accepted (2026-10-10: D1 sidecar, D2 exact source with factory refusal, D3 internal, each as recommended)
- **Date:** 2026-10-10

## Context

ADR 0034 made `cassette.record` callback values reversible and versioned, and
kept them in memory. Its point 8 deferred persistence "until cross-run callback
replay is demanded", and said it must be designed together with the explicit
keys that ADR 0027 point 6 deferred, because both change what `replay` matches.
No backlog task tracks that work. This ADR is the design it deferred.

The current code fixes the starting point:

- The callback registry (`createCallbackRegistry` in `packages/vcr/src/cassette.ts`)
  is created per test and never touches disk. A new process starts empty, so
  `replay(callback)` throws `CALLBACK_NOT_RECORDED` even when the same test
  recorded that callback in an earlier run.
- `save()` writes the HTTP entries as a bare array, `JSON.stringify(entries, null, 2)`.
  The golden file `packages/vcr/tests/fixtures/legacy-http-cassette.json` pins those
  bytes, and spec 0012 R2 says the on-disk schema is not yet a stable public format.
- The fixture auto-saves `<test dir>/__cassettes__/<test name>.json` at teardown,
  but only when `entries.length > 0`. Replay mode throws `CASSETTE_NOT_FOUND` when that
  file is missing. A test that only records callbacks therefore writes nothing today.
- Callback identity is ADR 0027: a recorded object is identified by the object; an
  unrecorded object is matched by its exact source text, and only when every recording
  with that text agrees. ADR 0027 point 6 records the residual limit. Two closures from
  one factory can share a source text and differ only in captured values, and a fresh
  closure can silently receive the agreed result. Within one run, the second recording
  of a factory's output usually exposes this (`CALLBACK_AMBIGUOUS`). Across runs, a single
  persisted recording can be matched silently. Persistence must not widen this.

Constraints this ADR must keep:

1. Raw HTTP entries stay byte-compatible: the golden-file test keeps passing unchanged.
2. The cassette file stays a bare array of HTTP entries (spec 0012 R2, ADR 0034 point 8).
3. Callback identity follows ADR 0027. Persistence adds no new identity rule that could
   return a result for a different closure.
4. A result that cannot round-trip is still refused loudly (ADR 0026, ADR 0034 point 6),
   and nothing unencodable reaches disk.

## Decision

**Callback results persist in a per-test sidecar file, not in the cassette. Replay
matches the exact recorded source text and refuses a source text recorded by more than
one closure object. The feature is internal to `0.1.x`: no new public API, and the
on-disk sidecar is part of the unstable schema covered by spec 0012 R2.**

The three decisions the maintainer asked for are below, each with a recommended option.
The maintainer accepted the recommended option for each on 2026-10-10.

### D1 — Location: sidecar file (accepted)

The sidecar is `<test dir>/__cassettes__/<test name>.callbacks.json`, written next to the
cassette with the same slug. It has three rules:

1. **Format.** Top-level object `{ "format": 1, "recordings": [...] }`. Each recording is
   `{ "source": <full Function.prototype.toString text>, "sourceLabel": "<fnv1a>:<length>",
   "closures": <n>, "encoded": <the codec's text, as a string> }`. `encoded` is the exact
   text the registry stores, so agreement is a string comparison. The full source is stored,
   not only a hash, because ADR 0027 point 5 says lookups use full source text, and a diff of
   the sidecar then shows exactly what changed.
2. **Writes.** In record mode, teardown rewrites the sidecar with this run's recordings only.
   This mirrors `save()` and needs no merge logic. If the run recorded no callbacks, no
   sidecar is written, and an existing one is removed. Both files are written through a
   temp file and a rename.
3. **Empty cassette.** When the sidecar is written, the cassette is written too. A run with no HTTP
   entries keeps an existing cassette untouched, and creates `[]` only when none
   exists, so a callback-only run never empties a recorded cassette. Replay mode still requires the cassette file, so the
   `CASSETTE_NOT_FOUND` guard and the bare-array format both stay as they are.

Rejected: a section of the existing cassette. A bare array cannot hold a second section.
Wrapping the array in an object changes the golden bytes and breaks every existing cassette.
Mixing callback records into the array breaks constraint 2.

### D2 — Staleness: exact source match plus factory refusal (accepted)

Callback results enter the replay index only through the sidecar, and only in replay mode.
`record` never reads from disk, so ADR 0027 rule 3 (record always runs an unrecorded object)
is unchanged. The replay rules become:

1. **Changed callback.** A changed body changes the full source text. That text matches no
   recording, so `replay` throws `CALLBACK_NOT_RECORDED`. The message names the sidecar path
   and says to re-record with `VCR_MODE=record`. Stale recordings are not kept: the next
   record run drops them (rule 2 of D1).
2. **Factory evidence.** Each recording stores `closures`, the number of distinct objects
   with that source text recorded in the run that wrote it. If `closures > 1`, a cross-run
   `replay` of an unrecorded object with that source text refuses with `CALLBACK_AMBIGUOUS`
   and does not run the callback. The recorded object itself still replays within its own run.
   This is the conservative choice: a factory's output cannot be told apart across runs, so
   the design does not guess.
3. **Serializer change.** An envelope whose `(name, version)` is no longer registered still
   fails with `CALLBACK_SERIALIZER_NOT_FOUND` (ADR 0034 point 6).
4. **Corrupt sidecar.** A sidecar that fails to parse, or has an unknown `format`, throws
   a new `CassetteError` code, `CALLBACK_STORE_INVALID`, with the path. It is not ignored.

Not detected, and documented as the limit: captured variables, module-level state read by
the body, and environment values. A function does not expose them (ADR 0027 point 6), so no
hash can cover them. Explicit keys are the only fix, and they stay deferred (D3).

### D3 — Stability: internal in 0.1.x (accepted)

Persistence stays internal for `0.1.x`:

- No new public method, option, or export. `record(callback)`, `replay(callback)`, and
  `addSerializer(serializer)` keep their signatures, so R4 holds as written.
- The sidecar format is covered by spec 0012 R2 (unstable), not by the stable surface.
- Spec 0012 R8 is amended: a recording counts whether it was made in this run or in an
  earlier one, and the factory-evidence rule applies.
- Public promotion waits for explicit keys (ADR 0027 point 6), which need their own
  decision because they extend R4.

## Consequences

**Good**

- Callback-backed tests can replay across runs without re-running the callback, which is
  the reason persistence was wanted.
- The cassette bytes do not change. The golden file and the bare-array rule keep their
  meaning, so existing users see no change.
- A changed callback body is caught with a precise message, because the sidecar stores the
  source text, and the diff shows the change.
- The factory-collision defect (task_067) cannot be reached through the persisted path.
  Across runs it is refused, not returned silently.
- Refusals still happen at record time, before anything is written. Unencodable values
  never reach disk.

**Bad**

- Two files per test instead of one. Callback-only tests now produce a `[]` cassette.
- A factory whose closures were recorded more than once cannot be replayed across runs
  until explicit keys exist. This is a real limitation, and it is the price of not guessing.
- A factory called only once in the recording run has `closures = 1`, so a later closure
  from that factory is matched by source and receives the one recorded value. This is the
  ADR 0027 point 6 residual, now reachable across runs. D2 does not remove it.
- Captured-value changes stay undetected. This is the ADR 0027 limit, now also cross-run.
- A new error code, `CALLBACK_STORE_INVALID`. It is additive under ADR 0018, but it joins
  the public `BunTestUtilsErrorCode` union.
- Writing two files is not atomic across a crash. The temp-file rename limits, but does
  not remove, the window where one file is new and the other is old. A mismatch shows up
  as `CALLBACK_NOT_RECORDED`, never as a wrong value.

**Required work once accepted** (each step starts with a failing test, per `workflow.md`)

- Golden test: the cassette bytes are unchanged, and a new golden pins the sidecar format.
- Refusal test: an unencodable result throws `CALLBACK_NOT_SERIALIZABLE` and writes no file.
- Factory test: a recording with `closures > 1` refuses a fresh closure across runs.
- Staleness test: a changed body throws `CALLBACK_NOT_RECORDED` and names the sidecar.
- Corrupt-sidecar test: `CALLBACK_STORE_INVALID`.
- Spec 0012 amended (R2, R8). Recording guide in `apps/docs` updated. ADR 0034 marked
  `amended by 0035` once this ADR is accepted.

## Alternatives considered

- **A section of the existing cassette, under a wrapping object.** Rejected: changes the
  golden bytes and the on-disk format of every existing cassette.
- **A marker entry inside the bare array.** Rejected: the array is defined as HTTP entries,
  and any reader of that array would see a non-HTTP element.
- **Persist the encoded text only, with no source text.** Rejected: staleness cannot be
  diagnosed, and the match would rest on a hash alone. ADR 0027 point 5 says lookups use
  full source text.
- **Match on a hash of captured values.** Not possible: captured values are not readable
  from a function without running it.
- **Explicit keys now, persistence later.** The most robust option, and ADR 0027 point 6's
  preferred fix. Deferred: it extends R4, which needs its own decision, and nothing here
  requires it to ship the internal feature.
- **Make persistence public now.** Rejected: the schema is unstable (R2), and the
  factory limit would then be part of a stable contract with no key to fix it.
- **Defer persistence entirely.** The honest alternative if the factory limit is judged
  unacceptable. This ADR says the limit is acceptable only with the refusal in D2.2.
- **Let `record` read the sidecar, to return persisted values.** Rejected: it would change
  ADR 0027 rule 3, and `record` would stop running callbacks it has not recorded in this run.
- **Merge sidecar entries across runs.** Rejected for now: nothing prunes stale entries, so a
  changed callback would leave its old recording in place.

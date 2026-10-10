# 0040 — Process-wide callback serializer registration for cassette preloads

- **Status:** accepted
- **Date:** 2026-10-10
- **Amends:** ADR 0034 decision 3 and decision 5 (ordering and fixture-local-only registration)

## Context

ADR 0034 intentionally made callback serializers fixture-local. At that time,
callback results lived only inside one test, and there was no consumer outside
the `cassette` fixture. Its decision 5 explicitly deferred a global registry
until preload-driven demand appeared.

That demand now exists. A project commonly defines a class such as `Point` in a
test preload and needs its reversible serializer in every root `cassette`
fixture. Repeating `cassette.addSerializer(pointSerializer)` in every test is
error-prone, and a preload cannot receive a test-scoped fixture value.

Snapshot serializers already solve the equivalent problem through a public
`/snap` registry backed by `Symbol.for`, so independently bundled root and
subpath entrypoints share one process-wide array. Callback serializers need the
same bundling guarantee: a preload imports `/vcr`, while the root fixture uses
the plugin bundle.

Global registration does not relax the exact `(name, version)` wire contract.
ADR 0039 also settled that a missing exact registration, including a same-name
version mismatch, is an error in every mode rather than a local-auto miss.

## Decision

1. **Public `/vcr` registration functions.** The capability subpath exports:

   ```ts
   registerCallbackSerializer(serializer): CallbackSerializer;
   unregisterCallbackSerializer(serializer): boolean;
   ```

   `registerCallbackSerializer` validates the same five-field
   `CallbackSerializer` contract as `cassette.addSerializer`, registers the
   exact object identity, and returns that object for convenient ownership.
   `unregisterCallbackSerializer` removes every registration of that exact
   object and returns `true` when it removed at least one. It returns `false`
   otherwise. There is deliberately no process-wide reset function in this
   decision: a preload owner can unregister its own serializer without
   unexpectedly erasing registrations it does not own.

2. **One process-wide registry.** The registry is an array held on
   `globalThis[Symbol.for("bun-test-utils.vcrCallbackSerializers")]`. Both the
   root plugin bundle and the `/vcr` bundle use that shared array, so a preload
   registration is visible to a root fixture in the same Bun process. The array
   identity is retained; unregister mutates it in place. Registrations last for
   the process until explicitly unregistered.

3. **Precedence.** For each cassette codec, serializer dispatch is:

   1. fixture-local serializers from `cassette.addSerializer`, newest first;
   2. globally registered serializers, newest first;
   3. ADR 0034 built-ins, in their fixed order;
   4. plain-data encoding or the existing refusal.

   The same ordered chain resolves decoder envelopes by exact `(name, version)`.
   A local serializer therefore remains the intentional per-test override.
   Multiple registrations are allowed; identity-based unregister removes all
   registrations of the supplied instance, matching `/snap`.

4. **Version behaviour remains strict.** A global serializer is part of the
   persisted sidecar format exactly as a local serializer is. A sidecar envelope
   needs an exact `(name, version)` registration. A global serializer at a newer
   version alone does not decode an older envelope and produces
   `CALLBACK_SERIALIZER_NOT_FOUND`; `cassette(fn)` must not re-record it in
   local auto mode. Register both versions when a test needs to decode both, or
   explicitly record a reviewed replacement under `VCR_MODE=record`.

5. **Preload and test contract.** A preload imports only the public `/vcr`
   subpath and calls `registerCallbackSerializer`. Every later cassette fixture
   can record and replay values it claims, including nested values. An
   installed-consumer test verifies this packed-package flow. Fixture-local
   registration remains supported and takes precedence.

## Consequences

**Good**

- One serializer definition in a project preload covers every cassette test.
- The Symbol-backed registry works across the separately bundled root plugin
  and `/vcr` entrypoint, instead of depending on private workspace module
  identity.
- Tests can temporarily register and clean up an exact serializer without
  clearing unrelated process-wide registrations.
- Per-test `addSerializer` stays the strongest override for a targeted test.
- Serializer versions remain reviewable and safe: registration convenience
  does not turn a format migration into a silent refresh.

**Bad**

- A forgotten global registration leaks into later tests in the same Bun
  process. Preload registrations are intentionally long-lived; test helpers
  must keep the returned identity and unregister it at their controlled
  boundary.
- There are now two registration scopes to explain and maintain.
- Global serializers can intentionally shadow built-ins; their scope makes
  that a project-wide decision rather than a local accident.

## Alternatives considered

- **Keep serializers fixture-local.** Rejected. It cannot serve a preload and
  forces repeated registration in every cassette test.
- **Add a `createCallbackSerializer` alias only.** Rejected. Constructing a
  serializer in a preload without registration does not make it available to
  fixtures.
- **Copy snapshot's global reset API.** Rejected for now. A global erase is
  too broad for a reversible codec registry; exact-identity unregister is the
  ownership operation the request needs.
- **Make global serializers override fixture-local serializers.** Rejected.
  A test must be able to narrowly override a project default, and this follows
  ADR 0034's existing user-before-built-in precedence.
- **Treat a version mismatch as an auto re-record.** Rejected by ADR 0039.
  A codec change is a persisted-format migration and must be explicit in every
  environment.
- **Store the registry in ordinary module state.** Rejected. The root plugin
  and `/vcr` are separately bundled in published installs, so module-local
  arrays would not share preload registrations.

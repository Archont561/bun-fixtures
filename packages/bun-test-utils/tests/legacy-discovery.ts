// Test-only compatibility bootstrap. Published consumers must compose fixture
// maps explicitly with test.extend(); automatic discovery is not enabled by
// the public preload.
import { discoverFixtures } from "@bun-test-utils/core";

await discoverFixtures();

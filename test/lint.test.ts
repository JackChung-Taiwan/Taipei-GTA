/**
 * The project lint rules (tools/lint/plugin.mjs) on a fixture of known
 * violations. Each is reported, and ordinary casts are let through.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { test } from "node:test"

const require = createRequire(import.meta.url)
const oxlint = join(dirname(require.resolve("oxlint/package.json")), "bin", "oxlint")

test("no-cast-escape reports as never and as unknown as, and nothing else", () => {
  const run = spawnSync(process.execPath, [oxlint, "--format", "unix", "tools/lint/fixtures"], { encoding: "utf8" })
  assert.ifError(run.error)
  assert.equal(run.status, 1, run.stderr)
  const findings = run.stdout.split("\n").flatMap((line) => {
    const match = /fixtures[\\/]([^:]+):(\d+):\d+: .*town\(([a-z-]+)\)/.exec(line)
    return match === null ? [] : [`${match[1]}:${match[2]} ${match[3]}`]
  })
  assert.deepEqual(findings, ["casts.ts:3 no-cast-escape", "casts.ts:4 no-cast-escape"])
})

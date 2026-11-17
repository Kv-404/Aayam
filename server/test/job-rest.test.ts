import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { d1RestDb } from "../src/d1/rest.ts";

function fakeFetch(statuses: number[]) {
  const bodies: unknown[] = [];
  let call = 0;
  const fetcher = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    const status = statuses[Math.min(call, statuses.length - 1)]!;
    call += 1;
    const ok = status < 400;
    return new Response(JSON.stringify({ success: ok, errors: ok ? [] : [{ message: "nope" }], result: [{ results: [{ n: 1 }], success: ok }] }), { status });
  }) as unknown as typeof fetch;
  return { fetcher, bodies };
}

describe("D1 REST client", () => {
  it("reads rows and splits large runs into batch calls", async () => {
    const { fetcher, bodies } = fakeFetch([200]);
    const db = d1RestDb({ accountId: "a", databaseId: "d", apiToken: "t", fetch: fetcher, maxBatchStatements: 2 });
    assert.deepEqual(await db.all("SELECT 1 AS n WHERE ? = ?", [true, undefined]), [{ n: 1 }]);
    assert.deepEqual(bodies[0], { sql: "SELECT 1 AS n WHERE ? = ?", params: [1, null] });
    await db.run([{ sql: "A" }, { sql: "B" }, { sql: "C" }]);
    assert.deepEqual(bodies[1], { batch: [{ sql: "A", params: [] }, { sql: "B", params: [] }] });
    assert.deepEqual(bodies[2], { sql: "C", params: [] });
  });

  it("retries 429 and fails fast on a bad query", async () => {
    const retry = fakeFetch([429, 200]);
    const db = d1RestDb({ accountId: "a", databaseId: "d", apiToken: "t", fetch: retry.fetcher });
    await db.run([{ sql: "A" }]);
    assert.equal(db.calls, 2);
    const bad = fakeFetch([400]);
    const failing = d1RestDb({ accountId: "a", databaseId: "d", apiToken: "t", fetch: bad.fetcher });
    await assert.rejects(failing.run([{ sql: "A" }]), /nope/);
    assert.equal(failing.calls, 1);
    await assert.rejects(failing.all("x", new Array(101).fill(1)), /100 bound parameters/);
  });
});

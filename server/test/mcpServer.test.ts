import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it } from "node:test";
import ExcelJS from "exceljs";
import { createApp } from "../src/app.ts";
import type { FacultyDirectoryRecord } from "../src/auth.ts";
import { getConfig } from "../src/config.ts";
import { openDatabase } from "../src/db.ts";
import { allowedScopesForIdentity, signMcpAccessToken } from "../src/mcp/oauthStore.ts";
import type { McpFacultyIdentity } from "../src/mcp/types.ts";
import { MemoryRedisStore, resetRedisForTests, setRedisForTests } from "../src/services/redis.ts";
import { runSync } from "../src/services/syncScheduler.ts";

async function makeMultiCohortWorkbook() {
  const wb = new ExcelJS.Workbook();
  const monday = wb.addWorksheet("Monday");
  monday.getCell("A1").value = "SEMESTER - 3";
  monday.getCell("A2").value = "16/11/2026 (Monday)";
  monday.getCell("A3").value = "Timing";
  monday.getCell("B3").value = "Sam Altman 2025";
  monday.getCell("C3").value = "Jeff Bezos 2025";

  monday.getCell("A4").value = "9:00 AM - 10:00 AM";
  monday.getCell("B4").value = "Data Structures";
  monday.getCell("C4").value = "Operating Systems";
  monday.getCell("A5").value = "Faculty";
  monday.getCell("B5").value = "Dr. Aarti P";
  monday.getCell("C5").value = "Prof. Karan";
  monday.getCell("A6").value = "Classroom No";
  monday.getCell("B6").value = "Classroom - 18";
  monday.getCell("C6").value = "Classroom - 22";

  monday.getCell("A8").value = "10:00 AM - 11:00 AM";
  monday.getCell("B8").value = "Machine Learning";
  monday.getCell("A9").value = "Faculty";
  monday.getCell("B9").value = "Prof. Karan";
  monday.getCell("A10").value = "Classroom No";
  monday.getCell("B10").value = "Classroom - 19";
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function withServer(
  app: ReturnType<typeof createApp>,
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function rpcCall(baseUrl: string, token: string, method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return { status: res.status, headers: res.headers, body: (await res.json()) as any };
}

function makeToken(baseUrl: string, identity: McpFacultyIdentity) {
  return signMcpAccessToken({
    iss: baseUrl,
    aud: `${baseUrl}/mcp`,
    faculty: identity,
    scopes: allowedScopesForIdentity(identity),
    clientId: "test-client",
  }).token;
}

const DIRECTORY: FacultyDirectoryRecord[] = [
  {
    id: 1,
    email: "test-faculty@itm.edu",
    faculty_name: "Dr. Aarti Pardesi",
    can_see_all_faculty: false,
    is_active: true,
    last_login_at: "2026-11-16T08:00:00Z",
  },
  {
    id: 2,
    email: "test-coord@itm.edu",
    faculty_name: "Harshita Deshmukh",
    can_see_all_faculty: false,
    is_active: true,
    last_login_at: "2026-11-16T09:00:00Z",
  },
  {
    id: 3,
    email: "test-dean@itm.edu",
    faculty_name: "Dr. Dipanjan",
    can_see_all_faculty: true,
    is_active: true,
    last_login_at: "2026-11-16T10:00:00Z",
  },
];

describe("Remote Streamable-HTTP MCP Server & Confidential RBAC", () => {
  afterEach(() => {
    resetRedisForTests();
  });

  it("enforces 401 discovery challenge, CORS, Origin checks, and method rules", async () => {
    setRedisForTests(new MemoryRedisStore());
    const db = openDatabase(":memory:");
    const config = getConfig();
    const app = createApp(db, config, async () => ({ buffer: Buffer.alloc(0) }));

    await withServer(app, async (baseUrl) => {
      const unauth = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://claude.ai" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      });
      assert.equal(unauth.status, 401);
      assert.equal(unauth.headers.get("access-control-allow-origin"), "https://claude.ai");
      assert.match(unauth.headers.get("access-control-expose-headers") ?? "", /WWW-Authenticate/);
      assert.match(unauth.headers.get("www-authenticate") ?? "", /resource_metadata=/);

      const preflight = await fetch(`${baseUrl}/mcp`, {
        method: "OPTIONS",
        headers: { Origin: "https://claude.ai" },
      });
      assert.equal(preflight.status, 204);

      const evilOrigin = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil-rebinding.example.com" },
        body: JSON.stringify({}),
      });
      assert.equal(evilOrigin.status, 403);
    });
  });

  it("enforces faculty, coordinator, and all-access RBAC across MCP tools", async () => {
    setRedisForTests(new MemoryRedisStore());
    const db = openDatabase(":memory:");
    const buf = await makeMultiCohortWorkbook();
    const config = { ...getConfig(), syncIntervalSeconds: 60 };
    await runSync({ db, config, load: async () => ({ buffer: buf }) });

    const app = createApp(db, config, async () => ({ buffer: buf }), {
      listDirectory: async () => DIRECTORY,
      mcpOAuth: {
        resolveFaculty: async (email) => {
          const found = DIRECTORY.find((d) => d.email.toLowerCase() === email.toLowerCase());
          if (!found) throw new Error("Not found");
          return found;
        },
      },
    });

    await withServer(app, async (baseUrl) => {
      const regularToken = makeToken(baseUrl, {
        id: 1,
        email: "test-faculty@itm.edu",
        facultyName: "Dr. Aarti Pardesi",
        canSeeAllFaculty: false,
        coordinatorCohorts: [],
      });
      const coordinatorToken = makeToken(baseUrl, {
        id: 2,
        email: "test-coord@itm.edu",
        facultyName: "Harshita Deshmukh",
        canSeeAllFaculty: false,
        coordinatorCohorts: ["Andrew NG", "Sam Altman"],
      });
      const allAccessToken = makeToken(baseUrl, {
        id: 3,
        email: "test-dean@itm.edu",
        facultyName: "Dr. Dipanjan",
        canSeeAllFaculty: true,
        coordinatorCohorts: [],
      });

      // Initialize & list tools
      const init = await rpcCall(baseUrl, regularToken, "initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      });
      assert.equal(init.status, 200);
      assert.equal(init.body.result.serverInfo.name, "aayam-timetable");

      const toolsList = await rpcCall(baseUrl, regularToken, "tools/list");
      assert.equal(toolsList.status, 200);
      const toolNames = (toolsList.body.result.tools as Array<{ name: string }>).map((t) => t.name);
      assert.ok(toolNames.includes("get_my_schedule"));
      assert.ok(toolNames.includes("list_faculty_directory"));

      // Regular faculty: can read own schedule & cohorts & free rooms, CANNOT read other faculty or directory
      const mySched = await rpcCall(baseUrl, regularToken, "tools/call", {
        name: "get_my_schedule",
        arguments: {},
      });
      assert.equal(mySched.body.result.isError, undefined);
      const myParsed = JSON.parse(mySched.body.result.content[0].text);
      assert.equal(myParsed.totalClasses, 1);
      assert.equal(myParsed.lectures[0].subject, "Data Structures");

      const deniedOther = await rpcCall(baseUrl, regularToken, "tools/call", {
        name: "get_faculty_schedule",
        arguments: { faculty: "Prof. Karan" },
      });
      assert.equal(deniedOther.body.result.isError, true);

      const deniedDir = await rpcCall(baseUrl, regularToken, "tools/call", {
        name: "list_faculty_directory",
        arguments: {},
      });
      assert.equal(deniedDir.body.result.isError, true);

      const deniedSync = await rpcCall(baseUrl, regularToken, "tools/call", {
        name: "refresh_timetable_sync",
        arguments: {},
      });
      assert.equal(deniedSync.body.result.isError, true);

      const freeRooms = await rpcCall(baseUrl, regularToken, "tools/call", {
        name: "find_free_rooms_or_slots",
        arguments: { date: "2026-11-16", startTime: "9:00 AM", endTime: "10:00 AM" },
      });
      const roomsData = JSON.parse(freeRooms.body.result.content[0].text);
      assert.deepEqual(roomsData.freeRooms, ["Classroom - 19"]);

      // Coordinator: sees Prof. Karan's lecture ONLY in Sam Altman 2025 (not Jeff Bezos 2025!)
      const coordFaculty = await rpcCall(baseUrl, coordinatorToken, "tools/call", {
        name: "get_faculty_schedule",
        arguments: { faculty: "Prof. Karan" },
      });
      assert.equal(coordFaculty.body.result.isError, undefined);
      const coordData = JSON.parse(coordFaculty.body.result.content[0].text);
      assert.equal(coordData.scopeApplied, "coordinator_cohorts");
      assert.equal(coordData.totalClasses, 1);
      assert.equal(coordData.lectures[0].division, "Sam Altman 2025");

      // Coordinator still denied confidential directory
      const coordDir = await rpcCall(baseUrl, coordinatorToken, "tools/call", {
        name: "list_faculty_directory",
        arguments: {},
      });
      assert.equal(coordDir.body.result.isError, true);

      // All-access faculty: sees all of Prof. Karan's lectures AND full directory AND can trigger sync
      const allFaculty = await rpcCall(baseUrl, allAccessToken, "tools/call", {
        name: "get_faculty_schedule",
        arguments: { faculty: "Prof. Karan" },
      });
      const allData = JSON.parse(allFaculty.body.result.content[0].text);
      assert.equal(allData.scopeApplied, "all_faculty");
      assert.equal(allData.totalClasses, 2);

      const fullDir = await rpcCall(baseUrl, allAccessToken, "tools/call", {
        name: "list_faculty_directory",
        arguments: {},
      });
      assert.equal(fullDir.body.result.isError, undefined);
      const dirData = JSON.parse(fullDir.body.result.content[0].text);
      assert.equal(dirData.total, 3);
      assert.ok(dirData.directory.some((d: FacultyDirectoryRecord) => d.email === "test-dean@itm.edu"));

      const syncCall = await rpcCall(baseUrl, allAccessToken, "tools/call", {
        name: "refresh_timetable_sync",
        arguments: {},
      });
      assert.equal(syncCall.body.result.isError, undefined);
      const syncData = JSON.parse(syncCall.body.result.content[0].text);
      assert.equal(syncData.ok, true);
    });
  });
});

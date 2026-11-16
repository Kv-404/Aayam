import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMcpInstallGuides,
  cursorDeeplinkUrl,
  PRODUCTION_MCP_URL,
  starterPromptsForUser,
  vscodeDeeplinkUrl,
} from "../../client/src/lib/mcpInstall.ts";

describe("MCP install prompt & config generators", () => {
  it("builds valid deeplinks and config snippets for all 7 supported AI hosts", () => {
    const guides = buildMcpInstallGuides(PRODUCTION_MCP_URL);
    assert.deepEqual(
      guides.map((g) => g.id),
      ["claude", "claude-code", "cursor", "vscode", "chatgpt", "windsurf", "gemini-cli"],
    );

    const claudeCode = guides.find((g) => g.id === "claude-code")!;
    assert.equal(
      claudeCode.snippet,
      `claude mcp add --transport http aayam-timetable ${PRODUCTION_MCP_URL} --scope user`,
    );

    const cursorLink = new URL(cursorDeeplinkUrl(PRODUCTION_MCP_URL));
    assert.equal(cursorLink.protocol, "cursor:");
    assert.equal(cursorLink.searchParams.get("name"), "aayam-timetable");
    const decodedCursor = JSON.parse(Buffer.from(cursorLink.searchParams.get("config")!, "base64").toString("utf8"));
    assert.deepEqual(decodedCursor, { url: PRODUCTION_MCP_URL });

    const vscodeRaw = vscodeDeeplinkUrl(PRODUCTION_MCP_URL);
    assert.ok(vscodeRaw.startsWith("vscode:mcp/install?"));
    const decodedVscode = JSON.parse(decodeURIComponent(vscodeRaw.slice("vscode:mcp/install?".length)));
    assert.deepEqual(decodedVscode, {
      name: "aayam-timetable",
      type: "http",
      url: PRODUCTION_MCP_URL,
    });

    const windsurf = JSON.parse(guides.find((g) => g.id === "windsurf")!.snippet!);
    assert.equal(windsurf.mcpServers["aayam-timetable"].serverUrl, PRODUCTION_MCP_URL);

    const gemini = JSON.parse(guides.find((g) => g.id === "gemini-cli")!.snippet!);
    assert.equal(gemini.mcpServers["aayam-timetable"].httpUrl, PRODUCTION_MCP_URL);
  });

  it("tailors starter prompts by faculty and all-access permissions", () => {
    const regular = starterPromptsForUser({ isFaculty: true, canSeeAllFaculty: false });
    assert.equal(regular.length, 3);
    assert.equal(regular.some((p) => p.id === "all-access"), false);

    const allAccess = starterPromptsForUser({ isFaculty: true, canSeeAllFaculty: true });
    assert.equal(allAccess.some((p) => p.id === "all-access"), true);
  });
});

/** The live site. On any other https origin the modal shows that origin's `/mcp`. */
export const PRODUCTION_MCP_URL = "https://aayam.kv404.dev/mcp";
/** `wrangler dev`, which serves the MCP endpoint and OAuth itself. */
export const LOCAL_DEV_MCP_URL = "http://localhost:8787/mcp";
export const MCP_SERVER_NAME = "aayam-timetable";

export type McpClientId =
  | "claude"
  | "claude-code"
  | "cursor"
  | "vscode"
  | "chatgpt"
  | "windsurf"
  | "gemini-cli";

export interface McpInstallGuide {
  id: McpClientId;
  name: string;
  badge: string;
  summary: string;
  steps: string[];
  deeplinkLabel?: string;
  deeplinkUrl?: string;
  snippetLabel?: string;
  snippetLanguage?: "bash" | "json";
  snippet?: string;
  note?: string;
}

export function isLocalDevHostname(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export function resolveMcpEndpointUrl(preferLocal = false): string {
  if (typeof window === "undefined") return PRODUCTION_MCP_URL;
  if (isLocalDevHostname()) {
    return preferLocal ? LOCAL_DEV_MCP_URL : PRODUCTION_MCP_URL;
  }
  if (window.location.protocol === "https:") {
    return `${window.location.origin}/mcp`;
  }
  return PRODUCTION_MCP_URL;
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function cursorDeeplinkUrl(endpointUrl: string): string {
  const config = JSON.stringify({ url: endpointUrl });
  const encoded = toBase64Utf8(config);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(MCP_SERVER_NAME)}&config=${encodeURIComponent(encoded)}`;
}

export function vscodeDeeplinkUrl(endpointUrl: string): string {
  const payload = JSON.stringify({
    name: MCP_SERVER_NAME,
    type: "http",
    url: endpointUrl,
  });
  return `vscode:mcp/install?${encodeURIComponent(payload)}`;
}

export function buildMcpInstallGuides(endpointUrl: string): McpInstallGuide[] {
  const claudeCodeCmd = `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpointUrl} --scope user`;
  const cursorJson = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          url: endpointUrl,
        },
      },
    },
    null,
    2,
  );
  const vscodeJson = JSON.stringify(
    {
      servers: {
        [MCP_SERVER_NAME]: {
          type: "http",
          url: endpointUrl,
        },
      },
    },
    null,
    2,
  );
  const windsurfJson = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          serverUrl: endpointUrl,
        },
      },
    },
    null,
    2,
  );
  const geminiJson = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          httpUrl: endpointUrl,
        },
      },
    },
    null,
    2,
  );

  return [
    {
      id: "claude",
      name: "Claude",
      badge: "Web & Desktop",
      summary: "Connect Aayam natively in Claude.ai or Claude Desktop with OAuth 2.1.",
      steps: [
        "Open Claude Settings -> Connectors -> Add custom connector.",
        "Name it Aayam Timetable and paste the remote MCP endpoint URL below.",
        "Click Connect and sign in with your authorized @itm.edu or @isu.ac.in Google account.",
      ],
      snippetLabel: "Custom connector URL",
      snippetLanguage: "bash",
      snippet: endpointUrl,
      note: "Do not add remote HTTP URLs to claude_desktop_config.json; Claude Desktop ignores remote URLs there and uses Connectors instead.",
    },
    {
      id: "claude-code",
      name: "Claude Code",
      badge: "CLI",
      summary: "Install once globally in your terminal and complete OAuth sign-in via /mcp.",
      steps: [
        "Run the command below in your terminal to register the server across projects.",
        "Start Claude Code and run /mcp, then select aayam-timetable to complete Google OAuth.",
      ],
      snippetLabel: "Terminal command",
      snippetLanguage: "bash",
      snippet: claudeCodeCmd,
      note: "Use --scope project instead of --scope user if you only want it active in the current repository.",
    },
    {
      id: "cursor",
      name: "Cursor",
      badge: "1-Click",
      summary: "Install with a single click or add the Streamable HTTP block to mcp.json.",
      steps: [
        "Click Install in Cursor below, or paste the JSON snippet into ~/.cursor/mcp.json.",
        "Approve the MCP server prompt in Cursor Settings -> Tools & MCP and sign in with Google.",
      ],
      deeplinkLabel: "Install in Cursor",
      deeplinkUrl: cursorDeeplinkUrl(endpointUrl),
      snippetLabel: "~/.cursor/mcp.json",
      snippetLanguage: "json",
      snippet: cursorJson,
    },
    {
      id: "vscode",
      name: "VS Code",
      badge: "1-Click",
      summary: "Install into VS Code Copilot Agent mode via deeplink or .vscode/mcp.json.",
      steps: [
        "Click Install in VS Code below, or save the JSON block into .vscode/mcp.json.",
        "Open Agent Mode in GitHub Copilot Chat and follow the Google OAuth prompt.",
      ],
      deeplinkLabel: "Install in VS Code",
      deeplinkUrl: vscodeDeeplinkUrl(endpointUrl),
      snippetLabel: ".vscode/mcp.json",
      snippetLanguage: "json",
      snippet: vscodeJson,
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      badge: "Developer Mode",
      summary: "Add Aayam as a custom OAuth connector in ChatGPT Developer Mode.",
      steps: [
        "Open ChatGPT Settings -> Apps & Connectors and enable Developer Mode.",
        "Click Create app (or Add custom MCP), paste the Server URL below, and choose OAuth authentication.",
        "Complete Google sign-in, then toggle the connector on from the + menu in any chat.",
      ],
      snippetLabel: "Server URL",
      snippetLanguage: "bash",
      snippet: endpointUrl,
      note: "Developer Mode is available on eligible ChatGPT Plus, Pro, Business, and Enterprise workspaces.",
    },
    {
      id: "windsurf",
      name: "Windsurf",
      badge: "JSON Config",
      summary: "Configure Cascade using Windsurf's serverUrl key.",
      steps: [
        "Open ~/.codeium/windsurf/mcp_config.json (or ~/.config/devin/mcp_config.json).",
        "Paste the configuration below and refresh MCP servers in Cascade.",
      ],
      snippetLabel: "~/.codeium/windsurf/mcp_config.json",
      snippetLanguage: "json",
      snippet: windsurfJson,
      note: "Windsurf requires \"serverUrl\" instead of \"url\" for remote Streamable HTTP servers.",
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      badge: "JSON Config",
      summary: "Add Aayam to Gemini CLI using httpUrl in ~/.gemini/settings.json.",
      steps: [
        "Open ~/.gemini/settings.json (or project .gemini/settings.json).",
        "Add the mcpServers block below using httpUrl and restart your session.",
      ],
      snippetLabel: "~/.gemini/settings.json",
      snippetLanguage: "json",
      snippet: geminiJson,
      note: "Gemini CLI expects \"httpUrl\" for Streamable HTTP transport endpoints.",
    },
  ];
}

export interface StarterPrompt {
  id: string;
  label: string;
  prompt: string;
}

export function starterPromptsForUser(opts: {
  isFaculty: boolean;
  canSeeAllFaculty?: boolean;
  cohortLabel?: string;
}): StarterPrompt[] {
  const cohort = opts.cohortLabel?.trim() || "Sam Altman 2025";
  const prompts: StarterPrompt[] = [
    {
      id: "my-day",
      label: "Today's teaching schedule & free rooms",
      prompt: "Check my timetable for today using get_my_schedule, and find which classrooms are free at 2:00 PM with find_free_rooms_or_slots.",
    },
    {
      id: "changes",
      label: "Recent cancellations & room swaps",
      prompt: "Show any cancelled, rescheduled, or moved lectures affecting my classes this week using get_timetable_changes.",
    },
    {
      id: "cohort",
      label: "Check a cohort's schedule",
      prompt: `Show the live timetable for ${cohort} using get_cohort_timetable and highlight any cancelled slots.`,
    },
  ];

  if (opts.canSeeAllFaculty) {
    prompts.push({
      id: "all-access",
      label: "All-faculty directory & coverage check",
      prompt: "List active faculty from list_faculty_directory and check Friday's teaching coverage across cohorts.",
    });
  } else if (!opts.isFaculty) {
    prompts.push({
      id: "calendar",
      label: "Calendar subscription URL",
      prompt: `Get my iCalendar feed URL for ${cohort} using get_calendar_subscription_info.`,
    });
  }

  return prompts;
}

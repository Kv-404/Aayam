import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export const MCP_SCOPES = [
  "timetable:read",
  "faculty:self",
  "coordinator:read",
  "faculty:all",
  "faculty:directory",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export interface McpFacultyIdentity {
  id: number;
  email: string;
  facultyName: string;
  canSeeAllFaculty: boolean;
  coordinatorCohorts: string[];
}

export interface McpOAuthClient {
  clientId: string;
  clientName: string;
  clientUri?: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none" | "client_secret_post" | "client_secret_basic";
  clientSecretHash?: string;
  isCimd: boolean;
  createdAt: number;
}

export interface McpAuthExtra {
  email: string;
  facultyName: string;
  canSeeAllFaculty: boolean;
  coordinatorCohorts: string[];
  jti: string;
  familyId?: string;
  [key: string]: unknown;
}

export interface McpAuthContext extends AuthInfo {
  extra: McpAuthExtra;
}

import postgres from "postgres";

let client: postgres.Sql | null = null;
let clientUrl = "";

export function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

/** Shared Postgres client. Supabase's transaction pooler cannot use prepared statements. */
export function getSql() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not configured.");
  if (!client || clientUrl !== url) {
    const previous = client;
    client = postgres(url, {
      ssl: "require",
      max: process.env.VERCEL ? 1 : 4,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 20,
      onnotice: (notice) => {
        if (notice.code === "42P07") return;
        console.log(notice.message);
      },
    });
    clientUrl = url;
    if (previous) void previous.end({ timeout: 1 });
  }
  return client;
}

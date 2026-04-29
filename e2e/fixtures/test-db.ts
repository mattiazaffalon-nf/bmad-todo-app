import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function assertSafeTestDatabase(connectionString: string | undefined) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — refusing to run E2E cleanup against an unknown database.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to TRUNCATE: NODE_ENV is 'production'.");
  }
}

export async function cleanupTodos() {
  assertSafeTestDatabase(process.env.DATABASE_URL);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("TRUNCATE TABLE todos");
  } finally {
    await client.end();
  }
}

export async function seedTodo(id: string, description: string) {
  const res = await fetch(`${BASE}/api/todos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, description }),
  });
  if (!res.ok) {
    throw new Error(`seedTodo failed: HTTP ${res.status}`);
  }
}

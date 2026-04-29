import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export async function cleanupTodos() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("TRUNCATE TABLE todos");
  await client.end();
}

export async function seedTodo(id: string, description: string) {
  await fetch(`${BASE}/api/todos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, description }),
  });
}

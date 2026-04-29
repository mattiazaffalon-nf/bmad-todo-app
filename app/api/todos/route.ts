import { createTodo, getTodoById, getTodos } from "@/db/queries";
import { TodoCreateSchema } from "@/lib/validation";
import { internalError, validationFailed } from "@/lib/api-errors";

export async function GET() {
  try {
    const todos = await getTodos(null);
    return Response.json({ todos }, { status: 200 });
  } catch (err) {
    console.error(err);
    return internalError();
  }
}

export async function POST(req: Request) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return validationFailed("Request body is not valid JSON");
    }

    const parsed = TodoCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return validationFailed(parsed.error.message);
    }

    const existing = await getTodoById(parsed.data.id, null);
    if (existing) {
      return Response.json({ todo: existing }, { status: 200 });
    }

    const todo = await createTodo(parsed.data, null);
    return Response.json({ todo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return internalError();
  }
}

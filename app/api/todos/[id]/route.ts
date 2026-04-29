import { z } from "zod";
import { deleteTodo, updateTodo } from "@/db/queries";
import { TodoUpdateSchema } from "@/lib/validation";
import { internalError, notFound, validationFailed } from "../_lib/responses";

const IdSchema = z.string().uuid();

export async function PATCH(req: Request, ctx: RouteContext<"/api/todos/[id]">) {
  try {
    const { id } = await ctx.params;
    if (!IdSchema.safeParse(id).success) {
      return validationFailed("id route param must be a UUID");
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return validationFailed("Request body is not valid JSON");
    }

    const parsed = TodoUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return validationFailed(parsed.error.message);
    }

    const todo = await updateTodo(id, { completed: parsed.data.completed }, null);
    if (!todo) {
      return notFound("Todo not found");
    }

    return Response.json({ todo }, { status: 200 });
  } catch (err) {
    console.error(err);
    return internalError();
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/todos/[id]">) {
  try {
    const { id } = await ctx.params;
    if (!IdSchema.safeParse(id).success) {
      return validationFailed("id route param must be a UUID");
    }
    await deleteTodo(id, null);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return internalError();
  }
}

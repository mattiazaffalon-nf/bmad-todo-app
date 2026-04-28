import { z } from "zod";
import type { Todo } from "@/db/schema";

export const TodoCreateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(280),
});
export type TodoCreateInput = z.infer<typeof TodoCreateSchema>;

export const TodoUpdateSchema = z.object({
  completed: z.boolean(),
});
export type TodoUpdateInput = z.infer<typeof TodoUpdateSchema>;

export type { Todo };

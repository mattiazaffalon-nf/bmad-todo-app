import { z } from "zod";

export const TodoCreateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(280),
});
export type TodoCreateInput = z.infer<typeof TodoCreateSchema>;

export const TodoUpdateSchema = z.object({
  completed: z.boolean(),
});
export type TodoUpdateInput = z.infer<typeof TodoUpdateSchema>;

export const TodoApiSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
  userId: z.string().uuid().nullable(),
});
export type Todo = z.infer<typeof TodoApiSchema>;

export type SyncStatus = "idle" | "pending" | "failed";
export type OptimisticTodo = Todo & { syncStatus?: SyncStatus };

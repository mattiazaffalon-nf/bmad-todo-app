import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
  id: uuid("id").primaryKey(),
  description: varchar("description", { length: 280 }).notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: uuid("user_id"),
});

export type Todo = typeof todos.$inferSelect;
export type TodoInsert = typeof todos.$inferInsert;

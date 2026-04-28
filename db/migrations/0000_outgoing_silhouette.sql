CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"description" varchar(280) NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid
);

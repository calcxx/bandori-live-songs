CREATE TYPE "public"."band_group_type" AS ENUM('band', 'project-common');--> statement-breakpoint
CREATE TYPE "public"."eventernote_fetch_status" AS ENUM('ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."setlist_status" AS ENUM('missing', 'partial', 'complete');--> statement-breakpoint
CREATE TABLE "app_runtime_snapshots" (
	"snapshot_key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bands" (
	"slug" text PRIMARY KEY NOT NULL,
	"name_ja" text NOT NULL,
	"name_en" text NOT NULL,
	"display_order" integer NOT NULL,
	"group_type" "band_group_type" NOT NULL,
	"eventernote_actor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventernote_user_cache" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_id" text,
	"display_name" text,
	"fetch_status" "eventernote_fetch_status" DEFAULT 'ok' NOT NULL,
	"parser_version" integer DEFAULT 1 NOT NULL,
	"activities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_message" text,
	"last_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"refreshing_started_at" timestamp with time zone,
	"remote_event_count" integer
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventernote_event_id" integer NOT NULL,
	"title" text NOT NULL,
	"event_date" date NOT NULL,
	"venue" text,
	"setlist_status" "setlist_status" DEFAULT 'missing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setlist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"order_index" integer NOT NULL,
	"raw_title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" serial PRIMARY KEY NOT NULL,
	"band_slug" text NOT NULL,
	"title" text NOT NULL,
	"first_release_date" date NOT NULL,
	"has_been_played_live" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setlist_entries" ADD CONSTRAINT "setlist_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_band_slug_bands_slug_fk" FOREIGN KEY ("band_slug") REFERENCES "public"."bands"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_eventernote_id_idx" ON "events" USING btree ("eventernote_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "setlist_entries_event_order_idx" ON "setlist_entries" USING btree ("event_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "songs_title_idx" ON "songs" USING btree ("title");
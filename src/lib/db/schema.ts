import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { BandoriUserEventSnapshot } from "@/lib/eventernote/bandori-user-events";
import type { EventVisibilityRules } from "@/lib/events/event-visibility";

export const bandGroupTypeEnum = pgEnum("band_group_type", ["band", "project-common"]);
export const setlistStatusEnum = pgEnum("setlist_status", ["missing", "partial", "complete"]);
export const eventernoteFetchStatusEnum = pgEnum("eventernote_fetch_status", ["ok", "error"]);

export const bands = pgTable("bands", {
  slug: text("slug").primaryKey(),
  nameJa: text("name_ja").notNull(),
  nameEn: text("name_en").notNull(),
  displayOrder: integer("display_order").notNull(),
  groupType: bandGroupTypeEnum("group_type").notNull(),
  eventernoteActorId: integer("eventernote_actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const songs = pgTable(
  "songs",
  {
    id: serial("id").primaryKey(),
    bandSlug: text("band_slug")
      .notNull()
      .references(() => bands.slug, { onDelete: "restrict" }),
    title: text("title").notNull(),
    firstReleaseDate: date("first_release_date", { mode: "string" }).notNull(),
    hasBeenPlayedLive: boolean("has_been_played_live").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    titleUnique: uniqueIndex("songs_title_idx").on(table.title),
  }),
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    eventernoteEventId: integer("eventernote_event_id").notNull(),
    title: text("title").notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    venue: text("venue"),
    setlistStatus: setlistStatusEnum("setlist_status").default("missing").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventernoteIdIndex: uniqueIndex("events_eventernote_id_idx").on(table.eventernoteEventId),
  }),
);

export const setlistEntries = pgTable(
  "setlist_entries",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    rawTitle: text("raw_title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventOrderIndex: uniqueIndex("setlist_entries_event_order_idx").on(table.eventId, table.orderIndex),
  }),
);

export const eventernoteUserCache = pgTable("eventernote_user_cache", {
  userId: text("user_id").primaryKey(),
  displayId: text("display_id"),
  displayName: text("display_name"),
  fetchStatus: eventernoteFetchStatusEnum("fetch_status").default("ok").notNull(),
  parserVersion: integer("parser_version").default(1).notNull(),
  activities: jsonb("activities").$type<BandoriUserEventSnapshot[]>().notNull().default(sql`'[]'::jsonb`),
  errorMessage: text("error_message"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  refreshingStartedAt: timestamp("refreshing_started_at", { withTimezone: true }),
  remoteEventCount: integer("remote_event_count"),
});

/** Actor-page authority: eventernoteEventId → BanG Dream bands (not Setlist events). */
export const bandoriEventIndex = pgTable("bandori_event_index", {
  eventernoteEventId: integer("eventernote_event_id").primaryKey(),
  title: text("title").notNull(),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  venue: text("venue"),
  sourceUrl: text("source_url").notNull(),
  attendeeCount: integer("attendee_count").notNull().default(0),
  bandSlugs: jsonb("band_slugs").$type<string[]>().notNull(),
  bandNames: jsonb("band_names").$type<string[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").$type<EventVisibilityRules>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

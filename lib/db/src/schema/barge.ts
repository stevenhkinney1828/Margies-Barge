import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("barge_settings", {
  id: integer("id").primaryKey().default(1),
  safeLow: numeric("safe_low", { precision: 8, scale: 2 }).notNull().default("1060.00"),
  safeHigh: numeric("safe_high", { precision: 8, scale: 2 }).notNull().default("1071.00"),
  familyEmails: text("family_emails").array().notNull().default(sql`ARRAY[]::text[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const tasksTable = pgTable("barge_tasks", {
  id: serial("id").primaryKey(),
  icon: text("icon").notNull(),
  name: text("name").notNull(),
  cadenceDays: integer("cadence_days").notNull(),
  cadenceLabel: text("cadence_label").notNull(),
  activeMonths: text("active_months"),
  activeStartMonth: integer("active_start_month"),
  activeEndMonth: integer("active_end_month"),
  lastDoneDate: date("last_done_date"),
  lastDoneBy: text("last_done_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const dockAdjustmentsTable = pgTable("barge_dock_adjustments", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  workDate: date("work_date").notNull(),
  clearanceUp: numeric("clearance_up", { precision: 6, scale: 2 }),
  clearanceDown: numeric("clearance_down", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingsTable = pgTable("barge_bookings", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  googleEventId: text("google_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bringItemsTable = pgTable("barge_bring_items", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issuesTable = pgTable("barge_issues", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  caption: text("caption").notNull(),
  photoUrl: text("photo_url").notNull(),
  urgent: boolean("urgent").notNull().default(false),
  status: text("status").notNull().default("open"),
  resolutionNote: text("resolution_note"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityEntriesTable = pgTable("barge_activity_entries", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  action: text("action").notNull(),
  actionDate: date("action_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export const insertBringItemSchema = createInsertSchema(bringItemsTable).omit({ id: true, createdAt: true });
export const insertIssueSchema = createInsertSchema(issuesTable).omit({ id: true, createdAt: true, resolvedAt: true });
export const insertActivityEntrySchema = createInsertSchema(activityEntriesTable).omit({ id: true, createdAt: true });

export type BargeTask = typeof tasksTable.$inferSelect;
export type InsertBargeTask = z.infer<typeof insertTaskSchema>;
export type BargeBooking = typeof bookingsTable.$inferSelect;
export type BargeBringItem = typeof bringItemsTable.$inferSelect;
export type BargeIssue = typeof issuesTable.$inferSelect;
export type BargeActivityEntry = typeof activityEntriesTable.$inferSelect;

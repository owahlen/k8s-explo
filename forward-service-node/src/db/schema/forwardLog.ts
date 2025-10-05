import {pgTable, uuid, timestamp, varchar, integer} from "drizzle-orm/pg-core";

/**
 * Matches:
 *   public.forward_log (
 *     id uuid primary key,
 *     log_date timestamp not null,
 *     pod_name varchar(255) not null,
 *     http_status integer not null
 *   )
 *
 * Notes:
 * - No default for `id` here (DB doesn't have one). You must supply it on insert.
 * - `timestamp(..., { withTimezone: false })` matches `timestamp without time zone`.
*/
export const forwardLog = pgTable("forward_log", {
    id: uuid("id").primaryKey(),
    logDate: timestamp("log_date", {withTimezone: false}).notNull(),
    podName: varchar("pod_name", {length: 255}).notNull(),
    targetPodName: varchar("target_pod_name", {length: 255}).notNull(),
    httpStatus: integer("http_status").notNull(),
});

// Inferred types (use these throughout your app)
export type ForwardLogEntry = typeof forwardLog.$inferSelect; // row returned from SELECT
export type NewForwardLogEntry = typeof forwardLog.$inferInsert; // shape required for INSERT

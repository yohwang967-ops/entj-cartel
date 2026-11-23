import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull().unique(),
  name: text("name").notNull(),
  topic: text("topic").notNull(),
  intro: text("intro").notNull(),
  updated: integer("updated").notNull(),
});

export const clubItems = sqliteTable("club_items", {
  id: text("id").primaryKey(),
  author: text("author").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  topic: text("topic").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  created: integer("created").notNull(),
});
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  member: text("member").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  groupId: text("group_id").notNull(),
});

import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_uq").on(table.workspaceId, table.userId),
  ],
);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("draft"),
  currentRevisionId: uuid("current_revision_id"),
  targetPlatform: text("target_platform").notNull().default("youtube-shorts"),
  targetSeconds: integer("target_seconds").notNull().default(60),
  language: text("language").notNull().default("id"),
  styleId: text("style_id").notNull().default("cinematic"),
  createdBy: uuid("created_by").notNull(),
  ...timestamps,
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const projectRevisions = pgTable(
  "project_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    source: text("source").notNull(),
    planJson: jsonb("plan_json").notNull(),
    legacyPlanJson: jsonb("legacy_plan_json"),
    changeSummary: text("change_summary"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("project_revisions_project_number_uq").on(table.projectId, table.revisionNumber)],
);

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => projectRevisions.id, { onDelete: "cascade" }),
    stableSceneId: text("stable_scene_id").notNull(),
    sceneOrder: integer("scene_order").notNull(),
    sceneType: text("scene_type").notNull(),
    purpose: text("purpose"),
    durationSeconds: integer("duration_seconds").notNull().default(5),
    status: text("status").notNull().default("ready"),
    ...timestamps,
  },
  (table) => [uniqueIndex("scenes_revision_stable_uq").on(table.revisionId, table.stableSceneId)],
);

export const sceneContents = pgTable("scene_contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  sceneId: uuid("scene_id")
    .notNull()
    .unique()
    .references(() => scenes.id, { onDelete: "cascade" }),
  contentJson: jsonb("content_json").notNull(),
  narrationText: text("narration_text"),
  captionText: text("caption_text"),
  visualDirection: text("visual_direction"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  assetType: text("asset_type").notNull(),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  durationSeconds: numeric("duration_seconds", { mode: "number" }),
  fileSize: integer("file_size").notNull(),
  checksum: text("checksum"),
  provider: text("provider"),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sceneAssets = pgTable("scene_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  sceneId: uuid("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  configJson: jsonb("config_json").notNull().default({}),
});

export const captionWords = pgTable("caption_words", {
  id: uuid("id").defaultRandom().primaryKey(),
  revisionId: uuid("revision_id")
    .notNull()
    .references(() => projectRevisions.id, { onDelete: "cascade" }),
  sceneId: uuid("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  groupIndex: integer("group_index").notNull().default(0),
  isEmphasis: boolean("is_emphasis").notNull().default(false),
});

export const audioTracks = pgTable("audio_tracks", {
  id: uuid("id").defaultRandom().primaryKey(),
  revisionId: uuid("revision_id")
    .notNull()
    .references(() => projectRevisions.id, { onDelete: "cascade" }),
  sceneId: uuid("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  trackType: text("track_type").notNull(),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  durationSeconds: numeric("duration_seconds").notNull(),
  waveformJson: jsonb("waveform_json"),
  status: text("status").notNull().default("ready"),
  provider: text("provider"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  sceneId: uuid("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  operation: text("operation").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  requestHash: text("request_hash"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id").references(() => projectRevisions.id, { onDelete: "set null" }),
  status: text("status").notNull().default("queued"),
  stage: text("stage"),
  progress: integer("progress").notNull().default(0),
  attempt: integer("attempt").notNull().default(0),
  priority: integer("priority").notNull().default(0),
  sandboxId: text("sandbox_id"),
  commandId: text("command_id"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  workerId: text("worker_id"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const renderArtifacts = pgTable("render_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => renderJobs.id, { onDelete: "cascade" }),
  artifactType: text("artifact_type").notNull(),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: text("checksum"),
  durationSeconds: numeric("duration_seconds", { mode: "number" }),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  provider: text("provider"),
  quantity: numeric("quantity").notNull(),
  unit: text("unit").notNull(),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Role = "owner" | "admin" | "editor" | "viewer";

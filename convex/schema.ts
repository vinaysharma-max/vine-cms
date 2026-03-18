import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  userProfiles: defineTable({
    userId: v.id("users"),
    avatarMode: v.union(v.literal("provider"), v.literal("custom")),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
  userPreferences: defineTable({
    userId: v.id("users"),
    defaultWorkspaceSlug: v.optional(v.string()),
    defaultLandingPage: v.optional(v.string()),
    emailInvites: v.boolean(),
    productUpdates: v.boolean(),
    publishAlerts: v.boolean(),
    apiUsageAlerts: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
  editorPreferences: defineTable({
    userId: v.id("users"),
    autosaveEnabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner_user_id", ["ownerUserId"]),
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_user_id", ["userId"])
    .index("by_workspace_id_and_user_id", ["workspaceId", "userId"]),
  workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    invitedByUserId: v.id("users"),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    invitedAt: v.number(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_workspace_id", ["workspaceId"])
    .index("by_email", ["email"]),
  authors: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    email: v.string(),
    about: v.optional(v.string()),
    socialLinks: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_workspace_id", ["workspaceId"]),
  categories: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_slug", ["workspaceId", "slug"]),
  tags: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_slug", ["workspaceId", "slug"]),
  posts: defineTable({
    workspaceId: v.id("workspaces"),
    createdByUserId: v.id("users"),
    authorId: v.optional(v.id("authors")),
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    thumbnailMediaId: v.optional(v.union(v.id("media"), v.null())),
    categorySlug: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    visible: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_slug", ["workspaceId", "slug"]),
  postBodies: defineTable({
    postId: v.id("posts"),
    contentHtml: v.string(),
    contentJson: v.any(),
  }).index("by_post_id", ["postId"]),
  postTags: defineTable({
    postId: v.id("posts"),
    workspaceId: v.id("workspaces"),
    tagSlug: v.string(),
  })
    .index("by_post_id", ["postId"])
    .index("by_workspace_id_and_tag_slug", ["workspaceId", "tagSlug"]),
  editorDrafts: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    draftKey: v.string(),
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    thumbnailMediaId: v.optional(v.union(v.id("media"), v.null())),
    authorId: v.optional(v.id("authors")),
    categorySlug: v.optional(v.string()),
    tagSlugs: v.array(v.string()),
    publishedAt: v.optional(v.number()),
    visible: v.optional(v.boolean()),
    status: v.union(v.literal("draft"), v.literal("published")),
    contentJson: v.any(),
    updatedAt: v.number(),
  }).index("by_user_id_and_workspace_id_and_draft_key", [
    "userId",
    "workspaceId",
    "draftKey",
  ]),
  workspaceApiKeys: defineTable({
    workspaceId: v.id("workspaces"),
    description: v.string(),
    hashedKey: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    lastUsedIp: v.optional(v.string()),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_hashed_key", ["hashedKey"]),
  media: defineTable({
    workspaceId: v.id("workspaces"),
    uploadedByUserId: v.id("users"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
    thumbhashBase64: v.optional(v.string()),
    aspectRatio: v.optional(v.number()),
  }).index("by_workspace_id", ["workspaceId"]),
  emailRateLimits: defineTable({
    identifier: v.string(),
    type: v.string(),
    lastSentAt: v.number(),
  }).index("by_identifier_and_type", ["identifier", "type"]),
});

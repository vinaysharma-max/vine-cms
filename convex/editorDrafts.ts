/* eslint-disable @typescript-eslint/no-explicit-any */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireWorkspaceMembership } from './lib/workspace';

export const get = query({
  args: {
    workspaceSlug: v.string(),
    draftKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace, userId } = await requireWorkspaceMembership(
      ctx,
      args.workspaceSlug,
    );

    const draft = await ctx.db
      .query('editorDrafts')
      .withIndex('by_user_id_and_workspace_id_and_draft_key', (q: any) =>
        q
          .eq('userId', userId)
          .eq('workspaceId', workspace._id)
          .eq('draftKey', args.draftKey),
      )
      .unique();

    if (!draft) {
      return null;
    }

    return {
      metadata: {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        thumbnailMediaId: draft.thumbnailMediaId ?? null,
        authorId: draft.authorId,
        categorySlug: draft.categorySlug,
        tagSlugs: draft.tagSlugs,
        publishedAt: draft.publishedAt ?? null,
        status: draft.status,
      },
      contentJson: draft.contentJson ?? null,
      updatedAt: draft.updatedAt,
    };
  },
});

export const upsert = mutation({
  args: {
    workspaceSlug: v.string(),
    draftKey: v.string(),
    data: v.object({
      title: v.string(),
      slug: v.string(),
      excerpt: v.string(),
      thumbnailMediaId: v.optional(v.union(v.id('media'), v.null())),
      authorId: v.optional(v.id('authors')),
      categorySlug: v.optional(v.string()),
      tagSlugs: v.array(v.string()),
      publishedAt: v.optional(v.number()),
      status: v.union(v.literal('draft'), v.literal('published')),
      contentJson: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    const { workspace, userId } = await requireWorkspaceMembership(
      ctx,
      args.workspaceSlug,
    );

    const existing = await ctx.db
      .query('editorDrafts')
      .withIndex('by_user_id_and_workspace_id_and_draft_key', (q: any) =>
        q
          .eq('userId', userId)
          .eq('workspaceId', workspace._id)
          .eq('draftKey', args.draftKey),
      )
      .unique();

    const nextData = {
      workspaceId: workspace._id,
      userId,
      draftKey: args.draftKey,
      title: args.data.title,
      slug: args.data.slug,
      excerpt: args.data.excerpt,
      thumbnailMediaId: args.data.thumbnailMediaId ?? null,
      authorId: args.data.authorId,
      categorySlug: args.data.categorySlug,
      tagSlugs: args.data.tagSlugs,
      publishedAt: args.data.publishedAt,
      status: args.data.status,
      contentJson: args.data.contentJson,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, nextData);
    } else {
      await ctx.db.insert('editorDrafts', nextData);
    }

    return { success: true };
  },
});

export const clear = mutation({
  args: {
    workspaceSlug: v.string(),
    draftKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace, userId } = await requireWorkspaceMembership(
      ctx,
      args.workspaceSlug,
    );

    const existing = await ctx.db
      .query('editorDrafts')
      .withIndex('by_user_id_and_workspace_id_and_draft_key', (q: any) =>
        q
          .eq('userId', userId)
          .eq('workspaceId', workspace._id)
          .eq('draftKey', args.draftKey),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

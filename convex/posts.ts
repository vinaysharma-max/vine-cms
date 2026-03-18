/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireWorkspaceMembership } from './lib/workspace';

async function getWorkspacePostBySlug(ctx: any, workspaceId: string, postSlug: string) {
  return await ctx.db
    .query('posts')
    .withIndex('by_workspace_id_and_slug', (q: any) =>
      q.eq('workspaceId', workspaceId).eq('slug', postSlug),
    )
    .unique();
}

async function ensureValidRelations(
  ctx: any,
  workspaceId: string,
  data: {
    thumbnailMediaId?: string | null;
    authorId?: string;
    categorySlug?: string;
    tagSlugs?: string[];
  },
) {
  if (data.thumbnailMediaId) {
    const media = await ctx.db.get(data.thumbnailMediaId);
    if (!media || media.workspaceId !== workspaceId) {
      throw new Error('Selected thumbnail does not belong to this workspace');
    }
  }

  if (data.authorId) {
    const author = await ctx.db.get(data.authorId);
    if (!author || author.workspaceId !== workspaceId) {
      throw new Error('Selected author does not belong to this workspace');
    }
  }

  if (data.categorySlug) {
    const category = await ctx.db
      .query('categories')
      .withIndex('by_workspace_id_and_slug', (q: any) =>
        q.eq('workspaceId', workspaceId).eq('slug', data.categorySlug),
      )
      .unique();
    if (!category) {
      throw new Error('Selected category does not belong to this workspace');
    }
  }

  if (data.tagSlugs?.length) {
    const uniqueTagSlugs = Array.from(new Set(data.tagSlugs));
    for (const tagSlug of uniqueTagSlugs) {
      const tag = await ctx.db
        .query('tags')
        .withIndex('by_workspace_id_and_slug', (q: any) =>
          q.eq('workspaceId', workspaceId).eq('slug', tagSlug),
        )
        .unique();
      if (!tag) {
        throw new Error('Selected tags must belong to this workspace');
      }
    }
  }
}

async function hydrateThumbnail(ctx: any, thumbnailMediaId?: string | null) {
  if (!thumbnailMediaId) {
    return null;
  }

  const media = await ctx.db.get(thumbnailMediaId);
  if (!media) {
    return null;
  }

  const url = await ctx.storage.getUrl(media.storageId);
  if (!url) {
    return null;
  }

  return {
    id: media._id,
    url,
    filename: media.filename,
    thumbhashBase64: media.thumbhashBase64 ?? null,
    aspectRatio: media.aspectRatio ?? null,
  };
}

async function hydratePost(ctx: any, post: any) {
  const [author, creator, category, body, postTags, thumbnail] = await Promise.all([
    post.authorId ? ctx.db.get(post.authorId) : Promise.resolve(null),
    ctx.db.get(post.createdByUserId),
    post.categorySlug
      ? ctx.db
          .query('categories')
          .withIndex('by_workspace_id_and_slug', (q: any) =>
            q.eq('workspaceId', post.workspaceId).eq('slug', post.categorySlug),
          )
          .unique()
      : Promise.resolve(null),
    ctx.db
      .query('postBodies')
      .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
      .unique(),
    ctx.db
      .query('postTags')
      .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
      .collect(),
    hydrateThumbnail(ctx, post.thumbnailMediaId),
  ]);

  const tags = await Promise.all(
    postTags.map(async (postTag: any) => {
      const tag = await ctx.db
        .query('tags')
        .withIndex('by_workspace_id_and_slug', (q: any) =>
          q.eq('workspaceId', post.workspaceId).eq('slug', postTag.tagSlug),
        )
        .unique();

      return tag
        ? {
            slug: tag.slug,
            name: tag.name,
          }
        : null;
    }),
  );

  return {
    id: post._id,
    workspaceId: post.workspaceId,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    thumbnail,
    status: post.status,
    createdAt: new Date(post.createdAt).toISOString(),
    updatedAt: new Date(post.updatedAt).toISOString(),
    publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
    author: author
      ? {
          id: author._id,
          name: author.name,
          email: author.email,
        }
      : null,
    category: category
      ? {
          name: category.name,
          slug: category.slug,
        }
      : null,
    creator: {
      id: creator?._id ?? '',
      name: creator?.name ?? 'Unknown',
      email: creator?.email ?? '',
    },
    tags: tags.filter((tag): tag is NonNullable<typeof tag> => tag !== null),
    contentHtml: body?.contentHtml ?? '',
    contentJson: body?.contentJson ?? null,
  };
}

export const list = query({
  args: {
    workspaceSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMembership(ctx, args.workspaceSlug);
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_workspace_id', (q: any) => q.eq('workspaceId', workspace._id))
      .collect();

    const hydrated = await Promise.all(posts.map((post) => hydratePost(ctx, post)));
    return hydrated.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  },
});

export const get = query({
  args: {
    workspaceSlug: v.string(),
    postSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMembership(ctx, args.workspaceSlug);
    const post = await getWorkspacePostBySlug(ctx, workspace._id, args.postSlug);

    if (!post) {
      return null;
    }

    return await hydratePost(ctx, post);
  },
});

export const create = mutation({
  args: {
    workspaceSlug: v.string(),
    data: v.object({
      title: v.string(),
      slug: v.string(),
      excerpt: v.string(),
      thumbnailMediaId: v.optional(v.union(v.id('media'), v.null())),
      authorId: v.optional(v.id('authors')),
      categorySlug: v.optional(v.string()),
      tagSlugs: v.array(v.string()),
      status: v.union(v.literal('draft'), v.literal('published')),
      contentHtml: v.string(),
      contentJson: v.any(),
      publishedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { workspace, userId } = await requireWorkspaceMembership(ctx, args.workspaceSlug);
    const existing = await getWorkspacePostBySlug(ctx, workspace._id, args.data.slug.trim());
    if (existing) {
      throw new Error('A post with this slug already exists');
    }

    await ensureValidRelations(ctx, workspace._id, args.data);

    const now = Date.now();
    const postId = await ctx.db.insert('posts', {
      workspaceId: workspace._id,
      createdByUserId: userId,
      authorId: args.data.authorId,
      title: args.data.title.trim(),
      slug: args.data.slug.trim(),
      excerpt: args.data.excerpt.trim(),
      thumbnailMediaId: args.data.thumbnailMediaId ?? null,
      categorySlug: args.data.categorySlug?.trim() || undefined,
      status: args.data.status,
      createdAt: now,
      updatedAt: now,
      publishedAt: args.data.publishedAt,
    });

    await ctx.db.insert('postBodies', {
      postId,
      contentHtml: args.data.contentHtml,
      contentJson: args.data.contentJson,
    });

    for (const tagSlug of Array.from(new Set(args.data.tagSlugs))) {
      await ctx.db.insert('postTags', {
        postId,
        workspaceId: workspace._id,
        tagSlug,
      });
    }

    const post = await ctx.db.get(postId);
    if (!post) {
      throw new Error('Failed to create post');
    }

    return await hydratePost(ctx, post);
  },
});

export const update = mutation({
  args: {
    workspaceSlug: v.string(),
    postSlug: v.string(),
    data: v.object({
      title: v.optional(v.string()),
      slug: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      thumbnailMediaId: v.optional(v.union(v.id('media'), v.null())),
      authorId: v.optional(v.id('authors')),
      categorySlug: v.optional(v.string()),
      tagSlugs: v.optional(v.array(v.string())),
      status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
      contentHtml: v.optional(v.string()),
      contentJson: v.optional(v.any()),
      publishedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMembership(ctx, args.workspaceSlug);
    const post = await getWorkspacePostBySlug(ctx, workspace._id, args.postSlug);

    if (!post) {
      throw new Error('Post not found');
    }

    const nextSlug = args.data.slug?.trim();
    if (nextSlug && nextSlug !== post.slug) {
      const existing = await getWorkspacePostBySlug(ctx, workspace._id, nextSlug);
      if (existing) {
        throw new Error('A post with this slug already exists');
      }
    }

    await ensureValidRelations(ctx, workspace._id, args.data);

    await ctx.db.patch(post._id, {
      ...(args.data.title !== undefined ? { title: args.data.title.trim() } : {}),
      ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
      ...(args.data.excerpt !== undefined ? { excerpt: args.data.excerpt.trim() } : {}),
      ...(args.data.thumbnailMediaId !== undefined
        ? { thumbnailMediaId: args.data.thumbnailMediaId ?? null }
        : {}),
      ...(args.data.authorId !== undefined ? { authorId: args.data.authorId } : {}),
      ...(args.data.categorySlug !== undefined
        ? { categorySlug: args.data.categorySlug?.trim() || undefined }
        : {}),
      ...(args.data.status !== undefined ? { status: args.data.status } : {}),
      ...(args.data.publishedAt !== undefined ? { publishedAt: args.data.publishedAt } : {}),
      updatedAt: Date.now(),
    });

    const body = await ctx.db
      .query('postBodies')
      .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
      .unique();

    if (args.data.contentHtml !== undefined || args.data.contentJson !== undefined) {
      if (body) {
        await ctx.db.patch(body._id, {
          ...(args.data.contentHtml !== undefined ? { contentHtml: args.data.contentHtml } : {}),
          ...(args.data.contentJson !== undefined ? { contentJson: args.data.contentJson } : {}),
        });
      } else {
        await ctx.db.insert('postBodies', {
          postId: post._id,
          contentHtml: args.data.contentHtml ?? '',
          contentJson: args.data.contentJson ?? null,
        });
      }
    }

    if (args.data.tagSlugs) {
      const existingTags = await ctx.db
        .query('postTags')
        .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
        .collect();
      for (const tag of existingTags) {
        await ctx.db.delete(tag._id);
      }
      for (const tagSlug of Array.from(new Set(args.data.tagSlugs))) {
        await ctx.db.insert('postTags', {
          postId: post._id,
          workspaceId: workspace._id,
          tagSlug,
        });
      }
    }

    const updated = await ctx.db.get(post._id);
    if (!updated) {
      throw new Error('Post not found');
    }

    return await hydratePost(ctx, updated);
  },
});

export const remove = mutation({
  args: {
    workspaceSlug: v.string(),
    postSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceMembership(ctx, args.workspaceSlug);
    const post = await getWorkspacePostBySlug(ctx, workspace._id, args.postSlug);

    if (!post) {
      throw new Error('Post not found');
    }

    const [body, tags] = await Promise.all([
      ctx.db
        .query('postBodies')
        .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
        .unique(),
      ctx.db
        .query('postTags')
        .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
        .collect(),
    ]);

    for (const tag of tags) {
      await ctx.db.delete(tag._id);
    }

    if (body) {
      await ctx.db.delete(body._id);
    }

    await ctx.db.delete(post._id);
    return { success: true };
  },
});

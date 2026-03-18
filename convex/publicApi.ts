/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { mutation, query } from './_generated/server';
import { estimateReadingTime } from '../lib/reading-time';
import { toPublicApiCursorPagination } from '../lib/public-api-pagination';

async function sha256(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validateApiKey(ctx: any, apiKey: string) {
  const hashedKey = await sha256(apiKey.trim());
  const record = await ctx.db
    .query('workspaceApiKeys')
    .withIndex('by_hashed_key', (q: any) => q.eq('hashedKey', hashedKey))
    .unique();

  if (!record) {
    return null;
  }

  const workspace = await ctx.db.get(record.workspaceId);
  if (!workspace) {
    return null;
  }

  return { workspace, apiKeyRecord: record };
}

function isPublicPost(post: any) {
  return post.status === 'published';
}

async function getPublicPostBySlug(ctx: any, workspaceId: string, postSlug: string) {
  return await ctx.db
    .query('posts')
    .withIndex('by_workspace_id_and_slug', (q: any) =>
      q.eq('workspaceId', workspaceId).eq('slug', postSlug),
    )
    .unique();
}

async function getPublicPostListItem(ctx: any, post: any) {
  const [author, category, postTags, body, thumbnail] = await Promise.all([
    post.authorId ? ctx.db.get(post.authorId) : Promise.resolve(null),
    post.categorySlug
      ? ctx.db
          .query('categories')
          .withIndex('by_workspace_id_and_slug', (q: any) =>
            q.eq('workspaceId', post.workspaceId).eq('slug', post.categorySlug),
          )
          .unique()
      : Promise.resolve(null),
    ctx.db
      .query('postTags')
      .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
      .collect(),
    ctx.db
      .query('postBodies')
      .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
      .unique(),
    post.thumbnailMediaId ? ctx.db.get(post.thumbnailMediaId) : Promise.resolve(null),
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

  const thumbnailUrl = thumbnail
    ? await ctx.storage.getUrl(thumbnail.storageId)
    : null;

  return {
    id: post._id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    thumbnailUrl,
    readingTimeMinutes: estimateReadingTime({
      html: body?.contentHtml ?? '',
      text: post.excerpt,
    }).minutes,
    publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
    updatedAt: new Date(post.updatedAt).toISOString(),
    author: author
      ? {
          id: author._id,
          name: author.name,
        }
      : null,
    category: category
      ? {
          slug: category.slug,
          name: category.name,
        }
      : null,
    tags: tags.filter((tag): tag is NonNullable<typeof tag> => tag !== null),
  };
}

async function getPublicPostDetail(ctx: any, post: any) {
  const [listItem, body] = await Promise.all([
    getPublicPostListItem(ctx, post),
    ctx.db
      .query('postBodies')
      .withIndex('by_post_id', (q: any) => q.eq('postId', post._id))
      .unique(),
  ]);

  return {
    ...listItem,
    readingTimeMinutes: estimateReadingTime({
      html: body?.contentHtml ?? '',
      text: post.excerpt,
    }).minutes,
    contentHtml: body?.contentHtml ?? '',
  };
}

export const listPosts = query({
  args: {
    apiKey: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await validateApiKey(ctx, args.apiKey);
    if (!access) {
      return null;
    }

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_workspace_id_and_status_and_published_at', (q: any) =>
        q.eq('workspaceId', access.workspace._id).eq('status', 'published'),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    const items = await Promise.all(posts.page.map((post) => getPublicPostListItem(ctx, post)));

    return {
      posts: items,
      pagination: toPublicApiCursorPagination({
        limit: args.paginationOpts.numItems,
        continueCursor: posts.continueCursor,
        isDone: posts.isDone,
      }),
    };
  },
});

export const getPost = query({
  args: {
    apiKey: v.string(),
    postSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await validateApiKey(ctx, args.apiKey);
    if (!access) {
      return null;
    }

    const post = await getPublicPostBySlug(ctx, access.workspace._id, args.postSlug.trim());
    if (!post || !isPublicPost(post)) {
      return {
        post: null,
      };
    }

    return {
      post: await getPublicPostDetail(ctx, post),
    };
  },
});

export const listAuthors = query({
  args: {
    apiKey: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await validateApiKey(ctx, args.apiKey);
    if (!access) {
      return null;
    }

    const authors = await ctx.db
      .query('authors')
      .withIndex('by_workspace_id_and_name', (q: any) => q.eq('workspaceId', access.workspace._id))
      .order('asc')
      .paginate(args.paginationOpts);

    return {
      authors: authors.page.map((author) => ({
        id: author._id,
        name: author.name,
        email: author.email,
        about: author.about ?? '',
        socialLinks: (author.socialLinks as Record<string, string> | undefined) ?? {},
      })),
      pagination: toPublicApiCursorPagination({
        limit: args.paginationOpts.numItems,
        continueCursor: authors.continueCursor,
        isDone: authors.isDone,
      }),
    };
  },
});

export const listCategories = query({
  args: {
    apiKey: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await validateApiKey(ctx, args.apiKey);
    if (!access) {
      return null;
    }

    const categories = await ctx.db
      .query('categories')
      .withIndex('by_workspace_id_and_name', (q: any) => q.eq('workspaceId', access.workspace._id))
      .order('asc')
      .paginate(args.paginationOpts);

    return {
      categories: categories.page.map((category) => ({
        id: category._id,
        name: category.name,
        slug: category.slug,
      })),
      pagination: toPublicApiCursorPagination({
        limit: args.paginationOpts.numItems,
        continueCursor: categories.continueCursor,
        isDone: categories.isDone,
      }),
    };
  },
});

export const listTags = query({
  args: {
    apiKey: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await validateApiKey(ctx, args.apiKey);
    if (!access) {
      return null;
    }

    const tags = await ctx.db
      .query('tags')
      .withIndex('by_workspace_id_and_name', (q: any) => q.eq('workspaceId', access.workspace._id))
      .order('asc')
      .paginate(args.paginationOpts);

    return {
      tags: tags.page.map((tag) => ({
        id: tag._id,
        name: tag.name,
        slug: tag.slug,
      })),
      pagination: toPublicApiCursorPagination({
        limit: args.paginationOpts.numItems,
        continueCursor: tags.continueCursor,
        isDone: tags.isDone,
      }),
    };
  },
});

export const getStats = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await validateApiKey(ctx, args.apiKey);
    if (!access) {
      return null;
    }

    const [posts, authors, categories, tags] = await Promise.all([
      ctx.db
        .query('posts')
        .withIndex('by_workspace_id', (q: any) => q.eq('workspaceId', access.workspace._id))
        .collect(),
      ctx.db
        .query('authors')
        .withIndex('by_workspace_id', (q: any) => q.eq('workspaceId', access.workspace._id))
        .collect(),
      ctx.db
        .query('categories')
        .withIndex('by_workspace_id', (q: any) => q.eq('workspaceId', access.workspace._id))
        .collect(),
      ctx.db
        .query('tags')
        .withIndex('by_workspace_id', (q: any) => q.eq('workspaceId', access.workspace._id))
        .collect(),
    ]);

    const publicPosts = posts.filter(isPublicPost);

    return {
      stats: {
        totalPosts: publicPosts.length,
        totalAuthors: authors.length,
        totalCategories: categories.length,
        totalTags: tags.length,
      },
    };
  },
});

export const trackApiKeyUsage = mutation({
  args: {
    apiKey: v.string(),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await validateApiKey(ctx, args.apiKey);
    if (!access) {
      return { success: false };
    }

    await ctx.db.patch(access.apiKeyRecord._id, {
      lastUsedAt: Date.now(),
      lastUsedIp: args.ip?.trim() || undefined,
    });

    return { success: true };
  },
});

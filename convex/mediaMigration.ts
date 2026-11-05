import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';

export const listMedia = internalQuery({
  args: {},
  handler: async (ctx) => {
    const media = await ctx.db.query('media').collect();
    return await Promise.all(
      media.map(async (record) => ({
        mediaId: record._id,
        storageId: record.storageId,
        contentType: record.contentType,
        size: record.size,
        filename: record.filename,
        url: await ctx.storage.getUrl(record.storageId),
      })),
    );
  },
});

export const generateUploadUrls = internalMutation({
  args: { count: v.number() },
  handler: async (ctx, args) => {
    return await Promise.all(Array.from({ length: args.count }, () => ctx.storage.generateUploadUrl()));
  },
});

export const swapMediaFiles = internalMutation({
  args: {
    swaps: v.array(
      v.object({
        mediaId: v.id('media'),
        oldStorageId: v.id('_storage'),
        newStorageId: v.id('_storage'),
        size: v.number(),
        contentType: v.string(),
        filename: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const swapped: { mediaId: string; oldStorageId: string; oldUrl: string; newUrl: string }[] = [];
    for (const swap of args.swaps) {
      const media = await ctx.db.get(swap.mediaId);
      if (!media || media.storageId !== swap.oldStorageId) continue;
      const [oldUrl, newUrl] = await Promise.all([ctx.storage.getUrl(swap.oldStorageId), ctx.storage.getUrl(swap.newStorageId)]);
      if (!oldUrl || !newUrl) continue;
      await ctx.db.patch(swap.mediaId, {
        storageId: swap.newStorageId,
        size: swap.size,
        contentType: swap.contentType,
        filename: swap.filename,
      });
      swapped.push({ mediaId: swap.mediaId, oldStorageId: swap.oldStorageId, oldUrl, newUrl });
    }
    return swapped;
  },
});

function replaceUrls(text: string, urls: [string, string][]) {
  let output = text;
  for (const [oldUrl, newUrl] of urls) output = output.split(oldUrl).join(newUrl);
  return output;
}

export const rewriteContentUrls = internalMutation({
  args: {
    table: v.union(v.literal('postBodies'), v.literal('editorDrafts')),
    urls: v.array(v.array(v.string())),
    cursor: v.union(v.string(), v.null()),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    const urls = args.urls.map(([oldUrl, newUrl]) => [oldUrl, newUrl] as [string, string]);
    const page = await ctx.db.query(args.table).paginate({ numItems: 25, cursor: args.cursor });
    let changed = 0;
    for (const doc of page.page) {
      const json = JSON.stringify(doc.contentJson ?? null);
      const nextJson = replaceUrls(json, urls);
      const html = 'contentHtml' in doc ? doc.contentHtml : null;
      const nextHtml = html === null ? null : replaceUrls(html, urls);
      if (nextJson === json && nextHtml === html) continue;
      changed += 1;
      if (args.dryRun) continue;
      await ctx.db.patch(doc._id, {
        contentJson: JSON.parse(nextJson),
        ...(nextHtml === null ? {} : { contentHtml: nextHtml }),
      });
    }
    return { changed, cursor: page.isDone ? null : page.continueCursor };
  },
});

export const deleteStorageFiles = internalMutation({
  args: { storageIds: v.array(v.id('_storage')) },
  handler: async (ctx, args) => {
    for (const storageId of args.storageIds) await ctx.storage.delete(storageId);
    return args.storageIds.length;
  },
});

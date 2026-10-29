import { internalAction } from './_generated/server';

export const notifyBlogChanged = internalAction({
  args: {},
  handler: async () => {
    const urls = (process.env.BLOG_REVALIDATE_URL ?? '')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    const secret = process.env.BLOG_REVALIDATE_SECRET;
    if (urls.length === 0 || !secret) return;

    const results = await Promise.allSettled(
      urls.map((url) => fetch(url, { method: 'POST', headers: { 'x-revalidate-secret': secret } })),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected' || !result.value.ok) {
        console.error('Blog revalidate failed', urls[index], result.status === 'fulfilled' ? result.value.status : result.reason);
      }
    });
  },
});

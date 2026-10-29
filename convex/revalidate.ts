import { internalAction } from './_generated/server';

export const notifyBlogChanged = internalAction({
  args: {},
  handler: async () => {
    const url = process.env.BLOG_REVALIDATE_URL;
    const secret = process.env.BLOG_REVALIDATE_SECRET;
    if (!url || !secret) return;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret },
    });
    if (!response.ok) console.error('Blog revalidate failed', response.status);
  },
});



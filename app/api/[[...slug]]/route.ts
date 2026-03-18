import { Elysia } from 'elysia';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { makeFunctionReference } from 'convex/server';
import {
  MAX_PUBLIC_API_PAGE_SIZE,
  type PublicApiPagination,
} from '@/lib/public-api-pagination';

type PaginatedCollectionResponse = {
  pagination: PublicApiPagination;
};

type PublicPostsResponse = ({
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    thumbnailUrl: string | null;
    readingTimeMinutes: number;
    publishedAt: string | null;
    updatedAt: string;
    author: { id: string; name: string } | null;
    category: { slug: string; name: string } | null;
    tags: Array<{ slug: string; name: string }>;
  }>;
} & PaginatedCollectionResponse) | null;

type PublicPostResponse = {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    thumbnailUrl: string | null;
    readingTimeMinutes: number;
    publishedAt: string | null;
    updatedAt: string;
    author: { id: string; name: string } | null;
    category: { slug: string; name: string } | null;
    tags: Array<{ slug: string; name: string }>;
    contentHtml: string;
  } | null;
} | null;

type PublicAuthorsResponse = ({
  authors: Array<{
    id: string;
    name: string;
    email: string;
    about: string;
    socialLinks: Record<string, string>;
  }>;
} & PaginatedCollectionResponse) | null;

type PublicCategoriesResponse = ({
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
} & PaginatedCollectionResponse) | null;

type PublicTagsResponse = ({
  tags: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
} & PaginatedCollectionResponse) | null;

type PublicStatsResponse = {
  stats: {
    totalPosts: number;
    totalAuthors: number;
    totalCategories: number;
    totalTags: number;
  };
} | null;

const listPublicPosts = makeFunctionReference<
  'query',
  { apiKey: string; page?: number; pageSize?: number },
  PublicPostsResponse
>('publicApi:listPosts');

const getPublicPost = makeFunctionReference<
  'query',
  { apiKey: string; postSlug: string },
  PublicPostResponse
>('publicApi:getPost');

const listPublicAuthors = makeFunctionReference<
  'query',
  { apiKey: string; page?: number; pageSize?: number },
  PublicAuthorsResponse
>('publicApi:listAuthors');

const listPublicCategories = makeFunctionReference<
  'query',
  { apiKey: string; page?: number; pageSize?: number },
  PublicCategoriesResponse
>('publicApi:listCategories');

const listPublicTags = makeFunctionReference<
  'query',
  { apiKey: string; page?: number; pageSize?: number },
  PublicTagsResponse
>('publicApi:listTags');

const getPublicStats = makeFunctionReference<
  'query',
  { apiKey: string },
  PublicStatsResponse
>('publicApi:getStats');

const trackPublicApiKeyUsage = makeFunctionReference<
  'mutation',
  { apiKey: string; ip?: string },
  { success: boolean }
>('publicApi:trackApiKeyUsage');

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim();
  }

  return request.headers.get('x-real-ip')?.trim() ?? undefined;
}

function parsePositiveIntegerQueryParam(
  value: string | null,
  name: 'page' | 'pageSize',
): { value?: number; error?: string } {
  if (value === null || value.trim() === '') {
    return {};
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      error: `Invalid ${name} query parameter. Expected a positive integer.`,
    };
  }

  if (name === 'pageSize' && parsed > MAX_PUBLIC_API_PAGE_SIZE) {
    return {
      error: `Invalid pageSize query parameter. Maximum allowed value is ${MAX_PUBLIC_API_PAGE_SIZE}.`,
    };
  }

  return { value: parsed };
}

function getPaginationArgs(request: Request) {
  const url = new URL(request.url);
  const page = parsePositiveIntegerQueryParam(url.searchParams.get('page'), 'page');
  if (page.error) {
    return { error: page.error };
  }

  const pageSize = parsePositiveIntegerQueryParam(url.searchParams.get('pageSize'), 'pageSize');
  if (pageSize.error) {
    return { error: pageSize.error };
  }

  return {
    page: page.value,
    pageSize: pageSize.value,
  };
}

const api = new Elysia({ prefix: '/api' })
  .get('/health', () => ({
    ok: true,
    service: 'web',
    runtime: 'nextjs+elysia',
  }))
  .get('/public/v1/status', () => ({
    ok: true,
    message: 'Public API is available.',
  }))
  .get('/public/v1/:apiKey/posts', async ({ params, request, set }) => {
    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      set.status = 401;
      return { ok: false, error: 'Missing API key' };
    }

    const pagination = getPaginationArgs(request);
    if (pagination.error) {
      set.status = 400;
      return { ok: false, error: pagination.error };
    }

    const result = await fetchQuery(listPublicPosts, {
      apiKey,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });

    if (!result) {
      set.status = 401;
      return { ok: false, error: 'Invalid API key' };
    }

    await fetchMutation(trackPublicApiKeyUsage, {
      apiKey,
      ip: getRequestIp(request),
    });

    return {
      ok: true,
      posts: result.posts,
      pagination: result.pagination,
    };
  })
  .get('/public/v1/:apiKey/posts/:postSlug', async ({ params, request, set }) => {
    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      set.status = 401;
      return { ok: false, error: 'Missing API key' };
    }

    const result = await fetchQuery(getPublicPost, {
      apiKey,
      postSlug: params.postSlug,
    });

    if (!result) {
      set.status = 401;
      return { ok: false, error: 'Invalid API key' };
    }

    if (!result.post) {
      set.status = 404;
      return { ok: false, error: 'Post not found' };
    }

    await fetchMutation(trackPublicApiKeyUsage, {
      apiKey,
      ip: getRequestIp(request),
    });

    return {
      ok: true,
      post: result.post,
    };
  })
  .get('/public/v1/:apiKey/authors', async ({ params, request, set }) => {
    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      set.status = 401;
      return { ok: false, error: 'Missing API key' };
    }

    const pagination = getPaginationArgs(request);
    if (pagination.error) {
      set.status = 400;
      return { ok: false, error: pagination.error };
    }

    const result = await fetchQuery(listPublicAuthors, {
      apiKey,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    if (!result) {
      set.status = 401;
      return { ok: false, error: 'Invalid API key' };
    }

    await fetchMutation(trackPublicApiKeyUsage, {
      apiKey,
      ip: getRequestIp(request),
    });

    return {
      ok: true,
      authors: result.authors,
      pagination: result.pagination,
    };
  })
  .get('/public/v1/:apiKey/categories', async ({ params, request, set }) => {
    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      set.status = 401;
      return { ok: false, error: 'Missing API key' };
    }

    const pagination = getPaginationArgs(request);
    if (pagination.error) {
      set.status = 400;
      return { ok: false, error: pagination.error };
    }

    const result = await fetchQuery(listPublicCategories, {
      apiKey,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    if (!result) {
      set.status = 401;
      return { ok: false, error: 'Invalid API key' };
    }

    await fetchMutation(trackPublicApiKeyUsage, {
      apiKey,
      ip: getRequestIp(request),
    });

    return {
      ok: true,
      categories: result.categories,
      pagination: result.pagination,
    };
  })
  .get('/public/v1/:apiKey/tags', async ({ params, request, set }) => {
    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      set.status = 401;
      return { ok: false, error: 'Missing API key' };
    }

    const pagination = getPaginationArgs(request);
    if (pagination.error) {
      set.status = 400;
      return { ok: false, error: pagination.error };
    }

    const result = await fetchQuery(listPublicTags, {
      apiKey,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    if (!result) {
      set.status = 401;
      return { ok: false, error: 'Invalid API key' };
    }

    await fetchMutation(trackPublicApiKeyUsage, {
      apiKey,
      ip: getRequestIp(request),
    });

    return {
      ok: true,
      tags: result.tags,
      pagination: result.pagination,
    };
  })
  .get('/public/v1/:apiKey/stats', async ({ params, request, set }) => {
    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      set.status = 401;
      return { ok: false, error: 'Missing API key' };
    }

    const result = await fetchQuery(getPublicStats, { apiKey });
    if (!result) {
      set.status = 401;
      return { ok: false, error: 'Invalid API key' };
    }

    await fetchMutation(trackPublicApiKeyUsage, {
      apiKey,
      ip: getRequestIp(request),
    });

    return {
      ok: true,
      stats: result.stats,
    };
  });

const handle = api.handle;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}

export function PATCH(request: Request) {
  return handle(request);
}

export function DELETE(request: Request) {
  return handle(request);
}

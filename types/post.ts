import type { ProseMirrorJSON } from '@/components/editor/persistence';

export interface Post {
  id: string;
  workspaceId: string;
  title: string;
  slug: string;
  excerpt: string;
  thumbnail: {
    id: string;
    url: string;
    filename: string;
    thumbhashBase64?: string | null;
    aspectRatio?: number | null;
  } | null;
  status: 'draft' | 'published';
  createdAt: string;
  publishedAt: string | null;
  updatedAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  } | null;
  category?: {
    name: string;
    slug: string;
  } | null;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  tags: Array<{
    slug: string;
    name: string;
  }>;
  contentHtml: string;
  contentJson: ProseMirrorJSON | null;
}

export interface CreatePostData {
  title: string;
  slug: string;
  excerpt: string;
  thumbnailMediaId?: string | null;
  authorId?: string;
  categorySlug?: string;
  tagSlugs: string[];
  status: 'draft' | 'published';
  contentHtml: string;
  contentJson: ProseMirrorJSON;
  publishedAt?: Date | null;
}

export interface UpdatePostData {
  title?: string;
  slug?: string;
  excerpt?: string;
  thumbnailMediaId?: string | null;
  authorId?: string;
  categorySlug?: string;
  tagSlugs?: string[];
  status?: 'draft' | 'published';
  contentHtml?: string;
  contentJson?: ProseMirrorJSON;
  publishedAt?: Date | null;
}

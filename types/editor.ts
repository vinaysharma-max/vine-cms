export interface PostMetadata {
  title: string;
  slug: string;
  authorId?: string;
  publishedAt: Date;
  excerpt: string;
  thumbnailMediaId?: string | null;
  categorySlug?: string;
  tagSlugs: string[];
  status: 'draft' | 'published';
}

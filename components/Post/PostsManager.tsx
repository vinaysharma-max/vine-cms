'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Plus, FileText, FileDown, LayoutGrid, List, Search } from 'lucide-react';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useWorkspaceSlug } from '@/hooks/useWorkspaceSlug';
import { useWorkspacePosts, useDeletePost } from '@/hooks/usePost';
import { DataTable } from './data-table';
import { ImportMarkdownDialog } from './ImportMarkdownDialog';
import { createColumns, POST_CUSTOMIZABLE_COLUMNS } from './columns';
import type { Post } from '@/types/post';
import { getWorkspacePath } from '@/lib/utils';
import { ImagePreview } from '@/components/Media/ImagePreview';
import { format } from 'date-fns';

type PostsViewMode = 'list' | 'grid';

export default function PostsManager() {
  const workspaceSlug = useWorkspaceSlug();
  const router = useRouter();
  const { data: posts, isLoading, isError } = useWorkspacePosts(workspaceSlug ?? '');
  const deletePostMutation = useDeletePost(workspaceSlug ?? '');

  const [pendingDeleteSlugs, setPendingDeleteSlugs] = useState<string[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewMode, setViewMode] = useQueryState(
    'view',
    parseAsStringLiteral<PostsViewMode>(['list', 'grid'])
      .withDefault('list')
      .withOptions({
        history: 'push',
      }),
  );
  const [gridSearch, setGridSearch] = useState('');

  const handleNewPost = () => {
    if (!workspaceSlug) return;
    router.push(getWorkspacePath(workspaceSlug, 'editor'));
  };

  const handleImportMarkdown = (raw: string) => {
    if (!workspaceSlug) return;
    sessionStorage.setItem(`vine-markdown-import-${workspaceSlug}`, raw);
    router.push(getWorkspacePath(workspaceSlug, 'editor'));
  };

  const handleEdit = (postSlug: string) => {
    if (!workspaceSlug) return;
    router.push(getWorkspacePath(workspaceSlug, `editor/${postSlug}`));
  };

  const handleDeleteSelected = (postSlugs: string[]) => {
    setPendingDeleteSlugs(postSlugs);
    setIsDeleteOpen(true);
  };

  const tableColumns = useMemo(() => createColumns(), []);
  const filteredGridPosts = useMemo(() => {
    const query = gridSearch.trim().toLowerCase();
    if (!query) {
      return posts;
    }

    return posts.filter((post) => {
      const haystack = [
        post.title,
        post.excerpt,
        post.slug,
        post.author?.name,
        post.category?.name,
        ...post.tags.map((tag) => tag.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [gridSearch, posts]);

  const confirmDelete = async () => {
    if (pendingDeleteSlugs.length === 0) return;

    for (const slug of pendingDeleteSlugs) {
      await deletePostMutation.mutateAsync(slug);
    }
    setIsDeleteOpen(false);
    setPendingDeleteSlugs([]);
  };

  const cancelDelete = () => {
    setIsDeleteOpen(false);
    setPendingDeleteSlugs([]);
  };

  const getRowSlug = (row: Post) => row.slug;

  if (isLoading || !workspaceSlug) {
    return (
      <div className='p-6'>
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className='h-6 w-40' />
            </CardTitle>
            <CardDescription>
              <Skeleton className='h-4 w-64' />
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Skeleton className='h-10 w-full' />
            <div className='space-y-3'>
              <Skeleton className='h-14 w-full' />
              <Skeleton className='h-14 w-full' />
              <Skeleton className='h-14 w-full' />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className='p-6'>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Posts</CardTitle>
              <CardDescription>Manage your blog posts</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Empty className='border-dashed'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>Error loading posts</EmptyTitle>
                <EmptyDescription>
                  There was an error loading your posts. Please try again.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className='p-6'>
        <Card className='animate-in fade-in-50 zoom-in-95 duration-300'>
          <CardHeader>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <CardTitle>Posts</CardTitle>
                <CardDescription>Manage your posts</CardDescription>
              </div>
              {posts.length > 0 && (
                <div className='inline-flex items-center rounded-xl border border-foreground/10 bg-muted/30 p-1'>
                  <Button
                    type='button'
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size='sm'
                    className='h-8 rounded-lg px-3'
                    onClick={() => void setViewMode('list')}
                  >
                    <List className='mr-2 h-4 w-4' />
                    List
                  </Button>
                  <Button
                    type='button'
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size='sm'
                    className='h-8 rounded-lg px-3'
                    onClick={() => void setViewMode('grid')}
                  >
                    <LayoutGrid className='mr-2 h-4 w-4' />
                    Grid
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <Empty className='border-dashed animate-in fade-in-50'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle>No Posts Yet</EmptyTitle>
                  <EmptyDescription>
                    You haven&apos;t created any posts yet. Get started by creating
                    your first post.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className='flex gap-2'>
                    <Button variant='outline' size='sm' onClick={() => setIsImportOpen(true)}>
                      <FileDown />
                      Import
                    </Button>
                    <Button onClick={handleNewPost} size='sm'>
                      <Plus />
                      Create Post
                    </Button>
                  </div>
                </EmptyContent>
              </Empty>
            ) : viewMode === 'list' ? (
              <DataTable
                columns={tableColumns}
                customizableColumns={POST_CUSTOMIZABLE_COLUMNS.map((column) => ({
                  ...column,
                }))}
                columnPreferencesKey={`posts-table:${workspaceSlug}`}
                data={posts}
                onNewPost={handleNewPost}
                onImportMarkdown={() => setIsImportOpen(true)}
                onEdit={handleEdit}
                onDeleteSelected={handleDeleteSelected}
                getRowSlug={getRowSlug}
              />
            ) : (
              <PostsGridView
                posts={filteredGridPosts}
                search={gridSearch}
                onSearchChange={setGridSearch}
                onNewPost={handleNewPost}
                onImportMarkdown={() => setIsImportOpen(true)}
                onEdit={handleEdit}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ImportMarkdownDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onFileReady={handleImportMarkdown}
      />

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingDeleteSlugs.length > 1
                ? `Delete ${pendingDeleteSlugs.length} posts`
                : 'Delete post'}
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              {pendingDeleteSlugs.length > 1
                ? `${pendingDeleteSlugs.length} posts and all their content.`
                : 'the post and all its content.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={cancelDelete} disabled={deletePostMutation.isPending}>
              Cancel
            </Button>
            <Button variant='destructive' onClick={confirmDelete} disabled={deletePostMutation.isPending}>
              {deletePostMutation.isPending
                ? 'Deleting...'
                : pendingDeleteSlugs.length > 1
                  ? `Delete ${pendingDeleteSlugs.length} posts`
                  : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PostsGridView({
  posts,
  search,
  onSearchChange,
  onNewPost,
  onImportMarkdown,
  onEdit,
}: {
  posts: Post[];
  search: string;
  onSearchChange: (value: string) => void;
  onNewPost: () => void;
  onImportMarkdown: () => void;
  onEdit: (postSlug: string) => void;
}) {
  return (
    <div className='space-y-5'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='relative w-full max-w-md'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder='Search posts, authors, categories, or tags...'
            className='pl-9'
          />
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button variant='outline' onClick={onImportMarkdown}>
            <FileDown className='mr-2 h-4 w-4' />
            Import Markdown
          </Button>
          <Button onClick={onNewPost}>
            <Plus className='mr-2 h-4 w-4' />
            New Post
          </Button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-foreground/15 bg-muted/20 px-6 py-16 text-center'>
          <p className='text-sm font-medium text-foreground'>No posts match this search.</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Try a different title, author, category, or tag.
          </p>
        </div>
      ) : (
        <>
          <div className='text-sm text-muted-foreground'>
            {posts.length} post{posts.length === 1 ? '' : 's'}
          </div>
          <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
            {posts.map((post) => (
              <button
                key={post.id}
                type='button'
                onClick={() => onEdit(post.slug)}
                className='group text-left'
              >
                <Card className='h-full gap-0 overflow-hidden border-foreground/10 bg-gradient-to-b from-background to-muted/20 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg'>
                  <div className='relative bg-muted/20 p-3'>
                    {post.thumbnail ? (
                      <ImagePreview
                        src={post.thumbnail.url}
                        alt={post.thumbnail.filename}
                        filename={post.thumbnail.filename}
                        thumbhashBase64={post.thumbnail.thumbhashBase64}
                        aspectRatio={post.thumbnail.aspectRatio}
                        className='aspect-[16/9] w-full rounded-xl'
                      />
                    ) : (
                      <div className='flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-dashed border-foreground/10 bg-background/80'>
                        <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                          <FileText className='h-6 w-6' />
                          <span className='text-xs font-medium'>No thumbnail</span>
                        </div>
                      </div>
                    )}
                    <div className='pointer-events-none absolute left-6 top-6'>
                      <Badge
                        variant={post.status === 'published' ? 'default' : 'secondary'}
                        className='capitalize shadow-sm'
                      >
                        {post.status}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className='space-y-2 px-5 py-5'>
                    <div className='space-y-1'>
                      <div className='line-clamp-2 text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary'>
                        {post.title || 'Untitled'}
                      </div>
                      {post.excerpt ? (
                        <p className='line-clamp-3 text-sm leading-6 text-muted-foreground'>
                          {post.excerpt}
                        </p>
                      ) : (
                        <p className='text-sm italic text-muted-foreground'>
                          No description added yet.
                        </p>
                      )}
                    </div>

                    <div className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
                      {post.author && <span>{post.author.name}</span>}
                      {post.author && post.category && <span>•</span>}
                      {post.category && <span>{post.category.name}</span>}
                    </div>

                    <div className='flex flex-wrap gap-1.5'>
                      {post.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag.slug} variant='outline' className='bg-background/70'>
                          {tag.name}
                        </Badge>
                      ))}
                      {post.tags.length > 3 && (
                        <Badge variant='outline' className='bg-background/70'>
                          +{post.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className='flex items-center justify-between pt-1 text-xs text-muted-foreground'>
                      <span>/{post.slug}</span>
                      <span>
                        {format(
                          new Date(post.publishedAt ?? post.updatedAt),
                          'MMM d, yyyy',
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

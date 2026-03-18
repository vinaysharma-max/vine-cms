"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  FileText,
  FileDown,
  LayoutGrid,
  List,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useWorkspaceSlug } from "@/hooks/useWorkspaceSlug";
import { useWorkspacePosts, useDeletePost } from "@/hooks/usePost";
import { DataTable } from "./data-table";
import { ImportMarkdownDialog } from "./ImportMarkdownDialog";
import { createColumns, POST_CUSTOMIZABLE_COLUMNS } from "./columns";
import type { Post } from "@/types/post";
import { cn, getWorkspacePath } from "@/lib/utils";
import { ImagePreview } from "@/components/Media/ImagePreview";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

type PostsViewMode = "list" | "grid";
type GridPropertyId = (typeof POST_CUSTOMIZABLE_COLUMNS)[number]["id"];
type GridPropertyVisibility = Record<GridPropertyId, boolean>;
type StoredGridPreferences = {
  visibility?: Partial<GridPropertyVisibility>;
};

const DEFAULT_GRID_PROPERTY_VISIBILITY = Object.fromEntries(
  POST_CUSTOMIZABLE_COLUMNS.map((column) => [column.id, true]),
) as GridPropertyVisibility;

function readStoredGridPreferences(storageKey?: string) {
  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredGridPreferences;
  } catch {
    return null;
  }
}

export default function PostsManager() {
  const workspaceSlug = useWorkspaceSlug();
  const router = useRouter();
  const {
    data: posts,
    isLoading,
    isError,
  } = useWorkspacePosts(workspaceSlug ?? "");
  const deletePostMutation = useDeletePost(workspaceSlug ?? "");
  const gridPreferencesKey = workspaceSlug
    ? `posts-grid:${workspaceSlug}`
    : undefined;

  const [pendingDeleteSlugs, setPendingDeleteSlugs] = useState<string[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedGridSlugs, setSelectedGridSlugs] = useState<Set<string>>(
    () => new Set(),
  );
  const [gridPropertyVisibility, setGridPropertyVisibility] =
    useState<GridPropertyVisibility>(() => ({
      ...DEFAULT_GRID_PROPERTY_VISIBILITY,
      ...(readStoredGridPreferences(gridPreferencesKey)?.visibility ?? {}),
    }));
  const [viewMode, setViewMode] = useQueryState(
    "view",
    parseAsStringLiteral<PostsViewMode>(["list", "grid"])
      .withDefault("list")
      .withOptions({
        history: "push",
      }),
  );
  const [gridSearch, setGridSearch] = useState("");

  const handleNewPost = () => {
    if (!workspaceSlug) return;
    router.push(getWorkspacePath(workspaceSlug, "editor"));
  };

  const handleImportMarkdown = (raw: string) => {
    if (!workspaceSlug) return;
    sessionStorage.setItem(`vine-markdown-import-${workspaceSlug}`, raw);
    router.push(getWorkspacePath(workspaceSlug, "editor"));
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
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [gridSearch, posts]);
  const validSelectedGridSlugs = useMemo(() => {
    const availableSlugs = new Set(posts.map((post) => post.slug));
    return new Set(
      [...selectedGridSlugs].filter((slug) => availableSlugs.has(slug)),
    );
  }, [posts, selectedGridSlugs]);

  useEffect(() => {
    if (!gridPreferencesKey || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      gridPreferencesKey,
      JSON.stringify({
        visibility: gridPropertyVisibility,
      } satisfies StoredGridPreferences),
    );
  }, [gridPreferencesKey, gridPropertyVisibility]);

  const confirmDelete = async () => {
    if (pendingDeleteSlugs.length === 0) return;

    for (const slug of pendingDeleteSlugs) {
      await deletePostMutation.mutateAsync(slug);
    }
    setSelectedGridSlugs((current) => {
      const next = new Set(current);
      pendingDeleteSlugs.forEach((slug) => next.delete(slug));
      return next;
    });
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
      <div className="flex h-full min-h-0 flex-col p-6">
        <Card className="flex flex-1 flex-col">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-40" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-64" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-0 flex-col p-6">
        <Card className="flex flex-1 flex-col">
          <CardHeader>
            <div>
              <CardTitle>Posts</CardTitle>
              <CardDescription>Manage your blog posts</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Empty className="border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
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
      <div className="flex h-full min-h-0 flex-col p-6">
        <Card className="flex min-h-0 flex-1 flex-col animate-in fade-in-50 zoom-in-95 duration-300">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Posts</CardTitle>
                <CardDescription>Manage your posts</CardDescription>
              </div>
              {posts.length > 0 && (
                <div className="inline-flex items-center rounded-xl border border-foreground/10 bg-muted/30 p-1">
                  <Button
                    type="button"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 rounded-lg px-3"
                    onClick={() => void setViewMode("list")}
                  >
                    <List className="mr-2 h-4 w-4" />
                    List
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 rounded-lg px-3"
                    onClick={() => void setViewMode("grid")}
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Grid
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {posts.length === 0 ? (
              <Empty className="border-dashed animate-in fade-in-50">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle>No Posts Yet</EmptyTitle>
                  <EmptyDescription>
                    You haven&apos;t created any posts yet. Get started by
                    creating your first post.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsImportOpen(true)}
                    >
                      <FileDown />
                      Import
                    </Button>
                    <Button onClick={handleNewPost} size="sm">
                      <Plus />
                      Create Post
                    </Button>
                  </div>
                </EmptyContent>
              </Empty>
            ) : viewMode === "list" ? (
              <div className="min-h-0 flex-1">
                <DataTable
                  columns={tableColumns}
                  customizableColumns={POST_CUSTOMIZABLE_COLUMNS.map(
                    (column) => ({
                      ...column,
                    }),
                  )}
                  columnPreferencesKey={`posts-table:${workspaceSlug}`}
                  data={posts}
                  onNewPost={handleNewPost}
                  onImportMarkdown={() => setIsImportOpen(true)}
                  onEdit={handleEdit}
                  onDeleteSelected={handleDeleteSelected}
                  getRowSlug={getRowSlug}
                />
              </div>
            ) : (
              <PostsGridView
                posts={filteredGridPosts}
                search={gridSearch}
                selectedSlugs={validSelectedGridSlugs}
                propertyVisibility={gridPropertyVisibility}
                onSearchChange={setGridSearch}
                onNewPost={handleNewPost}
                onImportMarkdown={() => setIsImportOpen(true)}
                onEdit={handleEdit}
                onDeleteSelected={handleDeleteSelected}
                onToggleSelect={(postSlug) => {
                  setSelectedGridSlugs((current) => {
                    const next = new Set(current);
                    if (next.has(postSlug)) {
                      next.delete(postSlug);
                    } else {
                      next.add(postSlug);
                    }
                    return next;
                  });
                }}
                onToggleSelectAll={(postSlugs) => {
                  setSelectedGridSlugs((current) => {
                    const next = new Set(current);
                    const allSelected =
                      postSlugs.length > 0 &&
                      postSlugs.every((postSlug) => next.has(postSlug));

                    postSlugs.forEach((postSlug) => {
                      if (allSelected) {
                        next.delete(postSlug);
                      } else {
                        next.add(postSlug);
                      }
                    });

                    return next;
                  });
                }}
                onPropertyVisibilityChange={(propertyId) => {
                  setGridPropertyVisibility((current) => ({
                    ...current,
                    [propertyId]: current[propertyId] === false,
                  }));
                }}
                onResetPropertyVisibility={() =>
                  setGridPropertyVisibility(DEFAULT_GRID_PROPERTY_VISIBILITY)
                }
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
                : "Delete post"}
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              {pendingDeleteSlugs.length > 1
                ? `${pendingDeleteSlugs.length} posts and all their content.`
                : "the post and all its content."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={deletePostMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletePostMutation.isPending}
            >
              {deletePostMutation.isPending
                ? "Deleting..."
                : pendingDeleteSlugs.length > 1
                  ? `Delete ${pendingDeleteSlugs.length} posts`
                  : "Delete"}
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
  selectedSlugs,
  propertyVisibility,
  onSearchChange,
  onNewPost,
  onImportMarkdown,
  onEdit,
  onDeleteSelected,
  onToggleSelect,
  onToggleSelectAll,
  onPropertyVisibilityChange,
  onResetPropertyVisibility,
}: {
  posts: Post[];
  search: string;
  selectedSlugs: Set<string>;
  propertyVisibility: GridPropertyVisibility;
  onSearchChange: (value: string) => void;
  onNewPost: () => void;
  onImportMarkdown: () => void;
  onEdit: (postSlug: string) => void;
  onDeleteSelected: (postSlugs: string[]) => void;
  onToggleSelect: (postSlug: string) => void;
  onToggleSelectAll: (postSlugs: string[]) => void;
  onPropertyVisibilityChange: (propertyId: GridPropertyId) => void;
  onResetPropertyVisibility: () => void;
}) {
  const filteredSlugs = posts.map((post) => post.slug);
  const filteredSelectedCount = filteredSlugs.filter((slug) =>
    selectedSlugs.has(slug),
  ).length;
  const allFilteredSelected =
    filteredSlugs.length > 0 && filteredSelectedCount === filteredSlugs.length;
  const hasFilteredSelection = filteredSelectedCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search posts, authors, categories, or tags..."
              className="pl-9"
            />
          </div>
          {hasFilteredSelection && (
            <Button
              variant="destructive"
              onClick={() =>
                onDeleteSelected(
                  filteredSlugs.filter((slug) => selectedSlugs.has(slug)),
                )
              }
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete ({filteredSelectedCount})
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Settings2 className="mr-1 h-4 w-4" />
                Customize
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Grid properties</p>
                    <p className="text-xs text-muted-foreground">
                      Show or hide the optional post details on each card.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={onResetPropertyVisibility}
                  >
                    Reset
                  </Button>
                </div>
              </div>
              <div className="space-y-1 p-2">
                {POST_CUSTOMIZABLE_COLUMNS.map((column) => {
                  const isVisible = propertyVisibility[column.id] !== false;

                  return (
                    <div
                      key={column.id}
                      className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`grid-property-${column.id}`}
                        checked={isVisible}
                        onCheckedChange={() =>
                          onPropertyVisibilityChange(column.id)
                        }
                        aria-label={`Toggle ${column.label} property`}
                      />
                      <label
                        htmlFor={`grid-property-${column.id}`}
                        className="flex-1 cursor-pointer text-sm font-medium"
                      >
                        {column.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={onImportMarkdown}>
            <FileDown className="mr-1 h-4 w-4" />
            Import Markdown
          </Button>
          <Button onClick={onNewPost}>
            <Plus className="mr-1 h-4 w-4" />
            New Post
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={
              allFilteredSelected || (hasFilteredSelection && "indeterminate")
            }
            onCheckedChange={() => onToggleSelectAll(filteredSlugs)}
            aria-label="Select all filtered posts"
            disabled={filteredSlugs.length === 0}
          />
          <span className="text-sm text-muted-foreground">
            {hasFilteredSelection
              ? `${filteredSelectedCount} selected`
              : filteredSlugs.length === 0
                ? "No matching posts"
                : "Select all"}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {posts.length} post{posts.length === 1 ? "" : "s"}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 bg-muted/20 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            No posts match this search.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different title, author, category, or tag.
          </p>
        </div>
      ) : (
        <>
          <ScrollArea className="min-h-0 flex-1 pr-2 [&_[data-slot=scroll-area-thumb]]:bg-foreground/15">
            <div className="grid gap-5 pb-1 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onEdit(post.slug)}
                  className="group text-left"
                >
                  <Card
                    className={cn(
                      "h-full gap-0 overflow-hidden border-foreground/10 bg-gradient-to-b from-background to-muted/20 py-0 transition-all duration-200 hover:border-foreground/20 hover:from-muted/10 hover:to-muted/35 hover:shadow-md",
                      selectedSlugs.has(post.slug) &&
                        "border-primary/60 bg-gradient-to-b from-primary/5 to-muted/20 shadow-md ring-1 ring-primary/10",
                    )}
                  >
                    <div className="relative bg-muted/20 p-3">
                      <div className="absolute right-6 top-6 z-10">
                        <Checkbox
                          checked={selectedSlugs.has(post.slug)}
                          onCheckedChange={() => onToggleSelect(post.slug)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${post.title || "untitled post"}`}
                        />
                      </div>
                      {post.thumbnail ? (
                        <ImagePreview
                          src={post.thumbnail.url}
                          alt={post.thumbnail.filename}
                          filename={post.thumbnail.filename}
                          thumbhashBase64={post.thumbnail.thumbhashBase64}
                          aspectRatio={16 / 9}
                          className="h-48 w-full overflow-hidden rounded-xl"
                        />
                      ) : (
                        <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-foreground/10 bg-background/80">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <FileText className="h-6 w-6" />
                            <span className="text-xs font-medium">
                              No thumbnail
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="pointer-events-none absolute left-6 top-6">
                        <Badge
                          variant={
                            post.status === "published"
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize shadow-sm"
                        >
                          {post.status}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="space-y-2 px-5 py-5">
                      <div className="space-y-1">
                        <div className="line-clamp-2 text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                          {post.title || "Untitled"}
                        </div>
                        {post.excerpt ? (
                          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {post.excerpt}
                          </p>
                        ) : (
                          <p className="text-sm italic text-muted-foreground">
                            No description added yet.
                          </p>
                        )}
                      </div>

                      {(propertyVisibility.author !== false ||
                        propertyVisibility.category !== false) && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {propertyVisibility.author !== false &&
                            post.author && <span>{post.author.name}</span>}
                          {propertyVisibility.author !== false &&
                            propertyVisibility.category !== false &&
                            post.author &&
                            post.category && <span>•</span>}
                          {propertyVisibility.category !== false &&
                            post.category && <span>{post.category.name}</span>}
                        </div>
                      )}

                      {propertyVisibility.tags !== false &&
                        post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {post.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag.slug}
                                variant="outline"
                                className="bg-background/70"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                            {post.tags.length > 3 && (
                              <Badge
                                variant="outline"
                                className="bg-background/70"
                              >
                                +{post.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                      <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                        {propertyVisibility.createdAt !== false && (
                          <div className="flex items-center justify-between gap-3">
                            <span>Created</span>
                            <span>
                              {format(new Date(post.createdAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        )}
                        {propertyVisibility.publishedAt !== false && (
                          <div className="flex items-center justify-between gap-3">
                            <span>Published</span>
                            <span>
                              {post.publishedAt
                                ? format(
                                    new Date(post.publishedAt),
                                    "MMM d, yyyy",
                                  )
                                : "—"}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

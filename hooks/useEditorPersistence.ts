'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useMutationState } from '@/hooks/useMutationState';
import type { ProseMirrorJSON } from '@/components/editor/persistence';

export type EditorDraftRecord = {
  metadata: {
    title: string;
    slug: string;
    excerpt: string;
    thumbnailMediaId?: string | null;
    authorId?: string;
    categorySlug?: string;
    tagSlugs: string[];
    publishedAt: number | null;
    status: 'draft' | 'published';
  };
  contentJson: ProseMirrorJSON | null;
  updatedAt: number;
};

type SaveEditorDraftData = {
  title: string;
  slug: string;
  excerpt: string;
  thumbnailMediaId?: string | null;
  authorId?: string;
  categorySlug?: string;
  tagSlugs: string[];
  publishedAt?: number;
  status: 'draft' | 'published';
  contentJson: ProseMirrorJSON;
};

export function useEditorDraft(workspaceSlug: string, draftKey: string) {
  const data = useQuery(
    api.editorDrafts.get,
    workspaceSlug && draftKey ? { workspaceSlug, draftKey } : 'skip',
  ) as EditorDraftRecord | null | undefined;

  return {
    data: data ?? null,
    isLoading: !!workspaceSlug && !!draftKey && data === undefined,
  };
}

export function useSaveEditorDraft(workspaceSlug: string, draftKey: string) {
  const mutation = useMutationState<
    { workspaceSlug: string; draftKey: string; data: SaveEditorDraftData },
    { success: boolean }
  >(api.editorDrafts.upsert);

  return {
    ...mutation,
    mutateAsync: async (data: SaveEditorDraftData) =>
      mutation.mutateAsync({ workspaceSlug, draftKey, data }),
  };
}

export function useClearEditorDraft(workspaceSlug: string, draftKey: string) {
  const mutation = useMutationState<
    { workspaceSlug: string; draftKey: string },
    { success: boolean }
  >(api.editorDrafts.clear);

  return {
    ...mutation,
    mutateAsync: async () => mutation.mutateAsync({ workspaceSlug, draftKey }),
  };
}

export function useEditorAutosavePreference() {
  const data = useQuery(api.editorPreferences.get, {}) as
    | { autosaveEnabled: boolean }
    | undefined;

  return {
    data: data?.autosaveEnabled ?? false,
    isLoading: data === undefined,
  };
}

export function useSetEditorAutosavePreference() {
  const mutation = useMutationState<
    { autosaveEnabled: boolean },
    { success: boolean }
  >(api.editorPreferences.set);

  return {
    ...mutation,
    mutateAsync: async (autosaveEnabled: boolean) =>
      mutation.mutateAsync({ autosaveEnabled }),
  };
}

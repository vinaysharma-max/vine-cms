'use client';

import { useState, useEffect, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/ErrorFallback';
import { Tiptap } from '@/components/editor/Tiptap';
import { useEditorContext } from '@/components/editor/editor-context';
import { useEditorDraft } from '@/hooks/useEditorPersistence';
import type { PostMetadata } from '@/types/editor';

const NEW_POST_DRAFT_KEY = '__new__';

export default function EditorPage() {
  const {
    workspaceSlug,
    editorRef,
    hasUnsavedChangesRef,
    shouldSkipBlockerRef,
    setMetadata,
    setOriginalMetadata,
    setOriginalContent,
  } = useEditorContext();
  const [markdownImport] = useState<string | undefined>(() => {
    if (typeof window === 'undefined' || !workspaceSlug) {
      return undefined;
    }

    const storageKey = `vine-markdown-import-${workspaceSlug}`;
    const raw = sessionStorage.getItem(storageKey) || undefined;
    if (raw) {
      sessionStorage.removeItem(storageKey);
    }
    return raw;
  });
  const { data: draft, isLoading: isDraftLoading } = useEditorDraft(
    workspaceSlug,
    NEW_POST_DRAFT_KEY,
  );
  const hasHydratedDraftRef = useRef(false);

  useEffect(() => {
    if (isDraftLoading || hasHydratedDraftRef.current) {
      return;
    }

    hasHydratedDraftRef.current = true;

    if (!draft) {
      return;
    }

    const draftMetadata: PostMetadata = {
      title: draft.metadata.title,
      slug: draft.metadata.slug,
      excerpt: draft.metadata.excerpt,
      authorId: draft.metadata.authorId,
      categorySlug: draft.metadata.categorySlug,
      tagSlugs: draft.metadata.tagSlugs,
      publishedAt: draft.metadata.publishedAt
        ? new Date(draft.metadata.publishedAt)
        : new Date(),
      status: draft.metadata.status,
    };

    setMetadata(draftMetadata);
    setOriginalMetadata(draftMetadata);
    setOriginalContent(
      draft.contentJson ? JSON.stringify(draft.contentJson) : null,
    );
  }, [
    draft,
    isDraftLoading,
    setMetadata,
    setOriginalContent,
    setOriginalMetadata,
  ]);

  // Warn before browser-level navigation (refresh, close tab) if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldSkipBlockerRef.current && hasUnsavedChangesRef.current?.()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChangesRef, shouldSkipBlockerRef]);

  if (isDraftLoading) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className='flex h-full w-full flex-col'>
        <Tiptap
          ref={editorRef}
          initialContent={draft?.contentJson ?? null}
          initialMarkdownImport={markdownImport}
        />
      </div>
    </ErrorBoundary>
  );
}

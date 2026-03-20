'use client';

import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useEditorContext } from '@/components/editor/editor-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Calendar as CalendarIcon,
  ImagePlus,
  Info,
  Loader2,
  Trash2,
} from 'lucide-react';
import AuthorSelect from '@/components/Author/AuthorSelect';
import TagMultiSelect from '@/components/Tag/TagMultiSelect';
import CategorySelect from '@/components/Category/CategorySelect';
import { ImagePreview } from '@/components/Media/ImagePreview';
import { useCreatePost, useUpdatePost } from '@/hooks/usePost';
import type { CreatePostData, UpdatePostData } from '@/types/post';
import type { PostMetadata } from '@/types/editor';
import {
  getContentFromEditor,
  isEditorEmpty as checkEditorEmpty,
  hasTextContent,
} from '@/components/editor/content-utils';
import type { ProseMirrorJSON } from '@/components/editor/persistence';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  postMetadataSchema,
  type PostMetadataFormData,
} from '@/lib/validations/post';
import { cn, getWorkspacePath } from '@/lib/utils';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { estimateReadingTime, getTextStatistics } from '@/lib/reading-time';
import { getErrorMessage } from '@/lib/error-utils';
import {
  useClearEditorDraft,
  useEditorAutosavePreference,
  useSaveEditorDraft,
  useSetEditorAutosavePreference,
} from '@/hooks/useEditorPersistence';
import { useMedia } from '@/hooks/useMedia';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import type { Media } from '@/types/media';

const AUTOSAVE_DELAY_MS = 1200;
const DRAFT_SAVE_DELAY_MS = 500;
const NEW_POST_DRAFT_KEY = '__new__';
type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function EditorSidebar() {
  const {
    metadata,
    setMetadata,
    editorRef,
    workspaceSlug,
    isEditing,
    postSlug,
    originalMetadata,
    originalContent,
    setOriginalMetadata,
    setOriginalContent,
    saveRef,
    hasUnsavedChangesRef,
  } = useEditorContext();

  const createPostMutation = useCreatePost(workspaceSlug);
  const updatePostMutation = useUpdatePost(workspaceSlug, postSlug || '');
  const draftKey = postSlug || NEW_POST_DRAFT_KEY;
  const saveDraftMutation = useSaveEditorDraft(workspaceSlug, draftKey);
  const clearDraftMutation = useClearEditorDraft(workspaceSlug, draftKey);
  const {
    data: autosavePreference,
    isLoading: isAutosavePreferenceLoading,
  } = useEditorAutosavePreference();
  const setAutosavePreferenceMutation = useSetEditorAutosavePreference();
  const { data: mediaItems } = useMedia(workspaceSlug);
  const thumbnailUpload = useMediaUpload(workspaceSlug);
  const router = useRouter();
  const canUseAutosave = Boolean(postSlug);

  const defaultValues = useMemo<PostMetadataFormData>(
    () => ({
      title: metadata.title || '',
      slug: metadata.slug || '',
      excerpt: metadata.excerpt || '',
      thumbnailMediaId: metadata.thumbnailMediaId ?? null,
      authorId: metadata.authorId,
      categorySlug: metadata.categorySlug,
      tagSlugs: metadata.tagSlugs || [],
      publishedAt: metadata.publishedAt || new Date(),
      status: metadata.status || 'draft',
    }),
    [metadata],
  );

  const form = useForm<PostMetadataFormData>({
    resolver: zodResolver(postMetadataSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const {
    register,
    control,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors, isValid },
  } = form;

  const titleValue = watch('title');
  const thumbnailMediaId = watch('thumbnailMediaId');
  const allValues = watch();
  const slugManuallyEditedRef = React.useRef(false);
  const isSyncingRef = React.useRef(false);
  const autosaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const draftSaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autosavePostSlugRef = React.useRef(postSlug || '');
  const isAutosavingRef = React.useRef(false);

  const [hasContentChanged, setHasContentChanged] = React.useState(false);
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metadata' | 'analysis'>(
    'metadata',
  );
  const [editorText, setEditorText] = React.useState('');
  const [editorHtml, setEditorHtml] = React.useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const initialContentRef = React.useRef<string | null>(null);
  const thumbnailInputRef = React.useRef<HTMLInputElement>(null);
  const editor = editorRef.current?.editor;

  useEffect(() => {
    if (postSlug) {
      autosavePostSlugRef.current = postSlug;
    }
  }, [postSlug]);

  useEffect(() => {
    if (isAutosavePreferenceLoading) {
      return;
    }

    setIsAutosaveEnabled(autosavePreference);
  }, [autosavePreference, isAutosavePreferenceLoading]);

  const buildMetadataSnapshot = useCallback(
    (values: PostMetadataFormData): PostMetadata => ({
      title: values.title,
      slug: values.slug,
      excerpt: values.excerpt || '',
      thumbnailMediaId: values.thumbnailMediaId ?? null,
      authorId: values.authorId,
      categorySlug: values.categorySlug,
      tagSlugs: values.tagSlugs || [],
      publishedAt: values.publishedAt || new Date(),
      status: values.status || 'draft',
    }),
    [],
  );

  const buildFormValues = useCallback(
    (source: PostMetadata): PostMetadataFormData => ({
      title: source.title || '',
      slug: source.slug || '',
      excerpt: source.excerpt || '',
      thumbnailMediaId: source.thumbnailMediaId ?? null,
      authorId: source.authorId,
      categorySlug: source.categorySlug,
      tagSlugs: source.tagSlugs || [],
      publishedAt: source.publishedAt || new Date(),
      status: source.status || 'draft',
    }),
    [],
  );

  const areMetadataSnapshotsEqual = useCallback(
    (left: PostMetadata, right: PostMetadata) => {
      if (left.title.trim() !== right.title.trim()) return false;
      if (left.slug.trim() !== right.slug.trim()) return false;
      if (left.excerpt.trim() !== right.excerpt.trim()) return false;
      if ((left.thumbnailMediaId ?? null) !== (right.thumbnailMediaId ?? null)) {
        return false;
      }
      if ((left.authorId ?? null) !== (right.authorId ?? null)) return false;
      if ((left.categorySlug ?? null) !== (right.categorySlug ?? null)) {
        return false;
      }
      if (left.status !== right.status) return false;

      const leftPublishedAt = left.publishedAt?.getTime() ?? null;
      const rightPublishedAt = right.publishedAt?.getTime() ?? null;
      if (leftPublishedAt !== rightPublishedAt) return false;

      if (left.tagSlugs.length !== right.tagSlugs.length) return false;
      return JSON.stringify(left.tagSlugs) === JSON.stringify(right.tagSlugs);
    },
    [],
  );

  const syncToParent = useCallback(() => {
    isSyncingRef.current = true;
    const values = getValues();
    setMetadata(buildMetadataSnapshot(values));
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 0);
  }, [buildMetadataSnapshot, getValues, setMetadata]);

  useEffect(() => {
    if (isSyncingRef.current) return;
    const nextValues = buildFormValues(metadata);
    const currentValues = buildMetadataSnapshot(getValues());
    const nextMetadata = buildMetadataSnapshot(nextValues);

    if (areMetadataSnapshotsEqual(currentValues, nextMetadata)) {
      return;
    }

    reset(nextValues);
    slugManuallyEditedRef.current = false;
  }, [
    areMetadataSnapshotsEqual,
    buildFormValues,
    buildMetadataSnapshot,
    getValues,
    metadata,
    reset,
  ]);

  const metadataChanged = useMemo(() => {
    const baseline = originalMetadata ?? buildMetadataSnapshot(defaultValues);
    const currentValues = buildMetadataSnapshot(allValues);
    return !areMetadataSnapshotsEqual(currentValues, baseline);
  }, [
    allValues,
    areMetadataSnapshotsEqual,
    buildMetadataSnapshot,
    defaultValues,
    originalMetadata,
  ]);

  useEffect(() => {
    if (isEditing || !titleValue || slugManuallyEditedRef.current) return;

    const autoSlug = titleValue
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();

    if (autoSlug) {
      setValue('slug', autoSlug, { shouldValidate: true });
    }
  }, [titleValue, setValue, isEditing]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const sanitizeSnapshot = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.stringify(JSON.parse(raw));
      } catch (error) {
        console.error('Failed to parse original editor content', error);
        return raw;
      }
    };

    initialContentRef.current =
      sanitizeSnapshot(originalContent) ?? JSON.stringify(editor.getJSON());

    setHasContentChanged(false);

    const handleUpdate = () => {
      const snapshot = JSON.stringify(editor.getJSON());
      setHasContentChanged(snapshot !== initialContentRef.current);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, originalContent, isEditing]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue('title', value, { shouldValidate: true });
  };

  const handleBlur = () => {
    syncToParent();
  };

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
  }, []);

  const clearDraftSaveTimer = useCallback(() => {
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }
  }, []);

  const clearCurrentDraft = useCallback(() => {
    if (!workspaceSlug) {
      return;
    }

    return clearDraftMutation.mutateAsync().catch((error) => {
      console.error('Failed to clear editor draft', error);
    });
  }, [clearDraftMutation, workspaceSlug]);

  const handleAutosaveToggle = useCallback(
    (checked: boolean) => {
      setIsAutosaveEnabled(checked);
      setAutosaveError(null);

      void setAutosavePreferenceMutation.mutateAsync(checked).catch((error) => {
        setIsAutosaveEnabled((current) => !current);
        toast.error(
          getErrorMessage(error, 'Failed to update editor autosave preference'),
        );
      });
    },
    [setAutosavePreferenceMutation],
  );

  const applySavedBaseline = useCallback(
    (values: PostMetadataFormData, contentJsonSnapshot: string) => {
      const nextMetadata = buildMetadataSnapshot(values);
      setMetadata(nextMetadata);
      setOriginalMetadata(nextMetadata);
      setOriginalContent(contentJsonSnapshot);
      reset(values);
      initialContentRef.current = contentJsonSnapshot;
      setHasContentChanged(false);
    },
    [
      buildMetadataSnapshot,
      reset,
      setMetadata,
      setOriginalContent,
      setOriginalMetadata,
    ],
  );

  const getSavePayload = useCallback(
    (
      values: PostMetadataFormData,
      contentHtml: string,
      contentJson: CreatePostData['contentJson'],
    ) => ({
      baseData: {
        title: values.title,
        excerpt: values.excerpt || '',
        thumbnailMediaId: values.thumbnailMediaId ?? null,
        authorId: values.authorId,
        categorySlug: values.categorySlug,
        tagSlugs: values.tagSlugs || [],
        status: values.status,
        contentHtml,
        contentJson,
      } as Omit<UpdatePostData, 'slug' | 'publishedAt'>,
    }),
    [],
  );

  const prepareSaveData = useCallback(
    async (mode: 'manual' | 'autosave') => {
      const editorInstance = editorRef.current?.editor;
      if (!editorInstance) {
        if (mode === 'manual') {
          toast.error('Editor is not ready');
        }
        return null;
      }

      const formValues = getValues();
      const parsed = postMetadataSchema.safeParse(formValues);

      if (!parsed.success) {
        if (mode === 'manual') {
          await form.trigger();
          toast.error('Please fix the form errors before saving');
        }
        return null;
      }

      if (checkEditorEmpty(editorInstance)) {
        if (mode === 'manual') {
          toast.error('Post content cannot be empty');
        }
        return null;
      }

      if (parsed.data.status === 'published' && !hasTextContent(editorInstance)) {
        if (mode === 'manual') {
          toast.error(
            'Posts with only images cannot be published. Add text content or save as draft.',
          );
        }
        return null;
      }

      const { contentHtml, contentJson } = getContentFromEditor(editorInstance);
      const { baseData } = getSavePayload(parsed.data, contentHtml, contentJson);

      return {
        formValues: parsed.data,
        contentJsonSnapshot: JSON.stringify(contentJson),
        baseData,
      };
    },
    [editorRef, form, getSavePayload, getValues],
  );

  const runAutosave = useCallback(async () => {
    if (!canUseAutosave || !isAutosaveEnabled || isAutosavingRef.current) {
      return;
    }

    const prepared = await prepareSaveData('autosave');
    if (!prepared) {
      setAutosaveState('idle');
      return;
    }

    const { formValues, baseData, contentJsonSnapshot } = prepared;

    isAutosavingRef.current = true;
    setAutosaveState('saving');
    setAutosaveError(null);

    try {
      if (isEditing || autosavePostSlugRef.current) {
        const nextPost = await updatePostMutation.mutateAsync(
          {
            ...baseData,
            slug: formValues.slug,
            publishedAt: formValues.publishedAt || new Date(),
          },
          {
            postSlug: autosavePostSlugRef.current,
            showSuccessToast: false,
            showErrorToast: false,
          },
        );

        applySavedBaseline(formValues, contentJsonSnapshot);
        clearCurrentDraft();

        if (nextPost.slug !== autosavePostSlugRef.current) {
          autosavePostSlugRef.current = nextPost.slug;
          startTransition(() => {
            router.replace(
              getWorkspacePath(workspaceSlug, `editor/${nextPost.slug}`),
            );
          });
        }
      } else {
        const nextPost = await createPostMutation.mutateAsync(
          {
            ...baseData,
            slug: formValues.slug,
            publishedAt: formValues.publishedAt || new Date(),
          } as CreatePostData & { slug: string; publishedAt: Date },
          {
            showSuccessToast: false,
            showErrorToast: false,
          },
        );

        autosavePostSlugRef.current = nextPost.slug;
        applySavedBaseline(formValues, contentJsonSnapshot);
        clearCurrentDraft();

        startTransition(() => {
          router.replace(
            getWorkspacePath(workspaceSlug, `editor/${nextPost.slug}`),
          );
        });
      }

      setAutosaveState('saved');
    } catch (error) {
      setAutosaveState('error');
      setAutosaveError(getErrorMessage(error, 'Autosave failed'));
    } finally {
      isAutosavingRef.current = false;
    }
  }, [
    applySavedBaseline,
    canUseAutosave,
    clearCurrentDraft,
    createPostMutation,
    isAutosaveEnabled,
    isEditing,
    prepareSaveData,
    router,
    updatePostMutation,
    workspaceSlug,
  ]);

  const handleSave = useCallback(async () => {
    clearAutosaveTimer();
    clearDraftSaveTimer();

    const prepared = await prepareSaveData('manual');
    if (!prepared) {
      return;
    }

    const { formValues, baseData, contentJsonSnapshot } = prepared;

    try {
      if (isEditing && postSlug) {
        const nextPost = await updatePostMutation.mutateAsync(
          {
            ...baseData,
            slug: formValues.slug,
            publishedAt: formValues.publishedAt || new Date(),
          },
          {
            postSlug,
          },
        );

        autosavePostSlugRef.current = nextPost.slug;
        applySavedBaseline(formValues, contentJsonSnapshot);
        await clearCurrentDraft();

        if (nextPost.slug !== postSlug) {
          startTransition(() => {
            router.replace(getWorkspacePath(workspaceSlug, `editor/${nextPost.slug}`));
          });
        }
      } else {
        const postData = {
          ...baseData,
          slug: formValues.slug,
          publishedAt: formValues.publishedAt || new Date(),
        } as CreatePostData & { slug: string; publishedAt: Date };

        await createPostMutation.mutateAsync(postData);

        const editorInstance = editorRef.current?.editor;
        if (editorInstance) {
          editorInstance.commands.setContent('<p></p>');
        }

        await clearCurrentDraft();
        setMetadata((prev) => ({
          ...prev,
          title: '',
          slug: '',
          excerpt: '',
          thumbnailMediaId: null,
          authorId: undefined,
          categorySlug: undefined,
          tagSlugs: [],
          publishedAt: new Date(),
          status: 'draft',
        }));

        router.push(getWorkspacePath(workspaceSlug, 'posts'));
      }
    } catch {
      return;
    }
  }, [
    applySavedBaseline,
    clearAutosaveTimer,
    clearCurrentDraft,
    clearDraftSaveTimer,
    createPostMutation,
    editorRef,
    isEditing,
    postSlug,
    prepareSaveData,
    router,
    setMetadata,
    updatePostMutation,
    workspaceSlug,
  ]);

  const handleClear = () => {
    clearAutosaveTimer();
    clearDraftSaveTimer();

    const editor = editorRef.current?.editor;
    if (editor) {
      editor.commands.setContent('<p></p>');
    }

    const initialValues: PostMetadataFormData = {
      title: '',
      slug: '',
      excerpt: '',
      thumbnailMediaId: null,
      authorId: undefined,
      categorySlug: undefined,
      tagSlugs: [],
      publishedAt: new Date(),
      status: 'draft',
    };

    reset(initialValues);

    setMetadata({
      title: '',
      slug: '',
      excerpt: '',
      thumbnailMediaId: null,
      authorId: undefined,
      categorySlug: undefined,
      tagSlugs: [],
      publishedAt: new Date(),
      status: 'draft',
    });

    setOriginalMetadata(null);
    setOriginalContent(null);
    initialContentRef.current = null;
    setHasContentChanged(false);
    autosavePostSlugRef.current = '';
    setAutosaveState('idle');
    setAutosaveError(null);

    clearCurrentDraft();
  };

  const editorIsEmpty = editor ? checkEditorEmpty(editor) : true;
  const selectedThumbnail = useMemo<Media | null>(
    () => mediaItems.find((item) => item.id === thumbnailMediaId) ?? null,
    [mediaItems, thumbnailMediaId],
  );

  const isSaving = isEditing
    ? updatePostMutation.isPending
    : createPostMutation.isPending;

  const hasChanges = metadataChanged || hasContentChanged;

  const isSaveDisabled =
    !isValid || isSaving || !editor || editorIsEmpty || !hasChanges;

  // Register save handler and unsaved-changes checker on context refs for Ctrl+S and back-button
  useEffect(() => {
    saveRef.current = () => {
      if (canUseAutosave && isAutosaveEnabled) {
        clearAutosaveTimer();
        void runAutosave();
        return;
      }

      if (!isSaveDisabled) {
        handleSave();
      }
    };
    return () => {
      saveRef.current = null;
    };
  }, [
    clearAutosaveTimer,
    canUseAutosave,
    clearCurrentDraft,
    clearDraftSaveTimer,
    handleSave,
    isAutosaveEnabled,
    isSaveDisabled,
    runAutosave,
    saveRef,
  ]);

  useEffect(() => {
    hasUnsavedChangesRef.current = () => hasChanges;
    return () => {
      hasUnsavedChangesRef.current = null;
    };
  }, [hasChanges, hasUnsavedChangesRef]);

  const autosaveSignature = useMemo(
    () =>
      JSON.stringify({
        values: allValues,
        content: editorHtml,
      }),
    [allValues, editorHtml],
  );

  useEffect(() => {
    const shouldSaveDraft = !canUseAutosave || !isAutosaveEnabled;

    if (!shouldSaveDraft || !hasChanges) {
      clearDraftSaveTimer();
      return;
    }

    const editorInstance = editorRef.current?.editor;
    if (!editorInstance) {
      return;
    }

    clearDraftSaveTimer();
    draftSaveTimeoutRef.current = setTimeout(() => {
      const values = getValues();
      const nextMetadata = buildMetadataSnapshot(values);

      void saveDraftMutation.mutateAsync({
        title: nextMetadata.title,
        slug: nextMetadata.slug,
        excerpt: nextMetadata.excerpt,
        thumbnailMediaId: nextMetadata.thumbnailMediaId ?? null,
        authorId: nextMetadata.authorId,
        categorySlug: nextMetadata.categorySlug,
        tagSlugs: nextMetadata.tagSlugs,
        publishedAt: nextMetadata.publishedAt?.getTime(),
        status: nextMetadata.status,
        contentJson: editorInstance.getJSON() as ProseMirrorJSON,
      });
    }, DRAFT_SAVE_DELAY_MS);

    return () => {
      clearDraftSaveTimer();
    };
  }, [
    allValues,
    buildMetadataSnapshot,
    canUseAutosave,
    clearDraftSaveTimer,
    editorHtml,
    editorRef,
    getValues,
    hasChanges,
    isAutosaveEnabled,
    saveDraftMutation,
  ]);

  useEffect(() => {
    if (!canUseAutosave || !isAutosaveEnabled) {
      clearAutosaveTimer();
      setAutosaveState('idle');
      setAutosaveError(null);
      return;
    }

    if (!hasChanges) {
      setAutosaveState('saved');
      setAutosaveError(null);
      return;
    }

    if (isSaving || isAutosavingRef.current) {
      return;
    }

    clearAutosaveTimer();
    setAutosaveState('pending');
    setAutosaveError(null);

    autosaveTimeoutRef.current = setTimeout(() => {
      void runAutosave();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      clearAutosaveTimer();
    };
  }, [
    autosaveSignature,
    canUseAutosave,
    clearAutosaveTimer,
    hasChanges,
    isAutosaveEnabled,
    isSaving,
    runAutosave,
  ]);

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
      clearDraftSaveTimer();
    };
  }, [clearAutosaveTimer, clearDraftSaveTimer]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'metadata' | 'analysis');
  };

  // Update analysis when editor content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setEditorText(editor.getText());
      setEditorHtml(editor.getHTML());
    };

    // Set initial text
    setEditorText(editor.getText());
    setEditorHtml(editor.getHTML());

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // Calculate analysis stats
  const analysisStats = useMemo(() => {
    if (!editor || !editorText.trim()) {
      return {
        wordCount: 0,
        sentenceCount: 0,
        wordsPerSentence: 0,
        readingTime: 0,
      };
    }

    const textStats = getTextStatistics(editorText);
    const readingTime = estimateReadingTime({
      text: editorText,
      html: editorHtml,
    }).minutes;

    return {
      wordCount: textStats.wordCount,
      sentenceCount: textStats.sentenceCount,
      wordsPerSentence: textStats.wordsPerSentence,
      readingTime,
    };
  }, [editor, editorHtml, editorText]);

  const applyThumbnailSelection = useCallback(
    (nextThumbnailMediaId: string | null) => {
      setValue('thumbnailMediaId', nextThumbnailMediaId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setMetadata((prev) => ({
        ...prev,
        thumbnailMediaId: nextThumbnailMediaId,
      }));
    },
    [setMetadata, setValue],
  );

  const handleThumbnailUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) {
        return;
      }

      try {
        const media = await thumbnailUpload.uploadImageAsync(file);
        applyThumbnailSelection(media.id);
      } catch {
        return;
      }
    },
    [applyThumbnailSelection, thumbnailUpload],
  );

  const handleThumbnailUploadClick = useCallback(() => {
    thumbnailInputRef.current?.click();
  }, []);

  const handleThumbnailRemove = useCallback(() => {
    applyThumbnailSelection(null);
  }, [applyThumbnailSelection]);

  const thumbnailUploadLabel = useMemo(() => {
    if (thumbnailUpload.uploadStage === 'generating') {
      return 'Preparing upload...';
    }

    if (thumbnailUpload.uploadStage === 'uploading') {
      return 'Uploading image...';
    }

    if (thumbnailUpload.uploadStage === 'confirming') {
      return 'Saving thumbnail...';
    }

    return null;
  }, [thumbnailUpload.uploadStage]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className='flex h-full flex-col'
    >
      <SidebarHeader className='px-4'>
        <TabsList className='w-full'>
          <TabsTrigger className='flex-1' value='metadata'>
            Metadata
          </TabsTrigger>
          <TabsTrigger className='flex-1' value='analysis'>
            Analysis
          </TabsTrigger>
        </TabsList>
      </SidebarHeader>
      <SidebarContent className='flex flex-1 flex-col min-h-0 overflow-hidden'>
        <TabsContent value='metadata' className='flex-1 min-h-0'>
          <ScrollArea className='h-full pr-2 [&_[data-slot=scroll-area-thumb]]:bg-foreground/15'>
            <div className='flex flex-col gap-4 px-6 py-4 text-sm'>
              {/* Title & description */}
              <div className='space-y-1'>
                <label className='mb-2 flex items-center gap-2 text-base font-medium text-muted-foreground'>
                  <span>Title</span>
                  <span className='-ml-2 text-destructive'>*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The main title of your post</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <Input
                  className={cn(errors.title && 'border-destructive')}
                  {...register('title', {
                    onChange: handleTitleChange,
                    onBlur: handleBlur,
                  })}
                  placeholder='A great title'
                />
                {errors.title && (
                  <p className='text-xs text-destructive mt-1'>
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className='space-y-1'>
                <label className='mb-2 flex items-center gap-2 text-base font-medium text-muted-foreground'>
                  <span>Description</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>A short description or excerpt of your post</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <Textarea
                  className={cn(
                    'min-h-[80px]',
                    errors.excerpt && 'border-destructive',
                  )}
                  {...register('excerpt', { onBlur: handleBlur })}
                  placeholder='A short description of your post'
                />
                {errors.excerpt && (
                  <p className='text-xs text-destructive mt-1'>
                    {errors.excerpt.message}
                  </p>
                )}
              </div>

              <div className='space-y-3'>
                <div className='space-y-1'>
                  <label className='mb-2 flex items-center gap-2 text-base font-medium text-muted-foreground'>
                    <span>Thumbnail</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className='h-3.5 w-3.5 cursor-help text-muted-foreground' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Optional cover image. Public API responses expose it as
                          `thumbnailUrl`.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <p className='text-xs text-muted-foreground'>
                    Upload an optional thumbnail for cards, previews, and API consumers.
                  </p>
                </div>

                <input
                  ref={thumbnailInputRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={handleThumbnailUpload}
                />

                <div className='overflow-hidden rounded-2xl border border-dashed border-foreground/15 bg-muted/20'>
                  {selectedThumbnail ? (
                    <div className='space-y-4 p-3'>
                      <ImagePreview
                        src={selectedThumbnail.url}
                        alt={selectedThumbnail.filename}
                        filename={selectedThumbnail.filename}
                        thumbhashBase64={selectedThumbnail.thumbhashBase64}
                        aspectRatio={selectedThumbnail.aspectRatio}
                        className='aspect-[16/9] w-full rounded-xl'
                      />
                      <div className='space-y-1'>
                        <p className='truncate text-sm font-medium text-foreground'>
                          {selectedThumbnail.filename}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          This image will be returned in post API responses.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className='flex flex-col items-start gap-3 p-4'>
                      <div className='rounded-xl border border-foreground/10 bg-background/80 p-3'>
                        <ImagePlus className='h-5 w-5 text-muted-foreground' />
                      </div>
                      <div className='space-y-1'>
                        <p className='text-sm font-medium text-foreground'>
                          No thumbnail selected
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Add a JPG, PNG, WebP, or GIF up to 5MB.
                        </p>
                      </div>
                    </div>
                  )}

                  {thumbnailMediaId && !selectedThumbnail && !thumbnailUpload.isPending && (
                    <p className='px-4 pb-1 text-xs text-muted-foreground'>
                      The current thumbnail could not be previewed, but the saved reference is still attached.
                    </p>
                  )}

                  <div className='border-t border-foreground/10 bg-background/70 p-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Button
                        type='button'
                        variant={selectedThumbnail ? 'secondary' : 'outline'}
                        size='sm'
                        onClick={handleThumbnailUploadClick}
                        disabled={thumbnailUpload.isPending}
                      >
                        {thumbnailUpload.isPending ? (
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        ) : (
                          <ImagePlus className='mr-2 h-4 w-4' />
                        )}
                        {selectedThumbnail ? 'Replace thumbnail' : 'Upload thumbnail'}
                      </Button>

                      {thumbnailMediaId && (
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={handleThumbnailRemove}
                          disabled={thumbnailUpload.isPending}
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          Remove
                        </Button>
                      )}
                    </div>

                    {thumbnailUploadLabel && (
                      <div className='mt-3 space-y-2'>
                        <div className='flex items-center justify-between text-xs text-muted-foreground'>
                          <span>{thumbnailUploadLabel}</span>
                          <span>{Math.round(thumbnailUpload.progress)}%</span>
                        </div>
                        <div className='h-2 overflow-hidden rounded-full bg-muted'>
                          <div
                            className='h-full bg-primary transition-all duration-300'
                            style={{ width: `${thumbnailUpload.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                {/* Slug */}
                <div className='space-y-1'>
                  <label className='mb-2 flex items-center gap-2 text-base font-medium text-muted-foreground'>
                    <span>Slug</span>
                    <span className='-ml-2 text-destructive'>*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Is for uniquely identifying the post in your
                          workspace and it will be used for accessing the post
                          content via API
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <Input
                    className={cn(errors.slug && 'border-destructive')}
                    {...register('slug', {
                      onChange: () => {
                        slugManuallyEditedRef.current = true;
                      },
                      onBlur: () => {
                        syncToParent();
                        form.clearErrors('slug');
                      },
                    })}
                    placeholder='my-awesome-post'
                  />
                  {errors.slug && (
                    <p className='text-xs text-destructive mt-1'>
                      {errors.slug.message}
                    </p>
                  )}
                </div>

                {/* Author */}
                <div className='space-y-1'>
                  <label className='mb-2 flex items-center gap-2 text-base font-medium text-muted-foreground'>
                    <span>Author</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select the author of this post</p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <Controller
                    control={control}
                    name='authorId'
                    render={({ field }) => (
                      <AuthorSelect
                        value={field.value ?? null}
                        onChange={(authorId) => {
                          field.onChange(authorId || undefined);
                          syncToParent();
                        }}
                        placeholder='Select author...'
                        allowCreate
                      />
                    )}
                  />
                </div>
              </div>

              {/* Category & Tags — side by side */}
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <label className='mb-2 flex items-center gap-2 text-base font-medium text-muted-foreground'>
                    <span>Category</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Assign a category to organize your post</p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <Controller
                    control={control}
                    name='categorySlug'
                    render={({ field }) => (
                      <CategorySelect
                        value={field.value ?? null}
                        onChange={(categorySlug) => {
                          field.onChange(categorySlug || undefined);
                          syncToParent();
                        }}
                        placeholder='Select...'
                        allowCreate
                      />
                    )}
                  />
                </div>
                <div className='space-y-1'>
                  <label className='mb-2 flex items-center gap-2 text-base font-medium text-muted-foreground'>
                    <span>Tags</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add tags to help categorize and find your post</p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <Controller
                    control={control}
                    name='tagSlugs'
                    render={({ field }) => (
                      <TagMultiSelect
                        value={field.value || []}
                        onChange={(tagSlugs) => {
                          field.onChange(tagSlugs);
                          syncToParent();
                        }}
                        placeholder='Select...'
                        allowCreate
                      />
                    )}
                  />
                </div>
              </div>

              {/* Status & Published at */}
              <Separator className='bg-foreground/10' />

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <label className='mb-2 flex items-center gap-2 text-sm font-medium'>
                    <span>Status</span>
                    <span className='-ml-2 text-destructive'>*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set the post status as draft or published</p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <Controller
                    control={control}
                    name='status'
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value as 'draft' | 'published');
                          syncToParent();
                        }}
                      >
                        <SelectTrigger className='h-9 w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='draft'>Draft</SelectItem>
                          <SelectItem value='published'>Published</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className='space-y-1'>
                  <label className='mb-2 flex items-center gap-2 text-sm font-medium'>
                    <span>Published at</span>
                    <span className='-ml-2 text-destructive'>*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The date when the post was or will be published</p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <Controller
                    control={control}
                    name='publishedAt'
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='outline'
                            className={cn(
                              'h-9 w-full justify-start text-left font-normal px-3',
                              errors.publishedAt && 'border-destructive',
                            )}
                          >
                            <CalendarIcon className='mr-2 h-4 w-4' />
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-auto p-0' align='end'>
                          <Calendar
                            mode='single'
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date || new Date());
                              syncToParent();
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>
              </div>

              {errors.publishedAt && (
                <p className='text-xs text-destructive mt-1'>
                  {errors.publishedAt.message}
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value='analysis' className='flex-1 min-h-0'>
          <ScrollArea className='h-full pr-2 [&_[data-slot=scroll-area-thumb]]:bg-foreground/15'>
            <div className='px-6 py-4 space-y-6'>
              <div>
                <h3 className='text-base font-semibold text-foreground mb-4'>
                  Text Statistics
                </h3>
                <div className='grid grid-cols-2 gap-6'>
                  <div className='space-y-1'>
                    <div className='text-sm text-muted-foreground'>Words</div>
                    <div className='text-lg font-semibold text-foreground'>
                      {analysisStats.wordCount.toLocaleString()}
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <div className='text-sm text-muted-foreground'>
                      Sentences
                    </div>
                    <div className='text-lg font-semibold text-foreground'>
                      {analysisStats.sentenceCount.toLocaleString()}
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <div className='text-sm text-muted-foreground'>
                      Words per Sentence
                    </div>
                    <div className='text-lg font-semibold text-foreground'>
                      {analysisStats.wordsPerSentence.toLocaleString()}
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <div className='text-sm text-muted-foreground'>
                      Estimated Reading Time
                    </div>
                    <div className='text-lg font-semibold text-foreground'>
                      {analysisStats.readingTime}{' '}
                      {analysisStats.readingTime === 1 ? 'minute' : 'minutes'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </SidebarContent>
      <SidebarFooter>
        <div className='border-t border-foreground/10 px-4 py-3'>
          {canUseAutosave ? (
            <div className='flex items-center justify-between gap-3'>
              <div className='min-w-0'>
                <p className='text-sm font-medium'>Autosave</p>
                <p className='text-xs text-muted-foreground'>
                  Save changes to Convex automatically while you edit
                </p>
              </div>
              <Switch
                checked={isAutosaveEnabled}
                onCheckedChange={handleAutosaveToggle}
              />
            </div>
          ) : null}

          {canUseAutosave && isAutosaveEnabled ? (
            <div className='pt-3 text-xs text-muted-foreground'>
              {autosaveState === 'saving' ? (
                <div className='flex items-center gap-2'>
                  <Loader2 className='h-3 w-3 animate-spin' />
                  Autosaving...
                </div>
              ) : autosaveState === 'pending' ? (
                'Changes pending autosave'
              ) : autosaveState === 'error' ? (
                <span className='text-destructive'>
                  {autosaveError ?? 'Autosave failed'}
                </span>
              ) : autosaveState === 'saved' ? (
                'All changes saved'
              ) : (
                'Autosave is on'
              )}
            </div>
          ) : (
            <div className='flex gap-2 pt-3'>
              <Button
                className='flex-1'
                size='sm'
                onClick={handleSave}
                disabled={isSaveDisabled}
              >
                {isSaving ? (
                  <>
                    <Loader2 className='mr-2 h-3 w-3 animate-spin' />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                variant='outline'
                size='sm'
                className='flex-1'
                onClick={() => setShowClearDialog(true)}
                disabled={isSaving}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </SidebarFooter>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Editor</DialogTitle>
            <DialogDescription>
              This will reset the editor content and all metadata fields. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant='destructive' onClick={() => {
              handleClear();
              setShowClearDialog(false);
            }}>
              Clear Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

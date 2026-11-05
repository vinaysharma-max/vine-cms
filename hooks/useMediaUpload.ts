'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import { getErrorMessage } from '@/lib/error-utils';

async function getAspectRatio(file: File) {
  return await new Promise<number | undefined>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      resolve(image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined);
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve(undefined);
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

const MAX_IMAGE_WIDTH = 1600;
const WEBP_QUALITY = 0.82;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const KEEP_ORIGINAL_TYPES = new Set(['image/gif', 'image/svg+xml']);

async function compressImage(file: File): Promise<File> {
  if (KEEP_ORIGINAL_TYPES.has(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export function useMediaUpload(workspaceSlug: string) {
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const confirmUpload = useMutation(api.media.confirmUpload);
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'generating' | 'uploading' | 'confirming'>('idle');

  const uploadImageAsync = async (
    original: File,
    onProgress?: (progress: number, stage: string) => void,
  ) => {
    if (!workspaceSlug) {
      throw new Error('Workspace not found');
    }

    if (!original.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    setIsPending(true);
    setUploadStage('generating');
    setProgress(0);
    onProgress?.(0, 'generating');

    try {
      const file = await compressImage(original);
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('File size must be less than 5MB');
      }
      const aspectRatio = await getAspectRatio(file);
      const { uploadUrl } = await generateUploadUrl({ workspaceSlug });

      setUploadStage('uploading');
      onProgress?.(0, 'uploading');

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setProgress(60);
      onProgress?.(60, 'uploading');

      const { storageId } = (await response.json()) as { storageId?: string };
      if (!storageId) {
        throw new Error('Upload did not return a file reference');
      }

      setUploadStage('confirming');
      onProgress?.(80, 'confirming');

      const media = await confirmUpload({
        workspaceSlug,
        data: {
          storageId: storageId as never,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          aspectRatio,
        },
      });

      setProgress(100);
      onProgress?.(100, 'complete');
      toast.success('Image uploaded successfully');
      return media;
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload image'));
      throw error;
    } finally {
      setIsPending(false);
      setUploadStage('idle');
      setProgress(0);
    }
  };

  return {
    uploadImage: (file: File, onProgress?: (progress: number, stage: string) => void) => {
      void uploadImageAsync(file, onProgress);
    },
    uploadImageAsync,
    isPending,
    progress,
    uploadStage,
    reset: () => {
      setProgress(0);
      setUploadStage('idle');
    },
  };
}

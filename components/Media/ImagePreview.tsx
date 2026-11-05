'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { thumbHashToDataURL } from 'thumbhash';

interface ImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  filename?: string;
  thumbhashBase64?: string | null;
  aspectRatio?: number | null;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ImagePreview({
  src,
  alt,
  className,
  filename,
  thumbhashBase64,
  aspectRatio,
  isOpen = false,
  onOpenChange,
}: ImagePreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const placeholderUrl = useMemo(() => {
    if (!thumbhashBase64 || imageLoaded) {
      return null;
    }

    try {
      const thumbhashBytes = Uint8Array.from(atob(thumbhashBase64), (char) => char.charCodeAt(0));
      return thumbHashToDataURL(thumbhashBytes);
    } catch {
      return null;
    }
  }, [imageLoaded, thumbhashBase64]);

  const handleClose = () => {
    onOpenChange?.(false);
  };

  const computedAspectRatio = aspectRatio ?? 1;
  const containerStyle = { aspectRatio: computedAspectRatio.toString() };

  return (
    <>
      <div className={cn('overflow-hidden rounded-lg relative', className)} style={containerStyle}>
        {placeholderUrl && !imageLoaded && (
          <img
            src={placeholderUrl}
            alt={alt}
            className='absolute inset-0 w-full h-full object-cover'
            aria-hidden='true'
          />
        )}
        <img
          src={src}
          alt={alt}
          loading='lazy'
          decoding='async'
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            imageLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {isOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm animate-in fade-in-0'
          onClick={handleClose}
        >
          <button
            className='absolute top-4 right-4 p-2 rounded-full bg-accent/10 hover:bg-accent/20 transition-colors text-foreground'
            onClick={handleClose}
          >
            <X className='w-6 h-6' />
          </button>
          <div
            className='max-w-5xl max-h-[90vh] p-4 flex flex-col items-center gap-4'
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className='max-w-full max-h-[80vh] object-contain rounded-lg'
              style={{ aspectRatio: computedAspectRatio.toString() }}
            />
            {filename && (
              <p className='text-foreground text-sm font-medium bg-muted/90 px-4 py-2 rounded-lg max-w-full break-all'>
                {filename}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

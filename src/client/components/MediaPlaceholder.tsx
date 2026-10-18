import React from 'react';
import { Image as ImageIcon, Play, Sparkles } from 'lucide-react';
import { FrameBrackets } from './FrameBrackets.js';

export interface MediaPlaceholderProps {
  slotId: string;
  aspectRatio?: '16:10' | '16:9' | '4:3' | '1:1' | '21:9' | string;
  variant?: 'image' | 'video' | 'illustration';
  label: string;
  src?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  priority?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * MediaPlaceholder Component
 * Provides a fixed aspect ratio surface with viewfinder frame brackets,
 * visible slot labeling, and zero layout shift (CLS = 0).
 * Swapping for a production image/video is a one-line prop change (`src`).
 */
export const MediaPlaceholder: React.FC<MediaPlaceholderProps> = ({
  slotId,
  aspectRatio = '16:9',
  variant = 'image',
  label,
  src,
  alt = '',
  width,
  height,
  priority = false,
  className = '',
  children,
}) => {
  // If a real media source is provided, render the asset with appropriate loading strategy
  if (src) {
    if (variant === 'video') {
      return (
        <div
          className={`af-media-placeholder af-media-loaded ${className}`}
          style={{ aspectRatio, width, height }}
          data-slot-id={slotId}
        >
          <video
            src={src}
            poster=""
            muted
            playsInline
            controls
            aria-label={alt || label}
            className="af-media-element"
          />
        </div>
      );
    }

    return (
      <div
        className={`af-media-placeholder af-media-loaded ${className}`}
        style={{ aspectRatio, width, height }}
        data-slot-id={slotId}
      >
        <img
          src={src}
          alt={alt || label}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          className="af-media-element"
        />
      </div>
    );
  }

  // Placeholder state: token-based surface, corner brackets, subtle grid, and visible slot metadata
  const VariantIcon =
    variant === 'video'
      ? Play
      : variant === 'illustration'
        ? Sparkles
        : ImageIcon;

  return (
    <div
      className={`af-media-placeholder af-media-${variant} ${className}`}
      style={{ aspectRatio, width, height }}
      data-slot-id={slotId}
      role="figure"
      aria-label={`${label} (${variant} placeholder)`}
    >
      <FrameBrackets active={true} className="af-media-frame">
        <div className="af-media-inner">
          {children ? (
            children
          ) : (
            <div className="af-media-badge-container">
              <div className="af-media-icon-badge" aria-hidden="true">
                <VariantIcon size={22} strokeWidth={1.5} />
              </div>
              <div className="af-media-metadata">
                <span className="af-media-label">{label}</span>
                <span className="af-media-slot-tag">
                  {slotId} • {aspectRatio}
                </span>
              </div>
            </div>
          )}
        </div>
      </FrameBrackets>
    </div>
  );
};

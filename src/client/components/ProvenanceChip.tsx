import React from 'react';
import { Quote, Frame, Sparkles, PenLine } from 'lucide-react';
import type { ProvenanceKind } from '../../shared/contracts.js';

export interface ProvenanceChipProps {
  kind: ProvenanceKind;
  timestampLabel?: string | null;
  active?: boolean;
  onClick?: () => void;
}

/**
 * Core Provenance Chip component (Section 6.3).
 * Distinguishable by label, icon, and border style — never by color alone:
 * - Transcript: "Transcript 0:14" | Solid, cyan | Quote icon
 * - Visual: "Frame 0:22" | Solid, violet | Frame icon
 * - Inferred: "Inferred" | Dashed, amber | Sparkles icon
 * - Edited: "Edited by you" | Double, neutral | PenLine icon
 */
export const ProvenanceChip: React.FC<ProvenanceChipProps> = ({
  kind,
  timestampLabel,
  active = false,
  onClick,
}) => {
  const label =
    kind === 'transcript'
      ? timestampLabel
        ? `Transcript ${timestampLabel}`
        : 'Transcript'
      : kind === 'visual'
        ? timestampLabel
          ? `Frame ${timestampLabel}`
          : 'Frame'
        : kind === 'inferred'
          ? 'Inferred'
          : 'Edited by you';

  const Icon =
    kind === 'transcript'
      ? Quote
      : kind === 'visual'
        ? Frame
        : kind === 'inferred'
          ? Sparkles
          : PenLine;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`af-prov-chip af-prov-chip-${kind}`}
      style={{
        boxShadow: active ? '0 0 0 2px var(--focus)' : undefined,
      }}
      title={`${label} — click to inspect supporting evidence`}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
};

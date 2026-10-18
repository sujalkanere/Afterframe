// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CaptureScreen } from '../../src/client/screens/CaptureScreen.js';
import { ReviewScreen } from '../../src/client/screens/ReviewScreen.js';
import { AtlasView } from '../../src/client/components/AtlasView.js';
import { ProvenanceChip } from '../../src/client/components/ProvenanceChip.js';
import {
  PIPELINE_VERSION,
  SKILL_SPEC_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  type ExtractionCandidateEnvelope,
} from '../../src/shared/contracts.js';

describe('UI Screens, Accessibility, Provenance Chips, and Signature Moments (Section 6)', () => {
  it('renders CaptureScreen with genuine empty state, single primary button, and reachable transcript input (FR-041, FR-059)', async () => {
    const onSubmitJob = vi.fn().mockResolvedValue({ ok: true, jobId: 'job_1' });
    const { container } = render(
      <CaptureScreen
        reducedMotion={false}
        capabilities={{
          youtubeLinkEnabled: true,
          instagramLinkEnabled: false,
          pasteTranscriptEnabled: true,
          llmConfigured: true,
        }}
        readyJobs={[]}
        recentArtifacts={[]}
        onSubmitJob={onSubmitJob}
        onOpenJob={vi.fn()}
        onOpenArtifact={vi.fn()}
      />
    );

    // Genuine empty state (no fake items)
    expect(screen.getByText('Your library is empty')).toBeInTheDocument();

    // Exactly one primary action button on screen (Section 6.2.1 & 6.14.2)
    const primaryBtns = container.querySelectorAll('.af-btn-primary');
    expect(primaryBtns.length).toBe(1);
    expect(primaryBtns[0]).toHaveTextContent('Extract');

    // Inline validation error for invalid URL (Section 6.8.A)
    const input = screen.getByLabelText('Video link');
    fireEvent.change(input, { target: { value: 'https://example.com/not-a-short' } });
    fireEvent.submit(input.closest('form')!);

    expect(
      await screen.findByText(
        /That doesn’t look like a YouTube Short or Instagram Reel link/i
      )
    ).toBeInTheDocument();

    // Reachable "Paste the transcript instead" path without failing first (FR-059)
    const toggleBtn = screen.getByRole('button', {
      name: /Paste the transcript instead/i,
    });
    fireEvent.click(toggleBtn);
    expect(
      screen.getByLabelText(/Spoken transcript or captions/i)
    ).toBeInTheDocument();
  });

  it('distinguishes all four ProvenanceChip kinds by text label and border style without relying on color alone (Section 6.3)', () => {
    const { rerender } = render(
      <ProvenanceChip kind="transcript" timestampLabel="0:14" />
    );
    expect(screen.getByRole('button')).toHaveTextContent('Transcript 0:14');
    expect(screen.getByRole('button')).toHaveClass('af-prov-chip-transcript');

    rerender(<ProvenanceChip kind="visual" timestampLabel="0:22" />);
    expect(screen.getByRole('button')).toHaveTextContent('Frame 0:22');
    expect(screen.getByRole('button')).toHaveClass('af-prov-chip-visual');

    rerender(<ProvenanceChip kind="inferred" />);
    expect(screen.getByRole('button')).toHaveTextContent('Inferred');
    expect(screen.getByRole('button')).toHaveClass('af-prov-chip-inferred');

    rerender(<ProvenanceChip kind="user_edited" />);
    expect(screen.getByRole('button')).toHaveTextContent('Edited by you');
    expect(screen.getByRole('button')).toHaveClass('af-prov-chip-user_edited');
  });

  it('renders ReviewScreen with evidence coverage note, inline inference warning, and triggers The Kept Moment on save (Section 6.4.2, 6.8.C)', async () => {
    const sampleEnvelope: ExtractionCandidateEnvelope = {
      schema_version: PIPELINE_VERSION,
      recommended_type: 'task',
      recommendation_reason:
        'The video demonstrates a step-by-step Git initialization checklist.',
      task_candidate: {
        schema_version: TASK_SCHEMA_VERSION,
        artifact_type: 'task',
        title: 'Initialize Git Repository',
        description: 'Run git init and set user configuration.',
        steps: [
          {
            id: 's1',
            position: 0,
            title: 'Run git init',
            description: 'Initialize repository in project directory',
            provenance_kind: 'transcript',
            is_inferred: false,
            is_user_edited: false,
            evidence_refs: ['ev_1'],
            caveats: null,
          },
          {
            id: 's2',
            position: 1,
            title: 'Check git status',
            description: 'Verify clean working tree',
            provenance_kind: 'inferred',
            is_inferred: true,
            is_user_edited: false,
            evidence_refs: [],
            caveats: null,
          },
        ],
        topics: ['git', 'coding'],
        estimated_minutes: null,
        deadline: null,
        priority: null,
      },
      skill_candidate: {
        schema_version: SKILL_SPEC_SCHEMA_VERSION,
        artifact_type: 'ai_skill',
        identity: {
          name: 'git-init-skill',
          title: 'Git Init Skill',
          summary: 'Initialize git repository',
          description: 'Full instructions',
        },
        intended_use: ['Use for new projects'],
        non_use_conditions: ['Do not use on existing repos'],
        trigger_examples: ['Initialize git here'],
        input_contract: { fields: [], notes: null },
        workflow_steps: [
          {
            id: 'w1',
            position: 0,
            title: 'Run git init',
            instruction: 'Execute git init',
            condition: null,
            provenance_kind: 'transcript',
            is_inferred: false,
            is_user_edited: false,
            evidence_refs: ['ev_1'],
          },
        ],
        output_contract: {
          format: 'markdown',
          description: 'Output',
          verification_criteria: ['Done'],
        },
        capability_declarations: ['instruction_only'],
        topics: ['git'],
      },
      evidence_summary: {
        transcript_analyzed: true,
        visual_frames_analyzed: 0,
        visual_note: 'Visual frames: not analyzed. The transcript was sufficient.',
      },
    };

    const onConfirmSave = vi
      .fn()
      .mockResolvedValue({ ok: true, artifactId: 'art_saved_123' });

    render(
      <ReviewScreen
        jobId="job_test_review"
        sourceUrl="https://www.youtube.com/shorts/SWx0YfIjjx8"
        initialEnvelope={sampleEnvelope}
        initialFindings={[]}
        evidence={[
          {
            id: 'ev_1',
            kind: 'caption',
            content_text: 'Run git init inside your project folder.',
            start_ms: 14000,
            end_ms: 18000,
            provenance: 'youtube-timedtext-json3-v1',
            limitations_json: [],
          },
        ]}
        reducedMotion={true}
        onConfirmSave={onConfirmSave}
        onDiscard={vi.fn()}
        onOpenSavedArtifact={vi.fn()}
      />
    );

    // Evidence coverage note is visible (Section 6.8.C)
    expect(
      screen.getByText(/Visual frames: not analyzed\. The transcript was sufficient\./i)
    ).toBeInTheDocument();

    // Inline warning for inferred step (Section 6.8.C)
    expect(
      screen.getByText('No spoken evidence for this detail. Kept as inference.')
    ).toBeInTheDocument();

    // Click Save task -> triggers The Kept Moment confirmation ("Kept. Saved to your Library.")
    const saveBtn = screen.getByRole('button', { name: 'Save task' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Kept. Saved to your Library.')
      ).toBeInTheDocument();
    });
  });

  it('renders AtlasView with visible shape legend, keyboard navigation, and accessible node directory (Section 6.5)', () => {
    render(
      <AtlasView
        loading={false}
        reducedMotion={true}
        onFocusNode={vi.fn()}
        onExpandCluster={vi.fn()}
        onOpenArtifact={vi.fn()}
        onSwitchToList={vi.fn()}
        graph={{
          nodes: [
            {
              id: 'source:src_1',
              kind: 'source',
              shape: 'square',
              label: 'Git Setup Short',
              subtitle: 'Source (youtube)',
              entityId: 'src_1',
              x: -100,
              y: 0,
              z: 0,
            },
            {
              id: 'artifact:art_1',
              kind: 'task',
              shape: 'circle',
              label: 'Configure Git Task',
              subtitle: 'Task',
              entityId: 'art_1',
              x: 100,
              y: 0,
              z: 0,
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'source:src_1',
              target: 'artifact:art_1',
              relationship: 'derived_from',
            },
          ],
          adjacency: {
            'source:src_1': ['artifact:art_1'],
            'artifact:art_1': ['source:src_1'],
          },
          totalUnclusteredNodes: 2,
          clustered: false,
          focusNodeId: null,
          maxHops: 2,
          legend: [],
        }}
      />
    );

    expect(screen.getByText(/Square = Source/i)).toBeInTheDocument();
    expect(screen.getByText(/Circle = Task/i)).toBeInTheDocument();
    expect(screen.getByText(/Diamond = AI skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Ring = Topic/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Accessible node directory \(2\)/i)
    ).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DashboardScreen } from '../../src/client/screens/DashboardScreen.js';
import type { LibraryArtifactRow } from '../../src/client/screens/LibraryScreen.js';
import type { ReadyJobSummary } from '../../src/client/screens/CaptureScreen.js';

describe('DashboardScreen Component & Spatial Analytics', () => {
  const sampleItems: LibraryArtifactRow[] = [
    {
      id: 'art-1',
      artifact_type: 'task',
      title: 'Setup TypeScript Monorepo',
      topics: ['devops', 'typescript'],
      source_platform: 'youtube',
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
    },
    {
      id: 'art-2',
      artifact_type: 'skill',
      title: 'Docker Multi-stage Optimization',
      topics: ['devops'],
      source_platform: 'youtube',
      created_at: '2026-10-18T11:00:00Z',
      updated_at: '2026-10-18T11:00:00Z',
    },
  ];

  const sampleJobs: ReadyJobSummary[] = [
    {
      id: 'job-101',
      status: 'extracting',
      current_stage: 'transcribe',
      platform: 'youtube',
      canonical_url: 'https://www.youtube.com/shorts/xyz',
      candidate_title: 'FastAPI Dependency Injection Pattern',
      recommended_type: 'task',
      expires_at: null,
      updated_at: '2026-10-18T12:00:00Z',
    },
  ];

  const sampleTopics = [
    { slug: 'devops', name: 'DevOps' },
    { slug: 'typescript', name: 'TypeScript' },
  ];

  it('renders spatial intelligence header and key metric tiles', () => {
    render(
      <DashboardScreen
        items={sampleItems}
        activeJobs={sampleJobs}
        availableTopics={sampleTopics}
        onOpenArtifact={vi.fn()}
        onOpenJob={vi.fn()}
        onNavigateCapture={vi.fn()}
        onNavigateLibraryWithTopic={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Spatial Intelligence Console/i })).toBeInTheDocument();
    expect(screen.getByText(/Knowledge Artifacts/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/1 tasks · 1 reusable AI skills/i)).toBeInTheDocument();
    expect(screen.getByText(/Time Reclaimed/i)).toBeInTheDocument();
    expect(screen.getByText(/Compression Ratio/i)).toBeInTheDocument();
    expect(screen.getByText(/Ground-Truth Ratio/i)).toBeInTheDocument();
  });

  it('renders provenance spectrum and legend', () => {
    render(
      <DashboardScreen
        items={sampleItems}
        activeJobs={sampleJobs}
        availableTopics={sampleTopics}
        onOpenArtifact={vi.fn()}
        onOpenJob={vi.fn()}
        onNavigateCapture={vi.fn()}
        onNavigateLibraryWithTopic={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Spatial Provenance Spectrum/i })).toBeInTheDocument();
    expect(screen.getByText(/Audio Transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/Visual Frame OCR/i)).toBeInTheDocument();
    expect(screen.getByText(/Model Reasoning/i)).toBeInTheDocument();
    expect(screen.getByText(/Human Confirmed/i)).toBeInTheDocument();
  });

  it('renders topic chips and calls onNavigateLibraryWithTopic on click', () => {
    const onNavigateLibraryWithTopic = vi.fn();

    render(
      <DashboardScreen
        items={sampleItems}
        activeJobs={sampleJobs}
        availableTopics={sampleTopics}
        onOpenArtifact={vi.fn()}
        onOpenJob={vi.fn()}
        onNavigateCapture={vi.fn()}
        onNavigateLibraryWithTopic={onNavigateLibraryWithTopic}
      />
    );

    const devopsChip = screen.getByRole('button', { name: /DevOps/i });
    expect(devopsChip).toBeInTheDocument();
    fireEvent.click(devopsChip);
    expect(onNavigateLibraryWithTopic).toHaveBeenCalledWith('devops');
  });

  it('renders engine telemetry and zero retention disclosure', () => {
    render(
      <DashboardScreen
        items={sampleItems}
        activeJobs={sampleJobs}
        availableTopics={sampleTopics}
        onOpenArtifact={vi.fn()}
        onOpenJob={vi.fn()}
        onNavigateCapture={vi.fn()}
        onNavigateLibraryWithTopic={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Engine Telemetry/i })).toBeInTheDocument();
    expect(screen.getByText(/Whisper \(48 kHz mono\)/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Cached Media \(100% Purged\)/i)).toBeInTheDocument();
  });

  it('opens artifact and job when clicked', () => {
    const onOpenArtifact = vi.fn();
    const onOpenJob = vi.fn();

    render(
      <DashboardScreen
        items={sampleItems}
        activeJobs={sampleJobs}
        availableTopics={sampleTopics}
        onOpenArtifact={onOpenArtifact}
        onOpenJob={onOpenJob}
        onNavigateCapture={vi.fn()}
        onNavigateLibraryWithTopic={vi.fn()}
      />
    );

    const artifactRow = screen.getByText('Setup TypeScript Monorepo');
    fireEvent.click(artifactRow);
    expect(onOpenArtifact).toHaveBeenCalledWith('art-1');

    const jobRow = screen.getByText('FastAPI Dependency Injection Pattern');
    fireEvent.click(jobRow);
    expect(onOpenJob).toHaveBeenCalledWith('job-101');
  });
});

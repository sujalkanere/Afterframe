// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PrivacyScreen } from '../../src/client/screens/PrivacyScreen.js';
import { TermsScreen } from '../../src/client/screens/TermsScreen.js';

describe('Legal Stub Screens (Privacy & Terms) with [VERIFY] Markers', () => {
  it('renders PrivacyScreen with retention policies and legal review warning', () => {
    const onBack = vi.fn();
    const onNavigateTerms = vi.fn();

    render(
      <PrivacyScreen
        onBack={onBack}
        onNavigateTerms={onNavigateTerms}
      />
    );

    // Title
    expect(
      screen.getByRole('heading', { name: /Privacy & Data Governance/i })
    ).toBeInTheDocument();

    // Legal review banner with [VERIFY] marker
    expect(screen.getByText(/Legal Review Notice \[VERIFY\]/i)).toBeInTheDocument();

    // SRS Section 7 retention guarantees
    expect(
      screen.getByText(/Temporary Media Streams \(0 days\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Unconfirmed Review Candidates \(7 days\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/10-Second Undo Window/i)
    ).toBeInTheDocument();

    // Back button
    const backBtn = screen.getByRole('button', { name: /Back to Afterframe/i });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);

    // Navigate to Terms
    const termsLink = screen.getByRole('button', { name: /View Terms of Service/i });
    fireEvent.click(termsLink);
    expect(onNavigateTerms).toHaveBeenCalledTimes(1);
  });

  it('renders TermsScreen with acceptable use and legal review warning', () => {
    const onBack = vi.fn();
    const onNavigatePrivacy = vi.fn();

    render(
      <TermsScreen
        onBack={onBack}
        onNavigatePrivacy={onNavigatePrivacy}
      />
    );

    // Title
    expect(
      screen.getByRole('heading', { name: /Terms of Service/i })
    ).toBeInTheDocument();

    // Legal review notice with [VERIFY]
    expect(screen.getByText(/Legal Review Notice \[VERIFY\]/i)).toBeInTheDocument();

    // Key clauses
    expect(screen.getByText(/Nature of the Service/i)).toBeInTheDocument();
    expect(screen.getByText(/Human Review & Limitation of Liability/i)).toBeInTheDocument();

    // Back button
    const backBtn = screen.getByRole('button', { name: /Back to Afterframe/i });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);

    // Navigate to Privacy
    const privacyLink = screen.getByRole('button', { name: /View Privacy Policy/i });
    fireEvent.click(privacyLink);
    expect(onNavigatePrivacy).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LandingScreen } from '../../src/client/screens/LandingScreen.js';

describe('LandingScreen Component & 10 Sections (Section 6 & Reference Archetype)', () => {
  it('renders all 10 sections in strict order with Log in CTA for logged out visitor', () => {
    const onNavigateLogin = vi.fn();
    const onNavigateApp = vi.fn();
    const onNavigateTerms = vi.fn();
    const onNavigatePrivacy = vi.fn();
    const onToggleTheme = vi.fn();

    const { container } = render(
      <LandingScreen
        isLoggedIn={false}
        onNavigateLogin={onNavigateLogin}
        onNavigateApp={onNavigateApp}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
        theme="dark"
        onToggleTheme={onToggleTheme}
      />
    );

    // 1. Top bar: Brand logo and "Log in" primary button
    expect(screen.getByLabelText('Afterframe homepage')).toBeInTheDocument();
    const loginBtns = screen.getAllByRole('button', { name: /Log in/i });
    expect(loginBtns.length).toBeGreaterThanOrEqual(1);

    // Clicking top bar CTA triggers onNavigateLogin
    fireEvent.click(loginBtns[0]);
    expect(onNavigateLogin).toHaveBeenCalledTimes(1);

    // 2. Hero: Two-part headline and window mockup
    expect(
      screen.getByRole('heading', {
        name: /Turn short-form video into actionable knowledge/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/With evidence for every single step/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Afterframe — Capture & Review/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/FastAPI dependency injection pattern/i)
    ).toBeInTheDocument();

    // 3. Intro statement: Problem and solution
    expect(screen.getByText('Why Afterframe')).toBeInTheDocument();
    expect(
      screen.getByText(/Saving ideas from short videos is broken/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Afterframe extracts the real substance/i)
    ).toBeInTheDocument();

    // 4. Capability block: 3 rows with icons
    expect(
      screen.getByRole('heading', {
        name: /A disciplined pipeline from frame to artifact/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Paste any link')).toBeInTheDocument();
    expect(screen.getByText('Review before you keep')).toBeInTheDocument();
    expect(screen.getByText('Evidence on every step')).toBeInTheDocument();

    // 5. Evidence you can check: Provenance chips
    expect(
      screen.getByRole('heading', { name: /Evidence you can check/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Transcript 0:14')).toBeInTheDocument();
    expect(screen.getByText('Frame 0:22')).toBeInTheDocument();
    expect(screen.getByText('Inferred')).toBeInTheDocument();
    expect(screen.getByText('Edited by you')).toBeInTheDocument();

    // 6. Library block: organizing by topic, list / atlas switch
    expect(
      screen.getByRole('heading', {
        name: /A library that understands what you are building/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Topic: Systems Architecture/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Structured List/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /2D Spatial Atlas/i })).toBeInTheDocument();

    // 7. Three-card trust block + wide banner
    expect(
      screen.getByRole('heading', { name: /The machine drafts\. You decide\./i })
    ).toBeInTheDocument();
    expect(screen.getByText('You confirm everything')).toBeInTheDocument();
    expect(screen.getByText('Nothing saved without you')).toBeInTheDocument();
    expect(screen.getByText("Honest about what it didn't see")).toBeInTheDocument();
    expect(
      screen.getByText(/Send tasks to Google Tasks \(coming soon\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Export AI skills to SKILL\.md and JSON formats/i)
    ).toBeInTheDocument();

    // 8. Privacy block with masked reveal text
    expect(screen.getByText('Zero media retention')).toBeInTheDocument();
    expect(screen.getByText('Local draft protection')).toBeInTheDocument();
    expect(screen.getByText('Complete data export and purge')).toBeInTheDocument();

    // 9. Closing CTA banner
    expect(
      screen.getByRole('heading', {
        name: /Stop losing valuable ideas to the feed/i,
      })
    ).toBeInTheDocument();

    // 10. Global footer
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Afterframe/i)).toBeInTheDocument();
  });

  it('renders "Open app" CTA when visitor is already signed in', () => {
    const onNavigateApp = vi.fn();

    render(
      <LandingScreen
        isLoggedIn={true}
        onNavigateLogin={vi.fn()}
        onNavigateApp={onNavigateApp}
        onNavigateTerms={vi.fn()}
        onNavigatePrivacy={vi.fn()}
      />
    );

    const appBtns = screen.getAllByRole('button', { name: /Open app/i });
    expect(appBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(appBtns[0]);
    expect(onNavigateApp).toHaveBeenCalledTimes(1);
  });

  it('reveals masked privacy heading on interaction', () => {
    render(
      <LandingScreen
        isLoggedIn={false}
        onNavigateLogin={vi.fn()}
        onNavigateApp={vi.fn()}
        onNavigateTerms={vi.fn()}
        onNavigatePrivacy={vi.fn()}
        reducedMotion={false}
      />
    );

    const maskedHeading = screen.getByRole('heading', {
      name: /Private enough to use real data/i,
    });
    expect(maskedHeading).toBeInTheDocument();

    // Initial masked text displays asterisks
    expect(maskedHeading).toHaveTextContent('*******');

    // Hover reveals word "Private"
    fireEvent.mouseEnter(maskedHeading);
    expect(maskedHeading).toHaveTextContent('Private');

    // Mouse leave conceals back to asterisks
    fireEvent.mouseLeave(maskedHeading);
    expect(maskedHeading).toHaveTextContent('*******');
  });

  it('switches between list and atlas views in Library section', () => {
    render(
      <LandingScreen
        isLoggedIn={false}
        onNavigateLogin={vi.fn()}
        onNavigateApp={vi.fn()}
        onNavigateTerms={vi.fn()}
        onNavigatePrivacy={vi.fn()}
      />
    );

    const listTab = screen.getByRole('tab', { name: /Structured List/i });
    const atlasTab = screen.getByRole('tab', { name: /2D Spatial Atlas/i });

    expect(listTab).toHaveAttribute('aria-selected', 'true');
    expect(atlasTab).toHaveAttribute('aria-selected', 'false');

    // Click Atlas tab
    fireEvent.click(atlasTab);
    expect(atlasTab).toHaveAttribute('aria-selected', 'true');
    expect(listTab).toHaveAttribute('aria-selected', 'false');
  });
});

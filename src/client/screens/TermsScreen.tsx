import React from 'react';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react';

export interface TermsScreenProps {
  onBack: () => void;
  onNavigatePrivacy: () => void;
}

export const TermsScreen: React.FC<TermsScreenProps> = ({
  onBack,
  onNavigatePrivacy,
}) => {
  return (
    <div className="af-legal-page">
      <div className="af-legal-container">
        <header className="af-legal-header">
          <button
            type="button"
            onClick={onBack}
            className="af-btn-secondary af-btn-sm"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Afterframe</span>
          </button>
        </header>

        <article className="af-legal-article">
          <div className="af-legal-badge">
            <FileText size={16} aria-hidden="true" />
            <span>Service Agreement</span>
          </div>

          <h1 className="af-legal-title">Terms of Service</h1>
          <p className="af-legal-updated">Last revised: October 2026 • Status: Draft for review</p>

          <div className="af-legal-banner-warning" role="note">
            <AlertTriangle size={18} className="af-warning-icon" aria-hidden="true" />
            <div>
              <strong>Legal Review Notice [VERIFY]:</strong> These draft terms describe the conditions under
              which Afterframe provides short-video parsing and extraction tools. This document requires formal
              legal review and jurisdiction adaptation before commercial launch.
            </div>
          </div>

          <section className="af-legal-section">
            <h2>1. Nature of the Service</h2>
            <p>
              Afterframe provides an assistive spatial tool that analyzes publicly accessible short-form video
              URLs and user-provided transcripts to draft structured tasks, checklists, and AI skills for personal
              and organizational productivity.
            </p>
          </section>

          <section className="af-legal-section">
            <h2>2. Acceptable Use & Source Material</h2>
            <p>
              You agree to use Afterframe only with content you have lawful rights to review, analyze, or transcribe
              under fair use, educational research, or applicable copyright exceptions:
            </p>
            <ul className="af-legal-list">
              <li>
                You must not use Afterframe to attempt automated bypass of paywalls, authentication hurdles, or DRM.
              </li>
              <li>
                You must not submit malicious URLs or attempt denial-of-service against our extraction workers.
              </li>
              <li>
                You are solely responsible for reviewing and verifying the factual accuracy of AI-extracted
                steps before executing real-world commands, tasks, or code.
              </li>
            </ul>
          </section>

          <section className="af-legal-section">
            <h2>3. Human Review & Limitation of Liability</h2>
            <p>
              Afterframe is designed with an explicit human-in-the-loop review step. AI model inferences,
              transcript timestamps, and generated code snippets are starting drafts, not professional legal,
              medical, or engineering advice. Afterframe disclaims liability for actions taken on unverified drafts.
            </p>
          </section>

          <section className="af-legal-section">
            <h2>4. Intellectual Property & Ownership</h2>
            <p>
              You retain all ownership rights to the artifacts, notes, tags, and AI skill definitions you compile
              within Afterframe. Afterframe claims no intellectual property rights in your saved library content.
            </p>
          </section>

          <section className="af-legal-section">
            <h2>5. Service Modifications & Termination</h2>
            <p>
              We may update features or connectors to maintain compliance with third-party platform API guidelines.
              You may terminate your account and wipe all stored data at any time via Settings.
            </p>
          </section>

          <footer className="af-legal-footer-nav">
            <button
              type="button"
              onClick={onNavigatePrivacy}
              className="af-link-accent"
            >
              View Privacy Policy →
            </button>
          </footer>
        </article>
      </div>
    </div>
  );
};

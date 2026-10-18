import React from 'react';
import { ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';

export interface PrivacyScreenProps {
  onBack: () => void;
  onNavigateTerms: () => void;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({
  onBack,
  onNavigateTerms,
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
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Data Privacy Policy</span>
          </div>

          <h1 className="af-legal-title">Privacy & Data Governance</h1>
          <p className="af-legal-updated">Last revised: October 2026 • Status: Draft for review</p>

          <div className="af-legal-banner-warning" role="note">
            <AlertTriangle size={18} className="af-warning-icon" aria-hidden="true" />
            <div>
              <strong>Legal Review Notice [VERIFY]:</strong> This policy outlines the current technical
              architecture and data retention guarantees of Afterframe v1.1. It requires formal legal
              counsel review prior to enterprise deployment.
            </div>
          </div>

          <section className="af-legal-section">
            <h2>1. Our Foundational Privacy Principle</h2>
            <p>
              Afterframe is built on a simple premise: <em>you own your knowledge, and research should remain private by default</em>.
              We do not sell personal data, do not train public foundation models on your notes or artifacts,
              and do not install covert telemetry or third-party advertising scripts.
            </p>
          </section>

          <section className="af-legal-section">
            <h2>2. Documented Data Retention Schedule (SRS Section 7)</h2>
            <p>
              Our automated data cleanup pipelines strictly enforce the following lifecycle rules:
            </p>
            <ul className="af-legal-list">
              <li>
                <strong>Temporary Media Streams (0 days):</strong> Video frames, temporary audio slices, and
                intermediate processing buffers are deleted from volatile memory and disk immediately after
                transcription and analysis finish or fail.
              </li>
              <li>
                <strong>Unconfirmed Review Candidates (7 days):</strong> Extraction candidates that remain in
                “Ready for Review” without user confirmation expire and are purged automatically after 7 calendar days.
              </li>
              <li>
                <strong>Confirmed Artifacts & Cited Evidence:</strong> Only artifacts you explicitly click “Save”
                to keep are permanently retained. Cited transcript segments and thumbnail references are preserved
                only while referenced by at least one active artifact owned by your account.
              </li>
              <li>
                <strong>10-Second Undo Window:</strong> When you delete an artifact or topic, it is immediately hidden
                from view and permanently purged after a 10-second undo window.
              </li>
            </ul>
          </section>

          <section className="af-legal-section">
            <h2>3. Account Data Portability & Deletion (FR-064)</h2>
            <p>
              You maintain total sovereignty over your research:
            </p>
            <ul className="af-legal-list">
              <li>
                <strong>Data Export:</strong> You may download an export bundle containing all your sources,
                cited evidence segments, artifacts, task steps, and skill packages in documented JSON format at any time.
              </li>
              <li>
                <strong>Complete Deletion:</strong> Clicking “Delete Account and Data” in Settings executes an
                irreversible transaction that permanently purges your user record, authentication sessions, sources,
                evidence links, and artifacts from our databases.
              </li>
            </ul>
          </section>

          <section className="af-legal-section">
            <h2>4. LLM Providers & API Boundaries [VERIFY]</h2>
            <p>
              When AI extraction is configured, prompts containing spoken transcripts and frame observations are
              dispatched solely to configured model endpoints (such as Google Gemini). We configure these requests
              with zero-retention flags where supported. You may configure your own API keys in Settings.
            </p>
          </section>

          <section className="af-legal-section">
            <h2>5. Contact & Questions</h2>
            <p>
              For privacy inquiries, data subject access requests, or verification questions, reach out to{' '}
              <a href="mailto:privacy@afterframe.app" className="af-link-accent">
                privacy@afterframe.app [VERIFY]
              </a>.
            </p>
          </section>

          <footer className="af-legal-footer-nav">
            <button
              type="button"
              onClick={onNavigateTerms}
              className="af-link-accent"
            >
              View Terms of Service →
            </button>
          </footer>
        </article>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Link as LinkIcon,
  CheckSquare,
  FileCheck,
  ArrowRight,
  Menu,
  X,
  Play,
  Sun,
  Moon,
  ExternalLink,
  ChevronRight,
  Compass,
  Layers,
  Sparkles,
} from 'lucide-react';
import { landingContent } from '../content/landing.js';
import { MediaPlaceholder } from '../components/MediaPlaceholder.js';
import { ProvenanceChip } from '../components/ProvenanceChip.js';
import { FrameBrackets } from '../components/FrameBrackets.js';
import { VaporRibbons } from '../../../app/components/backgrounds/effects/vapor-ribbons';

export interface LandingScreenProps {
  isLoggedIn: boolean;
  onNavigateLogin: () => void;
  onNavigateApp: () => void;
  onNavigateTerms: () => void;
  onNavigatePrivacy: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  reducedMotion?: boolean;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  isLoggedIn,
  onNavigateLogin,
  onNavigateApp,
  onNavigateTerms,
  onNavigatePrivacy,
  theme = 'dark',
  onToggleTheme,
  reducedMotion = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [libraryActiveTab, setLibraryActiveTab] = useState<'list' | 'atlas'>('list');
  const [activeChipKind, setActiveChipKind] = useState<
    'transcript' | 'visual' | 'inferred' | 'edited'
  >('transcript');

  // Masked text effect state
  const [maskedRevealed, setMaskedRevealed] = useState(false);

  // Monitor scroll for sticky header shrinkage
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePrimaryCta = () => {
    if (isLoggedIn) {
      onNavigateApp();
    } else {
      onNavigateLogin();
    }
  };

  const primaryBtnText = isLoggedIn
    ? landingContent.navigation.ctaLoggedIn
    : landingContent.navigation.ctaLoggedOut;

  return (
    <div className="af-landing">
      {/* 1. TOP BAR */}
      <header
        className={`af-landing-header ${isScrolled ? 'af-header-scrolled' : ''}`}
        role="banner"
      >
        <div className="af-landing-nav-container">
          {/* Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
            }}
            className="af-nav-logo"
            aria-label="Afterframe homepage"
          >
            <img
              src="/brand/logo.svg"
              alt=""
              className="af-nav-logo-emblem"
              aria-hidden="true"
            />
            <span className="af-logo-text">{landingContent.navigation.logoLabel}</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="af-nav-links-desktop" aria-label="Main Navigation">
            {landingContent.navigation.links.map((link) => (
              <a key={link.href} href={link.href} className="af-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Action Controls */}
          <div className="af-nav-actions">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="af-theme-toggle-btn"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrimaryCta}
              className="af-btn-primary af-btn-sm af-nav-cta"
            >
              {primaryBtnText}
            </button>

            {/* Mobile Menu Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="af-mobile-menu-btn"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="af-mobile-drawer" role="dialog" aria-modal="true">
            <nav className="af-mobile-nav-list">
              {landingContent.navigation.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="af-mobile-nav-item"
                >
                  {link.label}
                </a>
              ))}
              <div className="af-mobile-nav-divider" />
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handlePrimaryCta();
                }}
                className="af-btn-primary af-btn-block"
              >
                {primaryBtnText}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateApp();
                }}
                className="af-btn-secondary af-btn-block"
              >
                {landingContent.navigation.tryGuestLabel}
              </button>
            </nav>
          </div>
        )}
      </header>

      <main id="main-content" className="af-landing-main">
        {/* 2. HERO SECTION */}
        <section className="af-hero-section" aria-labelledby="hero-heading">
          {/* Ambient Vapor Ribbons Background Effect */}
          <div className="af-hero-vapor-ribbons" aria-hidden="true">
            <VaporRibbons
              color1="#a86df2"
              color2="#d66de0"
              color3="#6d5df2"
              background="#0f1013"
              speed={1.0}
            />
          </div>

          <div className="af-landing-container af-hero-content">
            <div className="af-hero-badge-row">
              <span className="af-hero-badge">
                <Sparkles size={14} className="af-badge-icon" aria-hidden="true" />
                <span>{landingContent.hero.badge}</span>
              </span>
            </div>

            <h1 id="hero-heading" className="af-hero-title">
              <span className="af-hero-lead">{landingContent.hero.headlineLead}</span>{' '}
              <span className="af-hero-muted">{landingContent.hero.headlineMuted}</span>
            </h1>

            <p className="af-hero-subheadline">{landingContent.hero.subheadline}</p>

            <div className="af-hero-cta-group">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="af-btn-primary af-btn-lg af-hero-primary-btn"
              >
                <span>{primaryBtnText}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>

              <a href={landingContent.hero.ctaSecondaryHref} className="af-btn-secondary af-btn-lg">
                {landingContent.hero.ctaSecondary}
              </a>
            </div>

            {/* App Window Mockup */}
            <div
              className={`af-hero-mockup-wrapper ${
                reducedMotion ? 'af-mockup-static' : 'af-mockup-animate'
              }`}
            >
              <div className="af-app-window-frame">
                {/* Window top bar */}
                <div className="af-window-chrome">
                  <div className="af-window-dots" aria-hidden="true">
                    <span className="af-dot af-dot-red" />
                    <span className="af-dot af-dot-yellow" />
                    <span className="af-dot af-dot-green" />
                  </div>
                  <div className="af-window-title">Afterframe — Capture & Review</div>
                  <div className="af-window-empty" />
                </div>

                {/* Window inner layout */}
                <div className="af-window-body">
                  {/* Decorative sidebar */}
                  <aside className="af-window-sidebar" aria-hidden="true">
                    <div className="af-window-sidebar-header">
                      <img
                        src="/brand/logo.svg"
                        alt=""
                        className="af-sidebar-brand-emblem"
                        aria-hidden="true"
                      />
                      <span className="af-sidebar-brand">Afterframe</span>
                    </div>
                    <nav className="af-window-sidebar-nav">
                      {landingContent.hero.windowMockup.sidebarNav.map((item) => (
                        <div
                          key={item.label}
                          className={`af-sidebar-item ${item.active ? 'af-sidebar-active' : ''}`}
                        >
                          <span>{item.label}</span>
                          {item.count && <span className="af-sidebar-count">{item.count}</span>}
                        </div>
                      ))}
                    </nav>
                  </aside>

                  {/* Window main area */}
                  <div className="af-window-content">
                    {/* Viewfinder frame lock input */}
                    <div className="af-mockup-capture-box">
                      <FrameBrackets active={true} animate={!reducedMotion} className="af-mockup-input-frame">
                        <div className="af-mockup-input-container">
                          <div className="af-mockup-input-lead">
                            <img
                              src="/icons/youtube.svg"
                              alt="YouTube Shorts"
                              className="af-mockup-lead-icon"
                              aria-hidden="true"
                            />
                            <input
                              type="text"
                              readOnly
                              value="https://youtube.com/shorts/5e_k9mD2w1Q"
                              aria-label="Sample URL input"
                              className="af-mockup-input"
                            />
                          </div>
                          <button type="button" className="af-btn-primary af-btn-sm" tabIndex={-1}>
                            Extract
                          </button>
                        </div>
                      </FrameBrackets>

                      {/* Supported Ingestion Sources Strip */}
                      <div className="af-mockup-platforms-bar" aria-label="Supported video sources">
                        <span className="af-platform-bar-label">Supported Sources:</span>
                        <div className="af-platform-pills">
                          <span className="af-platform-pill">
                            <img src="/icons/youtube.svg" alt="" className="af-platform-pill-icon" aria-hidden="true" />
                            <span>YouTube Shorts</span>
                          </span>
                          <span className="af-platform-pill">
                            <img src="/icons/tiktok.svg" alt="" className="af-platform-pill-icon" aria-hidden="true" />
                            <span>TikTok</span>
                          </span>
                          <span className="af-platform-pill">
                            <img src="/icons/instagram.svg" alt="" className="af-platform-pill-icon" aria-hidden="true" />
                            <span>Instagram Reels</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Short row of 3 recent cards */}
                    <div className="af-mockup-recents">
                      <div className="af-recents-heading">
                        {landingContent.hero.windowMockup.recentTitle}
                      </div>
                      <div className="af-recents-grid">
                        {landingContent.hero.windowMockup.recentCards.map((card) => (
                          <div key={card.id} className="af-recent-card">
                            <MediaPlaceholder
                              slotId={card.id}
                              aspectRatio="16:9"
                              variant="image"
                              label={`Thumbnail: ${card.title}`}
                              className="af-recent-media"
                            />
                            <div className="af-recent-info">
                              <span className="af-recent-tag">{card.type}</span>
                              <h4 className="af-recent-title">{card.title}</h4>
                              <span className="af-recent-meta">
                                {card.source} • {card.evidenceCount} citations
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Soft section warm projection transition */}
            <div className="af-section-warm-light" aria-hidden="true" />
          </div>
        </section>

        {/* 3. INTRO STATEMENT */}
        <section className="af-intro-section">
          <div className="af-landing-container af-intro-grid">
            <div className="af-intro-left">
              <a href={landingContent.intro.eyebrowHref} className="af-eyebrow-link">
                <span>{landingContent.intro.eyebrow}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </a>
            </div>
            <div className="af-intro-right">
              <p className="af-intro-problem">{landingContent.intro.problem}</p>
              <p className="af-intro-solution">{landingContent.intro.solution}</p>
            </div>
          </div>
        </section>

        {/* 4. CAPABILITY BLOCK */}
        <section id="capabilities" className="af-capabilities-section" aria-labelledby="cap-heading">
          <div className="af-landing-container">
            <div className="af-section-header">
              <span className="af-section-eyebrow">{landingContent.capabilities.eyebrow}</span>
              <h2 id="cap-heading" className="af-section-title">
                {landingContent.capabilities.heading}
              </h2>
              <p className="af-section-subheading">{landingContent.capabilities.subheading}</p>
            </div>

            <div className="af-capabilities-grid">
              {landingContent.capabilities.cards.map((card) => {
                const IconComponent =
                  card.iconName === 'Link'
                    ? LinkIcon
                    : card.iconName === 'CheckSquare'
                      ? CheckSquare
                      : FileCheck;

                return (
                  <div key={card.title} className="af-capability-card">
                    <MediaPlaceholder
                      slotId={card.slotId}
                      aspectRatio="4:3"
                      variant="illustration"
                      label={`Diagram: ${card.title}`}
                      className="af-cap-media"
                    />
                    <div className="af-cap-body">
                      <div className="af-cap-icon-box" aria-hidden="true">
                        <IconComponent size={20} />
                      </div>
                      <h3 className="af-cap-title">{card.title}</h3>
                      <p className="af-cap-desc">{card.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. EVIDENCE YOU CAN CHECK */}
        <section id="evidence" className="af-evidence-section" aria-labelledby="evidence-heading">
          <div className="af-landing-container">
            <div className="af-section-header af-text-center">
              <span className="af-section-eyebrow">{landingContent.evidenceSection.eyebrow}</span>
              <h2 id="evidence-heading" className="af-section-title">
                {landingContent.evidenceSection.heading}
              </h2>
              <p className="af-section-subheading">{landingContent.evidenceSection.subheading}</p>
            </div>

            {/* Provenance Chips Bar */}
            <div
              className="af-chips-demonstration"
              role="tablist"
              aria-label="Provenance Evidence Kinds"
            >
              {landingContent.evidenceSection.chips.map((chip) => (
                <button
                  key={chip.kind}
                  type="button"
                  role="tab"
                  aria-selected={activeChipKind === chip.kind}
                  onClick={() =>
                    setActiveChipKind(chip.kind as 'transcript' | 'visual' | 'inferred' | 'edited')
                  }
                  className={`af-chip-tab ${activeChipKind === chip.kind ? 'af-chip-tab-active' : ''}`}
                >
                  <ProvenanceChip
                    kind={chip.kind as 'transcript' | 'visual' | 'inferred' | 'edited'}
                    label={chip.label}
                  />
                </button>
              ))}
            </div>

            {/* Active Chip Details */}
            <div className="af-chip-explanation-card">
              <span className="af-chip-explanation-label">Auditable Evidence Guarantee:</span>
              <p className="af-chip-explanation-text">
                {
                  landingContent.evidenceSection.chips.find((c) => c.kind === activeChipKind)
                    ?.explanation
                }
              </p>
            </div>

            {/* Split Media Preview */}
            <div className="af-evidence-pane-container">
              <MediaPlaceholder
                slotId={landingContent.evidenceSection.reviewPlaceholder.slotId}
                aspectRatio="16:10"
                variant="image"
                label={landingContent.evidenceSection.reviewPlaceholder.label}
                className="af-evidence-hero-slot"
              />
            </div>
          </div>
        </section>

        {/* 6. LIBRARY BLOCK ("MEMORY" ARCHETYPE) */}
        <section id="library" className="af-library-section" aria-labelledby="library-heading">
          <div className="af-landing-container">
            <div className="af-section-header">
              <span className="af-section-eyebrow">{landingContent.librarySection.eyebrow}</span>
              <h2 id="library-heading" className="af-section-title">
                <span className="af-title-gradient">{landingContent.librarySection.headingLead}</span>{' '}
                {landingContent.librarySection.headingAccent}
              </h2>
              <p className="af-section-subheading">{landingContent.librarySection.description}</p>
            </div>

            {/* Topic pill preview */}
            <div className="af-library-topic-pill-row">
              <span className="af-topic-prompt-pill">
                <Compass size={16} aria-hidden="true" />
                <span>{landingContent.librarySection.promptChip}</span>
              </span>
            </div>

            {/* Interactive View Toggle */}
            <div className="af-library-tabs" role="tablist" aria-label="Library view mode">
              <button
                type="button"
                role="tab"
                aria-selected={libraryActiveTab === 'list'}
                onClick={() => setLibraryActiveTab('list')}
                className={`af-view-tab-btn ${
                  libraryActiveTab === 'list' ? 'af-view-tab-active' : ''
                }`}
              >
                <Layers size={16} aria-hidden="true" />
                <span>Structured List</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={libraryActiveTab === 'atlas'}
                onClick={() => setLibraryActiveTab('atlas')}
                className={`af-view-tab-btn ${
                  libraryActiveTab === 'atlas' ? 'af-view-tab-active' : ''
                }`}
              >
                <Compass size={16} aria-hidden="true" />
                <span>2D Spatial Atlas</span>
              </button>
            </div>

            {/* Dual Media Placeholders */}
            <div className="af-library-preview-box">
              {libraryActiveTab === 'list' ? (
                <MediaPlaceholder
                  slotId={landingContent.librarySection.slots.list.slotId}
                  aspectRatio="16:9"
                  variant="image"
                  label={landingContent.librarySection.slots.list.label}
                  className="af-library-slot"
                />
              ) : (
                <MediaPlaceholder
                  slotId={landingContent.librarySection.slots.atlas.slotId}
                  aspectRatio="16:9"
                  variant="image"
                  label={landingContent.librarySection.slots.atlas.label}
                  className="af-library-slot"
                />
              )}
            </div>
          </div>
        </section>

        {/* 7. THREE-CARD TRUST BLOCK + WIDE BANNER */}
        <section className="af-trust-section" aria-labelledby="trust-heading">
          <div className="af-landing-container">
            <div className="af-section-header">
              <span className="af-section-eyebrow">{landingContent.trustSection.eyebrow}</span>
              <h2 id="trust-heading" className="af-section-title">
                {landingContent.trustSection.heading}
              </h2>
              <p className="af-section-subheading">{landingContent.trustSection.subheading}</p>
            </div>

            {/* 3 Trust Cards */}
            <div className="af-trust-cards-grid">
              {landingContent.trustSection.cards.map((card) => (
                <div key={card.title} className="af-trust-card">
                  <MediaPlaceholder
                    slotId={card.slotId}
                    aspectRatio="16:9"
                    variant="illustration"
                    label={`Illustration: ${card.title}`}
                    className="af-trust-media"
                  />
                  <div className="af-trust-card-body">
                    <h3 className="af-trust-card-title">{card.title}</h3>
                    <p className="af-trust-card-desc">{card.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Wide Banner */}
            <div className="af-wide-banner">
              <div className="af-wide-banner-left">
                <span className="af-banner-badge">{landingContent.trustSection.wideBanner.badge}</span>
                <h3 className="af-banner-title">{landingContent.trustSection.wideBanner.title}</h3>
                <p className="af-banner-desc">{landingContent.trustSection.wideBanner.description}</p>
                <div className="af-banner-bullets">
                  {landingContent.trustSection.wideBanner.bullets.map((bullet) => (
                    <div key={bullet.text} className="af-banner-bullet-item">
                      <div className="af-bullet-dot" aria-hidden="true" />
                      <div>
                        <strong className="af-bullet-title">{bullet.text}</strong>
                        <span className="af-bullet-note"> — {bullet.note}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Connected Destinations Ecosystem */}
                <div className="af-banner-destinations">
                  <span className="af-destinations-title">Supported Export Destinations:</span>
                  <div className="af-destinations-grid">
                    <div className="af-destination-chip">
                      <img src="/icons/google-tasks.svg" alt="" className="af-dest-icon" aria-hidden="true" />
                      <span className="af-dest-name">Google Tasks</span>
                    </div>
                    <div className="af-destination-chip">
                      <img src="/icons/notion.svg" alt="" className="af-dest-icon" aria-hidden="true" />
                      <span className="af-dest-name">Notion</span>
                    </div>
                    <div className="af-destination-chip">
                      <img src="/icons/obsidian.svg" alt="" className="af-dest-icon" aria-hidden="true" />
                      <span className="af-dest-name">Obsidian</span>
                    </div>
                    <div className="af-destination-chip">
                      <img src="/icons/github.svg" alt="" className="af-dest-icon" aria-hidden="true" />
                      <span className="af-dest-name">GitHub</span>
                    </div>
                    <div className="af-destination-chip">
                      <img src="/icons/linear.svg" alt="" className="af-dest-icon" aria-hidden="true" />
                      <span className="af-dest-name">Linear</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="af-wide-banner-right">
                <MediaPlaceholder
                  slotId={landingContent.trustSection.wideBanner.slotId}
                  aspectRatio="16:9"
                  variant="illustration"
                  src="/brand/logo.svg"
                  label={landingContent.trustSection.wideBanner.slotLabel}
                  className="af-banner-media"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 8. PRIVACY AND CONTROL BLOCK */}
        <section id="privacy" className="af-privacy-section" aria-labelledby="privacy-heading">
          <div className="af-landing-container">
            <div className="af-section-header">
              <span className="af-section-eyebrow">{landingContent.privacySection.eyebrow}</span>

              {/* Masked-Text Reveal Effect Heading */}
              <h2
                id="privacy-heading"
                className="af-privacy-masked-heading"
                onMouseEnter={() => setMaskedRevealed(true)}
                onMouseLeave={() => setMaskedRevealed(false)}
                onClick={() => setMaskedRevealed((r) => !r)}
              >
                <span className="af-masked-word" aria-label={landingContent.privacySection.maskedWord}>
                  {reducedMotion || maskedRevealed ? 'Private' : '*******'}
                </span>{' '}
                <span className="af-heading-regular">enough to use real data.</span>
              </h2>

              <p className="af-section-subheading">{landingContent.privacySection.subheading}</p>
            </div>

            <div className="af-privacy-cards-grid">
              {landingContent.privacySection.cards.map((card) => (
                <div key={card.title} className="af-privacy-card">
                  <MediaPlaceholder
                    slotId={card.slotId}
                    aspectRatio="4:3"
                    variant="illustration"
                    label={`Diagram: ${card.title}`}
                    className="af-privacy-media"
                  />
                  <div className="af-privacy-body">
                    {card.badge && <span className="af-privacy-badge">{card.badge}</span>}
                    <h3 className="af-privacy-title">{card.title}</h3>
                    <p className="af-privacy-desc">{card.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. CLOSING CTA BANNER */}
        <section className="af-closing-cta-section" aria-labelledby="cta-heading">
          <div className="af-landing-container">
            <div className="af-cta-projection-room">
              <div className="af-cta-warm-spotlight" aria-hidden="true" />
              <div className="af-cta-content">
                <h2 id="cta-heading" className="af-cta-title">
                  {landingContent.closingCta.heading}
                </h2>
                <p className="af-cta-subtitle">{landingContent.closingCta.subheading}</p>
                <div className="af-cta-btn-row">
                  <button
                    type="button"
                    onClick={handlePrimaryCta}
                    className="af-btn-primary af-btn-lg"
                  >
                    <span>{primaryBtnText}</span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
                {/* Desktop Platform Compatibility */}
                <div className="af-cta-platforms-row" aria-label="Desktop Platform Availability">
                  <span className="af-cta-platforms-label">Desktop Engine Available On:</span>
                  <div className="af-cta-platforms-badges">
                    <span className="af-os-pill">
                      <img src="/icons/apple.svg" alt="" className="af-os-icon" aria-hidden="true" />
                      <span>macOS</span>
                    </span>
                    <span className="af-os-pill">
                      <img src="/icons/windows.svg" alt="" className="af-os-icon" aria-hidden="true" />
                      <span>Windows</span>
                    </span>
                    <span className="af-os-pill">
                      <img src="/icons/linux.svg" alt="" className="af-os-icon" aria-hidden="true" />
                      <span>Linux</span>
                    </span>
                  </div>
                </div>
                <p className="af-cta-note">{landingContent.closingCta.note}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 10. GLOBAL FOOTER */}
      <footer className="af-landing-footer" role="contentinfo">
        <div className="af-landing-container af-footer-content">
          <div className="af-footer-columns-grid">
            {landingContent.footer.columns.map((col) => (
              <div key={col.title} className="af-footer-column">
                <h3 className="af-footer-col-title">{col.title}</h3>
                <ul className="af-footer-link-list">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('/') ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (link.href === '/terms') onNavigateTerms();
                            else if (link.href === '/privacy') onNavigatePrivacy();
                            else if (link.href === '/login') onNavigateLogin();
                            else onNavigateApp();
                          }}
                          className="af-footer-link-btn"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <a
                          href={link.href}
                          target={link.isExternal ? '_blank' : undefined}
                          rel={link.isExternal ? 'noopener noreferrer' : undefined}
                          className="af-footer-link"
                        >
                          <span>{link.label}</span>
                          {link.isExternal && <ExternalLink size={12} aria-hidden="true" />}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="af-footer-bottom-row">
            <div className="af-footer-brand-info">
              <img
                src="/brand/logo.svg"
                alt=""
                className="af-footer-logo-emblem"
                aria-hidden="true"
              />
              <span className="af-footer-brand-name">AFTERFRAME</span>
              <span className="af-footer-copyright">{landingContent.footer.copyright}</span>
            </div>
            <p className="af-footer-disclaimer">{landingContent.footer.disclaimer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

import React from 'react';

export interface FrameBracketsProps {
  animate?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Viewfinder corner brackets ("The Frame", Section 6.3 & 6.4).
 * Used only on the two signature moments:
 * 1. The Frame Lock (Capture first load, < 900ms, skipped under reduced motion)
 * 2. The Kept Moment (Save confirmation, ~500ms)
 */
export const FrameBrackets: React.FC<FrameBracketsProps> = ({
  animate = false,
  active = true,
  children,
  className = '',
}) => {
  return (
    <div
      className={`af-frame-container ${animate ? 'af-frame-animate' : ''} ${className}`}
    >
      {active && (
        <>
          <span className="af-bracket af-bracket-tl" aria-hidden="true" />
          <span className="af-bracket af-bracket-tr" aria-hidden="true" />
          <span className="af-bracket af-bracket-bl" aria-hidden="true" />
          <span className="af-bracket af-bracket-br" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
};

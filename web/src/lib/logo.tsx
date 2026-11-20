import { useId } from "react";

/**
 * The H-Seal: the left pillar is the repository, the right pillar the chain, the punched
 * seal between them the verification, with the assay-gold stamp in the corner.
 * Each instance gets its own mask id, so several logos can share a page.
 */
export function HSeal({ className, title }: { className?: string; title?: string }) {
  const mask = `seal-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      <defs>
        <mask id={mask}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="60" cy="60" r="30" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        <rect x="0" y="0" width="42" height="120" fill="#3B6BFF" />
        <rect x="78" y="0" width="42" height="78" fill="#3B6BFF" />
        <path d="M78 78 H120 A42 42 0 0 1 78 120 Z" fill="#F5B83D" />
      </g>
      <circle cx="60" cy="60" r="16" fill="#2EE59D" />
    </svg>
  );
}

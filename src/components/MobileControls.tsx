import React from 'react';

interface MobileControlsProps {
  isLandscapeMobile: boolean;
  onDash: () => void;
}

export function MobileControls({ isLandscapeMobile, onDash }: MobileControlsProps) {
  return (
    <div
      className={`fixed left-0 bottom-0 z-20 pointer-events-none flex items-end ${
        isLandscapeMobile ? 'pl-3 pb-4' : 'pl-3.5 pb-3.5'
      }`}
      aria-label="Mobile touch controls"
    >
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          onDash();
        }}
        aria-label="Dash"
        className={`clay-btn pointer-events-auto rounded-full bg-[#C94136] hover:bg-[#B8372D] text-white font-bold touch-none cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
          isLandscapeMobile ? 'w-[54px] h-[54px] text-[10px]' : 'w-[58px] h-[58px] text-[11px]'
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="leading-none">Dash</span>
      </button>
    </div>
  );
}

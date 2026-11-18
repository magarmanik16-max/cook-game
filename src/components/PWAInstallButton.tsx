import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'clay-btn-soft bg-[#FFFBF7] hover:bg-[#FFF3E8] px-2.5 py-1.5 rounded-2xl text-xs font-bold text-[#3D2921] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer'
            : 'clay-btn-soft px-4 py-3.5 text-sm sm:text-base rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] font-bold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2'
        }
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#C94136] shrink-0" aria-hidden="true">
          <path
            d="M12 4 V15 M7 11 L12 16 L17 11 M5 19 H19"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'clay-btn-soft bg-[#FFFBF7] hover:bg-[#FFF3E8] px-2.5 py-1.5 rounded-2xl text-xs font-bold text-[#3D2921] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer'
              : 'clay-btn-soft px-4 py-3.5 text-sm rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] font-bold whitespace-nowrap shrink-0 cursor-pointer'
          }
        >
          Install App
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D2921]/45 p-4"
          >
            <div className="clay-card w-full max-w-sm p-5 text-[#3D2921]">
              <h3 id="ios-install-title" className="font-display text-xl font-bold">
                Install Copper Pan
              </h3>
              <p className="mt-2 text-sm text-[#6E5245] font-medium leading-relaxed">
                1. Tap the <strong className="text-[#3D2921]">Share</strong> button in Safari.
                <br />
                2. Tap <strong className="text-[#3D2921]">Add to Home Screen</strong> to play full-screen like a native app.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="clay-btn mt-4 w-full py-2.5 rounded-2xl bg-[#C94136] text-white font-bold text-sm cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

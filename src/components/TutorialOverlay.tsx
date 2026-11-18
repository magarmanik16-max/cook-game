import React from 'react';
import { TUTORIAL_COMPLETION_BONUS, type TutorialGuideSnapshot } from '../game/tutorial';
import { CoinSvg } from './DishIcons';

interface TutorialOverlayProps {
  guide: TutorialGuideSnapshot;
  isMobile: boolean;
  onNext: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({
  guide,
  isMobile,
  onNext,
  onSkip,
}: TutorialOverlayProps) {
  const isFinalStep = guide.stepIndex === guide.totalSteps - 1;

  return (
    <div
      data-testid="tutorial-overlay"
      className={`fixed z-30 pointer-events-none flex ${
        isMobile
          ? 'inset-x-0 bottom-2.5 pl-[76px] pr-3 justify-center'
          : 'top-2.5 left-4 right-[430px] justify-start'
      }`}
    >
      <div
        role="region"
        aria-label="Interactive kitchen tutorial"
        className={`pointer-events-auto clay-card bg-[#FFFBF7]/96 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-2 ${
          isMobile ? 'max-w-md px-3 py-2' : 'max-w-[600px] px-4 py-2'
        }`}
        style={{ borderColor: guide.accentColor }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Step Progress Dots */}
            <div className="flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: guide.totalSteps }, (_, idx) => (
                <span
                  key={idx}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: idx === guide.stepIndex ? 16 : 6,
                    backgroundColor:
                      idx <= guide.stepIndex ? guide.accentColor : '#E5D3C2',
                  }}
                />
              ))}
            </div>

            <span
              className="font-mono-num text-[10px] sm:text-[11px] font-bold uppercase tracking-wider"
              style={{ color: guide.accentColor }}
            >
              {guide.stepIndex + 1}/{guide.totalSteps} · {guide.title}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#3D2921] font-semibold leading-snug mt-0.5">
            {guide.instruction}
          </p>
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onSkip}
            className="clay-btn-soft px-2.5 py-1.5 rounded-xl bg-[#FFF6EC] hover:bg-[#FFEDD8] text-[11px] sm:text-xs font-bold text-[#6E5245] whitespace-nowrap cursor-pointer"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={onNext}
            className="clay-btn px-3 py-1.5 rounded-xl text-white text-[11px] sm:text-xs font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
            style={{ backgroundColor: guide.accentColor }}
          >
            {isFinalStep ? (
              <>
                <span>Got it!</span>
                <CoinSvg className="w-3.5 h-3.5" />
                <span className="font-mono-num">+{TUTORIAL_COMPLETION_BONUS}</span>
              </>
            ) : (
              'Next →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

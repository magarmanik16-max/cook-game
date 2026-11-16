import React, { useState } from 'react';
import { getDailySpecialForDay, getTargetOrdersForDay } from '../game/progression';
import { RECIPES } from '../game/recipes';
import type { GameMode, PersistentProgress } from '../game/types';
import { CoinSvg, CopperPanTitleLockup } from './DishIcons';

interface TitleScreenProps {
  mode: GameMode;
  progress: PersistentProgress;
  isMobile: boolean;
  isLandscapeMobile: boolean;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
  onOpenShop: () => void;
}

const TITLE_BG_SRC = '/src/assets/images/clay_bistro_title_bg_1794819813304.jpg';

export function TitleScreen({
  mode,
  progress,
  isMobile,
  isLandscapeMobile,
  onSelectMode,
  onStart,
  onOpenShop,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const dailySpecial = RECIPES[getDailySpecialForDay(progress.day)];
  const dayTarget = getTargetOrdersForDay(progress.day);

  return (
    <main className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-[#FDF4EB] flex flex-col justify-between">
      {!imgFailed ? (
        <img
          src={TITLE_BG_SRC}
          alt="Handcrafted matte clay diorama of a sunlit French patisserie kitchen with a copper skillet, brioche buns, strawberries, and avocado"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="fixed inset-0 w-full h-full object-cover object-right sm:object-center pointer-events-none"
        />
      ) : (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-[radial-gradient(circle_at_75%_40%,#FCD5C4_0%,#FCE8DB_52%,#FDF4EB_100%)] pointer-events-none"
        />
      )}

      {/* Soft warm cream-peach protection scrim on the left & mobile */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 pointer-events-none ${
          isMobile && !isLandscapeMobile
            ? 'bg-[#FDF4EB]/82'
            : 'bg-gradient-to-r from-[#FDF4EB]/96 via-[#FDF4EB]/74 to-transparent'
        }`}
      />
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FDF4EB]/92 to-transparent pointer-events-none"
      />

      <div
        className={`relative z-10 flex-1 flex items-center ${
          isLandscapeMobile ? 'px-7 py-3' : 'px-5 sm:px-14 lg:px-20 py-4'
        }`}
      >
        <div
          className={`w-full flex flex-col items-start ${
            isLandscapeMobile ? 'max-w-lg gap-2.5' : 'max-w-md gap-5'
          }`}
        >
          <CopperPanTitleLockup />

          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#6E5245] font-semibold flex-wrap">
            <span>Day {progress.day}</span>
            <span aria-hidden="true">·</span>
            <span>Special: {dailySpecial.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono-num tabular-nums text-[#3D2921]">
              <CoinSvg className="w-3.5 h-3.5" />
              {progress.coins}
            </span>
          </div>

          <p
            className={`text-[#4F372D] font-medium ${
              isLandscapeMobile
                ? 'text-xs leading-snug max-w-[46ch]'
                : 'text-sm sm:text-[17px] leading-relaxed max-w-[38ch]'
            }`}
          >
            Chop fresh produce &amp; berries, sear to the golden sweet spot, plate signature dishes, and earn Bistro Coins to customize your cozy clay kitchen.
          </p>

          <div
            role="group"
            aria-label="Service mode"
            className={`clay-inset inline-flex items-center gap-1.5 max-w-full ${
              isLandscapeMobile ? 'p-1' : 'p-1.5'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectMode('shift')}
              className={`px-3 sm:px-3.5 ${
                isLandscapeMobile ? 'py-1.5 text-xs' : 'py-2 text-xs sm:text-sm'
              } rounded-xl font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                mode === 'shift'
                  ? 'clay-btn bg-[#C94136] text-white'
                  : 'text-[#6E5245] hover:text-[#3D2921]'
              }`}
            >
              {isMobile && !isLandscapeMobile
                ? `Day ${progress.day} (${dayTarget})`
                : `Day ${progress.day} Shift (${dayTarget} Orders)`}
            </button>
            <button
              type="button"
              onClick={() => onSelectMode('endless')}
              className={`px-3 sm:px-3.5 ${
                isLandscapeMobile ? 'py-1.5 text-xs' : 'py-2 text-xs sm:text-sm'
              } rounded-xl font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                mode === 'endless'
                  ? 'clay-btn bg-[#C94136] text-white'
                  : 'text-[#6E5245] hover:text-[#3D2921]'
              }`}
            >
              Endless Rush
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-0.5 w-full sm:w-auto">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className={`clay-btn flex-1 sm:flex-initial ${
                isLandscapeMobile ? 'px-5 py-2.5 text-sm' : 'px-6 sm:px-7 py-3.5 text-base'
              } rounded-2xl bg-[#C94136] hover:bg-[#B8372D] text-white font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3D2921]`}
            >
              Start Service
            </button>

            <button
              type="button"
              onClick={onOpenShop}
              className={`clay-btn-soft flex-1 sm:flex-initial ${
                isLandscapeMobile ? 'px-4 py-2.5 text-xs' : 'px-4 sm:px-5 py-3.5 text-sm sm:text-base'
              } rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] font-bold whitespace-nowrap shrink-0 cursor-pointer`}
            >
              Upgrades &amp; Style
            </button>

            {progress.bestScore > 0 && (
              <div className="flex flex-col pl-1">
                <span className="text-xs font-semibold text-[#6E5245]">Best Score</span>
                <span className="font-mono-num text-lg sm:text-xl font-bold text-[#3D2921] tabular-nums">
                  {progress.bestScore}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer
        className={`relative z-10 ${
          isLandscapeMobile ? 'px-7 pb-2.5' : 'px-5 sm:px-14 lg:px-20 pb-5'
        }`}
      >
        {isMobile ? (
          <p className="text-xs text-[#6E5245] font-medium">
            Drag joystick or tap stations · Tap Cook to prep &amp; serve
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-[#6E5245] font-medium tracking-wide">
            WASD / Arrows Move · Space / E Interact · Shift Dash · Esc Pause · M Mute
          </p>
        )}
      </footer>
    </main>
  );
}

import React, { useState } from 'react';
import { getUnclaimedMissionCount } from '../game/missions';
import {
  getDailySpecialForDay,
  getUpgradeCost,
  KITCHEN_THEMES,
  UPGRADE_CATALOG,
} from '../game/progression';
import { RECIPES } from '../game/recipes';
import type { GameMode, MatchDurationSeconds, PersistentProgress } from '../game/types';
import type { ShopTab } from './BistroShopModal';
import { CoinSvg, CopperPanTitleLockup, IngredientSvg } from './DishIcons';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleScreenProps {
  mode: GameMode;
  durationSeconds: MatchDurationSeconds;
  progress: PersistentProgress;
  isMobile: boolean;
  isLandscapeMobile: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectDuration: (seconds: MatchDurationSeconds) => void;
  onStart: () => void;
  onOpenShop: (tab?: ShopTab) => void;
}

const TITLE_BG_SRC = '/src/assets/images/clay_bistro_title_bg_1794819813304.jpg';

const DURATION_OPTIONS: { value: MatchDurationSeconds; label: string }[] = [
  { value: 30, label: '30s' },
  { value: 60, label: '1 Min' },
  { value: 90, label: '90s' },
];

export function TitleScreen({
  mode,
  durationSeconds,
  progress,
  isMobile,
  isLandscapeMobile,
  onSelectMode,
  onSelectDuration,
  onStart,
  onOpenShop,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const dailySpecial = RECIPES[getDailySpecialForDay(progress.day)];
  const activeTheme = KITCHEN_THEMES[progress.selectedTheme] ?? KITCHEN_THEMES.copper;
  const hasAffordableUpgrade = UPGRADE_CATALOG.some((u) => {
    const lvl = progress.upgrades[u.key] ?? 0;
    return lvl < u.maxLevel && progress.coins >= getUpgradeCost(u, lvl);
  });
  const unclaimedMissions = getUnclaimedMissionCount(progress.dailyMissions);
  const completedMissions = progress.dailyMissions.missions.filter((m) => m.completed).length;

  const ctaLabel = mode === 'challenge' ? 'Start Challenge' : 'Start Service';

  if (isMobile) {
    return (
      <main className="relative w-full h-full overflow-hidden bg-[#FDF4EB] flex flex-col justify-between select-none">
        {!imgFailed ? (
          <img
            src={TITLE_BG_SRC}
            alt="Handcrafted matte clay diorama of a sunlit French patisserie kitchen"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
              isLandscapeMobile ? 'object-right' : 'object-[76%_center]'
            }`}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_60%_35%,#FCD5C4_0%,#FCE8DB_55%,#FDF4EB_100%)] pointer-events-none"
          />
        )}

        <div
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none ${
            isLandscapeMobile
              ? 'bg-gradient-to-r from-[#FDF4EB] via-[#FDF4EB]/96 via-52% to-transparent'
              : 'bg-gradient-to-b from-[#FDF4EB]/82 via-[#FDF4EB]/22 to-[#FDF4EB]/95'
          }`}
        />

        {/* Top Mobile Game Resource Header */}
        <header
          className={`relative z-10 flex items-center justify-between gap-2 ${
            isLandscapeMobile ? 'px-4 pt-2.5' : 'px-3.5 pt-3.5'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div className="clay-card-sm bg-[#FFFBF7] px-2.5 py-1.5 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#C94136]" aria-hidden="true" />
              <span className="font-display font-bold text-xs text-[#3D2921]">
                Best {progress.bestServed} Served
              </span>
            </div>

            {progress.challengeWins > 0 && (
              <div className="clay-card-sm bg-[#FAF5FF] px-2.5 py-1.5 flex items-center gap-1">
                <span className="font-mono-num text-xs font-bold text-[#7E22CE] tabular-nums">
                  {progress.challengeWins}W
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <PWAInstallButton compact />

            <button
              type="button"
              onClick={() => onOpenShop('upgrades')}
              aria-label={`Bistro coins: ${progress.coins}. Open shop`}
              className="clay-btn-soft bg-[#FFFBF7] hover:bg-[#FFF3E8] px-2.5 py-1.5 rounded-2xl flex items-center gap-1.5 cursor-pointer"
            >
              <CoinSvg className="w-4 h-4 shrink-0" />
              <span className="font-mono-num text-xs font-bold text-[#B45309] tabular-nums">
                {progress.coins}
              </span>
              <span className="w-4 h-4 rounded-full bg-[#C94136] text-white text-[11px] font-bold leading-none flex items-center justify-center">
                +
              </span>
            </button>
          </div>
        </header>

        {isLandscapeMobile ? (
          /* Landscape Phone Game Lobby */
          <div className="relative z-10 flex-1 flex items-center justify-between gap-4 px-5 pb-3 pt-1">
            <div className="flex flex-col items-start gap-2 max-w-[50%]">
              <div className="flex items-center gap-2.5">
                <div className="clay-card-sm bg-[#FFFBF7] px-2.5 py-1.5">
                  <svg viewBox="0 0 88 52" className="w-11 h-7" aria-hidden="true">
                    <path d="M6 28 L27 32 L26 37 L5 33 Z" fill="#A96B47" stroke="#3D2921" strokeWidth="2.4" />
                    <ellipse cx="52" cy="34" rx="28" ry="12" fill="#E37752" stroke="#3D2921" strokeWidth="2.4" />
                    <ellipse cx="52" cy="32" rx="23" ry="8.5" fill="#4A332A" />
                    <ellipse cx="49" cy="32" rx="9" ry="5.5" fill="#FFFDF9" />
                    <circle cx="51" cy="31.5" r="3.4" fill="#FBBF24" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-display text-3xl font-bold text-[#3D2921] leading-none">
                    Copper Pan
                  </h1>
                  <p className="text-[11px] font-semibold text-[#6E5245] mt-0.5">
                    {activeTheme.name} · Special: {dailySpecial.shortName}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div
                  role="group"
                  aria-label="Game mode"
                  className="clay-inset inline-flex items-center gap-1 p-1"
                >
                  <button
                    type="button"
                    onClick={() => onSelectMode('solo')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      mode === 'solo' ? 'clay-btn bg-[#C94136] text-white' : 'text-[#6E5245]'
                    }`}
                  >
                    Solo Rush
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectMode('challenge')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      mode === 'challenge' ? 'clay-btn bg-[#7E22CE] text-white' : 'text-[#6E5245]'
                    }`}
                  >
                    VS Bot
                  </button>
                </div>

                <div
                  role="group"
                  aria-label="Match timer"
                  className="clay-inset inline-flex items-center gap-1 p-1"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onSelectDuration(opt.value)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                        durationSeconds === opt.value
                          ? 'clay-btn bg-[#3D2921] text-white'
                          : 'text-[#6E5245]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="clay-card bg-[#FFFBF7]/94 p-3 flex flex-col gap-2.5 w-[44%] max-w-[290px]">
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className={`clay-btn w-full py-2.5 rounded-2xl text-white font-display text-base font-bold flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'challenge'
                    ? 'bg-[#7E22CE] hover:bg-[#6B21A8]'
                    : 'bg-[#C94136] hover:bg-[#B8372D]'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M7 5 L19 12 L7 19 Z" />
                </svg>
                {ctaLabel}
              </button>

              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenShop('missions')}
                  className="clay-btn-soft relative rounded-xl bg-[#FFF6EC] py-2 px-1 flex flex-col items-center gap-0.5 text-[10px] font-bold text-[#3D2921] cursor-pointer whitespace-nowrap"
                >
                  {unclaimedMissions > 0 && (
                    <span className="absolute top-1 right-1 px-1 rounded-full bg-[#16A34A] text-white text-[8px] font-bold leading-tight">
                      {unclaimedMissions}
                    </span>
                  )}
                  <span>Missions</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenShop('upgrades')}
                  className="clay-btn-soft relative rounded-xl bg-[#FFF6EC] py-2 px-1 flex flex-col items-center gap-0.5 text-[10px] font-bold text-[#3D2921] cursor-pointer whitespace-nowrap"
                >
                  {hasAffordableUpgrade && (
                    <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-[#F59E0B]" />
                  )}
                  <span>Upgrades</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenShop('themes')}
                  className="clay-btn-soft rounded-xl bg-[#FFF6EC] py-2 px-1 flex flex-col items-center gap-0.5 text-[10px] font-bold text-[#3D2921] cursor-pointer whitespace-nowrap"
                >
                  <span>Themes</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenShop('recipes')}
                  className="clay-btn-soft rounded-xl bg-[#FFF6EC] py-2 px-1 flex flex-col items-center gap-0.5 text-[10px] font-bold text-[#3D2921] cursor-pointer whitespace-nowrap"
                >
                  <span>Recipes</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Portrait Phone Mobile Game Lobby */
          <>
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-2 text-center">
              <div className="clay-card bg-[#FFFBF7]/94 px-6 py-4 flex flex-col items-center gap-2 max-w-[310px]">
                <div className="clay-inset px-3.5 py-2 inline-flex items-center justify-center">
                  <svg viewBox="0 0 88 52" className="w-16 h-10" aria-hidden="true">
                    <path d="M36 16 C33 11, 40 7, 36 2" fill="none" stroke="#E3574B" strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
                    <path d="M48 14 C45 9, 52 5, 48 1" fill="none" stroke="#F59E0B" strokeWidth="2.6" strokeLinecap="round" opacity="0.75" />
                    <path d="M59 17 C57 12, 62 8, 59 3" fill="none" stroke="#E3574B" strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
                    <path d="M6 28 L27 32 L26 37 L5 33 Z" fill="#A96B47" stroke="#3D2921" strokeWidth="2.2" strokeLinejoin="round" />
                    <circle cx="9" cy="31" r="1.8" fill="#FEF3C7" />
                    <ellipse cx="52" cy="34" rx="28" ry="12" fill="#E37752" stroke="#3D2921" strokeWidth="2.4" />
                    <ellipse cx="52" cy="32" rx="23" ry="8.5" fill="#4A332A" />
                    <ellipse cx="49" cy="32" rx="9" ry="5.5" fill="#FFFDF9" />
                    <circle cx="51" cy="31.5" r="3.4" fill="#FBBF24" />
                  </svg>
                </div>

                <h1 className="font-display text-4xl font-bold tracking-tight text-[#3D2921] leading-none">
                  Copper Pan
                </h1>

                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/40 px-3 py-1">
                  <div className="flex items-center -space-x-1">
                    {dailySpecial.steps.map((s, idx) => (
                      <IngredientSvg key={idx} base={s.base} className="w-3.5 h-3.5" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-[#92400E]">
                    Special: {dailySpecial.shortName} (+35%)
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Thumb-Friendly Mobile Game Control Dock */}
            <section className="relative z-10 px-3.5 pb-4">
              <div className="clay-card bg-[#FFFBF7]/96 p-3.5 flex flex-col gap-2.5">
                <div
                  role="group"
                  aria-label="Game mode"
                  className="clay-inset grid grid-cols-2 gap-1.5 p-1"
                >
                  <button
                    type="button"
                    onClick={() => onSelectMode('solo')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      mode === 'solo' ? 'clay-btn bg-[#C94136] text-white' : 'text-[#6E5245]'
                    }`}
                  >
                    Solo Rush
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectMode('challenge')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      mode === 'challenge' ? 'clay-btn bg-[#7E22CE] text-white' : 'text-[#6E5245]'
                    }`}
                  >
                    Bot Challenge
                  </button>
                </div>

                <div
                  role="group"
                  aria-label="Match timer"
                  className="clay-inset grid grid-cols-3 gap-1.5 p-1"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onSelectDuration(opt.value)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                        durationSeconds === opt.value
                          ? 'clay-btn bg-[#3D2921] text-white'
                          : 'text-[#6E5245]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  data-start="true"
                  onClick={onStart}
                  className={`clay-btn w-full h-12 rounded-2xl text-white font-display text-lg font-bold tracking-wide flex items-center justify-center gap-2 cursor-pointer ${
                    mode === 'challenge'
                      ? 'bg-[#7E22CE] hover:bg-[#6B21A8]'
                      : 'bg-[#C94136] hover:bg-[#B8372D]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                    <path d="M7 5 L19 12 L7 19 Z" />
                  </svg>
                  {ctaLabel}
                </button>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenShop('missions')}
                    className="clay-btn-soft relative rounded-2xl bg-[#FFF6EC] hover:bg-[#FFF0DF] py-2 px-1 flex flex-col items-center gap-1 text-[#3D2921] cursor-pointer"
                  >
                    {unclaimedMissions > 0 && (
                      <span
                        aria-label={`${unclaimedMissions} mission rewards ready`}
                        className="absolute top-1 right-1.5 px-1 rounded-full bg-[#16A34A] text-white text-[9px] font-bold leading-tight"
                      >
                        {unclaimedMissions}
                      </span>
                    )}
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#16A34A]" aria-hidden="true">
                      <path
                        d="M9 12 L11 14 L15.5 9.5 M6 4 H18 A2 2 0 0 1 20 6 V18 A2 2 0 0 1 18 20 H6 A2 2 0 0 1 4 18 V6 A2 2 0 0 1 6 4 Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-[10px] font-bold leading-none whitespace-nowrap">Missions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenShop('upgrades')}
                    className="clay-btn-soft relative rounded-2xl bg-[#FFF6EC] hover:bg-[#FFF0DF] py-2 px-1 flex flex-col items-center gap-1 text-[#3D2921] cursor-pointer"
                  >
                    {hasAffordableUpgrade && (
                      <span
                        aria-label="Upgrade available"
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F59E0B]"
                      />
                    )}
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#C94136]" aria-hidden="true">
                      <path d="M12 4 V20 M5 11 L12 4 L19 11" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[10px] font-bold leading-none whitespace-nowrap">Upgrades</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenShop('themes')}
                    className="clay-btn-soft rounded-2xl bg-[#FFF6EC] hover:bg-[#FFF0DF] py-2 px-1 flex flex-col items-center gap-1 text-[#3D2921] cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#D97706]" aria-hidden="true">
                      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
                      <circle cx="9.5" cy="10" r="1.4" fill="currentColor" />
                      <circle cx="14.5" cy="10" r="1.4" fill="currentColor" />
                      <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
                    </svg>
                    <span className="text-[10px] font-bold leading-none whitespace-nowrap">Themes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenShop('recipes')}
                    className="clay-btn-soft rounded-2xl bg-[#FFF6EC] hover:bg-[#FFF0DF] py-2 px-1 flex flex-col items-center gap-1 text-[#3D2921] cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#15803D]" aria-hidden="true">
                      <rect x="5" y="4" width="14" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
                      <path d="M9 9 H15 M9 13 H15 M9 17 H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="text-[10px] font-bold leading-none whitespace-nowrap">Recipes</span>
                  </button>
                </div>

                <p className="text-[11px] text-center text-[#6E5245] font-medium leading-tight">
                  {mode === 'challenge'
                    ? 'Out-serve Rival Chef Coco before the clock runs out!'
                    : 'Serve as many customers as you can before time expires!'}
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#FDF4EB]">
      {!imgFailed ? (
        <img
          src={TITLE_BG_SRC}
          alt="Handcrafted matte clay diorama of a sunlit French patisserie kitchen with a copper skillet, brioche buns, strawberries, and avocado"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-right sm:object-center pointer-events-none"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_75%_40%,#FCD5C4_0%,#FCE8DB_52%,#FDF4EB_100%)] pointer-events-none"
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#FDF4EB] via-[#FDF4EB]/96 via-52% to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FDF4EB]/92 to-transparent pointer-events-none"
      />

      <div className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col justify-between">
      <div className="flex-1 flex items-center px-5 sm:px-14 lg:px-20 py-4">
        <div className="w-full flex flex-col items-start max-w-md gap-4">
          <CopperPanTitleLockup />

          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#6E5245] font-semibold flex-wrap">
            <span>Special: {dailySpecial.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono-num tabular-nums text-[#3D2921]">
              <CoinSvg className="w-3.5 h-3.5" />
              {progress.coins}
            </span>
            {progress.challengeWins > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#7E22CE] font-bold">
                  {progress.challengeWins} Bot {progress.challengeWins === 1 ? 'Win' : 'Wins'}
                </span>
              </>
            )}
          </div>

          <p className="text-[#4F372D] font-medium text-sm sm:text-[16px] leading-relaxed max-w-[38ch]">
            {mode === 'challenge'
              ? 'Race head-to-head against Rival Chef Coco in the same kitchen! Cook, plate, and serve more customers before the timer runs out.'
              : 'Beat the clock! Chop fresh ingredients, sear to the golden sweet spot, and serve as many customers as you can before time expires.'}
          </p>

          {/* Mode + Match Timer Selectors */}
          <div className="flex flex-col gap-2.5 w-full">
            <div
              role="group"
              aria-label="Game mode"
              className="clay-inset inline-flex items-center gap-1.5 self-start p-1.5"
            >
              <button
                type="button"
                onClick={() => onSelectMode('solo')}
                className={`px-4 py-2 text-xs sm:text-sm rounded-xl font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  mode === 'solo'
                    ? 'clay-btn bg-[#C94136] text-white'
                    : 'text-[#6E5245] hover:text-[#3D2921]'
                }`}
              >
                Solo Rush
              </button>
              <button
                type="button"
                onClick={() => onSelectMode('challenge')}
                className={`px-4 py-2 text-xs sm:text-sm rounded-xl font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  mode === 'challenge'
                    ? 'clay-btn bg-[#7E22CE] text-white'
                    : 'text-[#6E5245] hover:text-[#3D2921]'
                }`}
              >
                Bot Challenge (VS Coco)
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-[#6E5245] uppercase tracking-wider">
                Timer
              </span>
              <div
                role="group"
                aria-label="Match timer"
                className="clay-inset inline-flex items-center gap-1 p-1"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelectDuration(opt.value)}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                      durationSeconds === opt.value
                        ? 'clay-btn bg-[#3D2921] text-white'
                        : 'text-[#6E5245] hover:text-[#3D2921]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1 w-auto">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className={`clay-btn px-7 py-3.5 text-base rounded-2xl text-white font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3D2921] ${
                mode === 'challenge'
                  ? 'bg-[#7E22CE] hover:bg-[#6B21A8]'
                  : 'bg-[#C94136] hover:bg-[#B8372D]'
              }`}
            >
              {ctaLabel}
            </button>

            <button
              type="button"
              onClick={() => onOpenShop('missions')}
              className="clay-btn-soft px-4 py-3.5 text-sm sm:text-base rounded-2xl bg-[#FFF6E5] hover:bg-[#FFEDD0] text-[#3D2921] font-bold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2"
            >
              <span>Daily Missions</span>
              <span
                className={`font-mono-num text-xs font-bold tabular-nums ${
                  unclaimedMissions > 0 ? 'text-[#15803D]' : 'text-[#6E5245]'
                }`}
              >
                {unclaimedMissions > 0 ? `${unclaimedMissions} Ready` : `${completedMissions}/3`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenShop('upgrades')}
              className="clay-btn-soft px-5 py-3.5 text-sm sm:text-base rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Upgrades &amp; Style
            </button>

            <PWAInstallButton />

            {progress.bestScore > 0 && (
              <div className="flex flex-col pl-1">
                <span className="text-xs font-semibold text-[#6E5245]">Best Score</span>
                <span className="font-mono-num text-xl font-bold text-[#3D2921] tabular-nums">
                  {progress.bestScore}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="px-5 sm:px-14 lg:px-20 pb-5">
        <p className="text-xs sm:text-sm text-[#6E5245] font-medium tracking-wide">
          Click stations to cook · Click customers to serve · Optional: WASD / Arrows · Shift Dash
        </p>
      </footer>
      </div>
    </main>
  );
}

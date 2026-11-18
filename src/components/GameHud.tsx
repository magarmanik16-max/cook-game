import React from 'react';
import { RECIPES } from '../game/recipes';
import { URGENT_ALARM_SECONDS } from '../game/rules';
import type { DishId, GameMode, MatchDurationSeconds, OrderTicket } from '../game/types';
import {
  CoinSvg,
  IngredientSvg,
  PauseIconSvg,
  RestartIconSvg,
  SoundIconSvg,
} from './DishIcons';

export interface HudState {
  durationSeconds: MatchDurationSeconds;
  timeRemaining: number;
  score: number;
  coinsEarned: number;
  combo: number;
  comboTimer: number;
  comboMaxWindow: number;
  ordersServed: number;
  botOrdersServed: number;
  botScore: number;
  mode: GameMode;
  wave: number;
  tickets: OrderTicket[];
  heldDishId: DishId | null;
  heldLabel: string | null;
  actionHint: string | null;
  statusBanner: string | null;
}

interface GameHudProps {
  hud: HudState;
  muted: boolean;
  isMobile: boolean;
  isLandscapeMobile: boolean;
  onToggleMute: () => void;
  onOpenRecipes: () => void;
  onPause: () => void;
  onRestart: () => void;
}

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getPrepBadge(prep: 'ready' | 'chop' | 'sear' | 'chop_sear'): {
  text: string;
  cls: string;
} {
  switch (prep) {
    case 'chop':
      return { text: 'Chop', cls: 'bg-[#15803D] text-white' };
    case 'sear':
      return { text: 'Sear', cls: 'bg-[#C2410C] text-white' };
    case 'chop_sear':
      return { text: 'Chop+Fry', cls: 'bg-[#B45309] text-white' };
    default:
      return { text: 'Plate', cls: 'bg-[#EAD8C8] text-[#5C4034]' };
  }
}

export function GameHud({
  hud,
  muted,
  isMobile,
  isLandscapeMobile,
  onToggleMute,
  onOpenRecipes,
  onPause,
  onRestart,
}: GameHudProps) {
  const isFinalCountdown = hud.timeRemaining > 0 && hud.timeRemaining <= 10;
  const hasCriticalOrder =
    isFinalCountdown || hud.tickets.some((t) => t.patience <= URGENT_ALARM_SECONDS);
  const isHighCombo = hud.combo >= 3;
  const isSuperCombo = hud.combo >= 5;
  const comboMultiplier = Math.min(3.0, 1 + Math.max(0, hud.combo - 1) * 0.25);
  const comboTimerRatio =
    hud.combo >= 2 && hud.comboMaxWindow > 0
      ? Math.max(0, Math.min(1, hud.comboTimer / hud.comboMaxWindow))
      : 0;
  const comboTierTitle =
    hud.combo >= 7
      ? 'UNSTOPPABLE!'
      : hud.combo >= 5
        ? 'MASTER CHEF!'
        : hud.combo >= 4
          ? 'SIZZLING!'
          : 'ON FIRE!';
  const isPortraitMobile = isMobile && !isLandscapeMobile;
  const isChallenge = hud.mode === 'challenge';

  const priorityTicket =
    hud.tickets.length > 0
      ? hud.tickets.reduce((best, cur) => (cur.patience < best.patience ? cur : best), hud.tickets[0])
      : null;
  const priorityRecipe = priorityTicket ? RECIPES[priorityTicket.dishId] : null;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-10 flex flex-col justify-between ${
        isLandscapeMobile ? 'px-3 py-1.5' : 'p-2 sm:p-4'
      }`}
    >
      {/* Subtle Screen-Edge Urgent Alarm Vignette OR Warm Golden High-Combo Glow */}
      {hasCriticalOrder ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none shadow-[inset_0_0_54px_rgba(225,29,72,0.32)] animate-pulse"
        />
      ) : hud.combo >= 4 ? (
        <div
          aria-hidden="true"
          data-testid="combo-vignette"
          className={`fixed inset-0 pointer-events-none anim-combo-edge ${
            isSuperCombo
              ? 'shadow-[inset_0_0_72px_rgba(245,158,11,0.42)]'
              : 'shadow-[inset_0_0_52px_rgba(234,88,12,0.28)]'
          }`}
        />
      ) : null}

      {/* High-Combo Screen-Space Celebratory Flourish Banner (3x+ streaks) */}
      {isHighCombo && (
        <div
          key={`combo-flourish-${hud.combo}`}
          data-testid="combo-flourish"
          aria-live="polite"
          className={`fixed left-1/2 -translate-x-1/2 pointer-events-none z-20 ${
            isLandscapeMobile ? 'top-11' : isPortraitMobile ? 'top-14' : 'top-20'
          }`}
        >
          <div
            className={`anim-combo-banner clay-card-sm px-3.5 sm:px-4 py-1.5 flex items-center gap-2 border-2 ${
              isSuperCombo
                ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#78350F]'
                : 'bg-[#FFF4EB] border-[#E3574B] text-[#9A3412]'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 anim-combo-star text-[#F59E0B]"
              aria-hidden="true"
            >
              <path
                d="M12 2 L14.8 8.2 L21.5 9 L16.5 13.6 L17.9 20.3 L12 17 L6.1 20.3 L7.5 13.6 L2.5 9 L9.2 8.2 Z"
                fill="currentColor"
                stroke="#B45309"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-display font-bold text-xs sm:text-sm whitespace-nowrap tracking-wide">
              {hud.combo}x {comboTierTitle}
            </span>
            <span className="font-mono-num text-[11px] sm:text-xs font-bold tabular-nums opacity-85 whitespace-nowrap">
              {comboMultiplier.toFixed(2).replace(/\.00$/, '')}x pts
            </span>
          </div>
        </div>
      )}

      {/* Top Perimeter Row: Countdown Timer + Score / VS Bot Ledger + Utility Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-2.5 w-full">
        <div
          className={`clay-card-sm flex items-center bg-[#FFFBF7] min-w-0 ${
            isLandscapeMobile
              ? 'gap-2 px-2.5 py-1'
              : isMobile
                ? 'gap-1.5 px-2 py-1'
                : 'gap-3.5 px-3.5 py-2'
          }`}
        >
          {/* Countdown Match Timer */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
              Time
            </span>
            <span
              data-testid="hud-timer"
              className={`font-mono-num font-bold leading-tight tabular-nums mt-0.5 sm:mt-0 inline-flex items-center gap-0.5 ${
                isFinalCountdown ? 'text-[#C94136] animate-pulse' : 'text-[#3D2921]'
              } ${isLandscapeMobile ? 'text-sm' : isMobile ? 'text-xs' : 'text-xl'}`}
            >
              {formatClock(hud.timeRemaining)}
            </span>
          </div>

          {isChallenge ? (
            <>
              {/* Head-to-Head VS Bot Counter */}
              <div
                className={`flex flex-col items-end border-l border-[#EAD8C8] ${
                  isPortraitMobile ? 'pl-1.5' : 'pl-2 sm:pl-2.5'
                }`}
              >
                <span className="text-[9px] sm:text-[11px] font-bold text-[#C94136] leading-none whitespace-nowrap">
                  You
                </span>
                <span
                  data-testid="hud-orders"
                  className={`font-mono-num font-bold text-[#3D2921] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                    isLandscapeMobile ? 'text-sm' : isMobile ? 'text-xs' : 'text-xl'
                  }`}
                >
                  {hud.ordersServed}
                </span>
              </div>

              <div
                className={`flex flex-col items-end border-l border-[#EAD8C8] ${
                  isPortraitMobile ? 'pl-1.5' : 'pl-2 sm:pl-2.5'
                }`}
              >
                <span className="text-[9px] sm:text-[11px] font-bold text-[#7E22CE] leading-none whitespace-nowrap">
                  Coco
                </span>
                <span
                  data-testid="hud-bot-orders"
                  className={`font-mono-num font-bold text-[#7E22CE] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                    isLandscapeMobile ? 'text-sm' : isMobile ? 'text-xs' : 'text-xl'
                  }`}
                >
                  {hud.botOrdersServed}
                </span>
              </div>

              <div
                className={`flex flex-col items-end border-l border-[#EAD8C8] ${
                  isPortraitMobile ? 'pl-1.5' : 'pl-2 sm:pl-2.5'
                }`}
              >
                <span className="text-[9px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
                  Score
                </span>
                <span
                  data-testid="hud-score"
                  className={`font-mono-num font-bold text-[#3D2921] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                    isLandscapeMobile ? 'text-sm' : isMobile ? 'text-xs' : 'text-xl'
                  }`}
                >
                  {Math.round(hud.score)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div
                className={`flex flex-col items-end border-l border-[#EAD8C8] ${
                  isPortraitMobile ? 'pl-1.5' : 'pl-2 sm:pl-2.5'
                }`}
              >
                <span className="text-[9px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
                  Served
                </span>
                <span
                  data-testid="hud-orders"
                  className={`font-mono-num font-bold text-[#15803D] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                    isLandscapeMobile ? 'text-sm' : isMobile ? 'text-xs' : 'text-xl'
                  }`}
                >
                  {hud.ordersServed}
                </span>
              </div>

              <div
                className={`flex flex-col items-end border-l border-[#EAD8C8] ${
                  isPortraitMobile ? 'pl-1.5' : 'pl-2 sm:pl-2.5'
                }`}
              >
                <span className="text-[9px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
                  Score
                </span>
                <span
                  data-testid="hud-score"
                  className={`font-mono-num font-bold text-[#3D2921] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                    isLandscapeMobile ? 'text-sm' : isMobile ? 'text-xs' : 'text-xl'
                  }`}
                >
                  {Math.round(hud.score)}
                </span>
              </div>
            </>
          )}

          {!isPortraitMobile && (
            <div className="flex flex-col items-end border-l border-[#EAD8C8] pl-2 sm:pl-2.5">
              <span className="text-[9px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
                Coins
              </span>
              <span
                className={`font-mono-num font-bold text-[#B45309] leading-tight tabular-nums inline-flex items-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-0 ${
                  isLandscapeMobile ? 'text-sm' : 'text-lg'
                }`}
              >
                <CoinSvg className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {hud.coinsEarned}
              </span>
            </div>
          )}

          {hud.combo >= 2 && (
            <div
              className={`flex flex-col items-end border-l border-[#EAD8C8] ${
                isPortraitMobile ? 'pl-1.5' : 'pl-2 sm:pl-2.5'
              }`}
            >
              <span
                className={`text-[9px] sm:text-[11px] font-bold leading-none whitespace-nowrap ${
                  isSuperCombo ? 'text-[#B45309]' : 'text-[#C94136]'
                }`}
              >
                {isHighCombo ? 'Hot Streak' : 'Streak'}
              </span>
              <span
                data-testid="hud-combo"
                className={`font-mono-num font-bold leading-tight tabular-nums mt-0.5 sm:mt-0 inline-flex items-center gap-0.5 ${
                  isSuperCombo ? 'text-[#D97706]' : 'text-[#C94136]'
                } ${isLandscapeMobile ? 'text-sm' : isMobile ? 'text-xs' : 'text-xl'}`}
              >
                {hud.combo}x
              </span>
              <div className="w-8 sm:w-11 h-1 rounded-full bg-[#EAD8C8] overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full transition-transform duration-150 origin-left"
                  style={{
                    transform: `scaleX(${comboTimerRatio})`,
                    backgroundColor: isSuperCombo ? '#F59E0B' : '#E3574B',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Squishy Square-Rounded Clay Utility Buttons */}
        <div
          className={`flex items-center pointer-events-auto shrink-0 ${
            isMobile ? 'gap-1' : 'gap-1.5'
          }`}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Open Recipe Book"
            title="Recipe Book (pauses timers)"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenRecipes();
            }}
            className={`clay-btn-soft rounded-xl sm:rounded-2xl bg-[#FFF7E6] hover:bg-[#FFEDD0] text-[#3D2921] flex items-center justify-center gap-1.5 font-bold cursor-pointer ${
              isLandscapeMobile
                ? 'h-8 px-2.5 text-[11px]'
                : isMobile
                  ? 'w-8 h-8'
                  : 'h-9 px-3 text-xs'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#C94136] shrink-0" aria-hidden="true">
              <rect
                x="4.5"
                y="3.5"
                width="15"
                height="17"
                rx="2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
              />
              <path
                d="M8.5 8.5 H15.5 M8.5 12.5 H15.5 M8.5 16.5 H12.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {!isMobile && <span>Recipes</span>}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
            title={muted ? 'Unmute (M)' : 'Mute (M)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className={`clay-btn-soft rounded-xl sm:rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] flex items-center justify-center cursor-pointer ${
              isMobile ? 'w-8 h-8' : 'w-9 h-9'
            }`}
          >
            <SoundIconSvg muted={muted} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause game (P)"
            title="Pause (P / Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className={`clay-btn-soft rounded-xl sm:rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] flex items-center justify-center cursor-pointer ${
              isMobile ? 'w-8 h-8' : 'w-9 h-9'
            }`}
          >
            <PauseIconSvg />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Restart match (R)"
            title="Restart (R)"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className={`clay-btn-soft rounded-xl sm:rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] flex items-center justify-center cursor-pointer ${
              isMobile ? 'w-8 h-8' : 'w-9 h-9'
            }`}
          >
            <RestartIconSvg />
          </button>
        </div>
      </div>

      {/* Bottom Contextual Clay Prompt & Live Visual Recipe Strip */}
      <div
        className={`flex items-center justify-center w-full ${
          isPortraitMobile ? 'pb-4 pl-[74px] pr-2' : 'pb-0.5 px-2'
        }`}
      >
        <div
          className={`clay-card-sm bg-[#FFFBF7] text-[#3D2921] flex items-center gap-1.5 whitespace-nowrap max-w-full overflow-hidden font-medium ${
            isLandscapeMobile ? 'px-3 py-1 text-[11px]' : 'px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm'
          }`}
        >
          {hud.statusBanner ? (
            <span className="font-bold text-[#C94136] truncate">{hud.statusBanner}</span>
          ) : hud.heldDishId ? (
            <span className="font-bold text-[#15803D] truncate">
              {isMobile
                ? 'Tap the matching customer to serve!'
                : 'Click the matching customer to serve!'}
            </span>
          ) : hud.actionHint ? (
            <span className="truncate">
              <span className="font-semibold">{hud.actionHint}</span>
              {hud.heldLabel && !isMobile ? (
                <span className="text-[#6E5245]"> · {hud.heldLabel}</span>
              ) : null}
            </span>
          ) : priorityRecipe ? (
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <span className="font-display font-bold text-[#3D2921] shrink-0">
                {priorityRecipe.shortName}:
              </span>
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                {priorityRecipe.steps.map((step, idx) => {
                  const badge = getPrepBadge(step.prep);
                  return (
                    <span
                      key={`${priorityRecipe.id}-${idx}`}
                      className="inline-flex items-center gap-1 shrink-0"
                    >
                      {idx > 0 && <span className="text-[#9C7F6E] font-bold">+</span>}
                      <IngredientSvg base={step.base} className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${badge.cls}`}
                      >
                        {badge.text}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <span className="text-[#6E5245] truncate">
              {hud.heldLabel
                ? `Holding: ${hud.heldLabel}`
                : isMobile
                  ? 'Tap stations to cook · Tap customers to serve'
                  : 'Click stations to cook · Click customers to serve'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { RECIPES } from '../game/recipes';
import { URGENT_ALARM_SECONDS } from '../game/rules';
import type { DishId, GameMode, OrderTicket } from '../game/types';
import {
  CoinSvg,
  IngredientSvg,
  PauseIconSvg,
  RestartIconSvg,
  SoundIconSvg,
  StarSocketSvg,
} from './DishIcons';

export interface HudState {
  day: number;
  score: number;
  coinsEarned: number;
  combo: number;
  ordersServed: number;
  targetOrders: number;
  mode: GameMode;
  stars: number;
  maxStars: number;
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
  onPause: () => void;
  onRestart: () => void;
}

function getPrepVerb(prep: 'ready' | 'chop' | 'sear' | 'chop_sear'): string {
  switch (prep) {
    case 'chop':
      return 'Chop';
    case 'sear':
      return 'Sear';
    case 'chop_sear':
      return 'Chop+Fry';
    default:
      return '';
  }
}

export function GameHud({
  hud,
  muted,
  isMobile,
  isLandscapeMobile,
  onToggleMute,
  onPause,
  onRestart,
}: GameHudProps) {
  const hasCriticalOrder = hud.tickets.some((t) => t.patience <= URGENT_ALARM_SECONDS);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-10 flex flex-col justify-between ${
        isLandscapeMobile ? 'px-3 py-1.5' : 'p-2 sm:p-4'
      }`}
    >
      {/* Subtle Screen-Edge Urgent Alarm Vignette */}
      {hasCriticalOrder && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none shadow-[inset_0_0_54px_rgba(225,29,72,0.32)] animate-pulse"
        />
      )}

      {/* Top Perimeter Row: Responsive stack on portrait mobile, split row on landscape/desktop */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 w-full">
        {/* Puffy Clay Order Ticket Rail */}
        <div
          aria-label="Active customer orders"
          className="no-scrollbar flex items-start gap-2 overflow-x-auto w-full sm:w-auto sm:max-w-[58vw] pb-0.5 pointer-events-auto"
        >
          {hud.tickets.map((ticket) => {
            const recipe = RECIPES[ticket.dishId];
            const ratio = Math.max(0, Math.min(1, ticket.patience / ticket.maxPatience));
            const secsLeft = Math.max(0, Math.ceil(ticket.patience));
            const isUrgent = ticket.patience <= URGENT_ALARM_SECONDS;
            const isMatch = hud.heldDishId === ticket.dishId;

            const barColor =
              ratio > 0.55 ? '#22C55E' : !isUrgent ? '#F59E0B' : '#E11D48';

            const ticketSurface = isMatch
              ? 'bg-[#FFF3CC] -translate-y-0.5 ring-2 ring-[#F59E0B]'
              : isUrgent
                ? 'bg-[#FFE0E4] ring-2 ring-[#E11D48] animate-pulse'
                : ticket.isVip
                  ? 'bg-[#FFF5D6] ring-1 ring-[#F59E0B]/60'
                  : 'bg-[#FFFBF7]';

            return (
              <div
                key={ticket.id}
                className={`clay-card-sm shrink-0 ${
                  isLandscapeMobile
                    ? 'w-[132px] px-2 py-1 leading-tight'
                    : 'w-[156px] sm:w-44 px-2.5 sm:px-3 py-1.5 sm:py-2.5'
                } transition-transform duration-150 ${ticketSurface}`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#6E5245] tracking-wide whitespace-nowrap truncate">
                    Table {ticket.tableNumber}
                    {ticket.isVip ? ' · VIP' : ticket.isDailySpecial ? ' · Special' : ''}
                  </span>
                  <span
                    className={`font-mono-num text-[11px] sm:text-xs font-bold tabular-nums shrink-0 ${
                      isUrgent ? 'text-[#BE123C]' : 'text-[#3D2921]'
                    }`}
                  >
                    {isUrgent ? `${secsLeft}s!` : `${secsLeft}s`}
                  </span>
                </div>

                <div
                  className={`font-display font-bold text-[#3D2921] truncate ${
                    isLandscapeMobile ? 'text-[11px] mt-0' : 'text-xs sm:text-sm mt-0.5'
                  }`}
                >
                  {recipe.shortName}
                </div>

                {/* Recipe Step Icons */}
                <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1.5 flex-wrap">
                  {recipe.steps.map((step, idx) => {
                    const verb = getPrepVerb(step.prep);
                    return (
                      <div
                        key={`${ticket.id}-${idx}`}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#5C4034]"
                        title={step.label}
                      >
                        <IngredientSvg base={step.base} className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        {verb && <span className="leading-none">{verb}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Soft Clay Patience Progress Bar */}
                <div className="mt-1 sm:mt-1.5 h-1.5 sm:h-2 w-full rounded-full bg-[#EFE0D2] overflow-hidden p-[1px]">
                  <div
                    className="h-full rounded-full transition-[width] duration-150"
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Cluster: Clay Kitchen Ledger + Squishy Utility Buttons */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2.5 shrink-0 w-full sm:w-auto">
          <div
            className={`clay-card-sm flex items-center bg-[#FFFBF7] ${
              isLandscapeMobile ? 'gap-2 px-2.5 py-1' : 'gap-2 sm:gap-3.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2'
            }`}
          >
            <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
                Day {hud.day}
              </span>
              <span
                data-testid="hud-score"
                className={`font-mono-num font-bold text-[#3D2921] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                  isLandscapeMobile ? 'text-sm' : 'text-sm sm:text-xl'
                }`}
              >
                {Math.round(hud.score)}
              </span>
            </div>

            <div className="flex flex-col items-end border-l border-[#EAD8C8] pl-2 sm:pl-2.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
                Coins
              </span>
              <span
                className={`font-mono-num font-bold text-[#B45309] leading-tight tabular-nums inline-flex items-center gap-1 mt-0.5 sm:mt-0 ${
                  isLandscapeMobile ? 'text-sm' : 'text-sm sm:text-lg'
                }`}
              >
                <CoinSvg className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {hud.coinsEarned}
              </span>
            </div>

            {hud.combo >= 2 && (
              <div className="flex flex-col items-end border-l border-[#EAD8C8] pl-2 sm:pl-2.5">
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#C94136] leading-none whitespace-nowrap">
                  Streak
                </span>
                <span
                  className={`font-mono-num font-bold text-[#C94136] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                    isLandscapeMobile ? 'text-sm' : 'text-sm sm:text-xl'
                  }`}
                >
                  {hud.combo}x
                </span>
              </div>
            )}

            <div className="flex flex-col items-end border-l border-[#EAD8C8] pl-2 sm:pl-2.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#6E5245] leading-none whitespace-nowrap">
                Orders
              </span>
              <span
                data-testid="hud-orders"
                className={`font-mono-num font-bold text-[#3D2921] leading-tight tabular-nums mt-0.5 sm:mt-0 ${
                  isLandscapeMobile ? 'text-sm' : 'text-sm sm:text-xl'
                }`}
              >
                {hud.mode === 'shift'
                  ? `${hud.ordersServed}/${hud.targetOrders}`
                  : `${hud.ordersServed}`}
              </span>
            </div>

            <div
              className="flex items-center gap-0.5 border-l border-[#EAD8C8] pl-2 sm:pl-2.5 shrink-0"
              aria-label={`Kitchen stars: ${hud.stars} of ${hud.maxStars}`}
            >
              {Array.from({ length: hud.maxStars }, (_, i) => (
                <StarSocketSvg key={i} filled={i < hud.stars} />
              ))}
            </div>
          </div>

          {/* Squishy Square-Rounded Clay Utility Buttons */}
          <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className={`clay-btn-soft rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] flex items-center justify-center cursor-pointer ${
                isLandscapeMobile ? 'w-8 h-8' : 'w-9 h-9'
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
              className={`clay-btn-soft rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] flex items-center justify-center cursor-pointer ${
                isLandscapeMobile ? 'w-8 h-8' : 'w-9 h-9'
              }`}
            >
              <PauseIconSvg />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart shift (R)"
              title="Restart (R)"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className={`clay-btn-soft rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] flex items-center justify-center cursor-pointer ${
                isLandscapeMobile ? 'w-8 h-8' : 'w-9 h-9'
              }`}
            >
              <RestartIconSvg />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Contextual Clay Prompt (shifted above touch deck on portrait mobile) */}
      <div
        className={`flex items-center justify-center w-full ${
          isMobile && !isLandscapeMobile ? 'pb-[118px]' : 'pb-0.5'
        }`}
      >
        <div
          className={`clay-card-sm bg-[#FFFBF7] text-[#3D2921] flex items-center gap-2 whitespace-nowrap max-w-[94vw] truncate font-medium ${
            isLandscapeMobile ? 'px-3 py-1 text-[11px]' : 'px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm'
          }`}
        >
          {hud.statusBanner ? (
            <span className="font-bold text-[#C94136]">{hud.statusBanner}</span>
          ) : hud.actionHint ? (
            <span>
              {!isMobile && <span className="font-bold text-[#C94136]">[Space] </span>}
              <span className="font-semibold">{hud.actionHint}</span>
              {hud.heldLabel ? <span className="text-[#6E5245]"> · Holding: {hud.heldLabel}</span> : null}
            </span>
          ) : (
            <span className="text-[#6E5245]">
              {hud.heldLabel
                ? `Holding: ${hud.heldLabel}`
                : isMobile
                  ? 'Tap any station or drag joystick'
                  : 'Click any station or use WASD / Arrows'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

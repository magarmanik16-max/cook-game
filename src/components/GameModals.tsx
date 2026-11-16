import React from 'react';
import { ACHIEVEMENTS } from '../game/progression';
import type { GamePhase, RunStatsSnapshot } from '../game/types';
import { CoinSvg } from './DishIcons';

interface GameModalsProps {
  phase: GamePhase;
  stats: RunStatsSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onNextDay: () => void;
  onOpenShop: () => void;
  onReturnTitle: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GameModals({
  phase,
  stats,
  onResume,
  onRestart,
  onNextDay,
  onOpenShop,
  onReturnTitle,
}: GameModalsProps) {
  if (phase !== 'paused' && phase !== 'gameover') return null;

  const isPaused = phase === 'paused';
  const isVictory = phase === 'gameover' && stats.outcome === 'victory';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[#3D2921]/45"
    >
      <div className="clay-card w-full max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-7 flex flex-col gap-4 sm:gap-5 text-[#3D2921]">
        <div>
          <p className="text-xs font-bold tracking-wide text-[#C94136]">
            {isPaused
              ? 'Kitchen Paused'
              : isVictory
                ? `Day ${stats.day} Complete`
                : 'Shift Closed'}
          </p>
          <h2 id="modal-title" className="font-display text-2xl sm:text-3xl font-bold mt-0.5 sm:mt-1">
            {isPaused
              ? 'Take a Breather'
              : isVictory
                ? 'Bravo, Chef!'
                : 'Out of Kitchen Stars'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6E5245] mt-1 font-medium">
            {isPaused
              ? 'The burners are banked and customer timers are held.'
              : isVictory
                ? `You completed all ${stats.targetOrders} bistro orders in ${formatSeconds(stats.elapsedSeconds)}.`
                : 'Three tables walked out before their plates hit the pass.'}
          </p>
        </div>

        {/* Inset Clay Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="clay-inset px-3 py-2.5">
            <div className="text-xs font-semibold text-[#6E5245]">Score</div>
            <div className="font-mono-num text-xl font-bold text-[#3D2921] tabular-nums mt-0.5">
              {stats.score}
            </div>
          </div>

          <div className="clay-inset px-3 py-2.5">
            <div className="text-xs font-semibold text-[#6E5245]">Coins Earned</div>
            <div className="font-mono-num text-xl font-bold text-[#B45309] tabular-nums mt-0.5 inline-flex items-center gap-1">
              <CoinSvg className="w-4 h-4" />
              +{stats.coinsEarned}
            </div>
          </div>

          <div className="clay-inset px-3 py-2.5">
            <div className="text-xs font-semibold text-[#6E5245]">
              {isVictory ? 'Clear Time' : 'Orders'}
            </div>
            <div className="font-mono-num text-xl font-bold text-[#3D2921] tabular-nums mt-0.5">
              {isVictory
                ? formatSeconds(stats.elapsedSeconds)
                : stats.mode === 'shift'
                  ? `${stats.ordersServed}/${stats.targetOrders}`
                  : `${stats.ordersServed}`}
            </div>
          </div>
        </div>

        {/* Newly Unlocked Milestones */}
        {stats.newlyUnlockedAchievements.length > 0 && (
          <div className="clay-card-sm bg-[#E3F6EA] px-4 py-3">
            <div className="text-xs font-bold text-[#166534]">Milestones Unlocked</div>
            <div className="mt-1 space-y-0.5">
              {stats.newlyUnlockedAchievements.map((id) => {
                const def = ACHIEVEMENTS.find((a) => a.id === id);
                if (!def) return null;
                return (
                  <div key={id} className="text-xs font-semibold text-[#3D2921] flex items-center justify-between">
                    <span>{def.title}</span>
                    <span className="font-mono-num text-[#B45309]">+{def.coinReward}c</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Squishy Clay Actions */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 pt-1">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="clay-btn flex-1 px-5 py-2.5 rounded-2xl bg-[#C94136] hover:bg-[#B8372D] text-white font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Resume Service
            </button>
          ) : isVictory ? (
            <button
              type="button"
              data-start="true"
              onClick={onNextDay}
              className="clay-btn flex-1 px-5 py-2.5 rounded-2xl bg-[#C94136] hover:bg-[#B8372D] text-white font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Day {stats.day + 1}
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="clay-btn flex-1 px-5 py-2.5 rounded-2xl bg-[#C94136] hover:bg-[#B8372D] text-white font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Try Again
            </button>
          )}

          {isPaused ? (
            <button
              type="button"
              onClick={onRestart}
              className="clay-btn-soft px-4 py-2.5 rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Restart
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenShop}
              className="clay-btn-soft px-4 py-2.5 rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Upgrades &amp; Style
            </button>
          )}

          <button
            type="button"
            onClick={onReturnTitle}
            className="clay-btn-soft px-4 py-2.5 rounded-2xl bg-[#F3E5D8] hover:bg-[#EAD8C8] text-[#6E5245] font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { ACHIEVEMENTS } from '../game/progression';
import type { GamePhase, RunStatsSnapshot } from '../game/types';
import { CoinSvg } from './DishIcons';

interface GameModalsProps {
  phase: GamePhase;
  stats: RunStatsSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onOpenShop: () => void;
  onReturnTitle: () => void;
}

function formatDurationLabel(seconds: number): string {
  if (seconds === 60) return '1 Min';
  return `${seconds}s`;
}

export function GameModals({
  phase,
  stats,
  onResume,
  onRestart,
  onOpenShop,
  onReturnTitle,
}: GameModalsProps) {
  if (phase !== 'paused' && phase !== 'gameover') return null;

  const isPaused = phase === 'paused';
  const isChallenge = stats.mode === 'challenge';
  const isVictory = stats.outcome === 'victory';
  const isDraw = stats.outcome === 'draw';
  const durationLabel = formatDurationLabel(stats.durationSeconds);

  const kicker = isPaused
    ? 'Kitchen Paused'
    : isChallenge
      ? `${durationLabel} Bot Challenge`
      : `${durationLabel} Solo Rush`;

  const headline = isPaused
    ? 'Take a Breather'
    : isChallenge
      ? isVictory
        ? 'You Beat Chef Coco!'
        : isDraw
          ? "It's a Tie!"
          : 'Chef Coco Wins!'
      : "Time's Up!";

  const subtitle = isPaused
    ? 'The burners are banked and the match clock is paused.'
    : isChallenge
      ? isVictory
        ? `You out-served Chef Coco (${stats.ordersServed} vs ${stats.botOrdersServed} customers) in ${durationLabel}!`
        : isDraw
          ? `Dead heat! Both chefs served ${stats.ordersServed} customers with ${stats.score} points.`
          : `Chef Coco served ${stats.botOrdersServed} customers to your ${stats.ordersServed}. Ready for a rematch?`
      : `You served ${stats.ordersServed} ${stats.ordersServed === 1 ? 'customer' : 'customers'} and scored ${stats.score} points in ${durationLabel}.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[#3D2921]/45"
    >
      <div className="clay-card w-full max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-7 flex flex-col gap-4 sm:gap-5 text-[#3D2921]">
        <div>
          <p
            className={`text-xs font-bold tracking-wide ${
              isChallenge ? 'text-[#7E22CE]' : 'text-[#C94136]'
            }`}
          >
            {kicker}
          </p>
          <h2 id="modal-title" className="font-display text-2xl sm:text-3xl font-bold mt-0.5 sm:mt-1">
            {headline}
          </h2>
          <p className="text-xs sm:text-sm text-[#6E5245] mt-1 font-medium">{subtitle}</p>
        </div>

        {/* Head-to-Head VS Bot Comparison Card in Challenge Mode */}
        {isChallenge && !isPaused && (
          <div className="grid grid-cols-2 gap-2.5">
            <div
              className={`clay-inset px-3.5 py-3 flex flex-col gap-0.5 ${
                isVictory ? 'ring-2 ring-[#16A34A]' : ''
              }`}
            >
              <span className="text-[11px] font-bold text-[#C94136]">You (Chef Pip)</span>
              <span className="font-mono-num text-2xl font-bold text-[#3D2921] tabular-nums">
                {stats.ordersServed}{' '}
                <span className="text-xs font-semibold text-[#6E5245]">served</span>
              </span>
              <span className="font-mono-num text-xs font-semibold text-[#6E5245] tabular-nums">
                {stats.score} pts
              </span>
            </div>

            <div
              className={`clay-inset px-3.5 py-3 flex flex-col gap-0.5 ${
                stats.outcome === 'defeat' ? 'ring-2 ring-[#7E22CE]' : ''
              }`}
            >
              <span className="text-[11px] font-bold text-[#7E22CE]">Rival Chef Coco</span>
              <span className="font-mono-num text-2xl font-bold text-[#7E22CE] tabular-nums">
                {stats.botOrdersServed}{' '}
                <span className="text-xs font-semibold text-[#6E5245]">served</span>
              </span>
              <span className="font-mono-num text-xs font-semibold text-[#6E5245] tabular-nums">
                {stats.botScore} pts
              </span>
            </div>
          </div>
        )}

        {/* Inset Clay Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="clay-inset px-3 py-2.5">
            <div className="text-xs font-semibold text-[#6E5245]">Served</div>
            <div className="font-mono-num text-xl font-bold text-[#15803D] tabular-nums mt-0.5">
              {stats.ordersServed}
            </div>
          </div>

          <div className="clay-inset px-3 py-2.5">
            <div className="text-xs font-semibold text-[#6E5245]">Score</div>
            <div className="font-mono-num text-xl font-bold text-[#3D2921] tabular-nums mt-0.5">
              {stats.score}
            </div>
          </div>

          <div className="clay-inset px-3 py-2.5">
            <div className="text-xs font-semibold text-[#6E5245]">Coins</div>
            <div className="font-mono-num text-xl font-bold text-[#B45309] tabular-nums mt-0.5 inline-flex items-center gap-1">
              <CoinSvg className="w-4 h-4" />
              +{stats.coinsEarned}
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
                  <div
                    key={id}
                    className="text-xs font-semibold text-[#3D2921] flex items-center justify-between"
                  >
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
              Resume Match
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className={`clay-btn flex-1 px-5 py-2.5 rounded-2xl text-white font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer ${
                isChallenge
                  ? 'bg-[#7E22CE] hover:bg-[#6B21A8]'
                  : 'bg-[#C94136] hover:bg-[#B8372D]'
              }`}
            >
              {isChallenge ? 'Rematch Coco' : 'Play Again'}
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

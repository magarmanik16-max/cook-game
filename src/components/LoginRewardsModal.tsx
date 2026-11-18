import React from 'react';
import { getLoginRewardStatus, LOGIN_REWARD_SCHEDULE } from '../game/loginRewards';
import type { PersistentProgress } from '../game/types';
import { CoinSvg } from './DishIcons';

interface LoginRewardsModalProps {
  open: boolean;
  progress: PersistentProgress;
  onClaim: () => void;
  onClose: () => void;
}

export function LoginRewardsModal({
  open,
  progress,
  onClaim,
  onClose,
}: LoginRewardsModalProps) {
  if (!open) return null;

  const status = getLoginRewardStatus(progress.loginRewards);
  const regularDays = LOGIN_REWARD_SCHEDULE.slice(0, 6);
  const grandDay = LOGIN_REWARD_SCHEDULE[6];

  const isDayClaimed = (dayNum: number) => dayNum <= status.claimedCountInCycle;
  const isTodayTarget = (dayNum: number) => status.canClaimToday && dayNum === status.activeDay;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-rewards-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-[#3D2921]/45"
    >
      <div className="clay-card w-full max-w-lg max-h-[92vh] p-4 sm:p-6 flex flex-col gap-3.5 text-[#3D2921] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#EAD8C8] pb-3">
          <div>
            <p className="text-xs font-bold text-[#C94136]">7-Day Bistro Check-In</p>
            <h2 id="login-rewards-title" className="font-display text-2xl sm:text-3xl font-bold leading-tight">
              Daily Login Rewards
            </h2>
            <p className="text-xs text-[#6E5245] font-medium mt-0.5">
              {status.canClaimToday
                ? status.streakBroken
                  ? 'Welcome back! Start a fresh 7-day coin streak today.'
                  : `Day ${status.activeDay} reward is ready to collect!`
                : `Claimed today! Return tomorrow for Day ${status.nextTomorrowDay}.`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className="clay-inset flex items-center gap-1.5 px-3 py-1.5"
              aria-label={`Bistro coins: ${progress.coins}`}
            >
              <CoinSvg className="w-4 h-4 shrink-0" />
              <span
                data-testid="login-rewards-coins"
                className="font-mono-num text-sm font-bold text-[#B45309] tabular-nums"
              >
                {progress.coins}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="clay-btn-soft px-3.5 py-1.5 rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-xs sm:text-sm font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

        {/* 7-Day Reward Grid */}
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-2.5">
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {regularDays.map((tier) => {
              const claimed = isDayClaimed(tier.day);
              const today = isTodayTarget(tier.day);
              return (
                <div
                  key={tier.day}
                  data-testid={`login-day-${tier.day}`}
                  className={`clay-card-sm px-2.5 py-3 flex flex-col items-center text-center gap-1 transition-all ${
                    claimed
                      ? 'bg-[#E3F6EA] ring-1 ring-[#22C55E]'
                      : today
                        ? 'bg-[#FFF5DC] ring-2 ring-[#F59E0B]'
                        : 'bg-[#FFFBF7] opacity-85'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      claimed
                        ? 'text-[#15803D]'
                        : today
                          ? 'text-[#B45309]'
                          : 'text-[#8C7062]'
                    }`}
                  >
                    Day {tier.day}
                  </span>

                  <div className="my-0.5 flex items-center justify-center">
                    {claimed ? (
                      <div className="w-8 h-8 rounded-full bg-[#16A34A] text-white flex items-center justify-center shadow-sm">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                          <path
                            d="M5 13 L10 18 L19 7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          today ? 'bg-[#FDE68A]' : 'bg-[#F5E6D7]'
                        }`}
                      >
                        <CoinSvg className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <span className="font-mono-num text-sm sm:text-base font-bold text-[#3D2921] tabular-nums">
                    +{tier.coins}
                  </span>
                  <span className="text-[10px] font-semibold text-[#6E5245] leading-tight line-clamp-1">
                    {claimed ? 'Claimed' : today ? 'Ready!' : tier.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day 7 Grand Chef Chest */}
          {(() => {
            const claimed = isDayClaimed(grandDay.day);
            const today = isTodayTarget(grandDay.day);
            return (
              <div
                data-testid="login-day-7"
                className={`clay-card-sm px-4 py-3.5 flex items-center justify-between gap-3 ${
                  claimed
                    ? 'bg-[#E3F6EA] ring-1 ring-[#22C55E]'
                    : today
                      ? 'bg-[#FFF3CC] ring-2 ring-[#F59E0B]'
                      : 'bg-[#FFF6E8]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center ${
                      claimed ? 'bg-[#16A34A] text-white' : 'bg-[#FDE68A]'
                    }`}
                  >
                    {claimed ? (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                        <path
                          d="M5 13 L10 18 L19 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <CoinSvg className="w-7 h-7" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#B45309]">
                        Day 7 Grand Prize
                      </span>
                    </div>
                    <div className="font-display text-base sm:text-lg font-bold text-[#3D2921] leading-tight">
                      {grandDay.title}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <CoinSvg className="w-5 h-5" />
                  <span className="font-mono-num text-xl font-bold text-[#B45309] tabular-nums">
                    +{grandDay.coins}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer Claim CTA */}
        <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span className="text-xs font-semibold text-[#6E5245]">
            Total Check-Ins: <strong className="font-mono-num text-[#3D2921]">{progress.loginRewards.totalClaims}</strong>
          </span>

          <button
            type="button"
            data-testid="claim-login-reward-btn"
            disabled={!status.canClaimToday}
            onClick={onClaim}
            className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2 ${
              status.canClaimToday
                ? 'clay-btn bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer'
                : 'clay-inset text-[#15803D] cursor-default'
            }`}
          >
            {status.canClaimToday ? (
              <>
                <span>Claim Day {status.activeDay} Reward</span>
                <CoinSvg className="w-4 h-4" />
                <span className="font-mono-num tabular-nums">+{status.todayTier.coins}</span>
              </>
            ) : (
              'Today’s Reward Claimed ✓'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

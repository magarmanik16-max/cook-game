import type { LoginRewardState } from './types';
import { getTodayDateKey } from './missions';

export interface LoginRewardTier {
  day: number; // 1..7
  title: string;
  coins: number;
  isGrandPrize?: boolean;
}

export const LOGIN_REWARD_SCHEDULE: LoginRewardTier[] = [
  { day: 1, title: 'Warm Welcome', coins: 25 },
  { day: 2, title: 'Morning Prep', coins: 40 },
  { day: 3, title: 'Sous-Chef Streak', coins: 60 },
  { day: 4, title: 'Copper Spark', coins: 80 },
  { day: 5, title: 'Bistro Regular', coins: 100 },
  { day: 6, title: 'Golden Skillet', coins: 125 },
  { day: 7, title: 'Grand Chef Chest', coins: 200, isGrandPrize: true },
];

export function createDefaultLoginRewardState(): LoginRewardState {
  return {
    streakDay: 0,
    lastClaimDateKey: null,
    totalClaims: 0,
  };
}

/**
 * Computes whole calendar-day difference between two YYYY-MM-DD local date keys.
 * Uses UTC midnight timestamps so daylight saving transitions never skew day counts.
 */
export function diffCalendarDays(fromDateKey: string, toDateKey: string): number {
  const parse = (k: string): number | null => {
    const parts = k.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  };
  const a = parse(fromDateKey);
  const b = parse(toDateKey);
  if (a === null || b === null) return 999;
  return Math.round((b - a) / 86_400_000);
}

export interface LoginRewardStatus {
  canClaimToday: boolean;
  /** The 1..7 day tier that is claimable today (or was just claimed today). */
  activeDay: number;
  /** Number of days already claimed in the current 7-day cycle (0..7). */
  claimedCountInCycle: number;
  /** Next day's tier preview when already claimed today. */
  nextTomorrowDay: number;
  todayTier: LoginRewardTier;
  streakBroken: boolean;
}

export function getLoginRewardStatus(
  state: LoginRewardState | undefined,
  todayDateKey: string = getTodayDateKey(),
): LoginRewardStatus {
  const safe: LoginRewardState = state ?? createDefaultLoginRewardState();

  if (!safe.lastClaimDateKey) {
    return {
      canClaimToday: true,
      activeDay: 1,
      claimedCountInCycle: 0,
      nextTomorrowDay: 2,
      todayTier: LOGIN_REWARD_SCHEDULE[0],
      streakBroken: false,
    };
  }

  const delta = diffCalendarDays(safe.lastClaimDateKey, todayDateKey);

  // Already claimed today (or clock moved backwards)
  if (delta <= 0) {
    const clamped = Math.max(1, Math.min(7, safe.streakDay || 1));
    const nextDay = (clamped % 7) + 1;
    return {
      canClaimToday: false,
      activeDay: clamped,
      claimedCountInCycle: clamped,
      nextTomorrowDay: nextDay,
      todayTier: LOGIN_REWARD_SCHEDULE[clamped - 1],
      streakBroken: false,
    };
  }

  // Consecutive day!
  if (delta === 1) {
    const prev = Math.max(0, Math.min(7, safe.streakDay));
    const nextDay = (prev % 7) + 1;
    const claimedBeforeToday = prev === 7 ? 0 : prev;
    return {
      canClaimToday: true,
      activeDay: nextDay,
      claimedCountInCycle: claimedBeforeToday,
      nextTomorrowDay: (nextDay % 7) + 1,
      todayTier: LOGIN_REWARD_SCHEDULE[nextDay - 1],
      streakBroken: false,
    };
  }

  // Missed at least one day -> reset cleanly to Day 1
  return {
    canClaimToday: true,
    activeDay: 1,
    claimedCountInCycle: 0,
    nextTomorrowDay: 2,
    todayTier: LOGIN_REWARD_SCHEDULE[0],
    streakBroken: safe.streakDay > 0,
  };
}

export function applyLoginRewardClaim(
  state: LoginRewardState | undefined,
  todayDateKey: string = getTodayDateKey(),
): { nextState: LoginRewardState; claimed: boolean; rewardCoins: number; claimedDay: number } {
  const safe = state ?? createDefaultLoginRewardState();
  const status = getLoginRewardStatus(safe, todayDateKey);
  if (!status.canClaimToday) {
    return { nextState: safe, claimed: false, rewardCoins: 0, claimedDay: status.activeDay };
  }

  const tier = status.todayTier;
  return {
    claimed: true,
    rewardCoins: tier.coins,
    claimedDay: tier.day,
    nextState: {
      streakDay: tier.day,
      lastClaimDateKey: todayDateKey,
      totalClaims: safe.totalClaims + 1,
    },
  };
}

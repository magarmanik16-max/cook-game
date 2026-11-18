import type {
  AchievementId,
  DailyMissionId,
  DishId,
  KitchenThemeId,
  PersistentProgress,
  UpgradeKey,
  UpgradeLevels,
} from './types';
import {
  applyLoginRewardClaim,
  createDefaultLoginRewardState,
} from './loginRewards';
import {
  applyMatchToDailyMissions,
  createDailyMissionState,
  DAILY_ALL_CLEAR_BONUS,
  DAILY_MISSION_CATALOG,
  ensureCurrentDailyMissions,
  getTodayDateKey,
} from './missions';
import { RECIPE_LIST } from './recipes';
import { TUTORIAL_COMPLETION_BONUS } from './tutorial';

const STORAGE_KEY = 'copper_pan_progress_v2';
const LEGACY_BEST_KEY = 'copper_pan_best_score';

export interface UpgradeDefinition {
  key: UpgradeKey;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
}

export const UPGRADE_CATALOG: UpgradeDefinition[] = [
  {
    key: 'speed',
    name: 'Swift Loafers',
    description: '+10% kitchen stride speed per level',
    maxLevel: 4,
    baseCost: 40,
    costStep: 35,
  },
  {
    key: 'chop',
    name: 'Damascus Knife',
    description: '+18% faster chopping per level',
    maxLevel: 4,
    baseCost: 45,
    costStep: 40,
  },
  {
    key: 'heat',
    name: 'Seasoned Copper',
    description: 'Wider golden sear window & slower burn',
    maxLevel: 4,
    baseCost: 50,
    costStep: 45,
  },
  {
    key: 'patience',
    name: 'Warming Lamps',
    description: '+10% extra guest patience per level',
    maxLevel: 4,
    baseCost: 55,
    costStep: 45,
  },
  {
    key: 'tips',
    name: 'Artisan Garnish',
    description: '+20% Bistro Coins earned per plate',
    maxLevel: 4,
    baseCost: 60,
    costStep: 50,
  },
];

export interface ThemeDefinition {
  id: KitchenThemeId;
  name: string;
  cost: number;
  floorLight: string;
  floorDark: string;
  counterWood: string;
  counterTrim: string;
  islandTop: string;
  apronAccent: string;
  railAccent: string;
}

export const KITCHEN_THEMES: Record<KitchenThemeId, ThemeDefinition> = {
  copper: {
    id: 'copper',
    name: 'Classic Copper',
    cost: 0,
    floorLight: '#FFF6EC',
    floorDark: '#F5E6D7',
    counterWood: '#E8BC93',
    counterTrim: '#A96B47',
    islandTop: '#F1CEA8',
    apronAccent: '#E3574B',
    railAccent: '#E8835B',
  },
  patisserie: {
    id: 'patisserie',
    name: 'Blush Patisserie',
    cost: 80,
    floorLight: '#FFF4F6',
    floorDark: '#FCE2E7',
    counterWood: '#F2C6CE',
    counterTrim: '#B55D71',
    islandTop: '#F8D7DD',
    apronAccent: '#E14969',
    railAccent: '#F0718D',
  },
  sage: {
    id: 'sage',
    name: 'Sage Conservatory',
    cost: 120,
    floorLight: '#F4FAF3',
    floorDark: '#E1EFE0',
    counterWood: '#C9DEC6',
    counterTrim: '#5B8260',
    islandTop: '#DCEBD9',
    apronAccent: '#2D935C',
    railAccent: '#4FB279',
  },
  twilight: {
    id: 'twilight',
    name: 'Lavender Velvet',
    cost: 160,
    floorLight: '#F7F3FC',
    floorDark: '#EAE0F7',
    counterWood: '#D9CBEF',
    counterTrim: '#72569E',
    islandTop: '#E5DAF6',
    apronAccent: '#8D52D8',
    railAccent: '#AC7CEB',
  },
};

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  coinReward: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_serve',
    title: 'First Bell Ring',
    description: 'Serve your very first dish at the pass',
    coinReward: 20,
  },
  {
    id: 'perfect_chef',
    title: 'Golden Sear Touch',
    description: 'Serve 5 dishes with a Perfect Sear',
    coinReward: 35,
  },
  {
    id: 'combo_five',
    title: 'Rhythm & Grace',
    description: 'Reach a 5x service combo streak',
    coinReward: 40,
  },
  {
    id: 'day_three',
    title: 'Rival Victor',
    description: 'Beat Rival Chef Coco in Bot Challenge',
    coinReward: 60,
  },
  {
    id: 'fifty_plates',
    title: 'Beloved Chef',
    description: 'Serve 50 total dishes across matches',
    coinReward: 80,
  },
];

export function createDefaultProgress(
  bestScore = 0,
  dateKey: string = getTodayDateKey(),
): PersistentProgress {
  return {
    coins: 0,
    day: 1,
    challengeWins: 0,
    bestScore,
    bestServed: 0,
    totalServed: 0,
    upgrades: {
      speed: 0,
      chop: 0,
      heat: 0,
      patience: 0,
      tips: 0,
    },
    selectedTheme: 'copper',
    unlockedThemes: ['copper'],
    unlockedAchievements: [],
    dailyMissions: createDailyMissionState(dateKey),
    loginRewards: createDefaultLoginRewardState(),
    tutorialCompleted: false,
  };
}

export function loadProgress(): PersistentProgress {
  if (typeof window === 'undefined') return createDefaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistentProgress>;
      const def = createDefaultProgress();
      return {
        coins: typeof parsed.coins === 'number' ? Math.max(0, Math.floor(parsed.coins)) : def.coins,
        day: typeof parsed.day === 'number' ? Math.max(1, Math.floor(parsed.day)) : def.day,
        challengeWins:
          typeof parsed.challengeWins === 'number'
            ? Math.max(0, Math.floor(parsed.challengeWins))
            : def.challengeWins,
        bestScore:
          typeof parsed.bestScore === 'number'
            ? Math.max(0, Math.floor(parsed.bestScore))
            : def.bestScore,
        bestServed:
          typeof parsed.bestServed === 'number'
            ? Math.max(0, Math.floor(parsed.bestServed))
            : def.bestServed,
        totalServed:
          typeof parsed.totalServed === 'number'
            ? Math.max(0, Math.floor(parsed.totalServed))
            : def.totalServed,
        upgrades: {
          speed: parsed.upgrades?.speed ?? 0,
          chop: parsed.upgrades?.chop ?? 0,
          heat: parsed.upgrades?.heat ?? 0,
          patience: parsed.upgrades?.patience ?? 0,
          tips: parsed.upgrades?.tips ?? 0,
        },
        selectedTheme:
          parsed.selectedTheme && parsed.selectedTheme in KITCHEN_THEMES
            ? parsed.selectedTheme
            : 'copper',
        unlockedThemes: Array.isArray(parsed.unlockedThemes)
          ? parsed.unlockedThemes.filter((t): t is KitchenThemeId => t in KITCHEN_THEMES)
          : ['copper'],
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
          ? parsed.unlockedAchievements
          : [],
        dailyMissions: ensureCurrentDailyMissions(parsed.dailyMissions),
        loginRewards:
          parsed.loginRewards && typeof parsed.loginRewards === 'object'
            ? {
                streakDay:
                  typeof parsed.loginRewards.streakDay === 'number'
                    ? Math.max(0, Math.min(7, Math.floor(parsed.loginRewards.streakDay)))
                    : 0,
                lastClaimDateKey:
                  typeof parsed.loginRewards.lastClaimDateKey === 'string'
                    ? parsed.loginRewards.lastClaimDateKey
                    : null,
                totalClaims:
                  typeof parsed.loginRewards.totalClaims === 'number'
                    ? Math.max(0, Math.floor(parsed.loginRewards.totalClaims))
                    : 0,
              }
            : createDefaultLoginRewardState(),
        tutorialCompleted:
          typeof parsed.tutorialCompleted === 'boolean'
            ? parsed.tutorialCompleted
            : (typeof parsed.totalServed === 'number' && parsed.totalServed > 0),
      };
    }

    const legacyBest = Number(window.localStorage.getItem(LEGACY_BEST_KEY) || 0);
    return createDefaultProgress(Number.isFinite(legacyBest) ? Math.max(0, Math.floor(legacyBest)) : 0);
  } catch {
    return createDefaultProgress();
  }
}

export function saveProgress(progress: PersistentProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.localStorage.setItem(LEGACY_BEST_KEY, String(Math.floor(progress.bestScore)));
  } catch {
    // Ignore storage failures
  }
}

export function getUpgradeCost(def: UpgradeDefinition, currentLevel: number): number {
  return def.baseCost + currentLevel * def.costStep;
}

export function purchaseUpgrade(
  progress: PersistentProgress,
  key: UpgradeKey,
): { next: PersistentProgress; purchased: boolean } {
  const def = UPGRADE_CATALOG.find((u) => u.key === key);
  if (!def) return { next: progress, purchased: false };
  const lvl = progress.upgrades[key] ?? 0;
  if (lvl >= def.maxLevel) return { next: progress, purchased: false };
  const cost = getUpgradeCost(def, lvl);
  if (progress.coins < cost) return { next: progress, purchased: false };

  return {
    purchased: true,
    next: {
      ...progress,
      coins: progress.coins - cost,
      upgrades: {
        ...progress.upgrades,
        [key]: lvl + 1,
      },
    },
  };
}

export function selectOrUnlockTheme(
  progress: PersistentProgress,
  themeId: KitchenThemeId,
): { next: PersistentProgress; changed: boolean } {
  const theme = KITCHEN_THEMES[themeId];
  if (!theme) return { next: progress, changed: false };
  if (progress.unlockedThemes.includes(themeId)) {
    return {
      changed: progress.selectedTheme !== themeId,
      next: { ...progress, selectedTheme: themeId },
    };
  }
  if (progress.coins < theme.cost) return { next: progress, changed: false };
  return {
    changed: true,
    next: {
      ...progress,
      coins: progress.coins - theme.cost,
      selectedTheme: themeId,
      unlockedThemes: [...progress.unlockedThemes, themeId],
    },
  };
}

export function getSpeedMultiplier(upgrades: UpgradeLevels): number {
  return 1 + (upgrades.speed ?? 0) * 0.1;
}

export function getChopMultiplier(upgrades: UpgradeLevels): number {
  return 1 + (upgrades.chop ?? 0) * 0.18;
}

export function getBurnGraceBonus(upgrades: UpgradeLevels): number {
  return (upgrades.heat ?? 0) * 0.12;
}

export function getPatienceMultiplier(upgrades: UpgradeLevels): number {
  return 1 + (upgrades.patience ?? 0) * 0.1;
}

export function getTipMultiplier(upgrades: UpgradeLevels): number {
  return 1 + (upgrades.tips ?? 0) * 0.2;
}

export function getTargetOrdersForDay(day: number): number {
  return Math.min(20, 8 + (Math.max(1, day) - 1) * 2);
}

export function getDailySpecialForDay(day: number): DishId {
  const pool = RECIPE_LIST;
  return pool[(Math.max(1, day) - 1) % pool.length].id;
}

export function claimDailyMission(
  progress: PersistentProgress,
  missionId: DailyMissionId,
  dateKey: string = getTodayDateKey(),
): { next: PersistentProgress; claimed: boolean; reward: number } {
  const current = ensureCurrentDailyMissions(progress.dailyMissions, dateKey);
  const target = current.missions.find((m) => m.id === missionId);
  if (!target || !target.completed || target.claimed) {
    return { next: progress, claimed: false, reward: 0 };
  }
  const def = DAILY_MISSION_CATALOG[missionId];
  const reward = def ? def.coinReward : 0;
  return {
    claimed: true,
    reward,
    next: {
      ...progress,
      coins: progress.coins + reward,
      dailyMissions: {
        ...current,
        missions: current.missions.map((m) =>
          m.id === missionId ? { ...m, claimed: true } : m,
        ),
      },
    },
  };
}

export function claimDailyAllClearBonus(
  progress: PersistentProgress,
  dateKey: string = getTodayDateKey(),
): { next: PersistentProgress; claimed: boolean; reward: number } {
  const current = ensureCurrentDailyMissions(progress.dailyMissions, dateKey);
  const allCompleted = current.missions.length === 3 && current.missions.every((m) => m.completed);
  if (!allCompleted || current.allClearClaimed) {
    return { next: progress, claimed: false, reward: 0 };
  }
  return {
    claimed: true,
    reward: DAILY_ALL_CLEAR_BONUS,
    next: {
      ...progress,
      coins: progress.coins + DAILY_ALL_CLEAR_BONUS,
      dailyMissions: {
        ...current,
        allClearClaimed: true,
      },
    },
  };
}

export function claimDailyLoginReward(
  progress: PersistentProgress,
  todayDateKey: string = getTodayDateKey(),
): { next: PersistentProgress; claimed: boolean; reward: number; claimedDay: number } {
  const { nextState, claimed, rewardCoins, claimedDay } = applyLoginRewardClaim(
    progress.loginRewards,
    todayDateKey,
  );
  if (!claimed) {
    return { next: progress, claimed: false, reward: 0, claimedDay };
  }
  return {
    claimed: true,
    reward: rewardCoins,
    claimedDay,
    next: {
      ...progress,
      coins: progress.coins + rewardCoins,
      loginRewards: nextState,
    },
  };
}

export function completeTutorial(
  progress: PersistentProgress,
  awardBonus = true,
): { next: PersistentProgress; bonusAwarded: number } {
  const bonus = !progress.tutorialCompleted && awardBonus ? TUTORIAL_COMPLETION_BONUS : 0;
  return {
    bonusAwarded: bonus,
    next: {
      ...progress,
      coins: progress.coins + bonus,
      tutorialCompleted: true,
    },
  };
}

export function finalizeShiftProgress(
  progress: PersistentProgress,
  summary: {
    score: number;
    coinsEarned: number;
    ordersServed: number;
    perfectDishes: number;
    maxCombo: number;
    burntCount?: number;
    servedByDish?: Partial<Record<DishId, number>>;
    vipOrFoodieServed?: number;
    wonChallenge?: boolean;
    dateKey?: string;
  },
): {
  nextProgress: PersistentProgress;
  newlyUnlocked: AchievementId[];
  newlyCompletedMissions: DailyMissionId[];
} {
  const nextChallengeWins = summary.wonChallenge
    ? progress.challengeWins + 1
    : progress.challengeWins;
  const nextTotalServed = progress.totalServed + summary.ordersServed;
  const nextBestScore = Math.max(progress.bestScore, Math.round(summary.score));
  const nextBestServed = Math.max(progress.bestServed, Math.round(summary.ordersServed));

  const earnedSet = new Set<AchievementId>(progress.unlockedAchievements);
  const newlyUnlocked: AchievementId[] = [];
  let bonusCoins = 0;

  const checkUnlock = (id: AchievementId, condition: boolean) => {
    if (!condition || earnedSet.has(id)) return;
    earnedSet.add(id);
    newlyUnlocked.push(id);
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (def) bonusCoins += def.coinReward;
  };

  checkUnlock('first_serve', nextTotalServed >= 1);
  checkUnlock('perfect_chef', summary.perfectDishes >= 5);
  checkUnlock('combo_five', summary.maxCombo >= 5);
  checkUnlock('day_three', nextChallengeWins >= 1);
  checkUnlock('fifty_plates', nextTotalServed >= 50);

  const { nextState: nextDailyMissions, newlyCompleted: newlyCompletedMissions } =
    applyMatchToDailyMissions(
      progress.dailyMissions,
      {
        ordersServed: summary.ordersServed,
        perfectDishes: summary.perfectDishes,
        burntCount: summary.burntCount ?? 0,
        maxCombo: summary.maxCombo,
        servedByDish: summary.servedByDish ?? {},
        vipOrFoodieServed: summary.vipOrFoodieServed ?? 0,
        wonChallenge: summary.wonChallenge,
      },
      summary.dateKey,
    );

  return {
    newlyUnlocked,
    newlyCompletedMissions,
    nextProgress: {
      ...progress,
      day: progress.day + 1,
      challengeWins: nextChallengeWins,
      totalServed: nextTotalServed,
      bestScore: nextBestScore,
      bestServed: nextBestServed,
      coins: progress.coins + Math.round(summary.coinsEarned) + bonusCoins,
      unlockedAchievements: Array.from(earnedSet),
      dailyMissions: nextDailyMissions,
    },
  };
}


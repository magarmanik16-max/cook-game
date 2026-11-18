import type {
  DailyMissionId,
  DailyMissionProgress,
  DailyMissionState,
  DishId,
} from './types';

export interface DailyMissionDefinition {
  id: DailyMissionId;
  title: string;
  description: string;
  target: number;
  coinReward: number;
  category: 'dish' | 'craft' | 'rush';
  accentColor: string;
}

export const DAILY_ALL_CLEAR_BONUS = 50;

export const SALAD_DISH_IDS: DishId[] = ['garden_bowl', 'avo_bowl'];
export const TOAST_DISH_IDS: DishId[] = [
  'bruschetta',
  'avo_toast',
  'morning_brioche',
  'berry_toast',
];
export const GRILL_DISH_IDS: DishId[] = [
  'bistro_burger',
  'steak_hash',
  'royale_burger',
];

export const DAILY_MISSION_CATALOG: Record<DailyMissionId, DailyMissionDefinition> = {
  serve_salads: {
    id: 'serve_salads',
    title: 'Garden Fresh',
    description: 'Serve 5 Garden Salads or Green Goddess Bowls',
    target: 5,
    coinReward: 45,
    category: 'dish',
    accentColor: '#16A34A',
  },
  serve_toasts: {
    id: 'serve_toasts',
    title: 'Artisan Toast Bar',
    description: 'Serve 5 Bruschetta, Avo, Egg, or Berry Toasts',
    target: 5,
    coinReward: 40,
    category: 'dish',
    accentColor: '#D97706',
  },
  serve_grill: {
    id: 'serve_grill',
    title: 'Copper Grill Master',
    description: 'Serve 3 Burgers or Steak Frites plates',
    target: 3,
    coinReward: 50,
    category: 'dish',
    accentColor: '#B45309',
  },
  no_burn_match: {
    id: 'no_burn_match',
    title: 'Spotless Skillets',
    description: "Don't burn any dishes in a match (3+ served)",
    target: 1,
    coinReward: 50,
    category: 'craft',
    accentColor: '#EA580C',
  },
  serve_perfect: {
    id: 'serve_perfect',
    title: 'Golden Sear Craft',
    description: 'Serve 4 dishes with a Perfect Sear',
    target: 4,
    coinReward: 45,
    category: 'craft',
    accentColor: '#F59E0B',
  },
  reach_combo: {
    id: 'reach_combo',
    title: 'Kitchen Rhythm',
    description: 'Reach a 4x service combo streak in a match',
    target: 4,
    coinReward: 45,
    category: 'craft',
    accentColor: '#C94136',
  },
  serve_customers: {
    id: 'serve_customers',
    title: 'Full House Service',
    description: 'Serve 10 happy customers today',
    target: 10,
    coinReward: 55,
    category: 'rush',
    accentColor: '#0284C7',
  },
  serve_vip: {
    id: 'serve_vip',
    title: 'VIP Hospitality',
    description: 'Serve 2 VIP or Foodie guests today',
    target: 2,
    coinReward: 50,
    category: 'rush',
    accentColor: '#D97706',
  },
  win_challenge: {
    id: 'win_challenge',
    title: 'Beat Rival Chef Coco',
    description: 'Win 1 Bot Challenge match against Chef Coco',
    target: 1,
    coinReward: 60,
    category: 'rush',
    accentColor: '#7E22CE',
  },
};

const DISH_POOL: DailyMissionId[] = ['serve_salads', 'serve_toasts', 'serve_grill'];
const CRAFT_POOL: DailyMissionId[] = ['no_burn_match', 'serve_perfect', 'reach_combo'];
const RUSH_POOL: DailyMissionId[] = ['serve_customers', 'serve_vip', 'win_challenge'];

export function getTodayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayNumber(dateKey: string): number {
  const parts = dateKey.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const utcMs = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    return Math.floor(utcMs / 86400000);
  }
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const ANCHOR_DAY = Math.floor(Date.UTC(2026, 10, 17) / 86400000);

export function pickDailyMissionIds(dateKey: string): [DailyMissionId, DailyMissionId, DailyMissionId] {
  const delta = Math.abs(getDayNumber(dateKey) - ANCHOR_DAY);
  const dishId = DISH_POOL[delta % DISH_POOL.length];
  const craftId = CRAFT_POOL[(delta + Math.floor(delta / 3)) % CRAFT_POOL.length];
  const rushId = RUSH_POOL[(delta + Math.floor(delta / 3) * 2) % RUSH_POOL.length];
  return [dishId, craftId, rushId];
}

export function createDailyMissionState(dateKey: string = getTodayDateKey()): DailyMissionState {
  const ids = pickDailyMissionIds(dateKey);
  return {
    dateKey,
    allClearClaimed: false,
    missions: ids.map((id) => {
      const def = DAILY_MISSION_CATALOG[id];
      return {
        id,
        progress: 0,
        target: def.target,
        completed: false,
        claimed: false,
      };
    }),
  };
}

export function ensureCurrentDailyMissions(
  existing: DailyMissionState | undefined,
  dateKey: string = getTodayDateKey(),
): DailyMissionState {
  if (
    !existing ||
    existing.dateKey !== dateKey ||
    !Array.isArray(existing.missions) ||
    existing.missions.length !== 3
  ) {
    return createDailyMissionState(dateKey);
  }
  const validMissions: DailyMissionProgress[] = [];
  for (const m of existing.missions) {
    const def = DAILY_MISSION_CATALOG[m.id];
    if (!def) return createDailyMissionState(dateKey);
    const clampedProgress = Math.max(0, Math.min(def.target, Math.floor(m.progress || 0)));
    const completed = Boolean(m.completed || clampedProgress >= def.target);
    validMissions.push({
      id: m.id,
      progress: completed ? def.target : clampedProgress,
      target: def.target,
      completed,
      claimed: Boolean(m.claimed && completed),
    });
  }
  return {
    dateKey,
    allClearClaimed: Boolean(existing.allClearClaimed),
    missions: validMissions,
  };
}

export interface MatchMissionReport {
  ordersServed: number;
  perfectDishes: number;
  burntCount: number;
  maxCombo: number;
  servedByDish: Partial<Record<DishId, number>>;
  vipOrFoodieServed: number;
  wonChallenge?: boolean;
}

function countDishGroup(
  servedByDish: Partial<Record<DishId, number>>,
  group: DishId[],
): number {
  let total = 0;
  for (const dishId of group) {
    total += servedByDish[dishId] ?? 0;
  }
  return total;
}

export function applyMatchToDailyMissions(
  state: DailyMissionState,
  report: MatchMissionReport,
  dateKey: string = getTodayDateKey(),
): { nextState: DailyMissionState; newlyCompleted: DailyMissionId[] } {
  const current = ensureCurrentDailyMissions(state, dateKey);
  const newlyCompleted: DailyMissionId[] = [];

  const nextMissions = current.missions.map((m) => {
    if (m.completed) return m;
    let nextProgress = m.progress;

    switch (m.id) {
      case 'serve_salads':
        nextProgress += countDishGroup(report.servedByDish, SALAD_DISH_IDS);
        break;
      case 'serve_toasts':
        nextProgress += countDishGroup(report.servedByDish, TOAST_DISH_IDS);
        break;
      case 'serve_grill':
        nextProgress += countDishGroup(report.servedByDish, GRILL_DISH_IDS);
        break;
      case 'no_burn_match':
        if (report.ordersServed >= 3 && report.burntCount === 0) {
          nextProgress = m.target;
        }
        break;
      case 'serve_perfect':
        nextProgress += report.perfectDishes;
        break;
      case 'reach_combo':
        nextProgress = Math.max(nextProgress, report.maxCombo);
        break;
      case 'serve_customers':
        nextProgress += report.ordersServed;
        break;
      case 'serve_vip':
        nextProgress += report.vipOrFoodieServed;
        break;
      case 'win_challenge':
        if (report.wonChallenge) {
          nextProgress += 1;
        }
        break;
    }

    const clamped = Math.min(m.target, Math.max(0, Math.floor(nextProgress)));
    const completed = clamped >= m.target;
    if (completed && !m.completed) {
      newlyCompleted.push(m.id);
    }
    return {
      ...m,
      progress: clamped,
      completed,
    };
  });

  return {
    newlyCompleted,
    nextState: {
      ...current,
      missions: nextMissions,
    },
  };
}

export function getUnclaimedMissionCount(state: DailyMissionState): number {
  const missionReady = state.missions.filter((m) => m.completed && !m.claimed).length;
  const allCompleted = state.missions.length === 3 && state.missions.every((m) => m.completed);
  const allClearReady = allCompleted && !state.allClearClaimed ? 1 : 0;
  return missionReady + allClearReady;
}

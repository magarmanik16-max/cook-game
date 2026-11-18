import { createInitialBot, stepBotChef } from './botAi';
import {
  clampToWalkablePoint,
  findShortestPathToAny,
  getStationCandidateStandPoints,
  isSegmentClear,
  KITCHEN_OBSTACLES,
  NAV_CLEARANCE,
  type NavPoint,
} from './pathfinding';
import {
  getBurnGraceBonus,
  getChopMultiplier,
  getDailySpecialForDay,
  getPatienceMultiplier,
  getSpeedMultiplier,
  getTipMultiplier,
} from './progression';
import {
  canAddToPlate,
  getChopResult,
  getCookResult,
  getRecipesForWave,
  INGREDIENT_META,
  isChoppable,
  isCookable,
  isPlatable,
  ITEM_LABELS,
  matchCompleteDish,
  RECIPES,
} from './recipes';
import type {
  ChefState,
  CookStage,
  CustomerVariety,
  DishId,
  GameMode,
  IngredientBase,
  InputSnapshot,
  KitchenSimulation,
  MatchDurationSeconds,
  OrderTicket,
  RunStatsSnapshot,
  SimEvent,
  StationState,
  UpgradeLevels,
} from './types';

export const GRID_COLS = 10;
export const GRID_ROWS = 7;

export const DEFAULT_MATCH_DURATION: MatchDurationSeconds = 60;
export const MAX_ACTIVE_TICKETS = 4;

export const CHEF_RADIUS = 0.34;
export const CHEF_SPEED = 4.7;
export const DASH_SPEED = 9.5;
export const DASH_DURATION = 0.16;
export const DASH_COOLDOWN = 0.72;
export const INTERACT_REACH = 1.38;

export const CHOP_TAP_AMOUNT = 0.34;
export const CHOP_AUTO_RATE = 0.88;

export const COOK_DURATION = 4.6;
export const PERFECT_THRESHOLD = 0.72;
export const WARNING_THRESHOLD = 1.0;
export const BURNT_THRESHOLD = 1.45;
export const COMBO_WINDOW = 16.0;
export const URGENT_ALARM_SECONDS = 9.0;

const GUEST_NAMES = [
  'Clara',
  'Camille',
  'Yuki',
  'Elena',
  'Sora',
  'Amelie',
  'Nadia',
  'Chloe',
  'Mateo',
  'Margot',
];

const GUEST_DIALOGUES: Record<DishId, string> = {
  bruschetta: 'Fresh bruschetta!',
  avo_toast: 'Creamy avo toast!',
  garden_bowl: 'Crisp salad, please!',
  morning_brioche: 'Warm egg brioche!',
  berry_toast: 'Sweet berry toast!',
  avo_bowl: 'Green goddess bowl!',
  bistro_burger: 'Smash burger!',
  steak_hash: 'Steak & frites!',
  royale_burger: 'Royale burger!',
};

const HAPPY_QUIPS = ['Merci! ♥', 'Delicious! ♥', 'So cozy! ★', 'Magnifique! ♥'];

const DEFAULT_UPGRADES: UpgradeLevels = {
  speed: 0,
  chop: 0,
  heat: 0,
  patience: 0,
  tips: 0,
};

export interface SimulationOptions {
  day?: number;
  durationSeconds?: MatchDurationSeconds;
  upgrades?: UpgradeLevels;
}

export function createStations(): StationState[] {
  const makeStation = (
    id: string,
    type: StationState['type'],
    label: string,
    col: number,
    row: number,
    pantryBase?: IngredientBase,
  ): StationState => ({
    id,
    type,
    label,
    col,
    row,
    pantryBase,
    item: null,
    isPerfect: false,
    chopProgress: 0,
    isChoppingActive: false,
    cookProgress: 0,
    cookStage: 'none',
    plateComponents: [],
    matchedDishId: null,
    pulseTimer: 0,
    claimedBy: null,
  });

  return [
    // Top Counter Row (row 0) — serving happens directly at Customer Counter seats!
    makeStation('board_1', 'board', 'Cutting Board', 2, 0),
    makeStation('board_2', 'board', 'Cutting Board', 3, 0),
    makeStation('compost', 'compost', 'Compost Bin', 8, 0),

    // Left Wall Pantry (col 0)
    makeStation('pantry_tomato', 'pantry', 'Tomatoes', 0, 1, 'tomato'),
    makeStation('pantry_lettuce', 'pantry', 'Greens', 0, 2, 'lettuce'),
    makeStation('pantry_potato', 'pantry', 'Potatoes', 0, 3, 'potato'),
    makeStation('pantry_strawberry', 'pantry', 'Berries', 0, 4, 'strawberry'),
    makeStation('pantry_bun', 'pantry', 'Brioche Buns', 0, 5, 'bun'),

    // Right Wall Skillets & Pantry (col 9)
    makeStation('skillet_1', 'skillet', 'Copper Skillet', 9, 1),
    makeStation('skillet_2', 'skillet', 'Copper Skillet', 9, 2),
    makeStation('pantry_avocado', 'pantry', 'Avocado', 9, 3, 'avocado'),
    makeStation('pantry_egg', 'pantry', 'Farm Eggs', 9, 4, 'egg'),
    makeStation('pantry_patty', 'pantry', 'Prime Beef', 9, 5, 'patty'),

    // Central Plating Island (row 3)
    makeStation('plate_1', 'plate_mat', 'Plating Mat', 4, 3),
    makeStation('plate_2', 'plate_mat', 'Plating Mat', 5, 3),
  ];
}

export function createInitialChef(startX = 4.5): ChefState {
  return {
    x: startX,
    y: 2.05,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: -1,
    held: null,
    dashTimer: 0,
    dashCooldown: 0,
    walkDistance: 0,
    lastStepDistance: 0,
    squashX: 1,
    squashY: 1,
    happyTimer: 0,
    targetStationId: null,
    queuedStationId: null,
    targetTicketId: null,
    queuedTicketId: null,
    targetPoint: null,
    navPath: [],
    navGoalKey: null,
  };
}

export function computeWaveForOrders(ordersServed: number, elapsedSeconds: number): number {
  if (ordersServed >= 7 || elapsedSeconds >= 105) return 3;
  if (ordersServed >= 3 || elapsedSeconds >= 45) return 2;
  return 1;
}

export function pickCustomerVariety(ticketIndex: number): CustomerVariety {
  if (ticketIndex >= 3 && ticketIndex % 4 === 0) return 'vip';
  if (ticketIndex === 2 || ticketIndex % 5 === 2) return 'foodie';
  if (ticketIndex >= 3 && ticketIndex % 5 === 3) return 'express';
  return 'regular';
}

export function computePatienceForWave(
  wave: number,
  dishId: DishId,
  upgrades: UpgradeLevels,
  variety: CustomerVariety | boolean,
): number {
  const recipe = RECIPES[dishId];
  const stepBonus = recipe.components.length * 6;
  const base = wave === 1 ? 38 : wave === 2 ? 34 : 30;
  const resolved: CustomerVariety =
    typeof variety === 'boolean' ? (variety ? 'vip' : 'regular') : variety;
  const varietyMult =
    resolved === 'vip'
      ? 0.88
      : resolved === 'express'
        ? 0.8
        : resolved === 'foodie'
          ? 1.14
          : 1;
  const raw = (base + stepBonus) * getPatienceMultiplier(upgrades) * varietyMult;
  return Math.round(raw);
}

export function computeSpawnInterval(wave: number, mode: GameMode = 'solo'): number {
  const base = wave === 1 ? 8.2 : wave === 2 ? 6.8 : 5.6;
  return mode === 'challenge' ? base * 0.62 : base;
}

export function pickRecipeForWave(
  wave: number,
  seedIndex: number,
  activeTickets: OrderTicket[],
  dailySpecialDishId: DishId,
): DishId {
  const pool = getRecipesForWave(wave);
  const activeCounts = new Map<DishId, number>();
  for (const t of activeTickets) {
    activeCounts.set(t.dishId, (activeCounts.get(t.dishId) ?? 0) + 1);
  }
  const specialRecipe = RECIPES[dailySpecialDishId];
  if (
    specialRecipe.minWave <= wave &&
    seedIndex % 4 === 0 &&
    (activeCounts.get(dailySpecialDishId) ?? 0) === 0
  ) {
    return dailySpecialDishId;
  }

  const lessCommon = pool.filter((r) => (activeCounts.get(r.id) ?? 0) === 0);
  const candidates = lessCommon.length > 0 ? lessCommon : pool;
  return candidates[Math.abs(seedIndex) % candidates.length].id;
}

function pickFreeSeatIndex(tickets: OrderTicket[]): number {
  const taken = new Set(tickets.map((t) => t.seatIndex));
  for (let i = 0; i < MAX_ACTIVE_TICKETS; i++) {
    if (!taken.has(i)) return i;
  }
  return tickets.length % MAX_ACTIVE_TICKETS;
}

export function getSeatWorldPos(seatIndex: number): { x: number; y: number } {
  return {
    x: 1.82 + seatIndex * 1.8,
    y: GRID_ROWS - 0.45,
  };
}

export function getSeatStandPoint(seatIndex: number): { x: number; y: number } {
  return {
    x: Math.max(1.4, Math.min(GRID_COLS - 1.4, 1.82 + seatIndex * 1.8)),
    y: GRID_ROWS - 1.38,
  };
}

export function spawnTicket(sim: KitchenSimulation, dishOverride?: DishId): OrderTicket {
  const idx = sim.nextTicketId;
  sim.nextTicketId += 1;
  const dishId =
    dishOverride ??
    pickRecipeForWave(sim.wave, idx * 7 + sim.ordersServed, sim.tickets, sim.dailySpecialDishId);
  const variety = pickCustomerVariety(idx);
  const isVip = variety === 'vip';
  const maxPatience = computePatienceForWave(sim.wave, dishId, sim.upgrades, variety);
  const ticket: OrderTicket = {
    id: idx,
    dishId,
    tableNumber: ((idx - 1) % 8) + 1,
    guestName: GUEST_NAMES[(idx - 1) % GUEST_NAMES.length],
    avatarId: (idx - 1) % 6,
    seatIndex: pickFreeSeatIndex(sim.tickets),
    dialogue:
      variety === 'vip'
        ? 'VIP Order!'
        : variety === 'foodie'
          ? 'Extra Tip!'
          : variety === 'express'
            ? 'Quick Bite!'
            : GUEST_DIALOGUES[dishId],
    variety,
    maxPatience,
    patience: maxPatience,
    createdAtElapsed: sim.elapsedSeconds,
    isVip,
    isDailySpecial: dishId === sim.dailySpecialDishId,
  };
  sim.tickets.push(ticket);
  return ticket;
}

export function createInitialSimulation(
  mode: GameMode = 'solo',
  bestScore = 0,
  options: SimulationOptions = {},
): KitchenSimulation {
  const day = Math.max(1, options.day ?? 1);
  const durationSeconds: MatchDurationSeconds = options.durationSeconds ?? DEFAULT_MATCH_DURATION;
  const upgrades: UpgradeLevels = { ...DEFAULT_UPGRADES, ...(options.upgrades ?? {}) };
  const dailySpecialDishId = getDailySpecialForDay(day);
  const isChallenge = mode === 'challenge';

  const sim: KitchenSimulation = {
    mode,
    durationSeconds,
    timeRemaining: durationSeconds,
    dailySpecialDishId,
    outcome: 'none',
    score: 0,
    bestScore,
    coinsEarned: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    ordersServed: 0,
    perfectDishes: 0,
    burntCount: 0,
    servedByDish: {},
    vipOrFoodieServed: 0,
    wave: 1,
    elapsedSeconds: 0,
    spawnTimer: isChallenge ? 3.8 : 5.5,
    nextTicketId: 1,
    hitstopTimer: 0,
    alarmCooldown: 0,
    skilletAlertCooldown: 0,
    upgrades,
    chef: createInitialChef(isChallenge ? 3.5 : 4.5),
    bot: isChallenge ? createInitialBot() : null,
    stations: createStations(),
    tickets: [],
    customerReactions: [],
    nearestStationId: null,
    statusBanner: null,
    statusBannerTimer: 0,
  };

  spawnTicket(sim, 'bruschetta');
  spawnTicket(sim, 'avo_toast');
  if (isChallenge) {
    spawnTicket(sim, 'berry_toast');
  }
  sim.nearestStationId = findNearestStationId(sim);
  return sim;
}

export function stationCenter(station: StationState): { x: number; y: number } {
  return { x: station.col + 0.5, y: station.row + 0.5 };
}

export function findNearestStationId(sim: KitchenSimulation): string | null {
  let bestId: string | null = null;
  let bestScore = Infinity;

  for (const st of sim.stations) {
    const c = stationCenter(st);
    const dx = c.x - sim.chef.x;
    const dy = c.y - sim.chef.y;
    const dist = Math.hypot(dx, dy);
    if (dist > INTERACT_REACH) continue;

    const dot = dist > 0.001 ? (dx / dist) * sim.chef.facingX + (dy / dist) * sim.chef.facingY : 1;
    const weighted = dist - dot * 0.22;
    if (weighted < bestScore) {
      bestScore = weighted;
      bestId = st.id;
    }
  }
  return bestId;
}

export function getStationInteractionHint(sim: KitchenSimulation, stationId: string | null): string | null {
  if (!stationId) return null;
  const st = sim.stations.find((s) => s.id === stationId);
  if (!st) return null;
  const held = sim.chef.held;

  switch (st.type) {
    case 'pantry': {
      const meta = st.pantryBase ? INGREDIENT_META[st.pantryBase] : null;
      if (!held && meta) return `Pick up ${meta.label}`;
      return meta ? `${meta.label} Crate (Hands Full)` : null;
    }
    case 'board': {
      if (st.item) {
        if (isChoppable(st.item)) {
          return `Chop ${ITEM_LABELS[st.item]} (${Math.round(st.chopProgress * 100)}%)`;
        }
        if (!held) return `Take ${ITEM_LABELS[st.item]}`;
        return 'Board Occupied';
      }
      if (held && isChoppable(held.kind)) return `Place ${ITEM_LABELS[held.kind]} to Chop`;
      return 'Cutting Board';
    }
    case 'skillet': {
      if (st.item) {
        if (st.cookStage === 'burnt') {
          return !held ? 'Clear Burnt Food' : 'Skillet Burnt (Free Hands First)';
        }
        if (st.cookStage === 'perfect') {
          return !held ? `Grab Perfect ${ITEM_LABELS[st.item]}!` : 'Perfect Now! Free Hands';
        }
        if (st.cookStage === 'warning') {
          return !held ? `Pull ${ITEM_LABELS[st.item]} Off Heat!` : 'Overcooking!';
        }
        return `Searing ${ITEM_LABELS[st.item]} (${Math.min(100, Math.round(st.cookProgress * 100))}%)`;
      }
      if (held && isCookable(held.kind)) return `Sear ${ITEM_LABELS[held.kind]}`;
      return 'Copper Skillet';
    }
    case 'plate_mat': {
      if (st.matchedDishId && !held) {
        return `Pick up ${RECIPES[st.matchedDishId].name}`;
      }
      if (held && held.kind === 'plate' && st.plateComponents.length === 0) {
        return 'Set Plate on Mat';
      }
      if (held && isPlatable(held.kind)) {
        if (canAddToPlate(st.plateComponents, held.kind)) {
          return `Plate ${ITEM_LABELS[held.kind]}`;
        }
        return `${ITEM_LABELS[held.kind]} doesn't match dish`;
      }
      if (!held && st.plateComponents.length > 0) {
        return `Pick up Plate (${st.plateComponents.length} ${st.plateComponents.length === 1 ? 'item' : 'items'})`;
      }
      return 'Plating Mat';
    }
    case 'compost': {
      if (held) {
        return held.kind === 'plate' ? 'Clear Plate to Compost' : `Discard ${ITEM_LABELS[held.kind]}`;
      }
      return 'Compost Bin';
    }
  }
}

export function resolveCircleRectCollision(
  x: number,
  y: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { x: number; y: number } {
  const closestX = Math.max(rx, Math.min(x, rx + rw));
  const closestY = Math.max(ry, Math.min(y, ry + rh));
  const dx = x - closestX;
  const dy = y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= r * r) return { x, y };

  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const overlap = r - dist;
    return {
      x: x + (dx / dist) * overlap,
      y: y + (dy / dist) * overlap,
    };
  }

  const leftPen = x - rx;
  const rightPen = rx + rw - x;
  const topPen = y - ry;
  const bottomPen = ry + rh - y;
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
  if (minPen === leftPen) return { x: rx - r, y };
  if (minPen === rightPen) return { x: rx + rw + r, y };
  if (minPen === topPen) return { x, y: ry - r };
  return { x, y: ry + rh + r };
}

export function getStationWalkStandPoint(
  station: StationState,
  from?: NavPoint,
): { x: number; y: number } {
  const candidates = getStationCandidateStandPoints(station);
  if (!from || candidates.length === 1) return candidates[0];
  const path = findShortestPathToAny(from, candidates, NAV_CLEARANCE);
  return path[path.length - 1] ?? candidates[0];
}

function clearChefNavPath(chef: ChefState): void {
  chef.navPath = [];
  chef.navGoalKey = null;
}

function ensureChefNavPath(
  chef: ChefState,
  goalKey: string,
  candidates: readonly NavPoint[],
): NavPoint | null {
  const curPos: NavPoint = { x: chef.x, y: chef.y };
  const needsPlan =
    chef.navGoalKey !== goalKey ||
    chef.navPath.length === 0 ||
    !isSegmentClear(curPos, chef.navPath[0], CHEF_RADIUS + 0.01);

  if (needsPlan) {
    chef.navPath = findShortestPathToAny(curPos, candidates, NAV_CLEARANCE);
    chef.navGoalKey = goalKey;
  }

  // Smoothly pop reached or skippable intermediate waypoints
  while (chef.navPath.length > 1) {
    const wp = chef.navPath[0];
    const dist = Math.hypot(wp.x - chef.x, wp.y - chef.y);
    if (dist <= 0.22 || isSegmentClear(curPos, chef.navPath[1], NAV_CLEARANCE)) {
      chef.navPath.shift();
    } else {
      break;
    }
  }

  return chef.navPath[0] ?? null;
}

function moveChefStep(sim: KitchenSimulation, dt: number, input: InputSnapshot, events: SimEvent[]): void {
  const chef = sim.chef;

  if (chef.dashCooldown > 0) chef.dashCooldown = Math.max(0, chef.dashCooldown - dt);
  if (chef.dashTimer > 0) chef.dashTimer = Math.max(0, chef.dashTimer - dt);
  if (chef.happyTimer > 0) chef.happyTimer = Math.max(0, chef.happyTimer - dt);

  const relax = 1 - Math.exp(-14 * dt);
  chef.squashX += (1 - chef.squashX) * relax;
  chef.squashY += (1 - chef.squashY) * relax;

  let dirX = input.moveX;
  let dirY = input.moveY;
  const hasManualMove = Math.abs(dirX) > 0.08 || Math.abs(dirY) > 0.08;
  let isAutoNavigating = false;

  if (hasManualMove) {
    chef.targetStationId = null;
    chef.queuedStationId = null;
    chef.targetTicketId = null;
    chef.queuedTicketId = null;
    chef.targetPoint = null;
    clearChefNavPath(chef);
  } else if (chef.targetStationId) {
    const targetStation = sim.stations.find((s) => s.id === chef.targetStationId);
    if (!targetStation) {
      chef.targetStationId = null;
      clearChefNavPath(chef);
    } else {
      const candidates = getStationCandidateStandPoints(targetStation);
      const nextWp = ensureChefNavPath(chef, `station:${targetStation.id}`, candidates);
      const finalWp = chef.navPath[chef.navPath.length - 1] ?? candidates[0];
      const center = stationCenter(targetStation);
      const distToFinal = Math.hypot(finalWp.x - chef.x, finalWp.y - chef.y);
      const distToStation = Math.hypot(center.x - chef.x, center.y - chef.y);
      const onFinalLeg = chef.navPath.length <= 1;

      if (onFinalLeg && (distToFinal < 0.22 || distToStation <= INTERACT_REACH - 0.16)) {
        const fdx = center.x - chef.x;
        const fdy = center.y - chef.y;
        const flen = Math.hypot(fdx, fdy);
        if (flen > 0.001) {
          chef.facingX = fdx / flen;
          chef.facingY = fdy / flen;
        }
        const clickedId = chef.targetStationId;
        const nextQueuedStation = chef.queuedStationId;
        const nextQueuedTicket = chef.queuedTicketId;
        chef.targetStationId =
          nextQueuedStation && nextQueuedStation !== clickedId ? nextQueuedStation : null;
        chef.queuedStationId = null;
        if (!chef.targetStationId && nextQueuedTicket !== null) {
          chef.targetTicketId = nextQueuedTicket;
          chef.queuedTicketId = null;
        }
        clearChefNavPath(chef);
        interactWithStation(sim, clickedId, events);
      } else if (nextWp) {
        const dx = nextWp.x - chef.x;
        const dy = nextWp.y - chef.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          dirX = dx / dist;
          dirY = dy / dist;
          isAutoNavigating = true;
        }
      }
    }
  } else if (chef.targetTicketId !== null) {
    const ticket = sim.tickets.find((t) => t.id === chef.targetTicketId);
    if (!ticket) {
      chef.targetTicketId = null;
      clearChefNavPath(chef);
    } else {
      const stand = getSeatStandPoint(ticket.seatIndex);
      const seatWorld = getSeatWorldPos(ticket.seatIndex);
      const nextWp = ensureChefNavPath(chef, `ticket:${ticket.id}:${ticket.seatIndex}`, [stand]);
      const finalWp = chef.navPath[chef.navPath.length - 1] ?? stand;
      const distToFinal = Math.hypot(finalWp.x - chef.x, finalWp.y - chef.y);
      const distToCustomer = Math.hypot(seatWorld.x - chef.x, seatWorld.y - chef.y);
      const onFinalLeg = chef.navPath.length <= 1;

      if (onFinalLeg && (distToFinal < 0.25 || distToCustomer <= 1.25)) {
        chef.facingX = 0;
        chef.facingY = 1;
        const clickedTicketId = chef.targetTicketId;
        chef.targetTicketId = chef.queuedTicketId;
        chef.queuedTicketId = null;
        if (chef.queuedStationId) {
          chef.targetStationId = chef.queuedStationId;
          chef.queuedStationId = null;
        }
        clearChefNavPath(chef);
        serveCustomerTicket(sim, clickedTicketId, events);
      } else if (nextWp) {
        const dx = nextWp.x - chef.x;
        const dy = nextWp.y - chef.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          dirX = dx / dist;
          dirY = dy / dist;
          isAutoNavigating = true;
        }
      }
    }
  } else if (chef.targetPoint) {
    const safeTarget = clampToWalkablePoint(chef.targetPoint.x, chef.targetPoint.y, NAV_CLEARANCE);
    chef.targetPoint = safeTarget;
    const key = `point:${safeTarget.x.toFixed(2)},${safeTarget.y.toFixed(2)}`;
    const nextWp = ensureChefNavPath(chef, key, [safeTarget]);
    const distToFinal = Math.hypot(safeTarget.x - chef.x, safeTarget.y - chef.y);

    if (chef.navPath.length <= 1 && distToFinal < 0.16) {
      chef.targetPoint = null;
      clearChefNavPath(chef);
    } else if (nextWp) {
      const dx = nextWp.x - chef.x;
      const dy = nextWp.y - chef.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) {
        dirX = dx / dist;
        dirY = dy / dist;
        isAutoNavigating = true;
      }
    }
  } else if (chef.navPath.length > 0 || chef.navGoalKey !== null) {
    clearChefNavPath(chef);
  }

  if (input.dashPressed && chef.dashCooldown <= 0) {
    chef.dashTimer = DASH_DURATION;
    chef.dashCooldown = DASH_COOLDOWN;
    chef.squashX = 1.28;
    chef.squashY = 0.76;
    events.push({
      sound: 'dash',
      particleKind: 'dash',
      particleX: chef.x,
      particleY: chef.y + 0.15,
      particleColor: '#FAF8F5',
      particleCount: 7,
    });
  }

  const speedMult = getSpeedMultiplier(sim.upgrades);
  const len = Math.hypot(dirX, dirY);
  if (len > 0.001) {
    const mag = Math.min(1, len);
    const nx = dirX / len;
    const ny = dirY / len;
    chef.facingX = nx;
    chef.facingY = ny;
    const speed = (chef.dashTimer > 0 ? DASH_SPEED : CHEF_SPEED * mag) * speedMult;
    chef.vx = nx * speed;
    chef.vy = ny * speed;
  } else if (chef.dashTimer > 0) {
    chef.vx = chef.facingX * DASH_SPEED * speedMult;
    chef.vy = chef.facingY * DASH_SPEED * speedMult;
  } else {
    const damp = Math.exp(-20 * dt);
    chef.vx *= damp;
    chef.vy *= damp;
  }

  const prevX = chef.x;
  const prevY = chef.y;
  let nextX = chef.x + chef.vx * dt;
  let nextY = chef.y + chef.vy * dt;

  const minX = 1.0 + CHEF_RADIUS;
  const maxX = GRID_COLS - 1.0 - CHEF_RADIUS;
  const minY = 1.0 + CHEF_RADIUS;
  const maxY = GRID_ROWS - 1.0 - CHEF_RADIUS;

  nextX = Math.max(minX, Math.min(maxX, nextX));
  nextY = Math.max(minY, Math.min(maxY, nextY));

  for (const rect of KITCHEN_OBSTACLES) {
    const resolved = resolveCircleRectCollision(nextX, nextY, CHEF_RADIUS, rect.x, rect.y, rect.w, rect.h);
    nextX = resolved.x;
    nextY = resolved.y;
  }

  chef.x = Math.max(minX, Math.min(maxX, nextX));
  chef.y = Math.max(minY, Math.min(maxY, nextY));

  const moved = Math.hypot(chef.x - prevX, chef.y - prevY);
  // Defense-in-depth: if blocked during auto-nav, immediately force fresh A* replan
  if (isAutoNavigating && dt > 0.001 && moved < 0.004) {
    chef.navGoalKey = null;
  }

  chef.walkDistance += moved;
  if (chef.walkDistance - chef.lastStepDistance >= 0.95) {
    chef.lastStepDistance = chef.walkDistance;
    events.push({ sound: 'footstep' });
  }
}

export function calculateServeScore(
  recipeBaseScore: number,
  perfectCount: number,
  patienceRatio: number,
  combo: number,
  variety: CustomerVariety | boolean = 'regular',
  isDailySpecial = false,
): number {
  const multiplier = Math.min(3.0, 1 + Math.max(0, combo - 1) * 0.25);
  const perfectBonus = perfectCount * 40;
  const speedBonus = Math.round(Math.max(0, Math.min(1, patienceRatio)) * 45);
  const resolved: CustomerVariety =
    typeof variety === 'boolean' ? (variety ? 'vip' : 'regular') : variety;
  const varietyScoreMult =
    resolved === 'vip' ? 1.5 : resolved === 'express' ? 1.25 : resolved === 'foodie' ? 1.15 : 1;
  const specialMult = varietyScoreMult * (isDailySpecial ? 1.35 : 1);
  return Math.round((recipeBaseScore + perfectBonus + speedBonus) * multiplier * specialMult);
}

export function calculateServeCoins(
  componentCount: number,
  perfectCount: number,
  variety: CustomerVariety | boolean,
  isDailySpecial: boolean,
  upgrades: UpgradeLevels,
): number {
  const baseCoins = 8 + componentCount * 3 + perfectCount * 4;
  const resolved: CustomerVariety =
    typeof variety === 'boolean' ? (variety ? 'vip' : 'regular') : variety;
  const varietyTipMult =
    resolved === 'vip' ? 2.0 : resolved === 'foodie' ? 1.6 : resolved === 'express' ? 1.4 : 1;
  const bonusMult = varietyTipMult * (isDailySpecial ? 1.5 : 1) * getTipMultiplier(upgrades);
  return Math.max(5, Math.round(baseCoins * bonusMult));
}

export function findNearestServeableTicket(sim: KitchenSimulation): OrderTicket | null {
  const held = sim.chef.held;
  if (!held || held.kind !== 'plate' || !held.matchedDishId) return null;
  let best: OrderTicket | null = null;
  let bestDist = 1.6;
  for (const t of sim.tickets) {
    if (t.dishId !== held.matchedDishId) continue;
    const seat = getSeatWorldPos(t.seatIndex);
    const d = Math.hypot(seat.x - sim.chef.x, seat.y - sim.chef.y);
    if (d <= bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

export function serveCustomerTicket(
  sim: KitchenSimulation,
  ticketId: number,
  events: SimEvent[],
): boolean {
  const chef = sim.chef;
  const ticketIndex = sim.tickets.findIndex((t) => t.id === ticketId);
  if (ticketIndex === -1) return false;
  const ticket = sim.tickets[ticketIndex];
  const seatPos = getSeatWorldPos(ticket.seatIndex);

  const wantedRecipe = RECIPES[ticket.dishId];
  const recipeStepsText = wantedRecipe.steps.map((s) => s.label).join(' + ');

  if (!chef.held || chef.held.kind !== 'plate' || !chef.held.matchedDishId) {
    sim.statusBanner = `${wantedRecipe.shortName}: ${recipeStepsText} → Plate`;
    sim.statusBannerTimer = 3.6;
    events.push({
      sound: 'error',
      floatingText: `Needs ${wantedRecipe.shortName}!`,
      floatingColor: '#F59E0B',
      floatingX: seatPos.x,
      floatingY: seatPos.y - 0.55,
    });
    return false;
  }

  const dishId = chef.held.matchedDishId;
  if (ticket.dishId !== dishId) {
    sim.statusBanner = `${ticket.guestName} wants ${wantedRecipe.shortName}: ${recipeStepsText}`;
    sim.statusBannerTimer = 3.6;
    events.push({
      sound: 'error',
      floatingText: `${ticket.guestName} wants ${wantedRecipe.shortName}!`,
      floatingColor: '#F87171',
      floatingX: seatPos.x,
      floatingY: seatPos.y - 0.55,
    });
    return false;
  }

  const recipe = RECIPES[dishId];
  const perfectCount = chef.held.plateComponents.filter((c) => c.isPerfect).length;
  const patienceRatio = ticket.maxPatience > 0 ? ticket.patience / ticket.maxPatience : 0;

  sim.combo += 1;
  sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
  sim.comboTimer = COMBO_WINDOW;
  sim.ordersServed += 1;
  sim.servedByDish[dishId] = (sim.servedByDish[dishId] ?? 0) + 1;
  if (ticket.variety === 'vip' || ticket.variety === 'foodie') {
    sim.vipOrFoodieServed += 1;
  }
  if (perfectCount > 0) sim.perfectDishes += 1;

  const gained = calculateServeScore(
    recipe.baseScore,
    perfectCount,
    patienceRatio,
    sim.combo,
    ticket.variety,
    ticket.isDailySpecial,
  );
  const coins = calculateServeCoins(
    recipe.components.length,
    perfectCount,
    ticket.variety,
    ticket.isDailySpecial,
    sim.upgrades,
  );

  sim.score += gained;
  sim.bestScore = Math.max(sim.bestScore, sim.score);
  sim.coinsEarned += coins;
  sim.tickets.splice(ticketIndex, 1);
  sim.customerReactions.push({
    id: ticket.id,
    avatarId: ticket.avatarId,
    seatIndex: ticket.seatIndex,
    guestName: ticket.guestName,
    variety: ticket.variety,
    kind: 'happy',
    text:
      ticket.variety === 'vip'
        ? `VIP Tip! +${coins}c ★`
        : ticket.variety === 'foodie'
          ? `Tip +${coins}c ♥`
          : ticket.variety === 'express'
            ? `Speed +${coins}c ⚡`
            : HAPPY_QUIPS[(ticket.id + sim.ordersServed) % HAPPY_QUIPS.length],
    timer: 1.55,
    maxTimer: 1.55,
  });
  chef.held = null;
  chef.happyTimer = 0.65;
  chef.squashX = 0.84;
  chef.squashY = 1.22;

  sim.wave = computeWaveForOrders(sim.ordersServed, sim.elapsedSeconds);
  const varietyTag =
    ticket.variety === 'vip'
      ? 'VIP Tip!'
      : ticket.variety === 'foodie'
        ? 'Foodie Tip!'
        : ticket.variety === 'express'
          ? 'Express Bonus!'
          : 'Served';
  sim.statusBanner = `${varietyTag} ${recipe.shortName} · +${gained} · +${coins} Coins`;
  sim.statusBannerTimer = 2.4;

  const isHighCombo = sim.combo >= 3;
  const comboTierBonus = Math.min(4, Math.max(0, sim.combo - 2));
  events.push({
    sound: 'serve',
    hitstop: isHighCombo ? 0.055 : 0.045,
    shakeTrauma: isHighCombo ? Math.min(0.45, 0.28 + comboTierBonus * 0.04) : 0.25,
    particleKind: 'serve',
    particleX: seatPos.x,
    particleY: seatPos.y - 0.3,
    particleColor: ticket.isVip ? '#FDE047' : '#FBBF24',
    particleCount: ticket.isVip ? 32 : 24,
    floatingText: `+${gained} (+${coins}c)${ticket.isVip ? ' ★ VIP' : perfectCount > 0 ? ' ★' : ''}`,
    floatingColor: ticket.isVip ? '#FDE047' : '#FBBF24',
    floatingX: seatPos.x,
    floatingY: seatPos.y - 0.65,
  });

  if (isHighCombo) {
    const comboLabel =
      sim.combo >= 7
        ? `${sim.combo}x UNSTOPPABLE!`
        : sim.combo >= 5
          ? `${sim.combo}x MASTER CHEF!`
          : sim.combo >= 4
            ? `${sim.combo}x SIZZLING!`
            : `${sim.combo}x ON FIRE!`;
    events.push({
      particleKind: 'combo_burst',
      particleX: seatPos.x,
      particleY: seatPos.y - 0.35,
      particleColor: sim.combo >= 5 ? '#F59E0B' : '#E3574B',
      particleCount: 22 + comboTierBonus * 8,
      comboLevel: sim.combo,
      floatingText: comboLabel,
      floatingColor: sim.combo >= 5 ? '#FDE047' : '#FB923C',
      floatingX: chef.x,
      floatingY: chef.y - 0.72,
    });
  }
  events.push({ sound: 'coin' });

  if (sim.tickets.length === 0 || (sim.mode === 'challenge' && sim.tickets.length < 2)) {
    const nextTicket = spawnTicket(sim);
    sim.spawnTimer = computeSpawnInterval(sim.wave, sim.mode);
    events.push({ sound: nextTicket.isVip ? 'vip_arrive' : 'ticket_new' });
  }
  return true;
}

export function interactWithStation(
  sim: KitchenSimulation,
  stationId: string,
  events: SimEvent[],
): boolean {
  const st = sim.stations.find((s) => s.id === stationId);
  if (!st) return false;

  const chef = sim.chef;
  const center = stationCenter(st);
  st.pulseTimer = 0.18;
  const chopMult = getChopMultiplier(sim.upgrades);

  switch (st.type) {
    case 'pantry': {
      if (!chef.held && st.pantryBase) {
        const meta = INGREDIENT_META[st.pantryBase];
        chef.held = {
          kind: meta.rawKind,
          isPerfect: false,
          plateComponents: [],
          matchedDishId: null,
        };
        chef.squashX = 0.88;
        chef.squashY = 1.15;
        events.push({
          sound: 'pickup',
          particleKind: 'sparkle',
          particleX: center.x,
          particleY: center.y,
          particleColor: meta.accent,
          particleCount: 5,
        });
        return true;
      }
      events.push({
        sound: 'error',
        floatingText: 'Hands Full!',
        floatingColor: '#F59E0B',
        floatingX: center.x,
        floatingY: center.y - 0.3,
      });
      return false;
    }

    case 'board': {
      if (st.item && isChoppable(st.item)) {
        st.isChoppingActive = true;
        st.chopProgress = Math.min(1, st.chopProgress + CHOP_TAP_AMOUNT * chopMult);
        chef.squashX = 1.16;
        chef.squashY = 0.84;

        if (st.chopProgress >= 1) {
          const result = getChopResult(st.item);
          if (result) {
            st.item = result;
            st.chopProgress = 1;
            st.isChoppingActive = false;
            events.push({
              sound: 'chop_done',
              hitstop: 0.035,
              shakeTrauma: 0.18,
              particleKind: 'chop',
              particleX: center.x,
              particleY: center.y,
              particleColor: '#86EFAC',
              particleCount: 12,
              floatingText: 'Chopped!',
              floatingColor: '#4ADE80',
              floatingX: center.x,
              floatingY: center.y - 0.35,
            });
          }
        } else {
          events.push({
            sound: 'chop',
            hitstop: 0.02,
            shakeTrauma: 0.1,
            particleKind: 'chop',
            particleX: center.x,
            particleY: center.y,
            particleColor:
              st.item === 'tomato_raw'
                ? '#F87171'
                : st.item === 'strawberry_raw'
                  ? '#FB7185'
                  : st.item === 'lettuce_raw' || st.item === 'avocado_raw'
                    ? '#4ADE80'
                    : '#FACC15',
            particleCount: 6,
          });
        }
        return true;
      }

      if (st.item && !isChoppable(st.item) && !chef.held) {
        chef.held = {
          kind: st.item,
          isPerfect: false,
          plateComponents: [],
          matchedDishId: null,
        };
        st.item = null;
        st.chopProgress = 0;
        st.isChoppingActive = false;
        st.claimedBy = null;
        events.push({ sound: 'pickup' });
        return true;
      }

      if (!st.item && chef.held && isChoppable(chef.held.kind)) {
        st.item = chef.held.kind;
        st.chopProgress = Math.min(1, CHOP_TAP_AMOUNT * chopMult);
        st.isChoppingActive = true;
        st.claimedBy = 'player';
        chef.held = null;
        events.push({
          sound: 'chop',
          particleKind: 'chop',
          particleX: center.x,
          particleY: center.y,
          particleColor: '#FDE68A',
          particleCount: 5,
        });
        return true;
      }

      events.push({ sound: 'error' });
      return false;
    }

    case 'skillet': {
      if (st.item) {
        if (chef.held) {
          events.push({
            sound: 'error',
            floatingText: 'Hands Full!',
            floatingColor: '#F59E0B',
            floatingX: center.x,
            floatingY: center.y - 0.3,
          });
          return false;
        }

        if (st.cookStage === 'burnt') {
          chef.held = {
            kind: 'burnt',
            isPerfect: false,
            plateComponents: [],
            matchedDishId: null,
          };
          st.item = null;
          st.cookProgress = 0;
          st.cookStage = 'none';
          st.claimedBy = null;
          events.push({
            sound: 'trash',
            floatingText: 'Dump in Compost',
            floatingColor: '#9CA3AF',
            floatingX: center.x,
            floatingY: center.y - 0.3,
          });
          return true;
        }

        if (st.cookProgress >= PERFECT_THRESHOLD) {
          const cookedKind = getCookResult(st.item);
          if (!cookedKind) return false;
          const isPerfect = st.cookStage === 'perfect';
          chef.held = {
            kind: cookedKind,
            isPerfect,
            plateComponents: [],
            matchedDishId: null,
          };
          st.item = null;
          st.cookProgress = 0;
          st.cookStage = 'none';
          st.claimedBy = null;

          if (isPerfect) {
            events.push({
              sound: 'perfect_grab',
              hitstop: 0.035,
              particleKind: 'sparkle',
              particleX: center.x,
              particleY: center.y,
              particleColor: '#FBBF24',
              particleCount: 14,
              floatingText: 'Perfect Sear!',
              floatingColor: '#FBBF24',
              floatingX: center.x,
              floatingY: center.y - 0.35,
            });
          } else {
            events.push({ sound: 'pickup' });
          }
          return true;
        }

        chef.held = {
          kind: st.item,
          isPerfect: false,
          plateComponents: [],
          matchedDishId: null,
        };
        st.item = null;
        st.cookProgress = 0;
        st.cookStage = 'none';
        st.claimedBy = null;
        events.push({ sound: 'pickup' });
        return true;
      }

      if (!st.item && chef.held && isCookable(chef.held.kind)) {
        st.item = chef.held.kind;
        st.cookProgress = 0;
        st.cookStage = 'cooking';
        st.claimedBy = 'player';
        chef.held = null;
        events.push({
          sound: 'sear_start',
          particleKind: 'steam',
          particleX: center.x,
          particleY: center.y,
          particleColor: '#FDE68A',
          particleCount: 6,
        });
        return true;
      }

      events.push({ sound: 'error' });
      return false;
    }

    case 'plate_mat': {
      if (chef.held && isPlatable(chef.held.kind)) {
        if (canAddToPlate(st.plateComponents, chef.held.kind)) {
          st.plateComponents.push({
            kind: chef.held.kind,
            isPerfect: chef.held.isPerfect,
          });
          st.matchedDishId = matchCompleteDish(st.plateComponents);
          st.claimedBy = 'player';
          chef.held = null;

          if (st.matchedDishId) {
            events.push({
              sound: 'perfect_ready',
              particleKind: 'sparkle',
              particleX: center.x,
              particleY: center.y,
              particleColor: '#34D399',
              particleCount: 12,
              floatingText: `${RECIPES[st.matchedDishId].shortName} Ready!`,
              floatingColor: '#34D399',
              floatingX: center.x,
              floatingY: center.y - 0.35,
            });
          } else {
            events.push({
              sound: 'place',
              particleKind: 'sparkle',
              particleX: center.x,
              particleY: center.y,
              particleColor: '#FAF8F5',
              particleCount: 5,
            });
          }
          return true;
        }
        events.push({
          sound: 'error',
          shakeTrauma: 0.12,
          floatingText: 'Wrong Combo',
          floatingColor: '#F87171',
          floatingX: center.x,
          floatingY: center.y - 0.3,
        });
        return false;
      }

      if (chef.held?.kind === 'plate' && st.plateComponents.length === 0) {
        st.plateComponents = [...chef.held.plateComponents];
        st.matchedDishId = chef.held.matchedDishId;
        st.claimedBy = 'player';
        chef.held = null;
        events.push({ sound: 'place' });
        return true;
      }

      if (!chef.held && st.plateComponents.length > 0) {
        chef.held = {
          kind: 'plate',
          isPerfect:
            st.plateComponents.every((c) => c.isPerfect) &&
            st.plateComponents.some((c) => c.isPerfect),
          plateComponents: [...st.plateComponents],
          matchedDishId: st.matchedDishId,
        };
        st.plateComponents = [];
        st.matchedDishId = null;
        st.claimedBy = null;
        events.push({ sound: 'pickup' });
        return true;
      }

      events.push({ sound: 'error' });
      return false;
    }

    case 'compost': {
      if (chef.held) {
        chef.held = null;
        events.push({
          sound: 'trash',
          particleKind: 'smoke',
          particleX: center.x,
          particleY: center.y,
          particleColor: '#9CA3AF',
          particleCount: 6,
          floatingText: 'Cleared',
          floatingColor: '#D6D3D1',
          floatingX: center.x,
          floatingY: center.y + 0.35,
        });
        return true;
      }
      return false;
    }
  }
}

export function stepSimulation(
  sim: KitchenSimulation,
  rawDt: number,
  input: InputSnapshot,
): SimEvent[] {
  const events: SimEvent[] = [];
  if (sim.outcome !== 'none') return events;

  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  if (sim.statusBannerTimer > 0) {
    sim.statusBannerTimer = Math.max(0, sim.statusBannerTimer - dt);
    if (sim.statusBannerTimer === 0) sim.statusBanner = null;
  }

  if (sim.hitstopTimer > 0) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
    return events;
  }

  sim.elapsedSeconds += dt;
  sim.timeRemaining = Math.max(0, sim.timeRemaining - dt);
  sim.wave = computeWaveForOrders(
    sim.ordersServed + (sim.bot?.ordersServed ?? 0),
    sim.elapsedSeconds,
  );

  for (let i = sim.customerReactions.length - 1; i >= 0; i--) {
    sim.customerReactions[i].timer -= dt;
    if (sim.customerReactions[i].timer <= 0) {
      sim.customerReactions.splice(i, 1);
    }
  }

  if (sim.comboTimer > 0) {
    sim.comboTimer = Math.max(0, sim.comboTimer - dt);
    if (sim.comboTimer === 0) {
      sim.combo = 0;
    }
  }

  moveChefStep(sim, dt, input, events);
  sim.nearestStationId = findNearestStationId(sim);

  if (input.interactPressed) {
    const serveTarget = findNearestServeableTicket(sim);
    if (serveTarget) {
      serveCustomerTicket(sim, serveTarget.id, events);
    } else if (sim.nearestStationId) {
      interactWithStation(sim, sim.nearestStationId, events);
    }
  }

  // Step Rival Bot Chef in Challenge Mode
  if (sim.bot) {
    stepBotChef(
      sim,
      dt,
      {
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
        perfectThreshold: PERFECT_THRESHOLD,
        comboWindow: COMBO_WINDOW,
        stationCenter,
        getSeatWorldPos,
        getSeatStandPoint,
        resolveCircleRectCollision,
        calculateServeScore,
        spawnTicket,
        computeSpawnInterval,
      },
      events,
    );
  }

  const chopMult = getChopMultiplier(sim.upgrades);
  const burnThreshold = BURNT_THRESHOLD + getBurnGraceBonus(sim.upgrades);
  const warningThreshold = WARNING_THRESHOLD + getBurnGraceBonus(sim.upgrades) * 0.5;
  let anyWarningSkillet = false;

  for (const st of sim.stations) {
    if (st.pulseTimer > 0) st.pulseTimer = Math.max(0, st.pulseTimer - dt);

    if (
      st.type === 'board' &&
      st.item &&
      isChoppable(st.item) &&
      st.isChoppingActive &&
      st.claimedBy !== 'bot'
    ) {
      const c = stationCenter(st);
      const dist = Math.hypot(c.x - sim.chef.x, c.y - sim.chef.y);
      if (dist <= INTERACT_REACH + 0.15) {
        st.chopProgress = Math.min(1, st.chopProgress + CHOP_AUTO_RATE * chopMult * dt);
        if (st.chopProgress >= 1) {
          const result = getChopResult(st.item);
          if (result) {
            st.item = result;
            st.chopProgress = 1;
            st.isChoppingActive = false;
            events.push({
              sound: 'chop_done',
              hitstop: 0.035,
              shakeTrauma: 0.16,
              particleKind: 'chop',
              particleX: c.x,
              particleY: c.y,
              particleColor: '#86EFAC',
              particleCount: 12,
              floatingText: 'Chopped!',
              floatingColor: '#4ADE80',
              floatingX: c.x,
              floatingY: c.y - 0.35,
            });
          }
        }
      } else {
        st.isChoppingActive = false;
      }
    }

    if (st.type === 'skillet' && st.item && st.cookStage !== 'burnt') {
      const prevStage = st.cookStage;
      st.cookProgress += dt / COOK_DURATION;

      let nextStage: CookStage = 'cooking';
      if (st.cookProgress >= burnThreshold) {
        nextStage = 'burnt';
        st.item = 'burnt';
        if (st.claimedBy !== 'bot') {
          sim.burntCount += 1;
        }
      } else if (st.cookProgress >= warningThreshold) {
        nextStage = 'warning';
      } else if (st.cookProgress >= PERFECT_THRESHOLD) {
        nextStage = 'perfect';
      }
      st.cookStage = nextStage;

      if (nextStage === 'warning' && st.claimedBy !== 'bot') anyWarningSkillet = true;

      if (prevStage !== nextStage && st.claimedBy !== 'bot') {
        const c = stationCenter(st);
        if (nextStage === 'perfect') {
          events.push({
            sound: 'perfect_ready',
            particleKind: 'sparkle',
            particleX: c.x,
            particleY: c.y,
            particleColor: '#FBBF24',
            particleCount: 10,
            floatingText: 'Sear Ready!',
            floatingColor: '#FBBF24',
            floatingX: c.x,
            floatingY: c.y - 0.35,
          });
        } else if (nextStage === 'warning') {
          events.push({
            sound: 'warning_tick',
            particleKind: 'smoke',
            particleX: c.x,
            particleY: c.y,
            particleColor: '#FCA5A5',
            particleCount: 6,
          });
        } else if (nextStage === 'burnt') {
          events.push({
            sound: 'burnt',
            shakeTrauma: 0.3,
            particleKind: 'smoke',
            particleX: c.x,
            particleY: c.y,
            particleColor: '#57534E',
            particleCount: 16,
            floatingText: 'Burnt!',
            floatingColor: '#EF4444',
            floatingX: c.x,
            floatingY: c.y - 0.35,
          });
        }
      }
    }
  }

  // Skillet overcook rhythmic alert
  if (sim.skilletAlertCooldown > 0) {
    sim.skilletAlertCooldown = Math.max(0, sim.skilletAlertCooldown - dt);
  }
  if (anyWarningSkillet && sim.skilletAlertCooldown <= 0) {
    sim.skilletAlertCooldown = 0.9;
    events.push({ sound: 'skillet_alert' });
  }

  // Order tickets countdown & urgent expiring alarm (walkouts reset combo without ending timed match)
  let anyUrgentTicket = false;
  for (let i = sim.tickets.length - 1; i >= 0; i--) {
    const t = sim.tickets[i];
    t.patience -= dt;
    if (t.patience > 0 && t.patience <= URGENT_ALARM_SECONDS) {
      anyUrgentTicket = true;
    }
    if (t.patience <= 0) {
      sim.tickets.splice(i, 1);
      sim.customerReactions.push({
        id: t.id,
        avatarId: t.avatarId,
        seatIndex: t.seatIndex,
        guestName: t.guestName,
        variety: t.variety,
        kind: 'upset',
        text: 'Gotta go!',
        timer: 1.35,
        maxTimer: 1.35,
      });
      sim.combo = 0;
      sim.comboTimer = 0;
      sim.statusBanner = `${t.guestName} walked out! Streak reset`;
      sim.statusBannerTimer = 2.2;
      events.push({
        sound: 'ticket_expired',
        shakeTrauma: 0.3,
      });
    }
  }

  if (sim.alarmCooldown > 0) {
    sim.alarmCooldown = Math.max(0, sim.alarmCooldown - dt);
  }
  if ((anyUrgentTicket || (sim.timeRemaining > 0 && sim.timeRemaining <= 10)) && sim.alarmCooldown <= 0) {
    sim.alarmCooldown = sim.timeRemaining <= 5 ? 0.95 : 1.45;
    events.push({ sound: 'alarm_urgent' });
  }

  // Match timer finished -> settle Solo Rush or Bot Challenge outcome!
  if (sim.timeRemaining <= 0) {
    if (sim.mode === 'challenge' && sim.bot) {
      const playerServed = sim.ordersServed;
      const botServed = sim.bot.ordersServed;
      const playerScore = Math.round(sim.score);
      const botScore = Math.round(sim.bot.score);

      if (playerServed > botServed || (playerServed === botServed && playerScore > botScore)) {
        sim.outcome = 'victory';
        sim.coinsEarned += 35;
        events.push({ sound: 'victory' });
      } else if (botServed > playerServed || botScore > playerScore) {
        sim.outcome = 'defeat';
        sim.coinsEarned += 10;
        events.push({ sound: 'defeat' });
      } else {
        sim.outcome = 'draw';
        sim.coinsEarned += 20;
        events.push({ sound: 'victory' });
      }
    } else {
      sim.outcome = 'finished';
      sim.coinsEarned += 10 + sim.ordersServed * 3;
      events.push({ sound: sim.ordersServed > 0 ? 'victory' : 'defeat' });
    }
    return events;
  }

  sim.spawnTimer -= dt;
  const minTickets = sim.mode === 'challenge' ? 2 : 1;
  if (sim.spawnTimer <= 0) {
    if (sim.tickets.length < MAX_ACTIVE_TICKETS) {
      const nextTicket = spawnTicket(sim);
      events.push({ sound: nextTicket.isVip ? 'vip_arrive' : 'ticket_new' });
    }
    sim.spawnTimer = computeSpawnInterval(sim.wave, sim.mode);
  } else if (sim.tickets.length < minTickets) {
    const nextTicket = spawnTicket(sim);
    sim.spawnTimer = computeSpawnInterval(sim.wave, sim.mode);
    events.push({ sound: nextTicket.isVip ? 'vip_arrive' : 'ticket_new' });
  }

  for (const ev of events) {
    if (ev.hitstop && ev.hitstop > sim.hitstopTimer) {
      sim.hitstopTimer = ev.hitstop;
    }
  }

  return events;
}

export function createStatsSnapshot(
  sim: KitchenSimulation,
  newlyUnlockedAchievements: RunStatsSnapshot['newlyUnlockedAchievements'] = [],
  newlyCompletedMissions: RunStatsSnapshot['newlyCompletedMissions'] = [],
): RunStatsSnapshot {
  return {
    score: Math.round(sim.score),
    bestScore: Math.round(sim.bestScore),
    coinsEarned: Math.round(sim.coinsEarned),
    durationSeconds: sim.durationSeconds,
    ordersServed: sim.ordersServed,
    botOrdersServed: sim.bot?.ordersServed ?? 0,
    botScore: Math.round(sim.bot?.score ?? 0),
    perfectDishes: sim.perfectDishes,
    burntCount: sim.burntCount,
    maxCombo: sim.maxCombo,
    elapsedSeconds: Math.round(sim.elapsedSeconds),
    wave: sim.wave,
    outcome: sim.outcome,
    mode: sim.mode,
    dailySpecialDishId: sim.dailySpecialDishId,
    newlyUnlockedAchievements,
    newlyCompletedMissions,
  };
}

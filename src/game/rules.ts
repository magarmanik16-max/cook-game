import {
  getBurnGraceBonus,
  getChopMultiplier,
  getDailySpecialForDay,
  getPatienceMultiplier,
  getSpeedMultiplier,
  getTargetOrdersForDay,
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
  DishId,
  GameMode,
  IngredientBase,
  InputSnapshot,
  KitchenSimulation,
  OrderTicket,
  RunStatsSnapshot,
  SimEvent,
  StationState,
  UpgradeLevels,
} from './types';

export const GRID_COLS = 10;
export const GRID_ROWS = 7;

export const SHIFT_TARGET_ORDERS = 8;
export const MAX_ACTIVE_TICKETS = 4;
export const MAX_STARS = 3;

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

const DEFAULT_UPGRADES: UpgradeLevels = {
  speed: 0,
  chop: 0,
  heat: 0,
  patience: 0,
  tips: 0,
};

export interface SimulationOptions {
  day?: number;
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
  });

  return [
    // Top Counter Row (row 0)
    makeStation('board_1', 'board', 'Cutting Board', 2, 0),
    makeStation('board_2', 'board', 'Cutting Board', 3, 0),
    makeStation('pass_1', 'pass', 'Service Pass', 5, 0),
    makeStation('pass_2', 'pass', 'Service Pass', 6, 0),
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

export function createInitialChef(): ChefState {
  return {
    x: 4.5,
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
  };
}

export function computeWaveForOrders(ordersServed: number, elapsedSeconds: number): number {
  if (ordersServed >= 7 || elapsedSeconds >= 105) return 3;
  if (ordersServed >= 3 || elapsedSeconds >= 45) return 2;
  return 1;
}

export function computePatienceForWave(
  wave: number,
  dishId: DishId,
  upgrades: UpgradeLevels,
  isVip: boolean,
): number {
  const recipe = RECIPES[dishId];
  const stepBonus = recipe.components.length * 6;
  const base = wave === 1 ? 38 : wave === 2 ? 34 : 30;
  const raw = (base + stepBonus) * getPatienceMultiplier(upgrades);
  return isVip ? Math.round(raw * 0.88) : Math.round(raw);
}

export function computeSpawnInterval(wave: number): number {
  if (wave === 1) return 10.2;
  if (wave === 2) return 8.4;
  return 6.9;
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
  // Occasionally favor Daily Special if compatible with current wave
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

export function spawnTicket(sim: KitchenSimulation, dishOverride?: DishId): OrderTicket {
  const idx = sim.nextTicketId;
  sim.nextTicketId += 1;
  const dishId =
    dishOverride ??
    pickRecipeForWave(sim.wave, idx * 7 + sim.ordersServed, sim.tickets, sim.dailySpecialDishId);
  const isVip = idx >= 4 && idx % 4 === 0;
  const maxPatience = computePatienceForWave(sim.wave, dishId, sim.upgrades, isVip);
  const ticket: OrderTicket = {
    id: idx,
    dishId,
    tableNumber: ((idx - 1) % 8) + 1,
    guestName: GUEST_NAMES[(idx - 1) % GUEST_NAMES.length],
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
  mode: GameMode = 'shift',
  bestScore = 0,
  options: SimulationOptions = {},
): KitchenSimulation {
  const day = Math.max(1, options.day ?? 1);
  const upgrades: UpgradeLevels = { ...DEFAULT_UPGRADES, ...(options.upgrades ?? {}) };
  const dailySpecialDishId = getDailySpecialForDay(day);

  const sim: KitchenSimulation = {
    mode,
    day,
    dailySpecialDishId,
    outcome: 'none',
    score: 0,
    bestScore,
    coinsEarned: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    ordersServed: 0,
    targetOrders: mode === 'shift' ? getTargetOrdersForDay(day) : 0,
    perfectDishes: 0,
    burntCount: 0,
    stars: MAX_STARS,
    maxStars: MAX_STARS,
    wave: 1,
    elapsedSeconds: 0,
    spawnTimer: 6.5,
    nextTicketId: 1,
    hitstopTimer: 0,
    alarmCooldown: 0,
    skilletAlertCooldown: 0,
    upgrades,
    chef: createInitialChef(),
    stations: createStations(),
    tickets: [],
    nearestStationId: null,
    statusBanner: null,
    statusBannerTimer: 0,
  };

  spawnTicket(sim, 'bruschetta');
  spawnTicket(sim, 'avo_toast');
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
    case 'pass': {
      if (held?.kind === 'plate' && held.matchedDishId) {
        const hasTicket = sim.tickets.some((t) => t.dishId === held.matchedDishId);
        return hasTicket
          ? `Ring Bell & Serve ${RECIPES[held.matchedDishId].shortName}!`
          : `No open ticket for ${RECIPES[held.matchedDishId].shortName}`;
      }
      return 'Service Pass Window';
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

export function getStationWalkStandPoint(station: StationState): { x: number; y: number } {
  if (station.row === 0) return { x: station.col + 0.5, y: 1.48 };
  if (station.col === 0) return { x: 1.48, y: station.row + 0.5 };
  if (station.col === GRID_COLS - 1) return { x: GRID_COLS - 1.48, y: station.row + 0.5 };
  if (station.row === GRID_ROWS - 1) return { x: station.col + 0.5, y: GRID_ROWS - 1.48 };
  return { x: station.col + 0.5, y: 2.48 };
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

  if (hasManualMove) {
    chef.targetStationId = null;
  } else if (chef.targetStationId) {
    const targetStation = sim.stations.find((s) => s.id === chef.targetStationId);
    if (!targetStation) {
      chef.targetStationId = null;
    } else {
      const stand = getStationWalkStandPoint(targetStation);
      let goalX = stand.x;
      let goalY = stand.y;
      const crossingIsland =
        ((chef.y < 2.9 && stand.y > 4.1) || (chef.y > 4.1 && stand.y < 2.9)) &&
        chef.x > 3.6 &&
        chef.x < 6.4 &&
        stand.x > 3.6 &&
        stand.x < 6.4;
      if (crossingIsland) {
        goalX = chef.x < 5.0 ? 3.35 : 6.65;
        goalY = 3.5;
      }

      const dx = goalX - chef.x;
      const dy = goalY - chef.y;
      const distToGoal = Math.hypot(dx, dy);

      const center = stationCenter(targetStation);
      const distToStation = Math.hypot(center.x - chef.x, center.y - chef.y);

      if (distToGoal < 0.22 || (!crossingIsland && distToStation <= INTERACT_REACH - 0.16)) {
        const fdx = center.x - chef.x;
        const fdy = center.y - chef.y;
        const flen = Math.hypot(fdx, fdy);
        if (flen > 0.001) {
          chef.facingX = fdx / flen;
          chef.facingY = fdy / flen;
        }
        const clickedId = chef.targetStationId;
        chef.targetStationId = null;
        interactWithStation(sim, clickedId, events);
      } else {
        dirX = dx / distToGoal;
        dirY = dy / distToGoal;
      }
    }
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

  const resolved = resolveCircleRectCollision(nextX, nextY, CHEF_RADIUS, 4.0, 3.0, 2.0, 1.0);
  chef.x = Math.max(minX, Math.min(maxX, resolved.x));
  chef.y = Math.max(minY, Math.min(maxY, resolved.y));

  chef.walkDistance += Math.hypot(chef.x - prevX, chef.y - prevY);
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
  isVip = false,
  isDailySpecial = false,
): number {
  const multiplier = Math.min(3.0, 1 + Math.max(0, combo - 1) * 0.25);
  const perfectBonus = perfectCount * 40;
  const speedBonus = Math.round(Math.max(0, Math.min(1, patienceRatio)) * 45);
  const specialMult = (isVip ? 1.5 : 1) * (isDailySpecial ? 1.35 : 1);
  return Math.round((recipeBaseScore + perfectBonus + speedBonus) * multiplier * specialMult);
}

export function calculateServeCoins(
  componentCount: number,
  perfectCount: number,
  isVip: boolean,
  isDailySpecial: boolean,
  upgrades: UpgradeLevels,
): number {
  const baseCoins = 8 + componentCount * 3 + perfectCount * 4;
  const bonusMult = (isVip ? 2 : 1) * (isDailySpecial ? 1.5 : 1) * getTipMultiplier(upgrades);
  return Math.max(5, Math.round(baseCoins * bonusMult));
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
        events.push({ sound: 'pickup' });
        return true;
      }

      if (!st.item && chef.held && isChoppable(chef.held.kind)) {
        st.item = chef.held.kind;
        st.chopProgress = Math.min(1, CHOP_TAP_AMOUNT * chopMult);
        st.isChoppingActive = true;
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
        events.push({ sound: 'pickup' });
        return true;
      }

      if (!st.item && chef.held && isCookable(chef.held.kind)) {
        st.item = chef.held.kind;
        st.cookProgress = 0;
        st.cookStage = 'cooking';
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
        events.push({ sound: 'pickup' });
        return true;
      }

      events.push({ sound: 'error' });
      return false;
    }

    case 'pass': {
      if (!chef.held || chef.held.kind !== 'plate' || !chef.held.matchedDishId) {
        events.push({
          sound: 'error',
          floatingText: 'Need Complete Dish!',
          floatingColor: '#F59E0B',
          floatingX: center.x,
          floatingY: center.y + 0.35,
        });
        return false;
      }

      const dishId = chef.held.matchedDishId;
      let ticketIndex = -1;
      let lowestPatience = Infinity;
      for (let i = 0; i < sim.tickets.length; i++) {
        if (sim.tickets[i].dishId === dishId && sim.tickets[i].patience < lowestPatience) {
          lowestPatience = sim.tickets[i].patience;
          ticketIndex = i;
        }
      }

      if (ticketIndex === -1) {
        events.push({
          sound: 'error',
          floatingText: `No Order for ${RECIPES[dishId].shortName}`,
          floatingColor: '#F87171',
          floatingX: center.x,
          floatingY: center.y + 0.35,
        });
        return false;
      }

      const ticket = sim.tickets[ticketIndex];
      const recipe = RECIPES[dishId];
      const perfectCount = chef.held.plateComponents.filter((c) => c.isPerfect).length;
      const patienceRatio = ticket.maxPatience > 0 ? ticket.patience / ticket.maxPatience : 0;

      sim.combo += 1;
      sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
      sim.comboTimer = COMBO_WINDOW;
      sim.ordersServed += 1;
      if (perfectCount > 0) sim.perfectDishes += 1;

      const gained = calculateServeScore(
        recipe.baseScore,
        perfectCount,
        patienceRatio,
        sim.combo,
        ticket.isVip,
        ticket.isDailySpecial,
      );
      const coins = calculateServeCoins(
        recipe.components.length,
        perfectCount,
        ticket.isVip,
        ticket.isDailySpecial,
        sim.upgrades,
      );

      sim.score += gained;
      sim.bestScore = Math.max(sim.bestScore, sim.score);
      sim.coinsEarned += coins;
      sim.tickets.splice(ticketIndex, 1);
      chef.held = null;
      chef.happyTimer = 0.65;
      chef.squashX = 0.84;
      chef.squashY = 1.22;

      sim.wave = computeWaveForOrders(sim.ordersServed, sim.elapsedSeconds);
      sim.statusBanner = `Served ${recipe.shortName}! +${gained} · +${coins} Coins`;
      sim.statusBannerTimer = 2.2;

      events.push({
        sound: 'serve',
        hitstop: 0.045,
        shakeTrauma: 0.25,
        particleKind: 'serve',
        particleX: center.x,
        particleY: center.y,
        particleColor: ticket.isVip ? '#FDE047' : '#FBBF24',
        particleCount: 26,
        floatingText: `+${gained} (+${coins}c)${perfectCount > 0 ? ' ★' : ''}`,
        floatingColor: '#FBBF24',
        floatingX: center.x,
        floatingY: center.y + 0.4,
      });
      events.push({ sound: 'coin' });

      if (sim.mode === 'shift' && sim.ordersServed >= sim.targetOrders) {
        // Day clear coin bonus!
        sim.coinsEarned += 25 + sim.day * 5;
        sim.outcome = 'victory';
        events.push({ sound: 'victory' });
      } else if (sim.tickets.length === 0) {
        const nextTicket = spawnTicket(sim);
        sim.spawnTimer = computeSpawnInterval(sim.wave);
        events.push({ sound: nextTicket.isVip ? 'vip_arrive' : 'ticket_new' });
      }
      return true;
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
  sim.wave = computeWaveForOrders(sim.ordersServed, sim.elapsedSeconds);

  if (sim.comboTimer > 0) {
    sim.comboTimer = Math.max(0, sim.comboTimer - dt);
    if (sim.comboTimer === 0) {
      sim.combo = 0;
    }
  }

  moveChefStep(sim, dt, input, events);
  sim.nearestStationId = findNearestStationId(sim);

  if (input.interactPressed && sim.nearestStationId) {
    interactWithStation(sim, sim.nearestStationId, events);
  }

  const chopMult = getChopMultiplier(sim.upgrades);
  const burnThreshold = BURNT_THRESHOLD + getBurnGraceBonus(sim.upgrades);
  const warningThreshold = WARNING_THRESHOLD + getBurnGraceBonus(sim.upgrades) * 0.5;
  let anyWarningSkillet = false;

  for (const st of sim.stations) {
    if (st.pulseTimer > 0) st.pulseTimer = Math.max(0, st.pulseTimer - dt);

    if (st.type === 'board' && st.item && isChoppable(st.item) && st.isChoppingActive) {
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
        sim.burntCount += 1;
      } else if (st.cookProgress >= warningThreshold) {
        nextStage = 'warning';
      } else if (st.cookProgress >= PERFECT_THRESHOLD) {
        nextStage = 'perfect';
      }
      st.cookStage = nextStage;

      if (nextStage === 'warning') anyWarningSkillet = true;

      if (prevStage !== nextStage) {
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

  // Order tickets countdown & urgent expiring alarm
  let anyUrgentTicket = false;
  for (let i = sim.tickets.length - 1; i >= 0; i--) {
    const t = sim.tickets[i];
    t.patience -= dt;
    if (t.patience > 0 && t.patience <= URGENT_ALARM_SECONDS) {
      anyUrgentTicket = true;
    }
    if (t.patience <= 0) {
      sim.tickets.splice(i, 1);
      sim.stars = Math.max(0, sim.stars - 1);
      sim.combo = 0;
      sim.comboTimer = 0;
      sim.statusBanner = `Table ${t.tableNumber} walked out!`;
      sim.statusBannerTimer = 2.4;
      events.push({
        sound: 'ticket_expired',
        shakeTrauma: 0.38,
      });
    }
  }

  if (sim.alarmCooldown > 0) {
    sim.alarmCooldown = Math.max(0, sim.alarmCooldown - dt);
  }
  if (anyUrgentTicket && sim.alarmCooldown <= 0 && sim.stars > 0) {
    sim.alarmCooldown = 1.45;
    events.push({ sound: 'alarm_urgent' });
  }

  if (sim.stars <= 0) {
    sim.outcome = 'defeat';
    events.push({ sound: 'defeat' });
    return events;
  }

  sim.spawnTimer -= dt;
  if (sim.spawnTimer <= 0) {
    if (sim.tickets.length < MAX_ACTIVE_TICKETS) {
      const nextTicket = spawnTicket(sim);
      events.push({ sound: nextTicket.isVip ? 'vip_arrive' : 'ticket_new' });
    }
    sim.spawnTimer = computeSpawnInterval(sim.wave);
  } else if (sim.tickets.length === 0) {
    const nextTicket = spawnTicket(sim);
    sim.spawnTimer = computeSpawnInterval(sim.wave);
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
): RunStatsSnapshot {
  return {
    score: Math.round(sim.score),
    bestScore: Math.round(sim.bestScore),
    coinsEarned: Math.round(sim.coinsEarned),
    day: sim.day,
    ordersServed: sim.ordersServed,
    targetOrders: sim.targetOrders,
    perfectDishes: sim.perfectDishes,
    maxCombo: sim.maxCombo,
    elapsedSeconds: Math.round(sim.elapsedSeconds),
    wave: sim.wave,
    starsRemaining: sim.stars,
    outcome: sim.outcome,
    mode: sim.mode,
    dailySpecialDishId: sim.dailySpecialDishId,
    newlyUnlockedAchievements,
  };
}

import {
  findShortestPathToAny,
  getStationCandidateStandPoints,
  isSegmentClear,
  KITCHEN_OBSTACLES,
  NAV_CLEARANCE,
  type NavPoint,
} from './pathfinding';
import {
  canAddToPlate,
  getChopResult,
  getCookResult,
  INGREDIENT_META,
  isChoppable,
  isCookable,
  isPlatable,
  matchCompleteDish,
  RECIPES,
} from './recipes';
import type {
  BotChefState,
  DishId,
  ItemKind,
  KitchenSimulation,
  OrderTicket,
  SimEvent,
  StationState,
} from './types';

export const BOT_SPEED = 3.65;
export const BOT_CHOP_RATE = 0.78;
export const BOT_CHEF_RADIUS = 0.34;
export const BOT_INTERACT_REACH = 1.38;
export const BOT_THINK_PAUSE = 0.22;

export function createInitialBot(): BotChefState {
  return {
    name: 'Chef Coco',
    x: 6.5,
    y: 2.05,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: 1,
    held: null,
    walkDistance: 0,
    squashX: 1,
    squashY: 1,
    happyTimer: 0,
    ordersServed: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    focusTicketId: null,
    targetStationId: null,
    targetTicketId: null,
    navPath: [],
    navGoalKey: null,
    thinkCooldown: 0.55,
  };
}

export interface BotStepHelpers {
  gridCols: number;
  gridRows: number;
  perfectThreshold: number;
  comboWindow: number;
  stationCenter: (st: StationState) => NavPoint;
  getSeatWorldPos: (seatIndex: number) => NavPoint;
  getSeatStandPoint: (seatIndex: number) => NavPoint;
  resolveCircleRectCollision: (
    x: number,
    y: number,
    r: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ) => NavPoint;
  calculateServeScore: (
    recipeBaseScore: number,
    perfectCount: number,
    patienceRatio: number,
    combo: number,
    variety: OrderTicket['variety'],
    isDailySpecial: boolean,
  ) => number;
  spawnTicket: (sim: KitchenSimulation, dishOverride?: DishId) => OrderTicket;
  computeSpawnInterval: (wave: number, mode: KitchenSimulation['mode']) => number;
}

function clearBotNav(bot: BotChefState): void {
  bot.navPath = [];
  bot.navGoalKey = null;
}

function isBotAllowedStation(st: StationState): boolean {
  return st.claimedBy !== 'player';
}

function getBotPreferredPlateMat(sim: KitchenSimulation): StationState | null {
  const plates = sim.stations.filter((s) => s.type === 'plate_mat');
  const botOwned = plates.find((p) => p.claimedBy === 'bot' && p.plateComponents.length > 0);
  if (botOwned) return botOwned;

  // Prefer plate_2 (right mat) so Player naturally keeps plate_1 (left mat)
  const plate2 = plates.find((p) => p.id === 'plate_2');
  if (plate2 && plate2.plateComponents.length === 0 && isBotAllowedStation(plate2)) {
    return plate2;
  }

  const anyEmpty = plates.find((p) => p.plateComponents.length === 0 && isBotAllowedStation(p));
  return anyEmpty ?? plate2 ?? plates[0] ?? null;
}

function pickBotFocusTicket(sim: KitchenSimulation, bot: BotChefState): OrderTicket | null {
  if (sim.tickets.length === 0) return null;

  // Keep current focus ticket if it still exists and matches whatever Coco already started plating
  const botPlate = sim.stations.find(
    (s) => s.type === 'plate_mat' && s.claimedBy === 'bot' && s.plateComponents.length > 0,
  );
  if (botPlate) {
    const matchingPlateTickets = sim.tickets.filter((t) => {
      const recipe = RECIPES[t.dishId];
      return botPlate.plateComponents.every((c) => recipe.components.includes(c.kind));
    });
    if (matchingPlateTickets.length > 0) {
      const existing = matchingPlateTickets.find((t) => t.id === bot.focusTicketId);
      if (existing) return existing;
      return matchingPlateTickets.reduce((a, b) => (a.patience < b.patience ? a : b));
    }
  }

  const current = sim.tickets.find((t) => t.id === bot.focusTicketId);
  if (current) return current;

  // Prefer seat 1/2/3 or quick 2-step recipes to race cleanly alongside the player
  const sorted = [...sim.tickets].sort((a, b) => {
    const aSteps = RECIPES[a.dishId].steps.length;
    const bSteps = RECIPES[b.dishId].steps.length;
    if (aSteps !== bSteps) return aSteps - bSteps;
    return a.patience - b.patience;
  });
  return sorted[0];
}

function findBotPlateAccepting(
  sim: KitchenSimulation,
  kind: Exclude<ItemKind, 'plate' | 'burnt'>,
): StationState | null {
  const plates = sim.stations.filter((s) => s.type === 'plate_mat');
  // 1. Existing bot-owned partial plate that accepts this ingredient
  const botPartial = plates.find(
    (p) =>
      p.claimedBy === 'bot' &&
      p.plateComponents.length > 0 &&
      canAddToPlate(p.plateComponents, kind),
  );
  if (botPartial) return botPartial;

  // 2. Empty plate_2 first, then any empty plate
  const plate2 = plates.find((p) => p.id === 'plate_2' && p.plateComponents.length === 0);
  if (plate2) return plate2;
  const anyEmpty = plates.find((p) => p.plateComponents.length === 0);
  return anyEmpty ?? null;
}

function chooseBotDecision(
  sim: KitchenSimulation,
  bot: BotChefState,
): { stationId: string | null; ticketId: number | null } {
  const compost = sim.stations.find((s) => s.type === 'compost') ?? null;

  // 1. Holding a finished plate -> serve matching customer immediately!
  if (bot.held && bot.held.kind === 'plate') {
    if (bot.held.matchedDishId) {
      const matching = sim.tickets
        .filter((t) => t.dishId === bot.held!.matchedDishId)
        .sort((a, b) => a.patience - b.patience);
      if (matching.length > 0) {
        bot.focusTicketId = matching[0].id;
        return { stationId: null, ticketId: matching[0].id };
      }
    }
    // No customer wants this plate anymore -> compost to avoid stalling
    return { stationId: compost?.id ?? null, ticketId: null };
  }

  // 2. Holding burnt food -> dump in compost
  if (bot.held && bot.held.kind === 'burnt') {
    return { stationId: compost?.id ?? null, ticketId: null };
  }

  // 3. Holding a platable item -> place onto Coco's plating mat
  if (bot.held && isPlatable(bot.held.kind)) {
    const plate = findBotPlateAccepting(sim, bot.held.kind);
    if (plate) return { stationId: plate.id, ticketId: null };
    return { stationId: compost?.id ?? null, ticketId: null };
  }

  // 4. Holding a choppable raw ingredient -> head to board_2 (or board_1 if empty)
  if (bot.held && isChoppable(bot.held.kind)) {
    const boards = sim.stations.filter((s) => s.type === 'board');
    const b2 = boards.find((b) => b.id === 'board_2' && !b.item);
    if (b2) return { stationId: b2.id, ticketId: null };
    const anyEmpty = boards.find((b) => !b.item);
    if (anyEmpty) return { stationId: anyEmpty.id, ticketId: null };
    return { stationId: compost?.id ?? null, ticketId: null };
  }

  // 5. Holding a cookable item -> head to skillet_2 (or skillet_1 if empty)
  if (bot.held && isCookable(bot.held.kind)) {
    const skillets = sim.stations.filter((s) => s.type === 'skillet');
    const s2 = skillets.find((s) => s.id === 'skillet_2' && !s.item);
    if (s2) return { stationId: s2.id, ticketId: null };
    const anyEmpty = skillets.find((s) => !s.item);
    if (anyEmpty) return { stationId: anyEmpty.id, ticketId: null };
    return { stationId: compost?.id ?? null, ticketId: null };
  }

  // --- Empty-handed decisions ---

  // 6. Pick up any completed dish sitting on Coco's plate mat
  const readyBotPlate = sim.stations.find(
    (s) =>
      s.type === 'plate_mat' &&
      s.claimedBy === 'bot' &&
      s.matchedDishId !== null &&
      sim.tickets.some((t) => t.dishId === s.matchedDishId),
  );
  if (readyBotPlate) {
    return { stationId: readyBotPlate.id, ticketId: null };
  }

  // 7. Pull any ready/warning/burnt food off Coco's skillet before it ruins
  const readySkillet = sim.stations.find(
    (s) =>
      s.type === 'skillet' &&
      s.claimedBy === 'bot' &&
      s.item !== null &&
      (s.cookStage === 'perfect' || s.cookStage === 'warning' || s.cookStage === 'burnt'),
  );
  if (readySkillet) {
    return { stationId: readySkillet.id, ticketId: null };
  }

  // 8. Finish chopping or pick up chopped ingredient on Coco's cutting board
  const activeBotBoard = sim.stations.find(
    (s) => s.type === 'board' && s.claimedBy === 'bot' && s.item !== null,
  );
  if (activeBotBoard) {
    return { stationId: activeBotBoard.id, ticketId: null };
  }

  // 9. Clear stale bot plate if no active customer wants any dish compatible with it
  const staleBotPlate = sim.stations.find(
    (s) =>
      s.type === 'plate_mat' &&
      s.claimedBy === 'bot' &&
      s.plateComponents.length > 0 &&
      !sim.tickets.some((t) => {
        const recipe = RECIPES[t.dishId];
        return s.plateComponents.every((c) => recipe.components.includes(c.kind));
      }),
  );
  if (staleBotPlate) {
    return { stationId: staleBotPlate.id, ticketId: null };
  }

  // 10. Pick focus ticket and gather the next missing ingredient
  const focus = pickBotFocusTicket(sim, bot);
  if (!focus) return { stationId: null, ticketId: null };
  bot.focusTicketId = focus.id;

  const recipe = RECIPES[focus.dishId];
  const plateMat = getBotPreferredPlateMat(sim);
  const platedKinds = new Set(plateMat?.plateComponents.map((c) => c.kind) ?? []);

  // Check if any missing step is currently cooking on Coco's skillet
  const botCookingSkillets = sim.stations.filter(
    (s) => s.type === 'skillet' && s.claimedBy === 'bot' && s.item !== null,
  );
  const cookingResults = new Set(
    botCookingSkillets.map((s) => (s.item ? getCookResult(s.item) : null)).filter(Boolean),
  );

  const missingSteps = recipe.steps.filter((step) => !platedKinds.has(step.resultKind));
  const nextStep =
    missingSteps.find((step) => !cookingResults.has(step.resultKind)) ?? missingSteps[0];

  if (!nextStep) {
    // All steps are plated! Go grab the plate
    return { stationId: plateMat?.id ?? null, ticketId: null };
  }

  // If the only remaining step is currently searing on Coco's skillet, wait right beside it!
  if (cookingResults.has(nextStep.resultKind) && botCookingSkillets.length > 0) {
    return { stationId: botCookingSkillets[0].id, ticketId: null };
  }

  // Otherwise go pick up the raw ingredient from the matching pantry crate
  const pantry = sim.stations.find((s) => s.type === 'pantry' && s.pantryBase === nextStep.base);
  if (pantry) {
    return { stationId: pantry.id, ticketId: null };
  }

  return { stationId: null, ticketId: null };
}

function botInteractWithStation(
  sim: KitchenSimulation,
  bot: BotChefState,
  station: StationState,
  helpers: BotStepHelpers,
  events: SimEvent[],
): boolean {
  const center = helpers.stationCenter(station);
  station.pulseTimer = 0.14;

  switch (station.type) {
    case 'pantry': {
      if (!bot.held && station.pantryBase) {
        const meta = INGREDIENT_META[station.pantryBase];
        bot.held = {
          kind: meta.rawKind,
          isPerfect: false,
          plateComponents: [],
          matchedDishId: null,
        };
        bot.squashX = 0.9;
        bot.squashY = 1.12;
        events.push({
          particleKind: 'sparkle',
          particleX: center.x,
          particleY: center.y,
          particleColor: '#C084FC',
          particleCount: 4,
        });
        return true;
      }
      return false;
    }

    case 'board': {
      if (station.item && isChoppable(station.item)) {
        station.isChoppingActive = true;
        station.claimedBy = 'bot';
        return true;
      }
      if (station.item && !isChoppable(station.item) && !bot.held) {
        bot.held = {
          kind: station.item,
          isPerfect: false,
          plateComponents: [],
          matchedDishId: null,
        };
        station.item = null;
        station.chopProgress = 0;
        station.isChoppingActive = false;
        station.claimedBy = null;
        return true;
      }
      if (!station.item && bot.held && isChoppable(bot.held.kind)) {
        station.item = bot.held.kind;
        station.chopProgress = 0.18;
        station.isChoppingActive = true;
        station.claimedBy = 'bot';
        bot.held = null;
        events.push({
          particleKind: 'chop',
          particleX: center.x,
          particleY: center.y,
          particleColor: '#E9D5FF',
          particleCount: 4,
        });
        return true;
      }
      return false;
    }

    case 'skillet': {
      if (station.item) {
        if (bot.held) return false;
        if (station.cookStage === 'burnt') {
          bot.held = {
            kind: 'burnt',
            isPerfect: false,
            plateComponents: [],
            matchedDishId: null,
          };
          station.item = null;
          station.cookProgress = 0;
          station.cookStage = 'none';
          station.claimedBy = null;
          return true;
        }
        if (station.cookProgress >= helpers.perfectThreshold) {
          const cooked = getCookResult(station.item);
          if (!cooked) return false;
          bot.held = {
            kind: cooked,
            isPerfect: station.cookStage === 'perfect',
            plateComponents: [],
            matchedDishId: null,
          };
          station.item = null;
          station.cookProgress = 0;
          station.cookStage = 'none';
          station.claimedBy = null;
          events.push({
            particleKind: 'sparkle',
            particleX: center.x,
            particleY: center.y,
            particleColor: '#E9D5FF',
            particleCount: 8,
          });
          return true;
        }
        // Still cooking — wait cleanly near the skillet
        return false;
      }

      if (!station.item && bot.held && isCookable(bot.held.kind)) {
        station.item = bot.held.kind;
        station.cookProgress = 0;
        station.cookStage = 'cooking';
        station.claimedBy = 'bot';
        bot.held = null;
        events.push({
          particleKind: 'steam',
          particleX: center.x,
          particleY: center.y,
          particleColor: '#FDE68A',
          particleCount: 5,
        });
        return true;
      }
      return false;
    }

    case 'plate_mat': {
      if (bot.held && isPlatable(bot.held.kind)) {
        if (canAddToPlate(station.plateComponents, bot.held.kind)) {
          station.plateComponents.push({
            kind: bot.held.kind,
            isPerfect: bot.held.isPerfect,
          });
          station.matchedDishId = matchCompleteDish(station.plateComponents);
          station.claimedBy = 'bot';
          bot.held = null;
          events.push({
            particleKind: 'sparkle',
            particleX: center.x,
            particleY: center.y,
            particleColor: '#C084FC',
            particleCount: 6,
          });
          return true;
        }
        return false;
      }

      if (!bot.held && station.plateComponents.length > 0) {
        bot.held = {
          kind: 'plate',
          isPerfect:
            station.plateComponents.every((c) => c.isPerfect) &&
            station.plateComponents.some((c) => c.isPerfect),
          plateComponents: [...station.plateComponents],
          matchedDishId: station.matchedDishId,
        };
        station.plateComponents = [];
        station.matchedDishId = null;
        station.claimedBy = null;
        return true;
      }
      return false;
    }

    case 'compost': {
      if (bot.held) {
        bot.held = null;
        events.push({
          particleKind: 'smoke',
          particleX: center.x,
          particleY: center.y,
          particleColor: '#A8A29E',
          particleCount: 5,
        });
        return true;
      }
      return false;
    }
  }
}

function botServeTicket(
  sim: KitchenSimulation,
  bot: BotChefState,
  ticketId: number,
  helpers: BotStepHelpers,
  events: SimEvent[],
): boolean {
  const idx = sim.tickets.findIndex((t) => t.id === ticketId);
  if (idx === -1) return false;
  const ticket = sim.tickets[idx];
  if (!bot.held || bot.held.kind !== 'plate' || bot.held.matchedDishId !== ticket.dishId) {
    return false;
  }

  const recipe = RECIPES[ticket.dishId];
  const seatPos = helpers.getSeatWorldPos(ticket.seatIndex);
  const perfectCount = bot.held.plateComponents.filter((c) => c.isPerfect).length;
  const patienceRatio = ticket.maxPatience > 0 ? ticket.patience / ticket.maxPatience : 0;

  bot.combo += 1;
  bot.comboTimer = helpers.comboWindow;
  bot.ordersServed += 1;

  const gained = helpers.calculateServeScore(
    recipe.baseScore,
    perfectCount,
    patienceRatio,
    bot.combo,
    ticket.variety,
    ticket.isDailySpecial,
  );
  bot.score += gained;
  bot.held = null;
  bot.happyTimer = 0.65;
  bot.squashX = 0.86;
  bot.squashY = 1.2;
  bot.focusTicketId = null;

  sim.tickets.splice(idx, 1);
  sim.customerReactions.push({
    id: ticket.id,
    avatarId: ticket.avatarId,
    seatIndex: ticket.seatIndex,
    guestName: ticket.guestName,
    variety: ticket.variety,
    kind: 'happy',
    text: `Coco served! +1`,
    timer: 1.45,
    maxTimer: 1.45,
  });

  events.push({
    sound: 'place',
    particleKind: 'serve',
    particleX: seatPos.x,
    particleY: seatPos.y - 0.3,
    particleColor: '#C084FC',
    particleCount: 16,
    floatingText: `Coco +1 (${gained})`,
    floatingColor: '#9333EA',
    floatingX: seatPos.x,
    floatingY: seatPos.y - 0.65,
  });

  if (sim.tickets.length < 2) {
    const nextTicket = helpers.spawnTicket(sim);
    sim.spawnTimer = helpers.computeSpawnInterval(sim.wave, sim.mode);
    events.push({ sound: nextTicket.isVip ? 'vip_arrive' : 'ticket_new' });
  }
  return true;
}

export function stepBotChef(
  sim: KitchenSimulation,
  dt: number,
  helpers: BotStepHelpers,
  events: SimEvent[],
): void {
  const bot = sim.bot;
  if (!bot) return;

  if (bot.happyTimer > 0) bot.happyTimer = Math.max(0, bot.happyTimer - dt);
  if (bot.comboTimer > 0) {
    bot.comboTimer = Math.max(0, bot.comboTimer - dt);
    if (bot.comboTimer === 0) bot.combo = 0;
  }

  const relax = 1 - Math.exp(-14 * dt);
  bot.squashX += (1 - bot.squashX) * relax;
  bot.squashY += (1 - bot.squashY) * relax;

  // Progress chopping on any bot-claimed cutting board while Coco stands nearby
  for (const st of sim.stations) {
    if (st.type === 'board' && st.claimedBy === 'bot' && st.item && isChoppable(st.item)) {
      const c = helpers.stationCenter(st);
      if (Math.hypot(c.x - bot.x, c.y - bot.y) <= BOT_INTERACT_REACH + 0.18) {
        st.isChoppingActive = true;
        st.chopProgress = Math.min(1, st.chopProgress + BOT_CHOP_RATE * dt);
        if (st.chopProgress >= 1) {
          const result = getChopResult(st.item);
          if (result) {
            st.item = result;
            st.chopProgress = 1;
            st.isChoppingActive = false;
            events.push({
              particleKind: 'chop',
              particleX: c.x,
              particleY: c.y,
              particleColor: '#C084FC',
              particleCount: 8,
            });
          }
        }
      }
    }
  }

  if (bot.thinkCooldown > 0) {
    bot.thinkCooldown = Math.max(0, bot.thinkCooldown - dt);
    const damp = Math.exp(-18 * dt);
    bot.vx *= damp;
    bot.vy *= damp;
    return;
  }

  // Decide next target dynamically
  const decision = chooseBotDecision(sim, bot);
  bot.targetStationId = decision.stationId;
  bot.targetTicketId = decision.ticketId;

  let dirX = 0;
  let dirY = 0;

  const ensureBotNav = (goalKey: string, candidates: readonly NavPoint[]): NavPoint | null => {
    const curPos: NavPoint = { x: bot.x, y: bot.y };
    const needsPlan =
      bot.navGoalKey !== goalKey ||
      bot.navPath.length === 0 ||
      !isSegmentClear(curPos, bot.navPath[0], BOT_CHEF_RADIUS + 0.01);

    if (needsPlan) {
      bot.navPath = findShortestPathToAny(curPos, candidates, NAV_CLEARANCE);
      bot.navGoalKey = goalKey;
    }

    while (bot.navPath.length > 1) {
      const wp = bot.navPath[0];
      if (
        Math.hypot(wp.x - bot.x, wp.y - bot.y) <= 0.22 ||
        isSegmentClear(curPos, bot.navPath[1], NAV_CLEARANCE)
      ) {
        bot.navPath.shift();
      } else {
        break;
      }
    }
    return bot.navPath[0] ?? null;
  };

  if (bot.targetStationId) {
    const st = sim.stations.find((s) => s.id === bot.targetStationId);
    if (st) {
      const candidates = getStationCandidateStandPoints(st);
      const nextWp = ensureBotNav(`bot_st:${st.id}`, candidates);
      const finalWp = bot.navPath[bot.navPath.length - 1] ?? candidates[0];
      const center = helpers.stationCenter(st);
      const distToFinal = Math.hypot(finalWp.x - bot.x, finalWp.y - bot.y);
      const distToStation = Math.hypot(center.x - bot.x, center.y - bot.y);
      const onFinalLeg = bot.navPath.length <= 1;

      if (onFinalLeg && (distToFinal < 0.24 || distToStation <= BOT_INTERACT_REACH - 0.16)) {
        const fdx = center.x - bot.x;
        const fdy = center.y - bot.y;
        const flen = Math.hypot(fdx, fdy);
        if (flen > 0.001) {
          bot.facingX = fdx / flen;
          bot.facingY = fdy / flen;
        }
        const acted = botInteractWithStation(sim, bot, st, helpers, events);
        if (acted && !(st.type === 'board' && st.item && isChoppable(st.item))) {
          clearBotNav(bot);
          bot.thinkCooldown = BOT_THINK_PAUSE;
        }
      } else if (nextWp) {
        const dx = nextWp.x - bot.x;
        const dy = nextWp.y - bot.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) {
          dirX = dx / d;
          dirY = dy / d;
        }
      }
    }
  } else if (bot.targetTicketId !== null) {
    const ticket = sim.tickets.find((t) => t.id === bot.targetTicketId);
    if (ticket) {
      const stand = helpers.getSeatStandPoint(ticket.seatIndex);
      const seatWorld = helpers.getSeatWorldPos(ticket.seatIndex);
      const nextWp = ensureBotNav(`bot_tk:${ticket.id}:${ticket.seatIndex}`, [stand]);
      const finalWp = bot.navPath[bot.navPath.length - 1] ?? stand;
      const distToFinal = Math.hypot(finalWp.x - bot.x, finalWp.y - bot.y);
      const distToCustomer = Math.hypot(seatWorld.x - bot.x, seatWorld.y - bot.y);
      const onFinalLeg = bot.navPath.length <= 1;

      if (onFinalLeg && (distToFinal < 0.26 || distToCustomer <= 1.25)) {
        bot.facingX = 0;
        bot.facingY = 1;
        botServeTicket(sim, bot, ticket.id, helpers, events);
        clearBotNav(bot);
        bot.thinkCooldown = BOT_THINK_PAUSE + 0.14;
      } else if (nextWp) {
        const dx = nextWp.x - bot.x;
        const dy = nextWp.y - bot.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) {
          dirX = dx / d;
          dirY = dy / d;
        }
      }
    }
  } else {
    clearBotNav(bot);
  }

  const len = Math.hypot(dirX, dirY);
  if (len > 0.001) {
    const nx = dirX / len;
    const ny = dirY / len;
    bot.facingX = nx;
    bot.facingY = ny;
    bot.vx = nx * BOT_SPEED;
    bot.vy = ny * BOT_SPEED;
  } else {
    const damp = Math.exp(-18 * dt);
    bot.vx *= damp;
    bot.vy *= damp;
  }

  const prevX = bot.x;
  const prevY = bot.y;
  let nextX = bot.x + bot.vx * dt;
  let nextY = bot.y + bot.vy * dt;

  const minX = 1.0 + BOT_CHEF_RADIUS;
  const maxX = helpers.gridCols - 1.0 - BOT_CHEF_RADIUS;
  const minY = 1.0 + BOT_CHEF_RADIUS;
  const maxY = helpers.gridRows - 1.0 - BOT_CHEF_RADIUS;

  nextX = Math.max(minX, Math.min(maxX, nextX));
  nextY = Math.max(minY, Math.min(maxY, nextY));

  for (const rect of KITCHEN_OBSTACLES) {
    const resolved = helpers.resolveCircleRectCollision(
      nextX,
      nextY,
      BOT_CHEF_RADIUS,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
    );
    nextX = resolved.x;
    nextY = resolved.y;
  }

  bot.x = Math.max(minX, Math.min(maxX, nextX));
  bot.y = Math.max(minY, Math.min(maxY, nextY));

  const moved = Math.hypot(bot.x - prevX, bot.y - prevY);
  if (len > 0.5 && dt > 0.001 && moved < 0.004) {
    bot.navGoalKey = null;
  }
  bot.walkDistance += moved;
}

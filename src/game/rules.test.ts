import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampToWalkablePoint,
  findNavPath,
  getStationCandidateStandPoints,
  isSegmentClear,
  NAV_CLEARANCE,
} from './pathfinding';
import {
  createDefaultProgress,
  finalizeShiftProgress,
  purchaseUpgrade,
  selectOrUnlockTheme,
} from './progression';
import { canAddToPlate, matchCompleteDish } from './recipes';
import {
  BURNT_THRESHOLD,
  calculateServeCoins,
  COOK_DURATION,
  createInitialSimulation,
  interactWithStation,
  PERFECT_THRESHOLD,
  pickCustomerVariety,
  serveCustomerTicket,
  stepSimulation,
  URGENT_ALARM_SECONDS,
} from './rules';
import type { HeldItem, InputSnapshot, SimEvent } from './types';

const IDLE_INPUT: InputSnapshot = {
  moveX: 0,
  moveY: 0,
  interactPressed: false,
  dashPressed: false,
};

const getHeld = (sim: ReturnType<typeof createInitialSimulation>): HeldItem | null => sim.chef.held;

test('recipe plating validates bruschetta, berry toast, and incompatible additions', () => {
  assert.equal(canAddToPlate([], 'bun'), true);
  assert.equal(canAddToPlate([{ kind: 'bun', isPerfect: false }], 'tomato_chopped'), true);
  assert.equal(canAddToPlate([{ kind: 'bun', isPerfect: false }], 'strawberry_chopped'), true);
  assert.equal(canAddToPlate([{ kind: 'bun', isPerfect: false }], 'bun'), false);

  assert.equal(
    matchCompleteDish([
      { kind: 'bun', isPerfect: false },
      { kind: 'egg_cooked', isPerfect: true },
      { kind: 'strawberry_chopped', isPerfect: false },
    ]),
    'berry_toast',
  );
  assert.equal(
    matchCompleteDish([
      { kind: 'bun', isPerfect: false },
      { kind: 'avocado_chopped', isPerfect: false },
    ]),
    'avo_toast',
  );
  assert.equal(matchCompleteDish([{ kind: 'bun', isPerfect: false }]), null);
});

test('full bruschetta prep, plate, and serve loop awards score, coins, and increments orders', () => {
  const sim = createInitialSimulation('solo');
  const events: SimEvent[] = [];

  assert.equal(interactWithStation(sim, 'pantry_bun', events), true);
  assert.equal(getHeld(sim)?.kind, 'bun');

  assert.equal(interactWithStation(sim, 'plate_1', events), true);
  assert.equal(getHeld(sim), null);

  assert.equal(interactWithStation(sim, 'pantry_tomato', events), true);
  assert.equal(interactWithStation(sim, 'board_1', events), true);
  assert.equal(interactWithStation(sim, 'board_1', events), true);
  assert.equal(interactWithStation(sim, 'board_1', events), true);
  assert.equal(interactWithStation(sim, 'board_1', events), true);
  assert.equal(getHeld(sim)?.kind, 'tomato_chopped');

  assert.equal(interactWithStation(sim, 'plate_1', events), true);
  const mat = sim.stations.find((s) => s.id === 'plate_1')!;
  assert.equal(mat.matchedDishId, 'bruschetta');

  assert.equal(interactWithStation(sim, 'plate_1', events), true);
  assert.equal(getHeld(sim)?.kind, 'plate');
  assert.equal(getHeld(sim)?.matchedDishId, 'bruschetta');

  const ticket = sim.tickets.find((t) => t.dishId === 'bruschetta')!;
  assert.equal(serveCustomerTicket(sim, ticket.id, events), true);
  assert.equal(sim.ordersServed, 1);
  assert.ok(sim.score > 120);
  assert.ok(sim.coinsEarned > 0);
  assert.equal(sim.combo, 1);
});

test('skillet cooking transitions through perfect sear window to burnt', () => {
  const sim = createInitialSimulation('solo');
  const events: SimEvent[] = [];

  assert.equal(interactWithStation(sim, 'pantry_egg', events), true);
  assert.equal(interactWithStation(sim, 'skillet_1', events), true);

  const skillet = sim.stations.find((s) => s.id === 'skillet_1')!;
  assert.equal(skillet.cookStage, 'cooking');

  const perfectTime = COOK_DURATION * (PERFECT_THRESHOLD + 0.05);
  const stepsToPerfect = Math.ceil(perfectTime / 0.04);
  for (let i = 0; i < stepsToPerfect; i++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
  }
  assert.equal(skillet.cookStage, 'perfect');

  const burnRemain = COOK_DURATION * (BURNT_THRESHOLD - PERFECT_THRESHOLD + 0.1);
  const stepsToBurn = Math.ceil(burnRemain / 0.04);
  for (let i = 0; i < stepsToBurn; i++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
  }
  assert.equal(skillet.cookStage, 'burnt');
  assert.equal(skillet.item, 'burnt');
});

test('expiring ticket emits urgent alarm cue and resets combo while timed match continues to 0:00', () => {
  const sim = createInitialSimulation('solo', 0, { durationSeconds: 30 });
  sim.combo = 3;
  sim.tickets = [
    {
      id: 1,
      dishId: 'bruschetta',
      tableNumber: 1,
      guestName: 'Clara',
      avatarId: 0,
      seatIndex: 0,
      dialogue: 'Fresh bruschetta!',
      variety: 'regular',
      maxPatience: 40,
      patience: URGENT_ALARM_SECONDS - 1,
      createdAtElapsed: 0,
      isVip: false,
      isDailySpecial: false,
    },
  ];
  const alarmEvents = stepSimulation(sim, 0.04, IDLE_INPUT);
  assert.ok(alarmEvents.some((e) => e.sound === 'alarm_urgent'));

  sim.tickets[0].patience = 0.02;
  stepSimulation(sim, 0.04, IDLE_INPUT);
  assert.equal(sim.combo, 0);
  assert.equal(sim.outcome, 'none');

  // Running the clock down to 0 finishes the Solo Rush match
  sim.timeRemaining = 0.02;
  stepSimulation(sim, 0.04, IDLE_INPUT);
  assert.equal(sim.timeRemaining, 0);
  assert.equal(sim.outcome, 'finished');
});

test('shop upgrades, themes, and timed match progression/achievements work deterministically', () => {
  let prog = createDefaultProgress();
  prog.coins = 150;
  const up = purchaseUpgrade(prog, 'speed');
  assert.equal(up.purchased, true);
  assert.equal(up.next.upgrades.speed, 1);
  assert.equal(up.next.coins, 110);

  const th = selectOrUnlockTheme(up.next, 'patisserie');
  assert.equal(th.changed, true);
  assert.equal(th.next.selectedTheme, 'patisserie');
  assert.equal(th.next.coins, 30);

  const fin = finalizeShiftProgress(th.next, {
    score: 1450,
    coinsEarned: 55,
    ordersServed: 8,
    perfectDishes: 5,
    maxCombo: 5,
    wonChallenge: true,
  });
  assert.equal(fin.nextProgress.challengeWins, 1);
  assert.equal(fin.nextProgress.bestScore, 1450);
  assert.equal(fin.nextProgress.bestServed, 8);
  assert.ok(fin.newlyUnlocked.includes('first_serve'));
  assert.ok(fin.newlyUnlocked.includes('perfect_chef'));
  assert.ok(fin.newlyUnlocked.includes('combo_five'));
  assert.ok(fin.newlyUnlocked.includes('day_three'));
  assert.equal(fin.nextProgress.coins, 30 + 55 + 20 + 35 + 40 + 60);
});

test('tap-to-move station queuing, floor target navigation, and customer happy reaction on serve', () => {
  const sim = createInitialSimulation('solo');
  sim.chef.targetStationId = 'pantry_tomato';
  sim.chef.queuedStationId = 'board_1';

  for (let i = 0; i < 60; i++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
    if (sim.chef.held?.kind === 'tomato_raw' && sim.chef.targetStationId === 'board_1') {
      break;
    }
  }
  assert.equal(sim.chef.held?.kind, 'tomato_raw');
  assert.equal(sim.chef.targetStationId, 'board_1');
  assert.equal(sim.chef.queuedStationId, null);

  for (let i = 0; i < 60; i++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
    if (sim.chef.targetStationId === null && sim.chef.held === null) {
      break;
    }
  }
  assert.equal(sim.chef.held, null);
  const board = sim.stations.find((s) => s.id === 'board_1')!;
  assert.equal(board.item, 'tomato_raw');

  // Floor targetPoint navigation
  sim.chef.targetPoint = { x: 2.5, y: 4.6 };
  for (let i = 0; i < 75; i++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
    if (!sim.chef.targetPoint) break;
  }
  assert.equal(sim.chef.targetPoint, null);
  assert.ok(Math.hypot(sim.chef.x - 2.5, sim.chef.y - 4.6) < 0.25);

  // Serve reaction & tap-customer queuing check
  const ticket = sim.tickets[0];
  sim.chef.held = {
    kind: 'plate',
    isPerfect: true,
    plateComponents:
      ticket.dishId === 'bruschetta'
        ? [
            { kind: 'bun', isPerfect: false },
            { kind: 'tomato_chopped', isPerfect: false },
          ]
        : [
            { kind: 'bun', isPerfect: false },
            { kind: 'avocado_chopped', isPerfect: false },
          ],
    matchedDishId: ticket.dishId,
  };
  sim.chef.targetTicketId = ticket.id;
  for (let i = 0; i < 80; i++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
    if (sim.ordersServed >= 1) break;
  }
  assert.equal(sim.ordersServed, 1);
  assert.equal(sim.customerReactions.length, 1);
  assert.equal(sim.customerReactions[0].kind, 'happy');
});

test('customer varieties pay extra tips (VIP 2x, Foodie 1.6x, Express 1.4x)', () => {
  const zeroUp = { speed: 0, chop: 0, heat: 0, patience: 0, tips: 0 };
  const regCoins = calculateServeCoins(2, 0, 'regular', false, zeroUp);
  const expCoins = calculateServeCoins(2, 0, 'express', false, zeroUp);
  const foodieCoins = calculateServeCoins(2, 0, 'foodie', false, zeroUp);
  const vipCoins = calculateServeCoins(2, 0, 'vip', false, zeroUp);

  assert.ok(vipCoins >= foodieCoins);
  assert.ok(foodieCoins >= expCoins);
  assert.ok(expCoins > regCoins);
  assert.equal(vipCoins, regCoins * 2);

  assert.equal(pickCustomerVariety(2), 'foodie');
  assert.equal(pickCustomerVariety(3), 'express');
  assert.equal(pickCustomerVariety(4), 'vip');
});

test('A* pathfinding routes smoothly around center plating island on horizontal, vertical, and diagonal trips', () => {
  const cases: Array<{ label: string; start: { x: number; y: number }; goal: { x: number; y: number } }> = [
    { label: 'horizontal left->right across island', start: { x: 1.48, y: 3.5 }, goal: { x: 8.52, y: 3.5 } },
    { label: 'horizontal right->left across island', start: { x: 8.52, y: 3.5 }, goal: { x: 1.48, y: 3.5 } },
    { label: 'diagonal top-left->bottom-right', start: { x: 1.48, y: 1.5 }, goal: { x: 8.52, y: 5.5 } },
    { label: 'diagonal bottom-left->top-right', start: { x: 1.48, y: 5.5 }, goal: { x: 8.52, y: 1.5 } },
    { label: 'vertical top->bottom through island', start: { x: 5.0, y: 1.5 }, goal: { x: 5.0, y: 5.5 } },
    { label: 'squeezed against island edge', start: { x: 3.66, y: 3.5 }, goal: { x: 6.5, y: 3.5 } },
  ];

  for (const tc of cases) {
    const path = findNavPath(tc.start, tc.goal, NAV_CLEARANCE);
    assert.ok(path.length >= 2, `${tc.label}: expected detour waypoints around island`);
    let prev = clampToWalkablePoint(tc.start.x, tc.start.y, NAV_CLEARANCE);
    for (const wp of path) {
      assert.ok(
        isSegmentClear(prev, wp, NAV_CLEARANCE - 0.01),
        `${tc.label}: segment (${prev.x.toFixed(2)},${prev.y.toFixed(2)}) -> (${wp.x.toFixed(2)},${wp.y.toFixed(2)}) must clear island`,
      );
      prev = wp;
    }
    const end = path[path.length - 1];
    assert.ok(Math.hypot(end.x - tc.goal.x, end.y - tc.goal.y) < 0.05, `${tc.label}: must end at goal`);
  }
});

test('all-pairs station-to-station navigation, bottom plating approach, and island floor clicks never get stuck', () => {
  const sim = createInitialSimulation('solo', 0, { durationSeconds: 90 });
  // Prevent match timers from ending the run while testing 256 trips
  const resetTimers = () => {
    sim.timeRemaining = 90;
    sim.outcome = 'none';
    for (const t of sim.tickets) t.patience = t.maxPatience;
  };

  // 1. Every station to every other station across the full kitchen (all 256 pairs)
  for (const fromSt of sim.stations) {
    const fromStand = getStationCandidateStandPoints(fromSt)[0];
    for (const toSt of sim.stations) {
      if (fromSt.id === toSt.id) continue;
      resetTimers();
      sim.chef.x = fromStand.x;
      sim.chef.y = fromStand.y;
      sim.chef.vx = 0;
      sim.chef.vy = 0;
      sim.chef.held = null;
      sim.chef.targetStationId = toSt.id;
      sim.chef.queuedStationId = null;
      sim.chef.targetTicketId = null;
      sim.chef.queuedTicketId = null;
      sim.chef.targetPoint = null;
      sim.chef.navPath = [];
      sim.chef.navGoalKey = null;

      let arrived = false;
      for (let step = 0; step < 120; step++) {
        stepSimulation(sim, 0.04, IDLE_INPUT);
        if (sim.chef.targetStationId === null) {
          arrived = true;
          break;
        }
      }
      assert.ok(
        arrived,
        `Chef got stuck navigating from ${fromSt.id} (${fromStand.x},${fromStand.y}) to ${toSt.id}; ended at (${sim.chef.x.toFixed(2)},${sim.chef.y.toFixed(2)})`,
      );
    }
  }

  // 2. Approaching a center plating mat from BELOW stays on the bottom side (never loops around to top)
  resetTimers();
  sim.chef.x = 4.5;
  sim.chef.y = 5.4;
  sim.chef.targetStationId = 'plate_1';
  sim.chef.navPath = [];
  sim.chef.navGoalKey = null;
  for (let step = 0; step < 40; step++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
    assert.ok(sim.chef.y > 4.0, 'Chef should approach plate_1 from the bottom without looping above the island');
    if (sim.chef.targetStationId === null) break;
  }
  assert.equal(sim.chef.targetStationId, null);

  // 3. Tapping directly inside the center island clamps cleanly and finishes walking without getting stuck
  resetTimers();
  sim.chef.x = 1.6;
  sim.chef.y = 3.5;
  sim.chef.targetPoint = { x: 5.0, y: 3.5 };
  sim.chef.navPath = [];
  sim.chef.navGoalKey = null;
  for (let step = 0; step < 80; step++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
    if (sim.chef.targetPoint === null) break;
  }
  assert.equal(sim.chef.targetPoint, null);
});

test('Bot Challenge mode: Rival Chef Coco autonomously cooks & serves customers and timer crowns winner by served count', () => {
  // 1. Run a full 30-second Challenge match with idle player -> Bot Coco must autonomously cook and serve >= 1 customer and win!
  const sim = createInitialSimulation('challenge', 0, { durationSeconds: 30 });
  assert.ok(sim.bot !== null, 'Bot Chef Coco should exist in challenge mode');

  for (let i = 0; i < 800; i++) {
    stepSimulation(sim, 0.04, IDLE_INPUT);
    if (sim.outcome !== 'none') break;
  }
  assert.equal(sim.timeRemaining, 0);
  assert.ok(
    (sim.bot?.ordersServed ?? 0) >= 1,
    `Expected Rival Chef Coco to serve at least 1 customer in 30s, got ${sim.bot?.ordersServed}`,
  );
  assert.ok((sim.bot?.score ?? 0) > 0, 'Expected Rival Chef Coco to earn score');
  assert.equal(sim.outcome, 'defeat', 'Idle player should lose when Bot Coco serves more customers');

  // 2. Player with higher served count wins when clock expires
  const winSim = createInitialSimulation('challenge', 0, { durationSeconds: 30 });
  winSim.ordersServed = 5;
  winSim.score = 900;
  winSim.bot!.ordersServed = 3;
  winSim.bot!.score = 600;
  winSim.timeRemaining = 0.02;
  stepSimulation(winSim, 0.04, IDLE_INPUT);
  assert.equal(winSim.outcome, 'victory');

  // 3. Exact tie on served count and score ends in a draw
  const drawSim = createInitialSimulation('challenge', 0, { durationSeconds: 30 });
  drawSim.ordersServed = 4;
  drawSim.score = 700;
  drawSim.bot!.ordersServed = 4;
  drawSim.bot!.score = 700;
  drawSim.timeRemaining = 0.02;
  stepSimulation(drawSim, 0.04, IDLE_INPUT);
  assert.equal(drawSim.outcome, 'draw');
});





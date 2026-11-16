import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultProgress,
  finalizeShiftProgress,
  getTargetOrdersForDay,
  purchaseUpgrade,
  selectOrUnlockTheme,
} from './progression';
import { canAddToPlate, matchCompleteDish } from './recipes';
import {
  BURNT_THRESHOLD,
  COOK_DURATION,
  createInitialSimulation,
  interactWithStation,
  PERFECT_THRESHOLD,
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
  const sim = createInitialSimulation('shift');
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

  assert.equal(interactWithStation(sim, 'pass_1', events), true);
  assert.equal(sim.ordersServed, 1);
  assert.ok(sim.score > 120);
  assert.ok(sim.coinsEarned > 0);
  assert.equal(sim.combo, 1);
});

test('skillet cooking transitions through perfect sear window to burnt', () => {
  const sim = createInitialSimulation('shift');
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

test('expiring ticket emits urgent alarm cue and 3 expired tickets trigger defeat', () => {
  const sim = createInitialSimulation('shift');
  sim.tickets = [
    {
      id: 1,
      dishId: 'bruschetta',
      tableNumber: 1,
      guestName: 'Clara',
      maxPatience: 40,
      patience: URGENT_ALARM_SECONDS - 1,
      createdAtElapsed: 0,
      isVip: false,
      isDailySpecial: false,
    },
  ];
  const alarmEvents = stepSimulation(sim, 0.04, IDLE_INPUT);
  assert.ok(alarmEvents.some((e) => e.sound === 'alarm_urgent'));

  sim.tickets = [
    { id: 1, dishId: 'bruschetta', tableNumber: 1, guestName: 'A', maxPatience: 10, patience: 0.02, createdAtElapsed: 0, isVip: false, isDailySpecial: false },
    { id: 2, dishId: 'bruschetta', tableNumber: 2, guestName: 'B', maxPatience: 10, patience: 0.02, createdAtElapsed: 0, isVip: false, isDailySpecial: false },
    { id: 3, dishId: 'bruschetta', tableNumber: 3, guestName: 'C', maxPatience: 10, patience: 0.02, createdAtElapsed: 0, isVip: false, isDailySpecial: false },
  ];
  stepSimulation(sim, 0.04, IDLE_INPUT);
  assert.equal(sim.stars, 0);
  assert.equal(sim.outcome, 'defeat');
});

test('day progression target orders & shop upgrades/themes/achievements work deterministically', () => {
  const day1Target = getTargetOrdersForDay(1);
  assert.equal(day1Target, 8);
  assert.equal(getTargetOrdersForDay(3), 12);

  const sim = createInitialSimulation('shift', 0, { day: 1 });
  sim.ordersServed = day1Target - 1;
  sim.tickets = [
    { id: 99, dishId: 'bruschetta', tableNumber: 4, guestName: 'D', maxPatience: 40, patience: 35, createdAtElapsed: 0, isVip: false, isDailySpecial: false },
  ];
  sim.chef.held = {
    kind: 'plate',
    isPerfect: true,
    plateComponents: [
      { kind: 'bun', isPerfect: false },
      { kind: 'tomato_chopped', isPerfect: false },
    ],
    matchedDishId: 'bruschetta',
  };
  const events: SimEvent[] = [];
  assert.equal(interactWithStation(sim, 'pass_1', events), true);
  assert.equal(sim.outcome, 'victory');

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
    isVictoryShift: true,
  });
  assert.equal(fin.nextProgress.day, 2);
  assert.equal(fin.nextProgress.bestScore, 1450);
  assert.ok(fin.newlyUnlocked.includes('first_serve'));
  assert.ok(fin.newlyUnlocked.includes('perfect_chef'));
  assert.ok(fin.newlyUnlocked.includes('combo_five'));
  assert.equal(fin.nextProgress.coins, 30 + 55 + 20 + 35 + 40);
});

import { isChoppable, isCookable } from './recipes';
import type { KitchenSimulation, TutorialStepId } from './types';

export const TUTORIAL_STEP_ORDER: TutorialStepId[] = ['chop', 'cook', 'plate', 'serve'];
export const TUTORIAL_COMPLETION_BONUS = 25;

export interface TutorialGuideSnapshot {
  stepId: TutorialStepId;
  stepIndex: number; // 0..3
  totalSteps: number;
  title: string;
  instruction: string;
  actionTag: string;
  accentColor: string;
  /** Primary pulsing stations (bright focus pulse) */
  primaryStationIds: string[];
  /** Secondary soft-highlighted stations (destination preview) */
  secondaryStationIds: string[];
  /** Customer ticket IDs to highlight with glowing pulses */
  highlightTicketIds: number[];
}

export function getNextTutorialStep(current: TutorialStepId): TutorialStepId | null {
  const idx = TUTORIAL_STEP_ORDER.indexOf(current);
  if (idx < 0 || idx >= TUTORIAL_STEP_ORDER.length - 1) return null;
  return TUTORIAL_STEP_ORDER[idx + 1];
}

/**
 * Evaluates live kitchen state to detect if the player has naturally completed
 * the current tutorial step via real gameplay interactions.
 */
export function shouldAutoAdvanceTutorial(
  sim: KitchenSimulation,
  stepId: TutorialStepId,
): boolean {
  const held = sim.chef.held;

  if (stepId === 'chop') {
    const anyBoardUsed = sim.stations.some((s) => s.type === 'board' && s.item !== null);
    const holdingChopped =
      held !== null &&
      (held.kind === 'tomato_chopped' ||
        held.kind === 'lettuce_chopped' ||
        held.kind === 'avocado_chopped' ||
        held.kind === 'strawberry_chopped' ||
        held.kind === 'potato_chopped');
    return anyBoardUsed || holdingChopped;
  }

  if (stepId === 'cook') {
    const anySkilletUsed = sim.stations.some((s) => s.type === 'skillet' && s.item !== null);
    const holdingCooked =
      held !== null &&
      (held.kind === 'egg_cooked' ||
        held.kind === 'patty_cooked' ||
        held.kind === 'fries_cooked');
    return anySkilletUsed || holdingCooked;
  }

  if (stepId === 'plate') {
    const anyPlateUsed = sim.stations.some(
      (s) => s.type === 'plate_mat' && s.plateComponents.length > 0,
    );
    const holdingMatchedPlate =
      held !== null && held.kind === 'plate' && held.matchedDishId !== null;
    return anyPlateUsed || holdingMatchedPlate;
  }

  if (stepId === 'serve') {
    return sim.ordersServed >= 1;
  }

  return false;
}

/**
 * Computes which stations or customers should display subtle glowing canvas pulses
 * and the exact live-reactive guidance text for the active tutorial step.
 */
export function getTutorialGuideSnapshot(
  sim: KitchenSimulation,
  stepId: TutorialStepId,
): TutorialGuideSnapshot {
  const stepIndex = Math.max(0, TUTORIAL_STEP_ORDER.indexOf(stepId));
  const held = sim.chef.held;

  if (stepId === 'chop') {
    const holdingChoppable = held !== null && isChoppable(held.kind);
    return {
      stepId,
      stepIndex,
      totalSteps: TUTORIAL_STEP_ORDER.length,
      title: 'Step 1: Prep & Chop',
      instruction: holdingChoppable
        ? 'Great! Now tap a glowing Cutting Board at the top to dice it.'
        : 'Tap Tomatoes in the left pantry, then tap a Cutting Board to chop.',
      actionTag: holdingChoppable ? 'Tap Cutting Board' : 'Tap Pantry → Board',
      accentColor: '#16A34A',
      primaryStationIds: holdingChoppable ? ['board_1', 'board_2'] : ['pantry_tomato'],
      secondaryStationIds: holdingChoppable ? [] : ['board_1', 'board_2'],
      highlightTicketIds: [],
    };
  }

  if (stepId === 'cook') {
    const holdingCookable = held !== null && isCookable(held.kind);
    return {
      stepId,
      stepIndex,
      totalSteps: TUTORIAL_STEP_ORDER.length,
      title: 'Step 2: Sear in Copper Skillet',
      instruction: holdingCookable
        ? 'Tap a glowing Copper Skillet to sear! Pull it off in the green sweet spot.'
        : 'Tap Farm Eggs on the right pantry, then tap a Copper Skillet to cook.',
      actionTag: holdingCookable ? 'Tap Copper Skillet' : 'Tap Eggs → Skillet',
      accentColor: '#D97706',
      primaryStationIds: holdingCookable ? ['skillet_1', 'skillet_2'] : ['pantry_egg'],
      secondaryStationIds: holdingCookable ? [] : ['skillet_1', 'skillet_2'],
      highlightTicketIds: [],
    };
  }

  if (stepId === 'plate') {
    const hasCookedInSkillet = sim.stations.some(
      (s) => s.type === 'skillet' && s.item && (s.cookStage === 'perfect' || s.cookStage === 'warning'),
    );
    return {
      stepId,
      stepIndex,
      totalSteps: TUTORIAL_STEP_ORDER.length,
      title: 'Step 3: Assemble on Plating Mats',
      instruction: hasCookedInSkillet
        ? 'Grab your golden dish from the skillet and tap a glowing Plating Mat in the center!'
        : 'Combine ingredients (e.g. Brioche Bun + Diced Tomato or Sunny Egg) on the center Plating Mats.',
      actionTag: 'Tap Plating Mat',
      accentColor: '#0284C7',
      primaryStationIds: ['plate_1', 'plate_2'],
      secondaryStationIds: held ? [] : ['pantry_bun'],
      highlightTicketIds: [],
    };
  }

  // Step 4: Serve waiting customers
  const holdingDish = held?.kind === 'plate' ? held.matchedDishId : null;
  const matchingTickets = holdingDish
    ? sim.tickets.filter((t) => t.dishId === holdingDish).map((t) => t.id)
    : [];
  const targetTickets =
    matchingTickets.length > 0 ? matchingTickets : sim.tickets.map((t) => t.id);

  return {
    stepId: 'serve',
    stepIndex,
    totalSteps: TUTORIAL_STEP_ORDER.length,
    title: 'Step 4: Serve Your Guests',
    instruction: holdingDish
      ? 'Your dish is ready! Tap the glowing guest who ordered it to serve & earn coins.'
      : 'Pick up a finished dish from a Plating Mat, then tap the matching guest at the counter!',
    actionTag: 'Tap Guest to Serve',
    accentColor: '#C94136',
    primaryStationIds: holdingDish
      ? []
      : sim.stations
          .filter((s) => s.type === 'plate_mat' && s.matchedDishId !== null)
          .map((s) => s.id),
    secondaryStationIds: [],
    highlightTicketIds: targetTickets,
  };
}

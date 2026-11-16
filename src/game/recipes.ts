import type { DishId, DishRecipe, IngredientBase, ItemKind, PlateComponent } from './types';

export const INGREDIENT_META: Record<
  IngredientBase,
  { label: string; color: string; accent: string; rawKind: Exclude<ItemKind, 'plate' | 'burnt'> }
> = {
  bun: {
    label: 'Brioche Bun',
    color: '#D99B52',
    accent: '#F5D09E',
    rawKind: 'bun',
  },
  tomato: {
    label: 'Heirloom Tomato',
    color: '#DC2626',
    accent: '#FCA5A5',
    rawKind: 'tomato_raw',
  },
  lettuce: {
    label: 'Crisp Greens',
    color: '#16A34A',
    accent: '#86EFAC',
    rawKind: 'lettuce_raw',
  },
  potato: {
    label: 'Golden Potato',
    color: '#CA8A04',
    accent: '#FDE047',
    rawKind: 'potato_raw',
  },
  egg: {
    label: 'Farm Egg',
    color: '#F59E0B',
    accent: '#FEF3C7',
    rawKind: 'egg_raw',
  },
  patty: {
    label: 'Prime Beef',
    color: '#991B1B',
    accent: '#F87171',
    rawKind: 'patty_raw',
  },
  avocado: {
    label: 'Fresh Avocado',
    color: '#65A30D',
    accent: '#D9F99D',
    rawKind: 'avocado_raw',
  },
  strawberry: {
    label: 'Sweet Berries',
    color: '#E11D48',
    accent: '#FDA4AF',
    rawKind: 'strawberry_raw',
  },
};

export const ITEM_LABELS: Record<ItemKind, string> = {
  bun: 'Brioche Bun',
  tomato_raw: 'Whole Tomato',
  tomato_chopped: 'Diced Tomato',
  lettuce_raw: 'Whole Greens',
  lettuce_chopped: 'Tossed Greens',
  potato_raw: 'Raw Potato',
  potato_chopped: 'Cut Fries',
  fries_cooked: 'Crispy Frites',
  egg_raw: 'Raw Egg',
  egg_cooked: 'Sunny Egg',
  patty_raw: 'Raw Beef',
  patty_cooked: 'Seared Patty',
  avocado_raw: 'Whole Avocado',
  avocado_chopped: 'Sliced Avocado',
  strawberry_raw: 'Whole Berries',
  strawberry_chopped: 'Macerated Berries',
  burnt: 'Charred Ash',
  plate: 'Plated Dish',
};

export const RECIPES: Record<DishId, DishRecipe> = {
  bruschetta: {
    id: 'bruschetta',
    name: 'Tomato Bruschetta',
    shortName: 'Bruschetta',
    minWave: 1,
    baseScore: 120,
    accentColor: '#DC2626',
    components: ['bun', 'tomato_chopped'],
    steps: [
      { base: 'bun', prep: 'ready', resultKind: 'bun', label: 'Bun' },
      { base: 'tomato', prep: 'chop', resultKind: 'tomato_chopped', label: 'Chop Tomato' },
    ],
  },
  avo_toast: {
    id: 'avo_toast',
    name: 'Avocado Brioche',
    shortName: 'Avo Toast',
    minWave: 1,
    baseScore: 130,
    accentColor: '#65A30D',
    components: ['bun', 'avocado_chopped'],
    steps: [
      { base: 'bun', prep: 'ready', resultKind: 'bun', label: 'Bun' },
      { base: 'avocado', prep: 'chop', resultKind: 'avocado_chopped', label: 'Slice Avo' },
    ],
  },
  garden_bowl: {
    id: 'garden_bowl',
    name: 'Garden Salad',
    shortName: 'Salad Bowl',
    minWave: 1,
    baseScore: 135,
    accentColor: '#16A34A',
    components: ['lettuce_chopped', 'tomato_chopped'],
    steps: [
      { base: 'lettuce', prep: 'chop', resultKind: 'lettuce_chopped', label: 'Chop Greens' },
      { base: 'tomato', prep: 'chop', resultKind: 'tomato_chopped', label: 'Chop Tomato' },
    ],
  },
  morning_brioche: {
    id: 'morning_brioche',
    name: 'Sunny Brioche',
    shortName: 'Egg Brioche',
    minWave: 1,
    baseScore: 150,
    accentColor: '#D97706',
    components: ['bun', 'egg_cooked'],
    steps: [
      { base: 'bun', prep: 'ready', resultKind: 'bun', label: 'Bun' },
      { base: 'egg', prep: 'sear', resultKind: 'egg_cooked', label: 'Sear Egg' },
    ],
  },
  berry_toast: {
    id: 'berry_toast',
    name: 'Berry French Toast',
    shortName: 'Berry Toast',
    minWave: 1,
    baseScore: 210,
    accentColor: '#E11D48',
    components: ['bun', 'egg_cooked', 'strawberry_chopped'],
    steps: [
      { base: 'bun', prep: 'ready', resultKind: 'bun', label: 'Brioche' },
      { base: 'egg', prep: 'sear', resultKind: 'egg_cooked', label: 'Sear Custard' },
      { base: 'strawberry', prep: 'chop', resultKind: 'strawberry_chopped', label: 'Dice Berries' },
    ],
  },
  avo_bowl: {
    id: 'avo_bowl',
    name: 'Green Goddess Bowl',
    shortName: 'Goddess Bowl',
    minWave: 2,
    baseScore: 225,
    accentColor: '#15803D',
    components: ['lettuce_chopped', 'avocado_chopped', 'tomato_chopped'],
    steps: [
      { base: 'lettuce', prep: 'chop', resultKind: 'lettuce_chopped', label: 'Chop Greens' },
      { base: 'avocado', prep: 'chop', resultKind: 'avocado_chopped', label: 'Slice Avo' },
      { base: 'tomato', prep: 'chop', resultKind: 'tomato_chopped', label: 'Chop Tomato' },
    ],
  },
  bistro_burger: {
    id: 'bistro_burger',
    name: 'Bistro Smash Burger',
    shortName: 'Smash Burger',
    minWave: 2,
    baseScore: 240,
    accentColor: '#B45309',
    components: ['bun', 'patty_cooked', 'lettuce_chopped'],
    steps: [
      { base: 'bun', prep: 'ready', resultKind: 'bun', label: 'Bun' },
      { base: 'patty', prep: 'sear', resultKind: 'patty_cooked', label: 'Sear Beef' },
      { base: 'lettuce', prep: 'chop', resultKind: 'lettuce_chopped', label: 'Chop Greens' },
    ],
  },
  steak_hash: {
    id: 'steak_hash',
    name: 'Steak Frites Plate',
    shortName: 'Steak Frites',
    minWave: 2,
    baseScore: 270,
    accentColor: '#991B1B',
    components: ['patty_cooked', 'fries_cooked', 'tomato_chopped'],
    steps: [
      { base: 'patty', prep: 'sear', resultKind: 'patty_cooked', label: 'Sear Beef' },
      { base: 'potato', prep: 'chop_sear', resultKind: 'fries_cooked', label: 'Chop + Fry' },
      { base: 'tomato', prep: 'chop', resultKind: 'tomato_chopped', label: 'Chop Tomato' },
    ],
  },
  royale_burger: {
    id: 'royale_burger',
    name: "Chef's Royale Burger",
    shortName: 'Royale Burger',
    minWave: 3,
    baseScore: 350,
    accentColor: '#C2410C',
    components: ['bun', 'patty_cooked', 'egg_cooked', 'tomato_chopped'],
    steps: [
      { base: 'bun', prep: 'ready', resultKind: 'bun', label: 'Bun' },
      { base: 'patty', prep: 'sear', resultKind: 'patty_cooked', label: 'Sear Beef' },
      { base: 'egg', prep: 'sear', resultKind: 'egg_cooked', label: 'Sear Egg' },
      { base: 'tomato', prep: 'chop', resultKind: 'tomato_chopped', label: 'Chop Tomato' },
    ],
  },
};

export const RECIPE_LIST: DishRecipe[] = Object.values(RECIPES);

export function isChoppable(kind: ItemKind): boolean {
  return (
    kind === 'tomato_raw' ||
    kind === 'lettuce_raw' ||
    kind === 'potato_raw' ||
    kind === 'avocado_raw' ||
    kind === 'strawberry_raw'
  );
}

export function getChopResult(kind: ItemKind): Exclude<ItemKind, 'plate' | 'burnt'> | null {
  switch (kind) {
    case 'tomato_raw':
      return 'tomato_chopped';
    case 'lettuce_raw':
      return 'lettuce_chopped';
    case 'potato_raw':
      return 'potato_chopped';
    case 'avocado_raw':
      return 'avocado_chopped';
    case 'strawberry_raw':
      return 'strawberry_chopped';
    default:
      return null;
  }
}

export function isCookable(kind: ItemKind): boolean {
  return kind === 'egg_raw' || kind === 'patty_raw' || kind === 'potato_chopped';
}

export function getCookResult(kind: ItemKind): Exclude<ItemKind, 'plate' | 'burnt'> | null {
  switch (kind) {
    case 'egg_raw':
      return 'egg_cooked';
    case 'patty_raw':
      return 'patty_cooked';
    case 'potato_chopped':
      return 'fries_cooked';
    default:
      return null;
  }
}

export function isPlatable(kind: ItemKind): kind is Exclude<ItemKind, 'plate' | 'burnt'> {
  return (
    kind === 'bun' ||
    kind === 'tomato_chopped' ||
    kind === 'lettuce_chopped' ||
    kind === 'fries_cooked' ||
    kind === 'egg_cooked' ||
    kind === 'patty_cooked' ||
    kind === 'avocado_chopped' ||
    kind === 'strawberry_chopped'
  );
}

export function canAddToPlate(
  existing: PlateComponent[],
  candidate: Exclude<ItemKind, 'plate' | 'burnt'>,
): boolean {
  if (!isPlatable(candidate)) return false;

  const nextKinds = [...existing.map((c) => c.kind), candidate];
  return RECIPE_LIST.some((recipe) => {
    const remaining = [...recipe.components];
    for (const k of nextKinds) {
      const idx = remaining.indexOf(k);
      if (idx === -1) return false;
      remaining.splice(idx, 1);
    }
    return true;
  });
}

export function matchCompleteDish(components: PlateComponent[]): DishId | null {
  if (components.length === 0) return null;
  const kinds = components.map((c) => c.kind).slice().sort();
  for (const recipe of RECIPE_LIST) {
    if (recipe.components.length !== kinds.length) continue;
    const expected = recipe.components.slice().sort();
    if (expected.every((k, i) => k === kinds[i])) {
      return recipe.id;
    }
  }
  return null;
}

export function getRecipesForWave(wave: number): DishRecipe[] {
  return RECIPE_LIST.filter((r) => r.minWave <= wave);
}

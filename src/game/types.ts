export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'solo' | 'challenge';

export type MatchDurationSeconds = 30 | 60 | 90;

export type GameOutcome = 'none' | 'finished' | 'victory' | 'defeat' | 'draw';

export type KitchenThemeId = 'copper' | 'patisserie' | 'sage' | 'twilight';

export type UpgradeKey = 'speed' | 'chop' | 'heat' | 'patience' | 'tips';

export type UpgradeLevels = Record<UpgradeKey, number>;

export type AchievementId =
  | 'first_serve'
  | 'perfect_chef'
  | 'combo_five'
  | 'day_three'
  | 'fifty_plates';

export type DailyMissionId =
  | 'serve_salads'
  | 'serve_toasts'
  | 'serve_grill'
  | 'no_burn_match'
  | 'serve_perfect'
  | 'reach_combo'
  | 'serve_customers'
  | 'serve_vip'
  | 'win_challenge';

export interface DailyMissionProgress {
  id: DailyMissionId;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface DailyMissionState {
  dateKey: string;
  missions: DailyMissionProgress[];
  allClearClaimed: boolean;
}

export interface PersistentProgress {
  coins: number;
  day: number;
  challengeWins: number;
  bestScore: number;
  bestServed: number;
  totalServed: number;
  upgrades: UpgradeLevels;
  selectedTheme: KitchenThemeId;
  unlockedThemes: KitchenThemeId[];
  unlockedAchievements: AchievementId[];
  dailyMissions: DailyMissionState;
}

export type IngredientBase =
  | 'bun'
  | 'tomato'
  | 'lettuce'
  | 'potato'
  | 'egg'
  | 'patty'
  | 'avocado'
  | 'strawberry';

export type ItemKind =
  | 'bun'
  | 'tomato_raw'
  | 'tomato_chopped'
  | 'lettuce_raw'
  | 'lettuce_chopped'
  | 'potato_raw'
  | 'potato_chopped'
  | 'fries_cooked'
  | 'egg_raw'
  | 'egg_cooked'
  | 'patty_raw'
  | 'patty_cooked'
  | 'avocado_raw'
  | 'avocado_chopped'
  | 'strawberry_raw'
  | 'strawberry_chopped'
  | 'burnt'
  | 'plate';

export type CookStage = 'none' | 'cooking' | 'perfect' | 'warning' | 'burnt';

export interface HeldItem {
  kind: ItemKind;
  isPerfect: boolean;
  plateComponents: PlateComponent[];
  matchedDishId: DishId | null;
}

export interface PlateComponent {
  kind: Exclude<ItemKind, 'plate' | 'burnt'>;
  isPerfect: boolean;
}

export type DishId =
  | 'bruschetta'
  | 'avo_toast'
  | 'garden_bowl'
  | 'morning_brioche'
  | 'berry_toast'
  | 'avo_bowl'
  | 'bistro_burger'
  | 'steak_hash'
  | 'royale_burger';

export interface RecipeStepHint {
  base: IngredientBase;
  prep: 'ready' | 'chop' | 'sear' | 'chop_sear';
  resultKind: Exclude<ItemKind, 'plate' | 'burnt'>;
  label: string;
}

export interface DishRecipe {
  id: DishId;
  name: string;
  shortName: string;
  minWave: number;
  baseScore: number;
  accentColor: string;
  components: Exclude<ItemKind, 'plate' | 'burnt'>[];
  steps: RecipeStepHint[];
}

export type StationType =
  | 'pantry'
  | 'board'
  | 'skillet'
  | 'plate_mat'
  | 'compost';

export type CustomerVariety = 'regular' | 'vip' | 'foodie' | 'express';

export interface StationState {
  id: string;
  type: StationType;
  label: string;
  col: number;
  row: number;
  pantryBase?: IngredientBase;
  item: ItemKind | null;
  isPerfect: boolean;
  chopProgress: number;
  isChoppingActive: boolean;
  cookProgress: number;
  cookStage: CookStage;
  plateComponents: PlateComponent[];
  matchedDishId: DishId | null;
  pulseTimer: number;
  claimedBy?: 'player' | 'bot' | null;
}

export interface OrderTicket {
  id: number;
  dishId: DishId;
  tableNumber: number;
  guestName: string;
  avatarId: number;
  seatIndex: number;
  dialogue: string;
  variety: CustomerVariety;
  maxPatience: number;
  patience: number;
  createdAtElapsed: number;
  isVip: boolean;
  isDailySpecial: boolean;
}

export interface CustomerReaction {
  id: number;
  avatarId: number;
  seatIndex: number;
  guestName: string;
  variety?: CustomerVariety;
  kind: 'happy' | 'upset';
  text: string;
  timer: number;
  maxTimer: number;
}

export interface ChefState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  held: HeldItem | null;
  dashTimer: number;
  dashCooldown: number;
  walkDistance: number;
  lastStepDistance: number;
  squashX: number;
  squashY: number;
  happyTimer: number;
  targetStationId: string | null;
  queuedStationId: string | null;
  targetTicketId: number | null;
  queuedTicketId: number | null;
  targetPoint: { x: number; y: number } | null;
  navPath: { x: number; y: number }[];
  navGoalKey: string | null;
}

export interface BotChefState {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  held: HeldItem | null;
  walkDistance: number;
  squashX: number;
  squashY: number;
  happyTimer: number;
  ordersServed: number;
  score: number;
  combo: number;
  comboTimer: number;
  focusTicketId: number | null;
  targetStationId: string | null;
  targetTicketId: number | null;
  navPath: { x: number; y: number }[];
  navGoalKey: string | null;
  thinkCooldown: number;
}

export type SoundCue =
  | 'pickup'
  | 'place'
  | 'chop'
  | 'chop_done'
  | 'sear_start'
  | 'perfect_ready'
  | 'perfect_grab'
  | 'warning_tick'
  | 'skillet_alert'
  | 'burnt'
  | 'serve'
  | 'dash'
  | 'trash'
  | 'error'
  | 'ticket_new'
  | 'vip_arrive'
  | 'alarm_urgent'
  | 'ticket_expired'
  | 'coin'
  | 'upgrade'
  | 'achievement'
  | 'footstep'
  | 'victory'
  | 'defeat';

export interface SimEvent {
  sound?: SoundCue;
  particleKind?: 'chop' | 'steam' | 'sparkle' | 'smoke' | 'dash' | 'serve' | 'combo_burst';
  particleX?: number;
  particleY?: number;
  particleColor?: string;
  particleCount?: number;
  comboLevel?: number;
  hitstop?: number;
  shakeTrauma?: number;
  floatingText?: string;
  floatingColor?: string;
  floatingX?: number;
  floatingY?: number;
  unlockedAchievement?: AchievementId;
}

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  interactPressed: boolean;
  dashPressed: boolean;
}

export interface RunStatsSnapshot {
  score: number;
  bestScore: number;
  coinsEarned: number;
  durationSeconds: MatchDurationSeconds;
  ordersServed: number;
  botOrdersServed: number;
  botScore: number;
  perfectDishes: number;
  burntCount: number;
  maxCombo: number;
  elapsedSeconds: number;
  wave: number;
  outcome: GameOutcome;
  mode: GameMode;
  dailySpecialDishId: DishId;
  newlyUnlockedAchievements: AchievementId[];
  newlyCompletedMissions: DailyMissionId[];
}

export interface KitchenSimulation {
  mode: GameMode;
  durationSeconds: MatchDurationSeconds;
  timeRemaining: number;
  dailySpecialDishId: DishId;
  outcome: GameOutcome;
  score: number;
  bestScore: number;
  coinsEarned: number;
  combo: number;
  maxCombo: number;
  comboTimer: number;
  ordersServed: number;
  perfectDishes: number;
  burntCount: number;
  servedByDish: Partial<Record<DishId, number>>;
  vipOrFoodieServed: number;
  wave: number;
  elapsedSeconds: number;
  spawnTimer: number;
  nextTicketId: number;
  hitstopTimer: number;
  alarmCooldown: number;
  skilletAlertCooldown: number;
  upgrades: UpgradeLevels;
  chef: ChefState;
  bot: BotChefState | null;
  stations: StationState[];
  tickets: OrderTicket[];
  customerReactions: CustomerReaction[];
  nearestStationId: string | null;
  statusBanner: string | null;
  statusBannerTimer: number;
}


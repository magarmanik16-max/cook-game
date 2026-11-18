import React, { useEffect, useState } from 'react';
import {
  DAILY_ALL_CLEAR_BONUS,
  DAILY_MISSION_CATALOG,
  getUnclaimedMissionCount,
} from '../game/missions';
import {
  ACHIEVEMENTS,
  getUpgradeCost,
  KITCHEN_THEMES,
  UPGRADE_CATALOG,
} from '../game/progression';
import { RECIPE_LIST, RECIPES } from '../game/recipes';
import type {
  DailyMissionId,
  DishId,
  KitchenThemeId,
  PersistentProgress,
  UpgradeKey,
} from '../game/types';
import { CoinSvg, IngredientSvg } from './DishIcons';
import {
  PlatedDishSvg,
  RecipeAssemblyPreview,
  ThemeMiniKitchenPreview,
  UpgradeMotionPreview,
} from './ShopPreviews';

export type ShopTab = 'missions' | 'upgrades' | 'themes' | 'recipes';

interface BistroShopModalProps {
  open: boolean;
  initialTab?: ShopTab;
  progress: PersistentProgress;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onSelectTheme: (themeId: KitchenThemeId) => void;
  onClaimMission: (missionId: DailyMissionId) => void;
  onClaimAllClear: () => void;
  onClose: () => void;
}

export function BistroShopModal({
  open,
  initialTab = 'upgrades',
  progress,
  onBuyUpgrade,
  onSelectTheme,
  onClaimMission,
  onClaimAllClear,
  onClose,
}: BistroShopModalProps) {
  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [previewThemeId, setPreviewThemeId] = useState<KitchenThemeId>(progress.selectedTheme);
  const [selectedRecipeId, setSelectedRecipeId] = useState<DishId>(RECIPE_LIST[0].id);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setPreviewThemeId(progress.selectedTheme);
    }
  }, [open, initialTab, progress.selectedTheme]);

  if (!open) return null;

  const unclaimedCount = getUnclaimedMissionCount(progress.dailyMissions);
  const completedMissionsCount = progress.dailyMissions.missions.filter((m) => m.completed).length;
  const allMissionsCompleted =
    progress.dailyMissions.missions.length === 3 && completedMissionsCount === 3;
  const previewTheme = KITCHEN_THEMES[previewThemeId] ?? KITCHEN_THEMES.copper;
  const previewUnlocked = progress.unlockedThemes.includes(previewTheme.id);
  const previewEquipped = progress.selectedTheme === previewTheme.id;
  const canUnlockPreview = previewUnlocked || progress.coins >= previewTheme.cost;
  const selectedRecipe = RECIPES[selectedRecipeId] ?? RECIPE_LIST[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bistro-shop-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-5 bg-[#3D2921]/45"
    >
      <div className="clay-card w-full max-w-2xl max-h-[92vh] p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 text-[#3D2921] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#EAD8C8] pb-2.5 sm:pb-3.5">
          <div>
            <p className="text-xs font-bold text-[#C94136]">Copper Pan Bistro Ledger</p>
            <h2 id="bistro-shop-title" className="font-display text-xl sm:text-3xl font-bold">
              {tab === 'missions'
                ? 'Daily Missions'
                : tab === 'themes'
                  ? 'Bistro Themes'
                  : tab === 'recipes'
                    ? 'Menu & Milestones'
                    : 'Upgrades & Style'}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="clay-inset flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5"
              aria-label={`Bistro coins: ${progress.coins}`}
            >
              <CoinSvg className="w-4 h-4 shrink-0" />
              <span
                data-testid="shop-coins"
                className="font-mono-num text-sm sm:text-base font-bold text-[#B45309] tabular-nums"
              >
                {progress.coins}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="clay-btn-soft px-3.5 sm:px-4 py-2 rounded-2xl bg-[#FFFBF7] hover:bg-[#FFF3E8] text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

        {/* Clay Inset Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Bistro shop sections"
          className="clay-inset inline-flex items-center gap-1 p-1 sm:p-1.5 self-start max-w-full overflow-x-auto no-scrollbar"
        >
          {(
            [
              ['missions', 'Missions', 'Daily Missions'],
              ['upgrades', 'Upgrades', 'Upgrades'],
              ['themes', 'Themes', 'Themes'],
              ['recipes', 'Recipes', 'Recipes'],
            ] as const
          ).map(([id, shortLabel, fullLabel]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                tab === id
                  ? 'clay-btn bg-[#C94136] text-white'
                  : 'text-[#6E5245] hover:text-[#3D2921]'
              }`}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{fullLabel}</span>
              {id === 'missions' && unclaimedCount > 0 && (
                <span
                  aria-label={`${unclaimedCount} rewards ready to claim`}
                  className={`font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    tab === id ? 'bg-white text-[#C94136]' : 'bg-[#F59E0B] text-white'
                  }`}
                >
                  {unclaimedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto pr-1.5 py-1 space-y-2.5 sm:space-y-3">
          {tab === 'missions' && (
            <div className="space-y-3">
              {/* Daily All-Clear Bonus Banner */}
              <div className="clay-card-sm bg-[#FFF5E8] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6E5245]">
                    <span className="font-display font-bold text-sm text-[#3D2921]">
                      Daily All-Clear Bonus
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num font-bold text-[#C94136] tabular-nums">
                      {completedMissionsCount}/3 Complete
                    </span>
                  </div>
                  <p className="text-xs text-[#6E5245] mt-0.5 font-medium">
                    Finish all 3 goals for {progress.dailyMissions.dateKey} to earn an extra coin chest.
                  </p>
                  <div className="h-2.5 w-full max-w-xs rounded-full bg-[#EAD8C8] overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-[#F59E0B] transition-all duration-300"
                      style={{ width: `${(completedMissionsCount / 3) * 100}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!allMissionsCompleted || progress.dailyMissions.allClearClaimed}
                  onClick={onClaimAllClear}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1.5 ${
                    progress.dailyMissions.allClearClaimed
                      ? 'clay-inset text-[#15803D] cursor-default'
                      : allMissionsCompleted
                        ? 'clay-btn bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer'
                        : 'clay-inset text-[#8C7062] cursor-not-allowed'
                  }`}
                >
                  {progress.dailyMissions.allClearClaimed ? (
                    'Bonus Claimed'
                  ) : (
                    <>
                      <span>{allMissionsCompleted ? 'Claim' : 'Bonus'}</span>
                      <CoinSvg className="w-3.5 h-3.5" />
                      <span className="font-mono-num tabular-nums">+{DAILY_ALL_CLEAR_BONUS}</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3 Daily Mission Cards */}
              {progress.dailyMissions.missions.map((m) => {
                const def = DAILY_MISSION_CATALOG[m.id];
                if (!def) return null;
                const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
                const canClaim = m.completed && !m.claimed;

                return (
                  <div
                    key={m.id}
                    data-testid={`mission-card-${m.id}`}
                    className={`clay-card-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 ${
                      m.claimed
                        ? 'bg-[#F0FAF3]'
                        : canClaim
                          ? 'bg-[#FFF6E5] ring-2 ring-[#F59E0B]'
                          : 'bg-[#FFFBF7]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-base text-[#3D2921]">
                          {def.title}
                        </span>
                        <span className="font-mono-num text-xs font-bold text-[#6E5245] tabular-nums">
                          {m.progress}/{m.target}
                        </span>
                      </div>
                      <p className="text-xs text-[#6E5245] mt-0.5 font-medium">{def.description}</p>
                      <div className="h-2 w-full max-w-sm rounded-full bg-[#EAD8C8] overflow-hidden mt-2">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: m.completed ? '#16A34A' : def.accentColor,
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canClaim}
                      onClick={() => onClaimMission(m.id)}
                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1.5 ${
                        m.claimed
                          ? 'clay-inset text-[#15803D] cursor-default'
                          : canClaim
                            ? 'clay-btn bg-[#16A34A] hover:bg-[#15803D] text-white cursor-pointer'
                            : 'clay-inset text-[#8C7062] cursor-not-allowed'
                      }`}
                    >
                      {m.claimed ? (
                        'Claimed'
                      ) : canClaim ? (
                        <>
                          <span>Claim</span>
                          <CoinSvg className="w-3.5 h-3.5" />
                          <span className="font-mono-num tabular-nums">+{def.coinReward}</span>
                        </>
                      ) : (
                        <>
                          <CoinSvg className="w-3.5 h-3.5" />
                          <span className="font-mono-num tabular-nums">+{def.coinReward}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'upgrades' &&
            UPGRADE_CATALOG.map((u) => {
              const lvl = progress.upgrades[u.key] ?? 0;
              const isMax = lvl >= u.maxLevel;
              const cost = getUpgradeCost(u, lvl);
              const canAfford = !isMax && progress.coins >= cost;

              return (
                <div
                  key={u.key}
                  className="clay-card-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFBF7] px-3.5 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <UpgradeMotionPreview upgradeKey={u.key} level={lvl} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-base text-[#3D2921]">
                          {u.name}
                        </span>
                        <span className="font-mono-num text-xs font-bold text-[#C94136] tabular-nums">
                          Lv {lvl}/{u.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-[#6E5245] mt-0.5 font-medium">{u.description}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {Array.from({ length: u.maxLevel }, (_, idx) => (
                          <span
                            key={idx}
                            className={`h-2 w-6 sm:w-7 rounded-full transition-colors ${
                              idx < lvl ? 'bg-[#E3574B]' : 'bg-[#EAD8C8]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyUpgrade(u.key)}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1.5 ${
                      isMax
                        ? 'clay-inset text-[#8C7062] cursor-default'
                        : canAfford
                          ? 'clay-btn bg-[#C94136] hover:bg-[#B8372D] text-white cursor-pointer'
                          : 'clay-inset text-[#8C7062] cursor-not-allowed'
                    }`}
                  >
                    {isMax ? (
                      'Maxed'
                    ) : (
                      <>
                        <span>Upgrade</span>
                        <CoinSvg className="w-3.5 h-3.5" />
                        <span className="font-mono-num tabular-nums">{cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {tab === 'themes' && (
            <div className="space-y-3.5">
              {/* Interactive Live Theme Preview Stage */}
              <div className="clay-card-sm bg-[#FFF5E8] p-3.5 flex flex-col sm:flex-row sm:items-center gap-3.5">
                <div className="w-full sm:w-[290px] shrink-0">
                  <ThemeMiniKitchenPreview theme={previewTheme} large />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-[#C94136]">
                      Live Kitchen Preview
                    </span>
                    <h3
                      data-testid="theme-preview-name"
                      className="font-display text-lg sm:text-xl font-bold text-[#3D2921] leading-tight"
                    >
                      {previewTheme.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {(
                        [
                          ['Floor', previewTheme.floorLight],
                          ['Wood', previewTheme.counterWood],
                          ['Island', previewTheme.islandTop],
                          ['Apron', previewTheme.apronAccent],
                        ] as const
                      ).map(([label, hex]) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6E5245]"
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: hex }}
                          />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canUnlockPreview || previewEquipped}
                    onClick={() => onSelectTheme(previewTheme.id)}
                    className={`self-start px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap inline-flex items-center gap-1.5 ${
                      previewEquipped
                        ? 'clay-btn bg-[#1E7E45] text-white cursor-default'
                        : previewUnlocked
                          ? 'clay-btn bg-[#3D2921] hover:bg-[#2A1B15] text-white cursor-pointer'
                          : canUnlockPreview
                            ? 'clay-btn bg-[#C94136] hover:bg-[#B8372D] text-white cursor-pointer'
                            : 'clay-inset text-[#8C7062] cursor-not-allowed'
                    }`}
                  >
                    {previewEquipped ? (
                      'Equipped'
                    ) : previewUnlocked ? (
                      'Equip Theme'
                    ) : (
                      <>
                        <span>Unlock</span>
                        <CoinSvg className="w-3.5 h-3.5" />
                        <span className="font-mono-num tabular-nums">{previewTheme.cost}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Theme Cards Grid with Miniature Diorama Previews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(KITCHEN_THEMES).map((theme) => {
                  const unlocked = progress.unlockedThemes.includes(theme.id);
                  const selected = progress.selectedTheme === theme.id;
                  const isPreviewing = previewThemeId === theme.id;
                  const canUnlock = unlocked || progress.coins >= theme.cost;

                  return (
                    <div
                      key={theme.id}
                      className={`clay-card-sm p-3.5 flex flex-col justify-between gap-2.5 ${
                        isPreviewing
                          ? 'bg-[#FFF3E6] ring-2 ring-[#C94136]'
                          : selected
                            ? 'bg-[#F0FAF3] ring-1 ring-[#16A34A]'
                            : 'bg-[#FFFBF7]'
                      }`}
                    >
                      <div className="space-y-2">
                        <ThemeMiniKitchenPreview theme={theme} />

                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-sm sm:text-base text-[#3D2921]">
                            {theme.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: theme.floorLight }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: theme.counterWood }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: theme.apronAccent }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewThemeId(theme.id)}
                          aria-label={`Preview ${theme.name} theme`}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                            isPreviewing
                              ? 'clay-inset text-[#C94136]'
                              : 'clay-btn-soft bg-[#FFF6EC] hover:bg-[#FFEDD8] text-[#3D2921]'
                          }`}
                        >
                          {isPreviewing ? 'Previewing' : 'Preview'}
                        </button>

                        <button
                          type="button"
                          disabled={!canUnlock || selected}
                          onClick={() => {
                            setPreviewThemeId(theme.id);
                            onSelectTheme(theme.id);
                          }}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                            selected
                              ? 'clay-btn bg-[#1E7E45] text-white cursor-default'
                              : unlocked
                                ? 'clay-btn-soft bg-[#FFFBF7] hover:bg-[#FFF3E8] text-[#3D2921] cursor-pointer'
                                : canUnlock
                                  ? 'clay-btn bg-[#C94136] hover:bg-[#B8372D] text-white cursor-pointer'
                                  : 'clay-inset text-[#8C7062] cursor-not-allowed'
                          }`}
                        >
                          {selected ? (
                            'Equipped'
                          ) : unlocked ? (
                            'Equip'
                          ) : (
                            <>
                              <span>Unlock</span>
                              <CoinSvg className="w-3.5 h-3.5" />
                              <span className="font-mono-num tabular-nums">{theme.cost}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'recipes' && (
            <div className="space-y-4">
              {/* Interactive Plated Dish & Step-by-Step Assembly Preview */}
              <RecipeAssemblyPreview recipe={selectedRecipe} />

              <div>
                <h3 className="text-xs font-bold text-[#C94136] mb-2">
                  Signature Menu ({RECIPE_LIST.length} Dishes · Tap any dish to preview)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RECIPE_LIST.map((r) => {
                    const isSelected = r.id === selectedRecipe.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRecipeId(r.id)}
                        aria-pressed={isSelected}
                        className={`clay-card-sm text-left px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#FFF3E6] ring-2 ring-[#C94136]'
                            : 'bg-[#FFFBF7] hover:bg-[#FFF6EC]'
                        }`}
                      >
                        <PlatedDishSvg dishId={r.id} className="w-11 h-11 shrink-0" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-display text-xs sm:text-sm font-bold text-[#3D2921] truncate">
                              {r.name}
                            </span>
                            <span className="font-mono-num text-[11px] font-bold text-[#B45309] shrink-0 tabular-nums">
                              {r.baseScore}pt
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {r.steps.map((s, idx) => {
                              const tagCls =
                                s.prep === 'chop'
                                  ? 'bg-[#15803D] text-white'
                                  : s.prep === 'sear'
                                    ? 'bg-[#C2410C] text-white'
                                    : s.prep === 'chop_sear'
                                      ? 'bg-[#B45309] text-white'
                                      : 'bg-[#EAD8C8] text-[#5C4034]';
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#FFF4E8] border border-[#E8D2BE] px-1.5 py-0.5 text-[10px] font-semibold text-[#3D2921]"
                                >
                                  <IngredientSvg base={s.base} className="w-3 h-3 shrink-0" />
                                  <span className={`px-1 py-0.5 rounded text-[9px] font-bold leading-none ${tagCls}`}>
                                    {s.prep === 'chop'
                                      ? 'CHOP'
                                      : s.prep === 'sear'
                                        ? 'SEAR'
                                        : s.prep === 'chop_sear'
                                          ? 'FRY'
                                          : 'PLATE'}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#C94136] mb-2">
                  Bistro Milestones ({progress.unlockedAchievements.length}/{ACHIEVEMENTS.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ACHIEVEMENTS.map((a) => {
                    const earned = progress.unlockedAchievements.includes(a.id);
                    return (
                      <div
                        key={a.id}
                        className={`clay-card-sm px-3.5 py-2.5 ${
                          earned ? 'bg-[#E3F6EA] ring-1 ring-[#22C55E]' : 'bg-[#FFFBF7]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-xs sm:text-sm font-bold text-[#3D2921]">
                            {a.title}
                          </span>
                          <span className="font-mono-num text-[11px] font-bold text-[#B45309]">
                            {earned ? 'Earned' : `+${a.coinReward}c`}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-[#6E5245] mt-0.5">{a.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

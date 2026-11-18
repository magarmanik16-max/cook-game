import React, { useEffect, useState } from 'react';
import {
  ACHIEVEMENTS,
  getUpgradeCost,
  KITCHEN_THEMES,
  UPGRADE_CATALOG,
} from '../game/progression';
import { RECIPE_LIST } from '../game/recipes';
import type { KitchenThemeId, PersistentProgress, UpgradeKey } from '../game/types';
import { CoinSvg, IngredientSvg } from './DishIcons';

export type ShopTab = 'upgrades' | 'themes' | 'recipes';

interface BistroShopModalProps {
  open: boolean;
  initialTab?: ShopTab;
  progress: PersistentProgress;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onSelectTheme: (themeId: KitchenThemeId) => void;
  onClose: () => void;
}

export function BistroShopModal({
  open,
  initialTab = 'upgrades',
  progress,
  onBuyUpgrade,
  onSelectTheme,
  onClose,
}: BistroShopModalProps) {
  const [tab, setTab] = useState<ShopTab>(initialTab);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  if (!open) return null;

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
            <p className="text-xs font-bold text-[#C94136]">Day {progress.day} Bistro Ledger</p>
            <h2 id="bistro-shop-title" className="font-display text-xl sm:text-3xl font-bold">
              Upgrades &amp; Style
            </h2>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="clay-inset flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5"
              aria-label={`Bistro coins: ${progress.coins}`}
            >
              <CoinSvg className="w-4 h-4 shrink-0" />
              <span className="font-mono-num text-sm sm:text-base font-bold text-[#B45309] tabular-nums">
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
          className="clay-inset inline-flex items-center gap-1 p-1 sm:p-1.5 self-start max-w-full"
        >
          {(
            [
              ['upgrades', 'Upgrades', 'Kitchen Upgrades'],
              ['themes', 'Themes', 'Bistro Themes'],
              ['recipes', 'Menu', 'Menu & Milestones'],
            ] as const
          ).map(([id, shortLabel, fullLabel]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                tab === id
                  ? 'clay-btn bg-[#C94136] text-white'
                  : 'text-[#6E5245] hover:text-[#3D2921]'
              }`}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{fullLabel}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto pr-1.5 py-1 space-y-2.5 sm:space-y-3">
          {tab === 'upgrades' &&
            UPGRADE_CATALOG.map((u) => {
              const lvl = progress.upgrades[u.key] ?? 0;
              const isMax = lvl >= u.maxLevel;
              const cost = getUpgradeCost(u, lvl);
              const canAfford = !isMax && progress.coins >= cost;

              return (
                <div
                  key={u.key}
                  className="clay-card-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFBF7] px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-display font-bold text-base text-[#3D2921]">
                        {u.name}
                      </span>
                      <span className="font-mono-num text-xs font-bold text-[#C94136]">
                        Lv {lvl}/{u.maxLevel}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E5245] mt-0.5 font-medium">{u.description}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {Array.from({ length: u.maxLevel }, (_, idx) => (
                        <span
                          key={idx}
                          className={`h-2 w-7 rounded-full transition-colors ${
                            idx < lvl ? 'bg-[#E3574B]' : 'bg-[#EAD8C8]'
                          }`}
                        />
                      ))}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {Object.values(KITCHEN_THEMES).map((theme) => {
                const unlocked = progress.unlockedThemes.includes(theme.id);
                const selected = progress.selectedTheme === theme.id;
                const canUnlock = unlocked || progress.coins >= theme.cost;

                return (
                  <div
                    key={theme.id}
                    className={`clay-card-sm p-4 flex flex-col justify-between gap-3 ${
                      selected ? 'bg-[#FFF3E6] ring-2 ring-[#C94136]' : 'bg-[#FFFBF7]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-base text-[#3D2921]">
                          {theme.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-4 rounded-full shadow-inner border border-black/10"
                            style={{ backgroundColor: theme.floorLight }}
                          />
                          <span
                            className="w-4 h-4 rounded-full shadow-inner border border-black/10"
                            style={{ backgroundColor: theme.counterWood }}
                          />
                          <span
                            className="w-4 h-4 rounded-full shadow-inner border border-black/10"
                            style={{ backgroundColor: theme.apronAccent }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-[#6E5245] mt-1 font-medium">
                        Styles kitchen tile, butcher block, and Chef Pip&apos;s apron.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!canUnlock || selected}
                      onClick={() => onSelectTheme(theme.id)}
                      className={`w-full py-2.5 rounded-2xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
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
                        'Equip Theme'
                      ) : (
                        <>
                          <span>Unlock</span>
                          <CoinSvg className="w-3.5 h-3.5" />
                          <span className="font-mono-num tabular-nums">{theme.cost}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'recipes' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-[#C94136] mb-2">
                  Signature Bistro &amp; Patisserie Menu ({RECIPE_LIST.length} Dishes)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RECIPE_LIST.map((r) => (
                    <div
                      key={r.id}
                      className="clay-card-sm bg-[#FFFBF7] px-3.5 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-display text-xs sm:text-sm font-bold text-[#3D2921] truncate">
                          {r.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
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
                                <IngredientSvg base={s.base} className="w-3.5 h-3.5 shrink-0" />
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold leading-none ${tagCls}`}>
                                  {s.prep === 'chop'
                                    ? 'CHOP'
                                    : s.prep === 'sear'
                                      ? 'SEAR'
                                      : s.prep === 'chop_sear'
                                        ? 'CHOP+FRY'
                                        : 'PLATE'}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-[#B45309] shrink-0">
                        {r.baseScore}pt
                      </span>
                    </div>
                  ))}
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

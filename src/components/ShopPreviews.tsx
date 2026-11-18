import React from 'react';
import type { ThemeDefinition } from '../game/progression';
import type { DishId, DishRecipe, UpgradeKey } from '../game/types';
import { IngredientSvg } from './DishIcons';

/**
 * Looping animated "GIF-like" clay preview for each Kitchen Upgrade.
 * Uses pure compositor transforms/opacity so every upgrade visually demonstrates
 * its gameplay effect at 60fps with zero external network assets.
 */
export function UpgradeMotionPreview({
  upgradeKey,
  level,
}: {
  upgradeKey: UpgradeKey;
  level: number;
}) {
  const speedBoostDuration = Math.max(0.95, 1.9 - level * 0.22);

  return (
    <div
      className="relative w-24 h-20 sm:w-28 sm:h-20 shrink-0 rounded-2xl overflow-hidden clay-inset bg-[#F6E9DC] flex items-center justify-center"
      aria-hidden="true"
    >
      {upgradeKey === 'speed' && (
        <svg viewBox="0 0 112 80" className="w-full h-full">
          {/* Checkered kitchen floor strip */}
          <rect x="0" y="0" width="112" height="80" fill="#FFF6EC" />
          <rect x="0" y="40" width="28" height="40" fill="#F2E0CE" />
          <rect x="56" y="40" width="28" height="40" fill="#F2E0CE" />
          <rect x="28" y="0" width="28" height="40" fill="#F2E0CE" />
          <rect x="84" y="0" width="28" height="40" fill="#F2E0CE" />

          {/* Animated Chef Pip dashing */}
          <g
            className="anim-gif-dash"
            style={{ animationDuration: `${speedBoostDuration}s` }}
          >
            {/* Speed whoosh lines */}
            <g className="anim-gif-whoosh">
              <line x1="22" y1="36" x2="36" y2="36" stroke="#E3574B" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="18" y1="45" x2="34" y2="45" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="24" y1="53" x2="36" y2="53" stroke="#E3574B" strokeWidth="2" strokeLinecap="round" />
            </g>
            {/* Shadow */}
            <ellipse cx="56" cy="59" rx="14" ry="4.5" fill="rgba(61,41,33,0.16)" />
            {/* Apron body */}
            <circle cx="56" cy="44" r="14" fill="#FFFDF9" stroke="#3D2921" strokeWidth="2.2" />
            <path d="M44 47 Q56 58 68 47 L65 56 Q56 61 47 56 Z" fill="#E3574B" />
            {/* Chef toque */}
            <circle cx="56" cy="30" r="10.5" fill="#FFFFFF" stroke="#3D2921" strokeWidth="2.2" />
            <circle cx="51" cy="24" r="5" fill="#FFFFFF" />
            <circle cx="61" cy="24" r="5" fill="#FFFFFF" />
            <circle cx="56" cy="22" r="5.5" fill="#FFFFFF" />
            {/* Rosy eyes */}
            <circle cx="59" cy="40" r="1.6" fill="#3D2921" />
            <circle cx="64" cy="40" r="1.6" fill="#3D2921" />
          </g>
        </svg>
      )}

      {upgradeKey === 'chop' && (
        <svg viewBox="0 0 112 80" className="w-full h-full">
          <rect x="0" y="0" width="112" height="80" fill="#F6E5D4" />
          {/* Wooden cutting board */}
          <rect x="12" y="20" width="88" height="48" rx="10" fill="#E3B587" stroke="#8A5233" strokeWidth="2.4" />
          <rect x="17" y="25" width="78" height="38" rx="7" fill="#F0CAA1" />
          {/* Tomato being diced */}
          <circle cx="44" cy="46" r="11" fill="#EF4444" stroke="#7F1D1D" strokeWidth="2" />
          <path d="M40 36 L44 39 L48 36" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" />
          {/* Diced pieces popping off */}
          <g className="anim-gif-chip">
            <rect x="52" y="42" width="6" height="6" rx="1.8" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
            <circle cx="60" cy="36" r="2.6" fill="#FCA5A5" />
          </g>
          {/* Animated Damascus Knife */}
          <g
            className="anim-gif-knife"
            style={{ animationDuration: `${Math.max(0.55, 1.15 - level * 0.14)}s` }}
          >
            <path
              d="M44 46 L72 28 L76 34 L50 51 Q46 52 44 46 Z"
              fill="#E2E8F0"
              stroke="#334155"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M51 44 L70 32" stroke="#94A3B8" strokeWidth="1.3" strokeDasharray="3 2" />
            <rect
              x="71"
              y="22"
              width="19"
              height="7.5"
              rx="3.5"
              transform="rotate(-32 71 22)"
              fill="#5C3A28"
              stroke="#3D2921"
              strokeWidth="1.8"
            />
          </g>
        </svg>
      )}

      {upgradeKey === 'heat' && (
        <svg viewBox="0 0 112 80" className="w-full h-full">
          <rect x="0" y="0" width="112" height="80" fill="#2F231E" />
          {/* Glowing burner */}
          <circle cx="52" cy="40" r="27" fill="rgba(249,115,22,0.22)" />
          {/* Skillet handle & copper pan */}
          <rect x="76" y="36" width="24" height="7" rx="3.5" fill="#B9724B" stroke="#1C1411" strokeWidth="2" />
          <circle cx="52" cy="40" r="22" fill="#E07650" stroke="#1C1411" strokeWidth="2.4" />
          <circle cx="52" cy="40" r="17" fill="#4A332A" />
          {/* Sizzling sunny egg */}
          <ellipse cx="51" cy="40" rx="10" ry="8" fill="#FFFDF9" />
          <circle cx="52" cy="40" r="4.5" fill="#FBBF24" />
          {/* Rising golden steam */}
          <g className="anim-gif-steam">
            <path d="M44 26 Q42 20 46 15" fill="none" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" />
            <path d="M58 24 Q61 18 57 12" fill="none" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" />
          </g>
          {/* Golden sear sweet-spot gauge */}
          <rect x="18" y="65" width="76" height="8" rx="4" fill="#1C1917" />
          <rect x="44" y="66.5" width={24 + level * 4} height="5" rx="2.5" fill="#22C55E" />
          <g className="anim-gif-gauge">
            <rect x="52" y="63" width="4.5" height="12" rx="2" fill="#FEF08A" stroke="#3D2921" strokeWidth="1.2" />
          </g>
        </svg>
      )}

      {upgradeKey === 'patience' && (
        <svg viewBox="0 0 112 80" className="w-full h-full">
          <rect x="0" y="0" width="112" height="80" fill="#FDF3E6" />
          {/* Brass warming lamp & soft glow cone */}
          <g className="anim-gif-lamp">
            <polygon points="44,18 68,18 92,76 20,76" fill="rgba(251,191,36,0.28)" />
          </g>
          <path d="M56 2 V12" stroke="#92400E" strokeWidth="2.4" />
          <path d="M41 18 Q56 8 71 18 Z" fill="#D97706" stroke="#78350F" strokeWidth="2" />
          {/* Smiling happy guest */}
          <circle cx="56" cy="47" r="14" fill="#F9A8D4" stroke="#3D2921" strokeWidth="2" />
          <circle cx="56" cy="45" r="10.5" fill="#FDE6D4" />
          <circle cx="52" cy="44" r="1.5" fill="#3D2921" />
          <circle cx="60" cy="44" r="1.5" fill="#3D2921" />
          <path d="M52.5 48.5 Q56 52 59.5 48.5" fill="none" stroke="#3D2921" strokeWidth="1.8" strokeLinecap="round" />
          {/* Floating hearts */}
          <g className="anim-gif-heart">
            <path
              d="M78 36 C78 33 74 33 74 36 C74 39 78 41 78 41 C78 41 82 39 82 36 C82 33 78 33 78 36 Z"
              fill="#EC4899"
            />
          </g>
          {/* Lush full green patience bar */}
          <rect x="26" y="66" width="60" height="7" rx="3.5" fill="#E7D8C9" />
          <rect x="27.5" y="67.5" width="52" height="4" rx="2" fill="#22C55E" />
        </svg>
      )}

      {upgradeKey === 'tips' && (
        <svg viewBox="0 0 112 80" className="w-full h-full">
          <rect x="0" y="0" width="112" height="80" fill="#FFF7EB" />
          {/* Bistro plate */}
          <ellipse cx="56" cy="56" rx="28" ry="12" fill="#FFFFFF" stroke="#B8A394" strokeWidth="2" />
          <ellipse cx="56" cy="55" rx="19" ry="7.5" fill="#FDE6C9" />
          <circle cx="51" cy="54" r="5" fill="#EF4444" />
          <circle cx="61" cy="54" r="5" fill="#22C55E" />
          {/* Falling herb garnish */}
          <g className="anim-gif-garnish">
            <path d="M56 46 Q51 40 56 36 Q61 40 56 46 Z" fill="#16A34A" stroke="#14532D" strokeWidth="1.4" />
            <path d="M56 46 Q62 41 65 45 Q60 49 56 46 Z" fill="#22C55E" stroke="#14532D" strokeWidth="1.2" />
          </g>
          {/* Fountain of Bistro Coins */}
          <g className="anim-gif-coin">
            <circle cx="34" cy="34" r="7" fill="#FBBF24" stroke="#B45309" strokeWidth="1.8" />
            <circle cx="56" cy="24" r="8" fill="#FDE047" stroke="#B45309" strokeWidth="1.8" />
            <circle cx="78" cy="34" r="7" fill="#FBBF24" stroke="#B45309" strokeWidth="1.8" />
            <text x="56" y="27.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#92400E">
              +
            </text>
          </g>
        </svg>
      )}

      <span className="absolute bottom-1 right-1.5 text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#3D2921]/75 text-[#FFFBF7]">
        LIVE
      </span>
    </div>
  );
}

/**
 * Miniature top-down clay kitchen diorama preview for Bistro Themes.
 * Renders the theme's real tile colors, butcher-block counters, island,
 * copper skillet, and animated Chef Pip wearing the theme's apron accent.
 */
export function ThemeMiniKitchenPreview({
  theme,
  large = false,
}: {
  theme: ThemeDefinition;
  large?: boolean;
}) {
  return (
    <div
      className={`relative w-full aspect-[240/112] overflow-hidden rounded-2xl border border-[#3D2921]/10 ${
        large ? 'shadow-sm' : ''
      }`}
      style={{ backgroundColor: theme.floorLight }}
      aria-label={`${theme.name} kitchen visual preview`}
    >
      <svg viewBox="0 0 240 112" preserveAspectRatio="xMidYMid meet" className="w-full h-full block">
        {/* Checkered floor tiles */}
        <rect x="0" y="0" width="240" height="112" fill={theme.floorLight} />
        {Array.from({ length: 10 }, (_, c) =>
          Array.from({ length: 5 }, (_, r) =>
            (c + r) % 2 === 1 ? (
              <rect
                key={`${c}-${r}`}
                x={c * 24}
                y={r * 24}
                width="24"
                height="24"
                fill={theme.floorDark}
              />
            ) : null,
          ),
        )}

        {/* Top butcher block counter + cutting boards */}
        <rect x="0" y="0" width="240" height="22" fill={theme.counterWood} />
        <rect x="0" y="20" width="240" height="3.5" fill={theme.counterTrim} />
        <rect x="44" y="4" width="26" height="14" rx="4" fill="#F8E4C8" stroke={theme.counterTrim} strokeWidth="1.5" />
        <rect x="78" y="4" width="26" height="14" rx="4" fill="#F8E4C8" stroke={theme.counterTrim} strokeWidth="1.5" />

        {/* Left pantry counter */}
        <rect x="0" y="22" width="24" height="90" fill={theme.counterWood} />
        <rect x="22" y="22" width="3" height="90" fill={theme.counterTrim} />
        <circle cx="12" cy="40" r="6.5" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.4" />
        <circle cx="12" cy="60" r="6.5" fill="#22C55E" stroke="#14532D" strokeWidth="1.4" />
        <circle cx="12" cy="80" r="6.5" fill="#E6A960" stroke="#78350F" strokeWidth="1.4" />

        {/* Right skillet counter with sizzling copper pan */}
        <rect x="216" y="22" width="24" height="90" fill={theme.counterWood} />
        <rect x="214" y="22" width="3" height="90" fill={theme.counterTrim} />
        <circle cx="228" cy="44" r="8" fill="#E07650" stroke="#3D2921" strokeWidth="1.6" />
        <circle cx="228" cy="44" r="5.5" fill="#4A332A" />
        <circle cx="228" cy="44" r="2.2" fill="#FBBF24" />
        <g className="anim-gif-steam">
          <path d="M226 34 Q224 28 228 24" fill="none" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Central plating island */}
        <rect
          x="90"
          y="44"
          width="60"
          height="28"
          rx="9"
          fill={theme.islandTop}
          stroke={theme.counterTrim}
          strokeWidth="2.4"
        />
        <circle cx="108" cy="58" r="8.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.6" />
        <circle cx="132" cy="58" r="8.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.6" />
        <circle cx="108" cy="58" r="4" fill="#EF4444" />

        {/* Service pass rail at bottom */}
        <rect x="0" y="94" width="240" height="18" fill={theme.counterWood} />
        <rect x="0" y="92" width="240" height="4" fill={theme.railAccent} />
        {/* Waiting customer heads */}
        <circle cx="64" cy="105" r="8" fill="#F9A8D4" stroke="#3D2921" strokeWidth="1.5" />
        <circle cx="120" cy="105" r="8" fill="#93C5FD" stroke="#3D2921" strokeWidth="1.5" />
        <circle cx="176" cy="105" r="8" fill="#FCD34D" stroke="#3D2921" strokeWidth="1.5" />

        {/* Animated Chef Pip in theme apron */}
        <g className="anim-theme-bob">
          <ellipse cx="64" cy="68" rx="11" ry="4" fill="rgba(61,41,33,0.16)" />
          <circle cx="64" cy="56" r="11" fill="#FFFDF9" stroke="#3D2921" strokeWidth="2" />
          <path d="M55 59 Q64 67 73 59 L70 65 Q64 69 58 65 Z" fill={theme.apronAccent} />
          <circle cx="64" cy="46" r="8" fill="#FFFFFF" stroke="#3D2921" strokeWidth="1.8" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Handcrafted clay plated dish illustration for every recipe in the Menu book.
 */
export function PlatedDishSvg({
  dishId,
  className = 'w-12 h-12',
}: {
  dishId: DishId;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* Clay ceramic plate */}
      <ellipse cx="32" cy="36" rx="26" ry="20" fill="#EAD8C8" />
      <ellipse cx="32" cy="33" rx="25" ry="19" fill="#FFFDF9" stroke="#C9B3A1" strokeWidth="2" />
      <ellipse cx="32" cy="33" rx="18" ry="13" fill="#FAF2E9" />

      {dishId === 'bruschetta' && (
        <>
          <ellipse cx="32" cy="34" rx="14" ry="9" fill="#E6A960" stroke="#78350F" strokeWidth="1.8" />
          <circle cx="27" cy="32" r="3.6" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
          <circle cx="35" cy="31" r="3.8" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.2" />
          <circle cx="31" cy="36" r="3.4" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
          <path d="M32 28 Q37 24 39 28 Q35 31 32 28 Z" fill="#16A34A" />
        </>
      )}

      {dishId === 'avo_toast' && (
        <>
          <ellipse cx="32" cy="34" rx="14" ry="9" fill="#E6A960" stroke="#78350F" strokeWidth="1.8" />
          <ellipse cx="26" cy="32" rx="4.5" ry="6.5" transform="rotate(-18 26 32)" fill="#84CC16" stroke="#365314" strokeWidth="1.4" />
          <ellipse cx="32" cy="31" rx="4.5" ry="6.5" fill="#A3E635" stroke="#365314" strokeWidth="1.4" />
          <ellipse cx="38" cy="32" rx="4.5" ry="6.5" transform="rotate(18 38 32)" fill="#84CC16" stroke="#365314" strokeWidth="1.4" />
          <circle cx="32" cy="33" r="2.2" fill="#FEF3C7" />
        </>
      )}

      {dishId === 'garden_bowl' && (
        <>
          <circle cx="26" cy="32" r="7.5" fill="#22C55E" stroke="#14532D" strokeWidth="1.5" />
          <circle cx="37" cy="32" r="7.5" fill="#16A34A" stroke="#14532D" strokeWidth="1.5" />
          <circle cx="32" cy="37" r="7" fill="#4ADE80" stroke="#14532D" strokeWidth="1.5" />
          <circle cx="28" cy="31" r="3.4" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
          <circle cx="36" cy="35" r="3.4" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
          <circle cx="34" cy="28" r="2.8" fill="#FCA5A5" />
        </>
      )}

      {dishId === 'morning_brioche' && (
        <>
          <ellipse cx="32" cy="36" rx="14" ry="9" fill="#E6A960" stroke="#78350F" strokeWidth="1.8" />
          <ellipse cx="32" cy="31" rx="11.5" ry="7.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
          <circle cx="32" cy="31" r="5" fill="#F59E0B" stroke="#D97706" strokeWidth="1.2" />
          <circle cx="30.5" cy="29.5" r="1.5" fill="#FEF3C7" />
        </>
      )}

      {dishId === 'berry_toast' && (
        <>
          <rect x="20" y="26" width="24" height="16" rx="6" fill="#F2B86B" stroke="#78350F" strokeWidth="1.8" />
          <ellipse cx="32" cy="33" rx="9" ry="5.5" fill="#FEF3C7" />
          <circle cx="27" cy="31" r="3.8" fill="#F43F5E" stroke="#881337" strokeWidth="1.2" />
          <circle cx="36" cy="31" r="3.8" fill="#E11D48" stroke="#881337" strokeWidth="1.2" />
          <circle cx="32" cy="36" r="3.8" fill="#F43F5E" stroke="#881337" strokeWidth="1.2" />
          <path d="M30 27 L32 29 L34 27" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {dishId === 'avo_bowl' && (
        <>
          <circle cx="25" cy="33" r="7" fill="#16A34A" stroke="#14532D" strokeWidth="1.4" />
          <circle cx="38" cy="33" r="7" fill="#22C55E" stroke="#14532D" strokeWidth="1.4" />
          <ellipse cx="32" cy="31" rx="6" ry="7" fill="#A3E635" stroke="#365314" strokeWidth="1.4" />
          <circle cx="32" cy="32" r="2.6" fill="#78350F" />
          <circle cx="25" cy="36" r="3.2" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
          <circle cx="39" cy="36" r="3.2" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
        </>
      )}

      {dishId === 'bistro_burger' && (
        <>
          <ellipse cx="32" cy="39" rx="13.5" ry="6.5" fill="#D99B52" stroke="#78350F" strokeWidth="1.6" />
          <ellipse cx="32" cy="35" rx="14.5" ry="5.5" fill="#22C55E" stroke="#14532D" strokeWidth="1.4" />
          <ellipse cx="32" cy="32" rx="13.5" ry="5.5" fill="#7C3F23" stroke="#3D2921" strokeWidth="1.6" />
          <path d="M19 29 C19 20, 45 20, 45 29 Z" fill="#E6A960" stroke="#78350F" strokeWidth="1.7" />
          <circle cx="28" cy="24" r="1.1" fill="#FEF3C7" />
          <circle cx="34" cy="23.5" r="1.1" fill="#FEF3C7" />
          <circle cx="38" cy="26" r="1.1" fill="#FEF3C7" />
        </>
      )}

      {dishId === 'steak_hash' && (
        <>
          {/* Crispy golden frites */}
          <rect x="33" y="24" width="4" height="14" rx="1.5" transform="rotate(14 33 24)" fill="#FACC15" stroke="#A16207" strokeWidth="1.2" />
          <rect x="38" y="25" width="4" height="14" rx="1.5" transform="rotate(24 38 25)" fill="#FDE047" stroke="#A16207" strokeWidth="1.2" />
          <rect x="30" y="27" width="4" height="13" rx="1.5" transform="rotate(6 30 27)" fill="#EAB308" stroke="#A16207" strokeWidth="1.2" />
          {/* Seared steak patty */}
          <ellipse cx="26" cy="35" rx="10" ry="7.5" fill="#7C3F23" stroke="#3D2921" strokeWidth="1.8" />
          <path d="M21 33 H31 M21 37 H31" stroke="#3D2921" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="39" cy="38" r="3.6" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.2" />
        </>
      )}

      {dishId === 'royale_burger' && (
        <>
          <ellipse cx="32" cy="41" rx="13.5" ry="6" fill="#D99B52" stroke="#78350F" strokeWidth="1.6" />
          <ellipse cx="32" cy="37" rx="13.8" ry="5" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.3" />
          <ellipse cx="32" cy="34" rx="13.5" ry="5" fill="#7C3F23" stroke="#3D2921" strokeWidth="1.6" />
          <ellipse cx="32" cy="30" rx="11" ry="4.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.3" />
          <circle cx="32" cy="30" r="3.5" fill="#F59E0B" />
          <path d="M19 27 C19 18, 45 18, 45 27 Z" fill="#E6A960" stroke="#78350F" strokeWidth="1.7" />
          <circle cx="28" cy="22" r="1.1" fill="#FEF3C7" />
          <circle cx="35" cy="22" r="1.1" fill="#FEF3C7" />
        </>
      )}
    </svg>
  );
}

/**
 * Interactive step-by-step recipe assembly preview banner shown in the Menu tab.
 */
export function RecipeAssemblyPreview({ recipe }: { recipe: DishRecipe }) {
  return (
    <div className="clay-card-sm bg-[#FFF5E8] p-3.5 sm:p-4 flex flex-col sm:flex-row items-center gap-3.5">
      <div className="clay-inset bg-[#FFFDF9] p-2 rounded-2xl shrink-0 flex flex-col items-center justify-center">
        <PlatedDishSvg dishId={recipe.id} className="w-16 h-16 sm:w-20 sm:h-20" />
      </div>

      <div className="flex-1 min-w-0 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <span className="font-display text-base sm:text-lg font-bold text-[#3D2921]">
            {recipe.name}
          </span>
          <span className="font-mono-num text-xs font-bold text-[#B45309]">
            {recipe.baseScore} pts
          </span>
          <span className="text-[11px] font-semibold text-[#6E5245]">
            · Wave {recipe.minWave}+
          </span>
        </div>

        <p className="text-xs text-[#6E5245] font-medium mt-0.5">
          Prep each ingredient, assemble on a Plating Mat, then tap the matching guest.
        </p>

        {/* Animated visual prep flow */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2.5">
          {recipe.steps.map((s, idx) => {
            const actionText =
              s.prep === 'chop'
                ? 'Chop on Board'
                : s.prep === 'sear'
                  ? 'Sear in Pan'
                  : s.prep === 'chop_sear'
                    ? 'Chop → Fry'
                    : 'Ready to Plate';
            const actionColor =
              s.prep === 'chop'
                ? 'text-[#15803D]'
                : s.prep === 'sear'
                  ? 'text-[#C2410C]'
                  : s.prep === 'chop_sear'
                    ? 'text-[#B45309]'
                    : 'text-[#6E5245]';
            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className="text-xs font-bold text-[#B08A74]" aria-hidden="true">
                    +
                  </span>
                )}
                <div className="clay-inset bg-[#FFFBF7] px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                  <IngredientSvg base={s.base} className="w-4 h-4 shrink-0" />
                  <div className="text-left leading-tight">
                    <div className="text-[11px] font-bold text-[#3D2921]">{s.label}</div>
                    <div className={`text-[9px] font-bold ${actionColor}`}>{actionText}</div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <span className="text-xs font-bold text-[#B08A74]" aria-hidden="true">
            →
          </span>
          <div className="clay-inset bg-[#E3F6EA] px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
            <PlatedDishSvg dishId={recipe.id} className="w-5 h-5 shrink-0" />
            <span className="text-[11px] font-bold text-[#15803D]">Serve!</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import type { IngredientBase } from '../game/types';

export function CopperPanTitleLockup() {
  return (
    <div className="flex flex-col items-start gap-2.5">
      <div className="clay-card-sm px-3.5 py-2 inline-flex items-center justify-center">
        <svg
          viewBox="0 0 88 52"
          className="w-16 h-10"
          aria-hidden="true"
        >
          <path
            d="M36 16 C33 11, 40 7, 36 2"
            fill="none"
            stroke="#E3574B"
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M48 14 C45 9, 52 5, 48 1"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.75"
          />
          <path
            d="M59 17 C57 12, 62 8, 59 3"
            fill="none"
            stroke="#E3574B"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.65"
          />
          <path
            d="M6 28 L27 32 L26 37 L5 33 Z"
            fill="#A96B47"
            stroke="#3D2921"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="31" r="1.8" fill="#FEF3C7" />
          <ellipse
            cx="52"
            cy="34"
            rx="28"
            ry="12"
            fill="#E37752"
            stroke="#3D2921"
            strokeWidth="2.4"
          />
          <ellipse cx="52" cy="32" rx="23" ry="8.5" fill="#4A332A" />
          <ellipse cx="49" cy="32" rx="9" ry="5.5" fill="#FFFDF9" />
          <circle cx="51" cy="31.5" r="3.4" fill="#FBBF24" />
          <path
            d="M30 40 Q52 47 74 40"
            fill="none"
            stroke="#FDBA74"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      </div>

      <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-[#3D2921] leading-[0.98] [text-wrap:balance]">
        Copper Pan
      </h1>
    </div>
  );
}

export function IngredientSvg({ base, className = 'w-4 h-4' }: { base: IngredientBase; className?: string }) {
  switch (base) {
    case 'bun':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#E6A960" stroke="#78350F" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1.1" fill="#FEF3C7" />
          <circle cx="14" cy="9" r="1.1" fill="#FEF3C7" />
          <circle cx="12" cy="14" r="1.1" fill="#FEF3C7" />
        </svg>
      );
    case 'tomato':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="13" r="8.5" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.8" />
          <path d="M9 5 L12 8 L15 5" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'lettuce':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="#22C55E" stroke="#14532D" strokeWidth="1.8" />
          <circle cx="10" cy="10" r="3.2" fill="#BBF7D0" />
        </svg>
      );
    case 'potato':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <ellipse cx="12" cy="12" rx="9" ry="6.5" fill="#EAB308" stroke="#713F12" strokeWidth="1.8" />
          <circle cx="9" cy="11" r="1" fill="#FEF08A" />
          <circle cx="15" cy="13" r="1" fill="#FEF08A" />
        </svg>
      );
    case 'egg':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4.2" fill="#F59E0B" />
        </svg>
      );
    case 'patty':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="#8C4A27" stroke="#3D2921" strokeWidth="1.8" />
          <path d="M7 10 H17 M7 14 H17" stroke="#3D2921" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'avocado':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <ellipse cx="12" cy="12" rx="7" ry="9" fill="#65A30D" stroke="#365314" strokeWidth="1.8" />
          <ellipse cx="12" cy="13" rx="4.2" ry="5.5" fill="#D9F99D" />
          <circle cx="12" cy="14" r="2.2" fill="#78350F" />
        </svg>
      );
    case 'strawberry':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 20 C6 15, 5 9, 8 7 C10 5.5, 14 5.5, 16 7 C19 9, 18 15, 12 20 Z"
            fill="#F43F5E"
            stroke="#881337"
            strokeWidth="1.8"
          />
          <path d="M9 6 L12 8 L15 6" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
}

export function CoinSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#FBBF24" stroke="#B45309" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#FEF3C7" strokeWidth="1.5" />
      <path d="M12 8 V16 M9.5 10.5 C9.5 9.2 14.5 9.2 14.5 10.5" stroke="#92400E" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function StarSocketSvg({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M12 2.5 L14.9 8.4 L21.4 9.3 L16.7 13.9 L17.8 20.4 L12 17.3 L6.2 20.4 L7.3 13.9 L2.6 9.3 L9.1 8.4 Z"
        fill={filled ? '#FBBF24' : '#EFE0D2'}
        stroke={filled ? '#B45309' : '#C8B29F'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {filled && <path d="M12 5 L13.7 8.8 L10.3 8.8 Z" fill="#FEF3C7" opacity="0.8" />}
    </svg>
  );
}

export function SoundIconSvg({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M4 9.5 H8 L13.5 5 V19 L8 14.5 H4 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M16.5 9 L21 15 M21 9 L16.5 15"
          stroke="#F87171"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16.5 8.8 C18.2 10.5 18.2 13.5 16.5 15.2 M19 6.5 C21.8 9.5 21.8 14.5 19 17.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function PauseIconSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

export function RestartIconSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M4 12 A8 8 0 1 1 6.4 17.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M4 7 V12.5 H9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

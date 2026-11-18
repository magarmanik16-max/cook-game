import React from 'react';
import { CUSTOMER_PALETTES } from '../game/customerSprites';

interface CustomerAvatarProps {
  avatarId: number;
  isVip?: boolean;
  mood?: 'calm' | 'impatient' | 'urgent';
  className?: string;
}

export function CustomerAvatar({
  avatarId,
  isVip = false,
  mood = 'calm',
  className = 'w-6 h-6',
}: CustomerAvatarProps) {
  const palette = CUSTOMER_PALETTES[Math.abs(avatarId) % CUSTOMER_PALETTES.length];

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {/* Shoulders */}
      <path
        d="M5 30 C5 22, 27 22, 27 30 Z"
        fill={palette.shirt}
        stroke="#3D2921"
        strokeWidth="1.8"
      />
      <path d="M12 23 Q16 26.5 20 23" fill={palette.collar} />

      {/* Back hair accents */}
      {palette.style === 'buns' && (
        <>
          <circle cx="8" cy="8.5" r="3.4" fill={palette.hair} stroke="#3D2921" strokeWidth="1.4" />
          <circle cx="24" cy="8.5" r="3.4" fill={palette.hair} stroke="#3D2921" strokeWidth="1.4" />
        </>
      )}
      {palette.style === 'ponytail' && (
        <ellipse
          cx="24.5"
          cy="14"
          rx="2.6"
          ry="4.5"
          fill={palette.hair}
          stroke="#3D2921"
          strokeWidth="1.3"
        />
      )}
      {palette.style === 'wavy' && (
        <>
          <circle cx="9" cy="17" r="3.2" fill={palette.hair} />
          <circle cx="23" cy="17" r="3.2" fill={palette.hair} />
        </>
      )}

      {/* Head */}
      <circle
        cx="16"
        cy="15"
        r="8.4"
        fill={palette.skin}
        stroke="#3D2921"
        strokeWidth="1.8"
      />

      {/* Bangs / Beret */}
      {palette.style === 'beret' ? (
        <>
          <path d="M8.5 13 A7.5 7 0 0 1 23.5 13 Z" fill={palette.hair} />
          <ellipse
            cx="15"
            cy="7.5"
            rx="8"
            ry="3.2"
            transform="rotate(-8 15 7.5)"
            fill="#E11D48"
            stroke="#3D2921"
            strokeWidth="1.5"
          />
        </>
      ) : (
        <path
          d="M8.2 13.5 A8 7.5 0 0 1 23.8 13.5 Q20 11 16 12.6 Q12 11 8.2 13.5 Z"
          fill={palette.hair}
        />
      )}

      {/* VIP Crown */}
      {isVip && (
        <path
          d="M11 7.2 L12.5 3 L16 6 L19.5 3 L21 7.2 Z"
          fill="#FBBF24"
          stroke="#78350F"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}

      {/* Cheeks */}
      <circle
        cx="11.5"
        cy="17"
        r="1.5"
        fill={mood === 'urgent' ? '#E11D48' : '#F43F5E'}
        opacity="0.45"
      />
      <circle
        cx="20.5"
        cy="17"
        r="1.5"
        fill={mood === 'urgent' ? '#E11D48' : '#F43F5E'}
        opacity="0.45"
      />

      {/* Eyes */}
      <circle cx="13.2" cy="15" r="1.25" fill="#1C1917" />
      <circle cx="18.8" cy="15" r="1.25" fill="#1C1917" />

      {/* Mouth */}
      {mood === 'urgent' ? (
        <path d="M14.2 19 Q16 17.4 17.8 19" fill="none" stroke="#3D2921" strokeWidth="1.3" strokeLinecap="round" />
      ) : mood === 'impatient' ? (
        <line x1="14.2" y1="18.5" x2="17.8" y2="18.2" stroke="#3D2921" strokeWidth="1.3" strokeLinecap="round" />
      ) : (
        <path d="M14 17.8 Q16 19.6 18 17.8" fill="none" stroke="#3D2921" strokeWidth="1.3" strokeLinecap="round" />
      )}
    </svg>
  );
}

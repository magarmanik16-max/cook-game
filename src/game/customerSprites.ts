import type { CustomerVariety } from './types';

export type CustomerHairStyle = 'bob' | 'buns' | 'beret' | 'ponytail' | 'curly' | 'wavy';

export interface CustomerPalette {
  shirt: string;
  collar: string;
  hair: string;
  skin: string;
  style: CustomerHairStyle;
}

export const CUSTOMER_PALETTES: CustomerPalette[] = [
  { shirt: '#F472B6', collar: '#FDF2F8', hair: '#4A2C21', skin: '#FCD5B5', style: 'bob' },
  { shirt: '#60A5FA', collar: '#EFF6FF', hair: '#78350F', skin: '#F7C9A6', style: 'beret' },
  { shirt: '#A78BFA', collar: '#F5F3FF', hair: '#1E293B', skin: '#FDE0C8', style: 'buns' },
  { shirt: '#34D399', collar: '#ECFDF5', hair: '#9A3412', skin: '#EAB996', style: 'ponytail' },
  { shirt: '#FB923C', collar: '#FFF7ED', hair: '#3B2314', skin: '#D99B72', style: 'curly' },
  { shirt: '#FBBF24', collar: '#FFFBEB', hair: '#581C87', skin: '#FCE0C6', style: 'wavy' },
];

export interface DrawCustomerSpriteOptions {
  cx: number;
  cy: number;
  radius: number;
  avatarId: number;
  variety?: CustomerVariety;
  isVip?: boolean;
  isExcited?: boolean;
  mood?: 'calm' | 'impatient' | 'urgent' | 'happy';
  timeNow: number;
  halfBody?: boolean;
}

export function drawCustomerSprite(
  ctx: CanvasRenderingContext2D,
  opts: DrawCustomerSpriteOptions,
): void {
  const {
    cx,
    cy,
    radius: r,
    avatarId,
    variety = 'regular',
    isVip = false,
    isExcited = false,
    mood = 'calm',
    timeNow,
    halfBody = false,
  } = opts;
  const resolvedVariety: CustomerVariety = isVip ? 'vip' : variety;

  const palette = CUSTOMER_PALETTES[Math.abs(avatarId) % CUSTOMER_PALETTES.length];
  const blink = (timeNow + avatarId * 530) % 3800 < 115;

  ctx.save();
  ctx.translate(cx, cy);

  if (!halfBody) {
    // Ground contact shadow
    ctx.fillStyle = 'rgba(110, 65, 42, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.88, r * 0.96, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shoulders / pastel cardigan + crisp white collar
  ctx.fillStyle = palette.shirt;
  ctx.strokeStyle = '#3D2921';
  ctx.lineWidth = Math.max(1.4, r * 0.11);
  ctx.beginPath();
  if (halfBody) {
    ctx.arc(0, r * 0.36, r * 0.86, Math.PI, 0);
    ctx.closePath();
  } else {
    ctx.arc(0, r * 0.24, r * 0.84, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();

  // Collar detail
  ctx.fillStyle = palette.collar;
  ctx.beginPath();
  ctx.arc(0, r * 0.14, r * 0.36, 0, Math.PI);
  ctx.fill();

  // Back hair layer (ponytail / wavy / buns behind head)
  ctx.fillStyle = palette.hair;
  ctx.strokeStyle = '#3D2921';
  ctx.lineWidth = Math.max(1.2, r * 0.09);

  if (palette.style === 'buns') {
    ctx.beginPath();
    ctx.arc(-r * 0.56, -r * 0.54, r * 0.24, 0, Math.PI * 2);
    ctx.arc(r * 0.56, -r * 0.54, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (palette.style === 'ponytail') {
    const tailSway = Math.sin(timeNow * 0.005 + avatarId) * (r * 0.08);
    ctx.beginPath();
    ctx.ellipse(r * 0.58 + tailSway, -r * 0.08, r * 0.22, r * 0.36, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (palette.style === 'wavy') {
    ctx.beginPath();
    ctx.arc(-r * 0.44, -r * 0.02, r * 0.24, 0, Math.PI * 2);
    ctx.arc(r * 0.44, -r * 0.02, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else if (palette.style === 'curly') {
    for (let a = 0; a < 5; a++) {
      const ang = Math.PI + (a / 4) * Math.PI;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * r * 0.52, -r * 0.24 + Math.sin(ang) * r * 0.46, r * 0.23, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Head
  ctx.fillStyle = palette.skin;
  ctx.strokeStyle = '#3D2921';
  ctx.lineWidth = Math.max(1.4, r * 0.11);
  ctx.beginPath();
  ctx.arc(0, -r * 0.16, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Front hair / bangs / beret
  ctx.fillStyle = palette.hair;
  if (palette.style === 'beret') {
    ctx.beginPath();
    ctx.arc(0, -r * 0.36, r * 0.56, Math.PI, 0);
    ctx.fill();
    // Soft crimson Parisian beret
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.ellipse(-r * 0.06, -r * 0.66, r * 0.64, r * 0.24, -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, -r * 0.9);
    ctx.lineTo(-r * 0.04, -r * 0.98);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, -r * 0.32, r * 0.58, Math.PI * 0.96, 0.04 * Math.PI);
    ctx.quadraticCurveTo(r * 0.22, -r * 0.22, 0, -r * 0.36);
    ctx.quadraticCurveTo(-r * 0.22, -r * 0.22, -r * 0.57, -r * 0.24);
    ctx.fill();
  }

  // Variety accessories: VIP Golden Crown + Gold Trim, Foodie Bow, Express Shades
  if (resolvedVariety === 'vip') {
    // Golden scarf collar accent
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, r * 0.16, r * 0.48, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Golden crown
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = Math.max(1.1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, -r * 0.66);
    ctx.lineTo(-r * 0.24, -r * 1.04);
    ctx.lineTo(0, -r * 0.78);
    ctx.lineTo(r * 0.24, -r * 1.04);
    ctx.lineTo(r * 0.36, -r * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (resolvedVariety === 'foodie') {
    // Cute rose hair bow on top right
    ctx.fillStyle = '#FB7185';
    ctx.strokeStyle = '#881337';
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.ellipse(r * 0.26, -r * 0.74, r * 0.19, r * 0.12, -0.3, 0, Math.PI * 2);
    ctx.ellipse(r * 0.52, -r * 0.66, r * 0.19, r * 0.12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFE4E6';
    ctx.beginPath();
    ctx.arc(r * 0.39, -r * 0.7, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rosy cheeks
  ctx.fillStyle = mood === 'urgent' ? 'rgba(225, 29, 72, 0.52)' : 'rgba(244, 63, 94, 0.34)';
  ctx.beginPath();
  ctx.arc(-r * 0.29, -r * 0.04, r * 0.11, 0, Math.PI * 2);
  ctx.arc(r * 0.29, -r * 0.04, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  // Eyes or Express Sunglasses
  if (resolvedVariety === 'express') {
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = Math.max(1.1, r * 0.07);
    ctx.beginPath();
    ctx.roundRect(-r * 0.42, -r * 0.28, r * 0.34, r * 0.2, r * 0.06);
    ctx.roundRect(r * 0.08, -r * 0.28, r * 0.34, r * 0.2, r * 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, -r * 0.2);
    ctx.lineTo(r * 0.08, -r * 0.2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1C1917';
    ctx.strokeStyle = '#1C1917';
    if (blink || isExcited || mood === 'happy') {
      ctx.lineWidth = Math.max(1.3, r * 0.09);
      ctx.beginPath();
      ctx.arc(-r * 0.19, -r * 0.15, r * 0.1, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.19, -r * 0.15, r * 0.1, Math.PI, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-r * 0.19, -r * 0.17, r * 0.085, 0, Math.PI * 2);
      ctx.arc(r * 0.19, -r * 0.17, r * 0.085, 0, Math.PI * 2);
      ctx.fill();

      // Eye catchlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-r * 0.21, -r * 0.19, r * 0.03, 0, Math.PI * 2);
      ctx.arc(r * 0.17, -r * 0.19, r * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mouth / mood expression
  ctx.strokeStyle = '#3D2921';
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.beginPath();
  if (mood === 'urgent') {
    ctx.arc(0, r * 0.05, r * 0.11, Math.PI, 0);
  } else if (mood === 'impatient') {
    ctx.moveTo(-r * 0.11, r * 0.02);
    ctx.lineTo(r * 0.11, r * 0.0);
  } else if (mood === 'happy' || isExcited) {
    ctx.arc(0, -r * 0.04, r * 0.15, 0.1 * Math.PI, 0.9 * Math.PI);
  } else {
    ctx.arc(0, -r * 0.05, r * 0.12, 0.18 * Math.PI, 0.82 * Math.PI);
  }
  ctx.stroke();

  // Waving hand when holding matching plate!
  if (isExcited) {
    const waveY = -r * 0.02 + Math.sin(timeNow * 0.018) * (r * 0.14);
    ctx.fillStyle = palette.skin;
    ctx.strokeStyle = '#3D2921';
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    ctx.beginPath();
    ctx.arc(r * 0.78, waveY, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

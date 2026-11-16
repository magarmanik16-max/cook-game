import { KITCHEN_THEMES } from './progression';
import {
  INGREDIENT_META,
  isChoppable,
  isCookable,
  isPlatable,
  RECIPES,
} from './recipes';
import {
  BURNT_THRESHOLD,
  GRID_COLS,
  GRID_ROWS,
  PERFECT_THRESHOLD,
  URGENT_ALARM_SECONDS,
  WARNING_THRESHOLD,
} from './rules';
import type {
  ItemKind,
  KitchenSimulation,
  KitchenThemeId,
  PlateComponent,
  SimEvent,
  StationState,
} from './types';
import { getViewportProfile } from './viewport';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingPopup {
  active: boolean;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface TapRipple {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export interface KitchenLayoutMetrics {
  tileSize: number;
  originX: number;
  originY: number;
  boardWidth: number;
  boardHeight: number;
  portrait: boolean;
  cols: number;
  rows: number;
}

const MAX_PARTICLES = 160;
const MAX_FLOATING = 24;
const MAX_RIPPLES = 8;

export class KitchenRenderer {
  private particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 4,
    color: '#fff',
  }));
  private particleCursor = 0;

  private popups: FloatingPopup[] = Array.from({ length: MAX_FLOATING }, () => ({
    active: false,
    x: 0,
    y: 0,
    text: '',
    color: '#fff',
    life: 0,
    maxLife: 1,
  }));
  private popupCursor = 0;

  private ripples: TapRipple[] = Array.from({ length: MAX_RIPPLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    life: 0,
    maxLife: 0.45,
  }));
  private rippleCursor = 0;

  private shakeTrauma = 0;
  private ambientTimer = 0;
  private themeId: KitchenThemeId = 'copper';

  public setTheme(themeId: KitchenThemeId): void {
    this.themeId = themeId;
  }

  public isPortraitLayout(width: number, height: number): boolean {
    return getViewportProfile(width, height).isPortrait;
  }

  private toScreenGrid(simX: number, simY: number, portrait: boolean): { x: number; y: number } {
    return portrait ? { x: simY, y: simX } : { x: simX, y: simY };
  }

  private toSimGrid(drawX: number, drawY: number, portrait: boolean): { x: number; y: number } {
    return portrait ? { x: drawY, y: drawX } : { x: drawX, y: drawY };
  }

  public computeLayout(width: number, height: number): KitchenLayoutMetrics {
    const profile = getViewportProfile(width, height);
    const portrait = profile.isPortrait;
    const landscapeMobile = profile.isLandscapeMobile;
    const cols = portrait ? GRID_ROWS : GRID_COLS;
    const rows = portrait ? GRID_COLS : GRID_ROWS;

    const padX = portrait
      ? 8
      : landscapeMobile
        ? Math.max(96, Math.round(width * 0.14))
        : Math.max(12, Math.min(48, width * 0.035));
    const topReserve = portrait ? 136 : landscapeMobile ? 78 : 116;
    const bottomReserve = portrait ? 160 : landscapeMobile ? 36 : 66;
    const availW = Math.max(220, width - padX * 2);
    const availH = Math.max(180, height - topReserve - bottomReserve);

    const tileSize = Math.floor(Math.min(availW / cols, availH / rows));
    const boardWidth = tileSize * cols;
    const boardHeight = tileSize * rows;
    const originX = Math.floor((width - boardWidth) * 0.5);
    const originY = Math.floor(topReserve + (availH - boardHeight) * 0.5);

    return { tileSize, originX, originY, boardWidth, boardHeight, portrait, cols, rows };
  }

  public hitTestStation(
    clientX: number,
    clientY: number,
    rect: DOMRect,
    sim: KitchenSimulation,
  ): string | null {
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const layout = this.computeLayout(rect.width, rect.height);
    const drawX = (localX - layout.originX) / layout.tileSize;
    const drawY = (localY - layout.originY) / layout.tileSize;
    const { x: gridX, y: gridY } = this.toSimGrid(drawX, drawY, layout.portrait);
    const col = Math.floor(gridX);
    const row = Math.floor(gridY);

    const exact = sim.stations.find((s) => s.col === col && s.row === row);
    if (exact) {
      this.spawnRipple(exact.col + 0.5, exact.row + 0.5);
      return exact.id;
    }

    // Forgiving touch hit test within 0.85 tile radius
    let closest: StationState | null = null;
    let bestDist = 0.85;
    for (const s of sim.stations) {
      const d = Math.hypot(s.col + 0.5 - gridX, s.row + 0.5 - gridY);
      if (d < bestDist) {
        bestDist = d;
        closest = s;
      }
    }
    if (closest) {
      this.spawnRipple(closest.col + 0.5, closest.row + 0.5);
      return closest.id;
    }
    return null;
  }

  public spawnRipple(x: number, y: number): void {
    const r = this.ripples[this.rippleCursor];
    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES;
    r.active = true;
    r.x = x;
    r.y = y;
    r.maxLife = 0.42;
    r.life = r.maxLife;
  }

  public ingestEvents(events: SimEvent[]): void {
    for (const ev of events) {
      if (ev.shakeTrauma) {
        this.shakeTrauma = Math.min(1, this.shakeTrauma + ev.shakeTrauma);
      }
      if (ev.particleKind && ev.particleX !== undefined && ev.particleY !== undefined) {
        const count = ev.particleCount ?? 6;
        for (let i = 0; i < count; i++) {
          this.spawnParticle(
            ev.particleX,
            ev.particleY,
            ev.particleKind,
            ev.particleColor ?? '#FBBF24',
          );
        }
      }
      if (ev.floatingText && ev.floatingX !== undefined && ev.floatingY !== undefined) {
        this.spawnPopup(
          ev.floatingX,
          ev.floatingY,
          ev.floatingText,
          ev.floatingColor ?? '#FAF8F5',
        );
      }
    }
  }

  public hasActiveVisuals(): boolean {
    if (this.shakeTrauma > 0.005) return true;
    for (let i = 0; i < MAX_PARTICLES; i++) if (this.particles[i].active) return true;
    for (let i = 0; i < MAX_FLOATING; i++) if (this.popups[i].active) return true;
    for (let i = 0; i < MAX_RIPPLES; i++) if (this.ripples[i].active) return true;
    return false;
  }

  public updateVisuals(dt: number, sim: KitchenSimulation, isPlaying: boolean): void {
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.45 * dt;
    }

    for (let i = 0; i < MAX_FLOATING; i++) {
      const f = this.popups[i];
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.active = false;
        continue;
      }
      f.y -= dt * 0.65;
    }

    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[i];
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) r.active = false;
    }

    if (isPlaying) {
      this.ambientTimer += dt;
      if (this.ambientTimer >= 0.16) {
        this.ambientTimer = 0;
        for (const st of sim.stations) {
          if (st.type === 'skillet' && st.item) {
            const cx = st.col + 0.5 + (Math.random() - 0.5) * 0.25;
            const cy = st.row + 0.42;
            if (st.cookStage === 'burnt') {
              this.spawnParticle(cx, cy, 'smoke', '#57534E');
            } else if (st.cookStage === 'warning') {
              this.spawnParticle(cx, cy, 'smoke', '#FCA5A5');
            } else {
              this.spawnParticle(cx, cy, 'steam', st.cookStage === 'perfect' ? '#FDE68A' : '#E7E5E4');
            }
          }
        }
      }
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    kind: NonNullable<SimEvent['particleKind']>,
    color: string,
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

    const angle = Math.random() * Math.PI * 2;
    const speed =
      kind === 'serve'
        ? 1.4 + Math.random() * 2.5
        : kind === 'steam' || kind === 'smoke'
          ? 0.25 + Math.random() * 0.4
          : 0.7 + Math.random() * 1.4;

    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed * (kind === 'steam' || kind === 'smoke' ? 0.5 : 1);
    p.vy =
      kind === 'steam' || kind === 'smoke'
        ? -0.7 - Math.random() * 0.65
        : Math.sin(angle) * speed - (kind === 'serve' ? 0.8 : 0.35);
    p.maxLife = kind === 'steam' || kind === 'smoke' ? 0.65 : kind === 'serve' ? 0.75 : 0.44;
    p.life = p.maxLife;
    p.size = kind === 'serve' ? 5.2 : kind === 'smoke' ? 6.5 : 4;
    p.color = color;
  }

  private spawnPopup(x: number, y: number, text: string, color: string): void {
    const f = this.popups[this.popupCursor];
    this.popupCursor = (this.popupCursor + 1) % MAX_FLOATING;
    f.active = true;
    f.x = x;
    f.y = y;
    f.text = text;
    f.color = color;
    f.maxLife = 1.1;
    f.life = f.maxLife;
  }

  private getRecommendedStationIds(sim: KitchenSimulation): Set<string> {
    const set = new Set<string>();
    const held = sim.chef.held;
    if (!held) return set;

    if (isChoppable(held.kind)) {
      for (const st of sim.stations) {
        if (st.type === 'board' && !st.item) set.add(st.id);
      }
    } else if (isCookable(held.kind)) {
      for (const st of sim.stations) {
        if (st.type === 'skillet' && !st.item) set.add(st.id);
      }
    } else if (held.kind === 'burnt') {
      set.add('compost');
    } else if (held.kind === 'plate' && held.matchedDishId) {
      if (sim.tickets.some((t) => t.dishId === held.matchedDishId)) {
        set.add('pass_1');
        set.add('pass_2');
      }
    } else if (isPlatable(held.kind)) {
      for (const st of sim.stations) {
        if (st.type === 'plate_mat') set.add(st.id);
      }
    }
    return set;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sim: KitchenSimulation,
    timeNow: number,
  ): void {
    ctx.save();
    ctx.fillStyle = '#F7ECE1';
    ctx.fillRect(0, 0, width, height);

    const layout = this.computeLayout(width, height);
    const { tileSize: T, originX, originY, boardWidth, boardHeight, portrait, cols, rows } = layout;

    const shakeMag = this.shakeTrauma * this.shakeTrauma * 9;
    const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

    ctx.translate(originX + shakeX, originY + shakeY);

    const theme = KITCHEN_THEMES[this.themeId] ?? KITCHEN_THEMES.copper;
    this.drawFloor(ctx, T, boardWidth, boardHeight, cols, rows, theme);
    this.drawCounterFrames(ctx, T, boardWidth, boardHeight, portrait, theme);

    const recommended = this.getRecommendedStationIds(sim);

    for (const st of sim.stations) {
      const isHighlighted = sim.nearestStationId === st.id;
      const isClickTarget = sim.chef.targetStationId === st.id;
      const isRecommended = recommended.has(st.id);
      this.drawStation(ctx, st, T, sim, portrait, isHighlighted, isClickTarget, isRecommended, timeNow);
    }

    // Tap ripples
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[i];
      if (!r.active) continue;
      const progress = 1 - r.life / r.maxLife;
      const rp = this.toScreenGrid(r.x, r.y, portrait);
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.78;
      ctx.strokeStyle = '#E3574B';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(rp.x * T, rp.y * T, T * (0.25 + progress * 0.38), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.drawChef(ctx, sim, T, portrait, timeNow, theme.apronAccent);
    this.drawParticles(ctx, T, portrait);
    this.drawPopups(ctx, T, portrait);

    ctx.restore();
  }

  private drawFloor(
    ctx: CanvasRenderingContext2D,
    T: number,
    boardWidth: number,
    boardHeight: number,
    cols: number,
    rows: number,
    theme: (typeof KITCHEN_THEMES)['copper'],
  ): void {
    ctx.fillStyle = 'rgba(132, 82, 58, 0.14)';
    this.roundRect(ctx, -10, -2, boardWidth + 20, boardHeight + 20, 24);
    ctx.fill();

    ctx.fillStyle = 'rgba(132, 82, 58, 0.22)';
    this.roundRect(ctx, -5, -4, boardWidth + 10, boardHeight + 12, 20);
    ctx.fill();

    ctx.save();
    this.roundRect(ctx, 0, 0, boardWidth, boardHeight, 18);
    ctx.clip();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isEven = (r + c) % 2 === 0;
        ctx.fillStyle = isEven ? theme.floorLight : theme.floorDark;
        ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5);
        ctx.strokeStyle = 'rgba(155, 112, 88, 0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * T, r * T, T, T);
      }
    }

    ctx.restore();
  }

  private drawCounterFrames(
    ctx: CanvasRenderingContext2D,
    T: number,
    boardWidth: number,
    boardHeight: number,
    portrait: boolean,
    theme: (typeof KITCHEN_THEMES)['copper'],
  ): void {
    ctx.save();
    this.roundRect(ctx, 0, 0, boardWidth, boardHeight, 18);
    ctx.clip();

    if (!portrait) {
      // Landscape 10x7 counters: Top, Left, Right + Bottom Dining Rail
      ctx.fillStyle = theme.counterTrim;
      ctx.fillRect(0, 0, boardWidth, T);
      ctx.fillRect(0, 0, T, boardHeight);
      ctx.fillRect(boardWidth - T, 0, T, boardHeight);

      ctx.fillStyle = theme.counterWood;
      ctx.fillRect(5, 5, boardWidth - 10, T - 11);
      ctx.fillRect(5, 5, T - 11, boardHeight - T - 5);
      ctx.fillRect(boardWidth - T + 6, 5, T - 11, boardHeight - T - 5);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.fillRect(6, 5, boardWidth - 12, 4);
      ctx.fillRect(5, 5, 4, boardHeight - T - 6);

      ctx.fillStyle = 'rgba(110, 65, 42, 0.28)';
      ctx.fillRect(T - 5, T - 5, boardWidth - T * 2 + 10, 5);
      ctx.fillRect(T - 5, T - 5, 5, boardHeight - T * 2 + 10);
      ctx.fillRect(boardWidth - T, T - 5, 5, boardHeight - T * 2 + 10);

      ctx.fillStyle = theme.counterTrim;
      ctx.fillRect(0, boardHeight - T, boardWidth, T);
      ctx.fillStyle = theme.counterWood;
      ctx.fillRect(6, boardHeight - T + 6, boardWidth - 12, T - 12);
      ctx.fillStyle = theme.railAccent;
      ctx.fillRect(T, boardHeight - T + 6, boardWidth - T * 2, 5);
    } else {
      // Portrait 7x10 counters: Left, Top, Bottom + Right Dining Rail
      ctx.fillStyle = theme.counterTrim;
      ctx.fillRect(0, 0, T, boardHeight);
      ctx.fillRect(0, 0, boardWidth, T);
      ctx.fillRect(0, boardHeight - T, boardWidth, T);

      ctx.fillStyle = theme.counterWood;
      ctx.fillRect(5, 5, T - 11, boardHeight - 10);
      ctx.fillRect(5, 5, boardWidth - T - 5, T - 11);
      ctx.fillRect(5, boardHeight - T + 6, boardWidth - T - 5, T - 11);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.fillRect(5, 5, boardWidth - T - 6, 4);
      ctx.fillRect(5, 5, 4, boardHeight - 10);

      ctx.fillStyle = 'rgba(110, 65, 42, 0.28)';
      ctx.fillRect(T - 5, T - 5, 5, boardHeight - T * 2 + 10);
      ctx.fillRect(T - 5, T - 5, boardWidth - T * 2 + 10, 5);
      ctx.fillRect(T - 5, boardHeight - T, boardWidth - T * 2 + 10, 5);

      ctx.fillStyle = theme.counterTrim;
      ctx.fillRect(boardWidth - T, 0, T, boardHeight);
      ctx.fillStyle = theme.counterWood;
      ctx.fillRect(boardWidth - T + 6, 6, T - 12, boardHeight - 12);
      ctx.fillStyle = theme.railAccent;
      ctx.fillRect(boardWidth - T + 6, T, 5, boardHeight - T * 2);
    }

    ctx.restore();

    ctx.strokeStyle = theme.counterTrim;
    ctx.lineWidth = 3;
    this.roundRect(ctx, 1, 1, boardWidth - 2, boardHeight - 2, 18);
    ctx.stroke();

    const drawCornerPot = (cx: number, cy: number) => {
      ctx.fillStyle = 'rgba(110, 65, 42, 0.2)';
      ctx.beginPath();
      ctx.arc(cx, cy + 3, T * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E07A5F';
      ctx.beginPath();
      ctx.arc(cx, cy, T * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(cx - T * 0.08, cy - T * 0.05, T * 0.14, 0, Math.PI * 2);
      ctx.arc(cx + T * 0.09, cy - T * 0.04, T * 0.13, 0, Math.PI * 2);
      ctx.arc(cx, cy + T * 0.07, T * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFE4E6';
      ctx.beginPath();
      ctx.arc(cx - T * 0.05, cy - T * 0.04, T * 0.055, 0, Math.PI * 2);
      ctx.arc(cx + T * 0.07, cy + T * 0.03, T * 0.05, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCornerPot(T * 0.5, T * 0.5);
    if (!portrait) {
      drawCornerPot(boardWidth - T * 0.5, T * 0.5);
    } else {
      drawCornerPot(T * 0.5, boardHeight - T * 0.5);
    }

    // Central Clay Plating Island
    const ix = portrait ? 3 * T : 4 * T;
    const iy = portrait ? 4 * T : 3 * T;
    const iw = portrait ? T : T * 2;
    const ih = portrait ? T * 2 : T;
    ctx.fillStyle = 'rgba(120, 74, 52, 0.22)';
    this.roundRect(ctx, ix + 2, iy + 8, iw, ih, 14);
    ctx.fill();

    ctx.fillStyle = theme.counterTrim;
    this.roundRect(ctx, ix, iy, iw, ih, 14);
    ctx.fill();

    ctx.fillStyle = theme.islandTop;
    this.roundRect(ctx, ix + 4, iy + 4, iw - 8, ih - 10, 11);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    this.roundRect(ctx, ix + 8, iy + 5, iw - 16, 4, 3);
    ctx.fill();
  }

  private drawStation(
    ctx: CanvasRenderingContext2D,
    st: StationState,
    T: number,
    sim: KitchenSimulation,
    portrait: boolean,
    isHighlighted: boolean,
    isClickTarget: boolean,
    isRecommended: boolean,
    timeNow: number,
  ): void {
    const drawCol = portrait ? st.row : st.col;
    const drawRow = portrait ? st.col : st.row;
    const x = drawCol * T;
    const y = drawRow * T;
    const cx = x + T * 0.5;
    const cy = y + T * 0.5;

    const pulseScale = st.pulseTimer > 0 ? 1 + Math.sin((st.pulseTimer / 0.18) * Math.PI) * 0.09 : 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-cx, -cy);

    if (isHighlighted || isClickTarget) {
      ctx.strokeStyle = isHighlighted ? '#FBBF24' : '#38BDF8';
      ctx.lineWidth = 3;
      this.roundRect(ctx, x + 3, y + 3, T - 6, T - 6, 9);
      ctx.stroke();
    } else if (isRecommended) {
      const glow = 0.4 + Math.sin(timeNow * 0.008) * 0.25;
      ctx.strokeStyle = `rgba(251, 191, 36, ${glow})`;
      ctx.lineWidth = 2;
      this.roundRect(ctx, x + 4, y + 4, T - 8, T - 8, 8);
      ctx.stroke();
    }

    const labelFont = `700 ${Math.max(5.5, Math.min(13, Math.round(T * 0.125)))}px "Plus Jakarta Sans", sans-serif`;

    if (st.type === 'pantry' && st.pantryBase) {
      const meta = INGREDIENT_META[st.pantryBase];
      ctx.fillStyle = '#9C6240';
      this.roundRect(ctx, x + T * 0.1, y + T * 0.1, T * 0.8, T * 0.8, 11);
      ctx.fill();
      ctx.fillStyle = '#BF8056';
      this.roundRect(ctx, x + T * 0.15, y + T * 0.14, T * 0.7, T * 0.68, 9);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      this.roundRect(ctx, x + T * 0.2, y + T * 0.16, T * 0.6, T * 0.08, 4);
      ctx.fill();
      this.drawItemGraphic(ctx, meta.rawKind, cx, cy - T * 0.1, T * 0.23, false, timeNow);

      const shortTag =
        st.pantryBase === 'strawberry'
          ? 'BERRY'
          : st.pantryBase === 'avocado'
            ? 'AVO'
            : st.pantryBase === 'lettuce'
              ? 'GREENS'
              : st.pantryBase.toUpperCase();
      ctx.fillStyle = '#FFFBF7';
      ctx.font = labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(shortTag, cx, y + T * 0.87);
    } else if (st.type === 'board') {
      ctx.fillStyle = '#FFF3E4';
      this.roundRect(ctx, x + T * 0.12, y + T * 0.12, T * 0.76, T * 0.72, 11);
      ctx.fill();
      ctx.strokeStyle = '#C99870';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (!st.item) {
        ctx.save();
        ctx.translate(cx + T * 0.1, cy - T * 0.02);
        ctx.rotate(-0.65);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-T * 0.18, -T * 0.04, T * 0.26, T * 0.08);
        ctx.fillStyle = '#4A332A';
        ctx.fillRect(T * 0.08, -T * 0.03, T * 0.13, T * 0.06);
        ctx.restore();

        ctx.fillStyle = '#6E5245';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('CHOP', cx, y + T * 0.81);
      } else {
        this.drawItemGraphic(ctx, st.item, cx, cy, T * 0.29, false, timeNow);

        if (st.isChoppingActive && isChoppable(st.item)) {
          const rock = Math.sin(timeNow * 0.026) * 0.45;
          ctx.save();
          ctx.translate(cx + T * 0.18, cy - T * 0.08);
          ctx.rotate(-0.4 + rock);
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(-T * 0.24, -T * 0.045, T * 0.26, T * 0.09);
          ctx.fillStyle = '#3D2921';
          ctx.fillRect(T * 0.02, -T * 0.03, T * 0.12, T * 0.06);
          ctx.restore();
        }

        if (st.chopProgress > 0 && st.chopProgress < 1) {
          this.drawProgressBar(ctx, cx, y + T * 0.08, T * 0.7, st.chopProgress, '#22C55E');
        }
      }
    } else if (st.type === 'skillet') {
      ctx.fillStyle = '#4A3730';
      this.roundRect(ctx, x + T * 0.1, y + T * 0.1, T * 0.8, T * 0.8, 13);
      ctx.fill();

      ctx.fillStyle = '#A89489';
      ctx.beginPath();
      if (portrait) {
        ctx.arc(x + T * 0.24, y + T * 0.82, T * 0.045, 0, Math.PI * 2);
        ctx.arc(x + T * 0.76, y + T * 0.82, T * 0.045, 0, Math.PI * 2);
      } else {
        ctx.arc(x + T * 0.82, y + T * 0.24, T * 0.045, 0, Math.PI * 2);
        ctx.arc(x + T * 0.82, y + T * 0.76, T * 0.045, 0, Math.PI * 2);
      }
      ctx.fill();

      if (st.item) {
        const glow = 0.55 + Math.sin(timeNow * 0.012) * 0.2;
        ctx.strokeStyle =
          st.cookStage === 'warning' || st.cookStage === 'burnt'
            ? `rgba(225, 29, 72, ${glow})`
            : `rgba(249, 115, 22, ${glow})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.34, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#A96B47';
      if (portrait) {
        ctx.fillRect(cx - T * 0.05, cy - T * 0.44, T * 0.1, T * 0.22);
      } else {
        ctx.fillRect(cx - T * 0.44, cy - T * 0.05, T * 0.22, T * 0.1);
      }
      ctx.fillStyle = '#E37752';
      ctx.beginPath();
      ctx.arc(cx, cy, T * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#36231B';
      ctx.beginPath();
      ctx.arc(cx, cy, T * 0.24, 0, Math.PI * 2);
      ctx.fill();

      if (st.item) {
        this.drawItemGraphic(ctx, st.item, cx, cy, T * 0.24, st.cookStage === 'perfect', timeNow);
        this.drawSkilletMeter(ctx, st, cx, y + T * 0.08, T * 0.76, timeNow);

        if (st.cookStage !== 'burnt') {
          const b1 = (timeNow * 0.004) % 1;
          const b2 = (timeNow * 0.004 + 0.5) % 1;
          ctx.fillStyle = 'rgba(254, 243, 199, 0.75)';
          ctx.beginPath();
          ctx.arc(cx - T * 0.14, cy + T * 0.1 - b1 * T * 0.14, 2.2, 0, Math.PI * 2);
          ctx.arc(cx + T * 0.13, cy + T * 0.08 - b2 * T * 0.14, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        if (st.cookStage === 'warning') {
          const bounce = Math.abs(Math.sin(timeNow * 0.015)) * (T * 0.08);
          ctx.fillStyle = '#E11D48';
          ctx.beginPath();
          ctx.arc(cx, y - T * 0.05 - bounce, T * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `800 ${Math.max(10, Math.round(T * 0.2))}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', cx, y - T * 0.05 - bounce);
        }
      } else {
        ctx.fillStyle = '#E7D6C8';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SEAR', cx, cy);
      }
    } else if (st.type === 'plate_mat') {
      ctx.fillStyle = '#FFFDF9';
      this.roundRect(ctx, x + T * 0.12, y + T * 0.12, T * 0.76, T * 0.72, 11);
      ctx.fill();
      ctx.strokeStyle = st.matchedDishId ? '#16A34A' : '#E2CFC0';
      ctx.lineWidth = st.matchedDishId ? 3 : 1.8;
      ctx.stroke();

      this.drawPlateWithComponents(ctx, cx, cy, T * 0.28, st.plateComponents, st.matchedDishId, timeNow);
      if (st.plateComponents.length === 0) {
        ctx.fillStyle = '#9C7F6E';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PLATE', cx, cy);
      }
    } else if (st.type === 'pass') {
      const holdingDeliverable =
        sim.chef.held?.kind === 'plate' &&
        sim.chef.held.matchedDishId !== null &&
        sim.tickets.some((t) => t.dishId === sim.chef.held?.matchedDishId);

      ctx.fillStyle = holdingDeliverable ? '#FEF3C7' : '#FFFBF7';
      this.roundRect(ctx, x + T * 0.08, y + T * 0.1, T * 0.84, T * 0.74, 12);
      ctx.fill();

      if (holdingDeliverable) {
        const pulse = 0.65 + Math.sin(timeNow * 0.01) * 0.35;
        ctx.strokeStyle = `rgba(245, 158, 11, ${pulse})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }

      if (st.id === 'pass_1') {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(cx, cy - T * 0.03, T * 0.17, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(cx - T * 0.2, cy - T * 0.03, T * 0.4, T * 0.055);
        ctx.fillStyle = '#B45309';
        ctx.beginPath();
        ctx.arc(cx, cy - T * 0.21, T * 0.04, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#9C7F6E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy - T * 0.06, T * 0.18, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#3D2921';
      ctx.font = labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('SERVE', cx, y + T * 0.8);
    } else if (st.type === 'compost') {
      ctx.fillStyle = '#5B6982';
      this.roundRect(ctx, x + T * 0.14, y + T * 0.11, T * 0.72, T * 0.73, 12);
      ctx.fill();
      ctx.fillStyle = '#3B4659';
      ctx.beginPath();
      ctx.arc(cx, cy - T * 0.08, T * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('TRASH', cx, y + T * 0.8);
    }

    // Subtle floating arrow above recommended next station
    if (isRecommended) {
      const bob = Math.sin(timeNow * 0.009) * (T * 0.06);
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = '#181412';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, y + T * 0.16 + bob);
      ctx.lineTo(cx - T * 0.11, y - T * 0.02 + bob);
      ctx.lineTo(cx + T * 0.11, y - T * 0.02 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawChef(
    ctx: CanvasRenderingContext2D,
    sim: KitchenSimulation,
    T: number,
    portrait: boolean,
    timeNow: number,
    apronAccent: string,
  ): void {
    const chef = sim.chef;
    const pos = this.toScreenGrid(chef.x, chef.y, portrait);
    const px = pos.x * T;
    const py = pos.y * T;
    const r = T * 0.32;
    const faceX = portrait ? chef.facingY : chef.facingX;
    const faceY = portrait ? chef.facingX : chef.facingY;

    const speed = Math.hypot(chef.vx, chef.vy);
    const walkBob = speed > 0.2 ? Math.sin(chef.walkDistance * 7.5) * (T * 0.04) : 0;
    const happyBounce = chef.happyTimer > 0 ? Math.abs(Math.sin(chef.happyTimer * 18)) * (T * 0.12) : 0;

    if (chef.targetStationId) {
      const target = sim.stations.find((s) => s.id === chef.targetStationId);
      if (target) {
        const tp = this.toScreenGrid(target.col + 0.5, target.row + 0.5, portrait);
        const tx = tp.x * T;
        const ty = tp.y * T;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(px, py + walkBob - happyBounce);

    // Contact shadow
    ctx.fillStyle = 'rgba(132, 82, 58, 0.26)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.92 - walkBob + happyBounce, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(chef.squashX, chef.squashY);

    // Chef coat torso
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = '#3D2921';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Apron & neckerchief in theme accent
    ctx.fillStyle = apronAccent;
    ctx.beginPath();
    ctx.arc(faceX * r * 0.25, faceY * r * 0.25, r * 0.44, 0, Math.PI * 2);
    ctx.fill();

    // Head
    const headX = faceX * r * 0.14;
    const headY = faceY * r * 0.14 - r * 0.1;
    ctx.fillStyle = '#FCD5B5';
    ctx.strokeStyle = '#3D2921';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(headX, headY, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rosy cheeks + eyes (blink periodically)
    const perpX = -faceY;
    const perpY = faceX;
    const eyeBaseX = headX + faceX * r * 0.24;
    const eyeBaseY = headY + faceY * r * 0.24;
    const isBlink = timeNow % 3400 < 120;

    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.arc(eyeBaseX + perpX * r * 0.26, eyeBaseY + perpY * r * 0.26 + 2, r * 0.1, 0, Math.PI * 2);
    ctx.arc(eyeBaseX - perpX * r * 0.26, eyeBaseY - perpY * r * 0.26 + 2, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1C1917';
    if (isBlink || chef.happyTimer > 0) {
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#1C1917';
      ctx.beginPath();
      ctx.moveTo(eyeBaseX + perpX * r * 0.1 - 2, eyeBaseY + perpY * r * 0.1);
      ctx.lineTo(eyeBaseX + perpX * r * 0.22 + 2, eyeBaseY + perpY * r * 0.22);
      ctx.moveTo(eyeBaseX - perpX * r * 0.1 - 2, eyeBaseY - perpY * r * 0.1);
      ctx.lineTo(eyeBaseX - perpX * r * 0.22 + 2, eyeBaseY - perpY * r * 0.22);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(eyeBaseX + perpX * r * 0.16, eyeBaseY + perpY * r * 0.16, r * 0.08, 0, Math.PI * 2);
      ctx.arc(eyeBaseX - perpX * r * 0.16, eyeBaseY - perpY * r * 0.16, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tall Chef Toque Hat with subtle ribbon
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#3D2921';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(headX - faceX * 2, headY - r * 0.34, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sweat drop cue if any order is urgent
    const hasUrgent = sim.tickets.some((t) => t.patience <= URGENT_ALARM_SECONDS);
    if (hasUrgent) {
      const dropY = headY - r * 0.6 + Math.sin(timeNow * 0.015) * 2;
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(headX + r * 0.56, dropY, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }

    if (chef.held) {
      const holdX = faceX * r * 1.15;
      const holdY = faceY * r * 1.15 - r * 0.15;
      if (chef.held.kind === 'plate') {
        this.drawPlateWithComponents(
          ctx,
          holdX,
          holdY,
          T * 0.24,
          chef.held.plateComponents,
          chef.held.matchedDishId,
          timeNow,
        );
      } else {
        this.drawItemGraphic(
          ctx,
          chef.held.kind,
          holdX,
          holdY,
          T * 0.24,
          chef.held.isPerfect,
          timeNow,
        );
      }
    }

    ctx.restore();
  }

  private drawPlateWithComponents(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    components: PlateComponent[],
    matchedDishId: StationState['matchedDishId'],
    timeNow: number,
  ): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = matchedDishId ? '#16A34A' : '#94A3B8';
    ctx.lineWidth = matchedDishId ? 2.5 : 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    components.forEach((comp, idx) => {
      const angle = (idx / Math.max(1, components.length)) * Math.PI * 2 - Math.PI * 0.5;
      const offset = components.length === 1 ? 0 : radius * 0.24;
      const ix = cx + Math.cos(angle) * offset;
      const iy = cy + Math.sin(angle) * offset - idx * 1.5;
      this.drawItemGraphic(ctx, comp.kind, ix, iy, radius * 0.58, comp.isPerfect, timeNow);
    });

    if (matchedDishId) {
      const recipe = RECIPES[matchedDishId];
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(cx + radius * 0.72, cy - radius * 0.72, radius * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 ${Math.max(9, Math.round(radius * 0.48))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', cx + radius * 0.72, cy - radius * 0.7);

      ctx.strokeStyle = recipe.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawItemGraphic(
    ctx: CanvasRenderingContext2D,
    kind: ItemKind,
    cx: number,
    cy: number,
    r: number,
    isPerfect: boolean,
    timeNow: number,
  ): void {
    ctx.save();
    ctx.translate(cx, cy);

    if (isPerfect) {
      const glow = 0.55 + Math.sin(timeNow * 0.012) * 0.3;
      ctx.strokeStyle = `rgba(251, 191, 36, ${glow})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
    }

    switch (kind) {
      case 'bun':
        ctx.fillStyle = '#D99B52';
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(-r * 0.3, -r * 0.25, 3, 2);
        ctx.fillRect(r * 0.15, -r * 0.32, 3, 2);
        ctx.fillRect(0, r * 0.12, 3, 2);
        break;
      case 'tomato_raw':
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#7F1D1D';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#16A34A';
        ctx.fillRect(-r * 0.16, -r * 0.72, r * 0.32, r * 0.25);
        break;
      case 'tomato_chopped':
        ctx.fillStyle = '#EF4444';
        for (const [ox, oy] of [[-0.3, -0.2], [0.25, -0.22], [-0.05, 0.28]]) {
          ctx.beginPath();
          ctx.arc(ox * r, oy * r, r * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FCA5A5';
        ctx.beginPath();
        ctx.arc(-0.3 * r, -0.2 * r, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'lettuce_raw':
        ctx.fillStyle = '#16A34A';
        ctx.strokeStyle = '#14532D';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#86EFAC';
        ctx.beginPath();
        ctx.arc(-r * 0.18, -r * 0.18, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'lettuce_chopped':
        ctx.fillStyle = '#22C55E';
        for (const [ox, oy, rot] of [[-0.28, -0.15, 0.4], [0.24, -0.2, -0.5], [0.02, 0.24, 0.1]]) {
          ctx.save();
          ctx.translate(ox * r, oy * r);
          ctx.rotate(rot);
          ctx.fillRect(-r * 0.36, -r * 0.16, r * 0.72, r * 0.32);
          ctx.restore();
        }
        break;
      case 'potato_raw':
        ctx.fillStyle = '#CA8A04';
        ctx.strokeStyle = '#713F12';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.88, r * 0.62, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'potato_chopped':
        ctx.fillStyle = '#FEF08A';
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(i * r * 0.35 - r * 0.12, -r * 0.55, r * 0.24, r * 1.1);
          ctx.strokeRect(i * r * 0.35 - r * 0.12, -r * 0.55, r * 0.24, r * 1.1);
        }
        break;
      case 'fries_cooked':
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(i * r * 0.36 - r * 0.13, -r * 0.58, r * 0.26, r * 1.16);
          ctx.strokeRect(i * r * 0.36 - r * 0.13, -r * 0.58, r * 0.26, r * 1.16);
        }
        break;
      case 'egg_raw':
        ctx.fillStyle = '#FEF3C7';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.62, r * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'egg_cooked':
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'patty_raw':
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#7F1D1D';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'patty_cooked':
        ctx.fillStyle = '#78350F';
        ctx.strokeStyle = '#451A03';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#290F02';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.2);
        ctx.lineTo(r * 0.45, -r * 0.2);
        ctx.moveTo(-r * 0.45, r * 0.2);
        ctx.lineTo(r * 0.45, r * 0.2);
        ctx.stroke();
        break;
      case 'avocado_raw':
        ctx.fillStyle = '#4D7C0F';
        ctx.strokeStyle = '#1A2E05';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.65, r * 0.86, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#BEF264';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.08, r * 0.38, r * 0.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(0, r * 0.16, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'avocado_chopped':
        ctx.fillStyle = '#84CC16';
        ctx.strokeStyle = '#3F6212';
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(i * r * 0.3, Math.abs(i) * r * 0.1, r * 0.36, Math.PI * 0.1, Math.PI * 0.9);
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'strawberry_raw':
        ctx.fillStyle = '#E11D48';
        ctx.strokeStyle = '#881337';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.85);
        ctx.quadraticCurveTo(-r * 0.85, r * 0.1, -r * 0.6, -r * 0.55);
        ctx.quadraticCurveTo(0, -r * 0.8, r * 0.6, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.85, r * 0.1, 0, r * 0.85);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#16A34A';
        ctx.fillRect(-r * 0.35, -r * 0.72, r * 0.7, r * 0.22);
        break;
      case 'strawberry_chopped':
        ctx.fillStyle = '#F43F5E';
        for (const [ox, oy] of [[-0.28, -0.18], [0.26, -0.2], [0, 0.26]]) {
          ctx.beginPath();
          ctx.arc(ox * r, oy * r, r * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FDA4AF';
        ctx.beginPath();
        ctx.arc(-0.28 * r, -0.18 * r, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'burnt':
        ctx.fillStyle = '#1C1917';
        ctx.strokeStyle = '#44403C';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      default:
        break;
    }

    ctx.restore();
  }

  private drawProgressBar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    w: number,
    ratio: number,
    color: string,
  ): void {
    const h = 7;
    ctx.fillStyle = '#1C1917';
    this.roundRect(ctx, cx - w * 0.5, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = color;
    this.roundRect(ctx, cx - w * 0.5 + 1.5, y + 1.5, Math.max(0, (w - 3) * Math.min(1, ratio)), h - 3, 3);
    ctx.fill();
  }

  private drawSkilletMeter(
    ctx: CanvasRenderingContext2D,
    st: StationState,
    cx: number,
    y: number,
    w: number,
    timeNow: number,
  ): void {
    const h = 8;
    const left = cx - w * 0.5;
    ctx.fillStyle = '#1C1917';
    this.roundRect(ctx, left, y, w, h, 4);
    ctx.fill();

    const maxScale = BURNT_THRESHOLD;
    const perfStartX = left + (PERFECT_THRESHOLD / maxScale) * w;
    const perfEndX = left + (WARNING_THRESHOLD / maxScale) * w;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.38)';
    ctx.fillRect(perfStartX, y + 1, perfEndX - perfStartX, h - 2);

    const ratio = Math.min(1, st.cookProgress / maxScale);
    let fillColor = '#F59E0B';
    if (st.cookStage === 'perfect') fillColor = '#22C55E';
    else if (st.cookStage === 'warning') {
      fillColor = Math.sin(timeNow * 0.025) > 0 ? '#EF4444' : '#F97316';
    } else if (st.cookStage === 'burnt') {
      fillColor = '#57534E';
    }

    ctx.fillStyle = fillColor;
    this.roundRect(ctx, left + 1.5, y + 1.5, Math.max(0, (w - 3) * ratio), h - 3, 3);
    ctx.fill();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, T: number, portrait: boolean): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      const sp = this.toScreenGrid(p.x, p.y, portrait);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sp.x * T, sp.y * T, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPopups(ctx: CanvasRenderingContext2D, T: number, portrait: boolean): void {
    for (let i = 0; i < MAX_FLOATING; i++) {
      const f = this.popups[i];
      if (!f.active) continue;
      const alpha = Math.min(1, (f.life / f.maxLife) * 1.4);
      const sp = this.toScreenGrid(f.x, f.y, portrait);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.max(13, Math.round(T * 0.22))}px "Fredoka", "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#3D2921';
      ctx.strokeText(f.text, sp.x * T, sp.y * T);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sp.x * T, sp.y * T);
      ctx.restore();
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

import { drawCustomerSprite } from './customerSprites';
import { clampToWalkablePoint, NAV_CLEARANCE } from './pathfinding';
import { KITCHEN_THEMES } from './progression';
import {
  INGREDIENT_META,
  isChoppable,
  isCookable,
  isPlatable,
  ITEM_LABELS,
  RECIPES,
} from './recipes';
import {
  BURNT_THRESHOLD,
  getSeatWorldPos,
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
  OrderTicket,
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
        ? Math.max(76, Math.round(width * 0.1))
        : Math.max(12, Math.min(48, width * 0.035));
    const topReserve = portrait ? 64 : landscapeMobile ? 50 : 76;
    const bottomReserve = portrait ? 84 : landscapeMobile ? 38 : 64;
    const availW = Math.max(220, width - padX * 2);
    const availH = Math.max(180, height - topReserve - bottomReserve);

    const tileSize = Math.floor(Math.min(availW / cols, availH / rows));
    const boardWidth = tileSize * cols;
    const boardHeight = tileSize * rows;
    const originX = Math.floor((width - boardWidth) * 0.5);
    const originY = Math.floor(topReserve + (availH - boardHeight) * 0.5);

    return { tileSize, originX, originY, boardWidth, boardHeight, portrait, cols, rows };
  }

  private getSeatScreenCoord(
    seatIndex: number,
    T: number,
    portrait: boolean,
  ): { x: number; y: number } {
    const world = getSeatWorldPos(seatIndex);
    const sc = this.toScreenGrid(world.x, world.y, portrait);
    return { x: sc.x * T, y: sc.y * T };
  }

  private getCustomerOrderCardRect(
    seat: { x: number; y: number },
    T: number,
    boardWidth: number,
    boardHeight: number,
    portrait: boolean,
  ): { bx: number; by: number; bw: number; bh: number } {
    if (!portrait) {
      const bw = Math.min(T * 1.62, Math.max(102, T * 1.56));
      const bh = Math.max(54, Math.round(T * 0.96));
      const bx = Math.max(T + 2, Math.min(boardWidth - T - bw - 2, seat.x - bw * 0.5));
      const by = seat.y - T * 0.43 - bh;
      return { bx, by, bw, bh };
    }
    const bw = Math.max(106, Math.round(T * 2.12));
    const bh = Math.max(52, Math.round(T * 1.02));
    const bx = Math.max(T * 1.08, seat.x - T * 0.42 - bw);
    const by = Math.max(T * 1.02, Math.min(boardHeight - T - bh - 4, seat.y - bh * 0.52));
    return { bx, by, bw, bh };
  }

  public hitTestCanvas(
    clientX: number,
    clientY: number,
    rect: DOMRect,
    sim: KitchenSimulation,
  ): { stationId: string | null; ticketId: number | null; walkPoint: { x: number; y: number } | null } {
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const layout = this.computeLayout(rect.width, rect.height);
    const boardX = localX - layout.originX;
    const boardY = localY - layout.originY;
    const drawX = boardX / layout.tileSize;
    const drawY = boardY / layout.tileSize;
    const { x: gridX, y: gridY } = this.toSimGrid(drawX, drawY, layout.portrait);
    const col = Math.floor(gridX);
    const row = Math.floor(gridY);

    // 1. Direct customer sprite or above-head order card tap-to-serve
    let bestTicket: OrderTicket | null = null;
    let bestTicketDist = layout.tileSize * 0.68;
    for (const ticket of sim.tickets) {
      const seat = this.getSeatScreenCoord(ticket.seatIndex, layout.tileSize, layout.portrait);
      const card = this.getCustomerOrderCardRect(
        seat,
        layout.tileSize,
        layout.boardWidth,
        layout.boardHeight,
        layout.portrait,
      );
      if (
        boardX >= card.bx - 4 &&
        boardX <= card.bx + card.bw + 4 &&
        boardY >= card.by - 4 &&
        boardY <= card.by + card.bh + 4
      ) {
        const worldSeat = getSeatWorldPos(ticket.seatIndex);
        this.spawnRipple(worldSeat.x, worldSeat.y);
        return { stationId: null, ticketId: ticket.id, walkPoint: null };
      }
      const d = Math.hypot(boardX - seat.x, boardY - seat.y);
      if (d < bestTicketDist) {
        bestTicketDist = d;
        bestTicket = ticket;
      }
    }
    if (bestTicket) {
      const worldSeat = getSeatWorldPos(bestTicket.seatIndex);
      this.spawnRipple(worldSeat.x, worldSeat.y);
      return { stationId: null, ticketId: bestTicket.id, walkPoint: null };
    }

    // 2. Exact station tile hit
    const exact = sim.stations.find((s) => s.col === col && s.row === row);
    if (exact) {
      this.spawnRipple(exact.col + 0.5, exact.row + 0.5);
      return { stationId: exact.id, ticketId: null, walkPoint: null };
    }

    // 3. Forgiving tap hit test within 0.85 tile radius of any counter station
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
      return { stationId: closest.id, ticketId: null, walkPoint: null };
    }

    // 4. Walkable interior kitchen floor tap (clamped cleanly outside center island & walls)
    if (gridX >= 0.8 && gridX <= GRID_COLS - 0.8 && gridY >= 0.8 && gridY <= GRID_ROWS - 0.8) {
      const safe = clampToWalkablePoint(gridX, gridY, NAV_CLEARANCE);
      this.spawnRipple(safe.x, safe.y);
      return { stationId: null, ticketId: null, walkPoint: safe };
    }

    return { stationId: null, ticketId: null, walkPoint: null };
  }

  public hitTestStation(
    clientX: number,
    clientY: number,
    rect: DOMRect,
    sim: KitchenSimulation,
  ): string | null {
    return this.hitTestCanvas(clientX, clientY, rect, sim).stationId;
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
      // Highlighting happens directly on matching waiting customers
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
      const isClickTarget =
        sim.chef.targetStationId === st.id || sim.chef.queuedStationId === st.id;
      const isRecommended = recommended.has(st.id);
      this.drawStation(ctx, st, T, sim, portrait, isHighlighted, isClickTarget, isRecommended, timeNow);
    }

    this.drawCustomersAndLine(ctx, sim, T, boardWidth, boardHeight, portrait, timeNow);
    this.drawFloatingStationLabels(ctx, sim, T, portrait, timeNow);

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

    if (sim.bot) {
      const chefY = this.toScreenGrid(sim.chef.x, sim.chef.y, portrait).y;
      const botY = this.toScreenGrid(sim.bot.x, sim.bot.y, portrait).y;
      if (botY < chefY) {
        this.drawBotChef(ctx, sim, T, portrait, timeNow);
        this.drawChef(ctx, sim, T, portrait, timeNow, theme.apronAccent);
      } else {
        this.drawChef(ctx, sim, T, portrait, timeNow, theme.apronAccent);
        this.drawBotChef(ctx, sim, T, portrait, timeNow);
      }
    } else {
      this.drawChef(ctx, sim, T, portrait, timeNow, theme.apronAccent);
    }
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

    // Cozy Espresso Machine & Pastry Cloche decor along the top prep counter (col 5..6, row 0)
    const decorPos = this.toScreenGrid(5.5, 0.5, portrait);
    const dx = decorPos.x * T;
    const dy = decorPos.y * T;
    ctx.fillStyle = '#C94136';
    this.roundRect(ctx, dx - T * 0.24, dy - T * 0.2, T * 0.48, T * 0.36, 6);
    ctx.fill();
    ctx.fillStyle = '#F5EBE0';
    this.roundRect(ctx, dx - T * 0.16, dy - T * 0.08, T * 0.32, T * 0.18, 4);
    ctx.fill();
    ctx.fillStyle = '#3D2921';
    ctx.beginPath();
    ctx.arc(dx, dy + T * 0.04, T * 0.07, 0, Math.PI * 2);
    ctx.fill();

    const decorPos2 = this.toScreenGrid(6.5, 0.5, portrait);
    const dx2 = decorPos2.x * T;
    const dy2 = decorPos2.y * T;
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = '#C99870';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(dx2, dy2 + T * 0.02, T * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F3BD7A';
    ctx.beginPath();
    ctx.ellipse(dx2, dy2 + T * 0.02, T * 0.12, T * 0.08, -0.3, 0, Math.PI * 2);
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

    const labelFont = `800 ${Math.max(6.5, Math.min(12.5, Math.round(T * 0.145)))}px "Plus Jakarta Sans", sans-serif`;
    const miniSignFont = `700 ${Math.max(6, Math.min(10.5, Math.round(T * 0.12)))}px "Plus Jakarta Sans", sans-serif`;

    if (st.type === 'pantry' && st.pantryBase) {
      const meta = INGREDIENT_META[st.pantryBase];
      ctx.fillStyle = '#9C6240';
      this.roundRect(ctx, x + T * 0.08, y + T * 0.09, T * 0.84, T * 0.82, 12);
      ctx.fill();
      ctx.fillStyle = '#C98A5F';
      this.roundRect(ctx, x + T * 0.13, y + T * 0.13, T * 0.74, T * 0.7, 9);
      ctx.fill();
      // Wood slat rim detail
      ctx.fillStyle = '#875132';
      this.roundRect(ctx, x + T * 0.15, y + T * 0.76, T * 0.7, T * 0.09, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      this.roundRect(ctx, x + T * 0.18, y + T * 0.15, T * 0.64, T * 0.07, 4);
      ctx.fill();

      this.drawItemGraphic(ctx, meta.rawKind, cx, cy - T * 0.02, T * 0.29, false, timeNow);
    } else if (st.type === 'board') {
      ctx.fillStyle = '#FFF3E4';
      this.roundRect(ctx, x + T * 0.1, y + T * 0.1, T * 0.8, T * 0.78, 11);
      ctx.fill();
      ctx.strokeStyle = '#C99870';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (!st.item) {
        ctx.save();
        ctx.translate(cx + T * 0.08, cy - T * 0.1);
        ctx.rotate(-0.6);
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(-T * 0.17, -T * 0.04, T * 0.25, T * 0.08);
        ctx.fillStyle = '#4A332A';
        ctx.fillRect(T * 0.08, -T * 0.03, T * 0.12, T * 0.06);
        ctx.restore();

        ctx.fillStyle = '#6E5245';
        this.roundRect(ctx, x + T * 0.18, y + T * 0.64, T * 0.64, T * 0.21, 6);
        ctx.fill();
        ctx.fillStyle = '#FFFBF7';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CHOP', cx, y + T * 0.745);
      } else {
        this.drawItemGraphic(ctx, st.item, cx, cy - T * 0.06, T * 0.28, false, timeNow);

        if (st.isChoppingActive && isChoppable(st.item)) {
          const rock = Math.sin(timeNow * 0.026) * 0.45;
          ctx.save();
          ctx.translate(cx + T * 0.18, cy - T * 0.1);
          ctx.rotate(-0.4 + rock);
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(-T * 0.24, -T * 0.045, T * 0.26, T * 0.09);
          ctx.fillStyle = '#3D2921';
          ctx.fillRect(T * 0.02, -T * 0.03, T * 0.12, T * 0.06);
          ctx.restore();
        }

        if (st.chopProgress > 0 && st.chopProgress < 1) {
          this.drawProgressBar(ctx, cx, y + T * 0.08, T * 0.7, st.chopProgress, '#22C55E');
        } else if (!isChoppable(st.item)) {
          ctx.fillStyle = '#15803D';
          this.roundRect(ctx, x + T * 0.16, y + T * 0.67, T * 0.68, T * 0.2, 6);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = miniSignFont;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('READY', cx, y + T * 0.77);
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
        this.drawItemGraphic(ctx, st.item, cx, cy - T * 0.04, T * 0.24, st.cookStage === 'perfect', timeNow);
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

        if (st.cookStage === 'perfect' || st.cookStage === 'warning' || st.cookStage === 'burnt') {
          const badgeBg =
            st.cookStage === 'perfect'
              ? '#15803D'
              : st.cookStage === 'warning'
                ? '#E11D48'
                : '#1C1917';
          const badgeText =
            st.cookStage === 'perfect' ? 'READY' : st.cookStage === 'warning' ? 'PULL!' : 'BURNT';
          ctx.fillStyle = badgeBg;
          this.roundRect(ctx, x + T * 0.17, y + T * 0.68, T * 0.66, T * 0.2, 6);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = miniSignFont;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, cx, y + T * 0.78);
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
      this.roundRect(ctx, x + T * 0.1, y + T * 0.1, T * 0.8, T * 0.78, 11);
      ctx.fill();
      ctx.strokeStyle = st.matchedDishId ? '#16A34A' : '#E2CFC0';
      ctx.lineWidth = st.matchedDishId ? 3 : 1.8;
      ctx.stroke();

      this.drawPlateWithComponents(ctx, cx, cy - (st.matchedDishId ? T * 0.06 : 0), T * 0.28, st.plateComponents, st.matchedDishId, timeNow);
      if (st.plateComponents.length === 0) {
        ctx.fillStyle = '#9C7F6E';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PLATE', cx, cy);
      } else if (st.matchedDishId) {
        ctx.fillStyle = '#15803D';
        this.roundRect(ctx, x + T * 0.14, y + T * 0.69, T * 0.72, T * 0.19, 6);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = miniSignFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('READY!', cx, y + T * 0.785);
      }
    } else if (st.type === 'compost') {
      ctx.fillStyle = '#5B6982';
      this.roundRect(ctx, x + T * 0.12, y + T * 0.09, T * 0.76, T * 0.8, 12);
      ctx.fill();
      ctx.fillStyle = '#3B4659';
      ctx.beginPath();
      ctx.arc(cx, cy - T * 0.12, T * 0.19, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#252F3F';
      this.roundRect(ctx, x + T * 0.13, y + T * 0.64, T * 0.74, T * 0.23, 6);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TRASH', cx, y + T * 0.755);
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

  private drawFloatingStationLabels(
    ctx: CanvasRenderingContext2D,
    sim: KitchenSimulation,
    T: number,
    portrait: boolean,
    timeNow: number,
  ): void {
    const pillH = Math.max(15, Math.min(22, Math.round(T * 0.28)));
    const fontSize = Math.max(7.5, Math.min(11, Math.round(T * 0.155)));

    for (let idx = 0; idx < sim.stations.length; idx++) {
      const st = sim.stations[idx];
      if (st.type !== 'pantry' && st.type !== 'skillet') continue;

      const drawCol = portrait ? st.row : st.col;
      const drawRow = portrait ? st.col : st.row;
      const cx = (drawCol + 0.5) * T;
      const bob = Math.sin(timeNow * 0.0042 + idx * 0.85) * 1.6;
      // Hover gently right above the upper lip of the station
      const anchorY = (drawRow === 0 ? drawRow * T - T * 0.11 : drawRow * T - T * 0.05) + bob;

      let labelText = '';
      let bgColor = '#FFFBF7';
      let borderColor = '#84523A';
      let textColor = '#3D2921';
      let itemForIcon: ItemKind | null = null;
      let isSkilletIcon = false;

      if (st.type === 'pantry' && st.pantryBase) {
        itemForIcon = INGREDIENT_META[st.pantryBase].rawKind;
        labelText =
          st.pantryBase === 'strawberry'
            ? 'Berry'
            : st.pantryBase === 'avocado'
              ? 'Avo'
              : st.pantryBase === 'lettuce'
                ? 'Greens'
                : st.pantryBase === 'patty'
                  ? 'Beef'
                  : st.pantryBase.charAt(0).toUpperCase() + st.pantryBase.slice(1);
      } else if (st.type === 'skillet') {
        if (!st.item) {
          isSkilletIcon = true;
          labelText = 'Pan';
          bgColor = '#3D2921';
          borderColor = '#E37752';
          textColor = '#FFFBF7';
        } else {
          itemForIcon = st.item;
          if (st.cookStage === 'perfect') {
            labelText = 'Ready!';
            bgColor = '#15803D';
            borderColor = '#DCFCE7';
            textColor = '#FFFFFF';
          } else if (st.cookStage === 'warning') {
            labelText = 'Pull!';
            bgColor = '#E11D48';
            borderColor = '#FFE4E6';
            textColor = '#FFFFFF';
          } else if (st.cookStage === 'burnt') {
            labelText = 'Burnt';
            bgColor = '#1C1917';
            borderColor = '#78716C';
            textColor = '#FCA5A5';
          } else {
            labelText = 'Sear';
            bgColor = '#7C2D12';
            borderColor = '#FDBA74';
            textColor = '#FFF7ED';
          }
        }
      }

      ctx.save();
      ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      const iconSize = pillH * 0.72;
      const textWidth = ctx.measureText(labelText).width;
      const padX = Math.max(5, Math.round(T * 0.08));
      const gap = 3.5;
      const pillW = Math.min(T * 1.18, padX * 2 + iconSize + gap + textWidth);
      const pillX = cx - pillW * 0.5;
      const pillY = anchorY - pillH * 0.5;

      // Soft clay drop shadow
      ctx.fillStyle = 'rgba(61, 41, 33, 0.2)';
      this.roundRect(ctx, pillX, pillY + 2, pillW, pillH, pillH * 0.5);
      ctx.fill();

      // Pill body
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.4;
      this.roundRect(ctx, pillX, pillY, pillW, pillH, pillH * 0.5);
      ctx.fill();
      ctx.stroke();

      // Mini floating icon inside pill
      const iconCx = pillX + padX + iconSize * 0.5;
      const iconCy = anchorY;
      if (isSkilletIcon) {
        ctx.fillStyle = '#E37752';
        ctx.beginPath();
        ctx.arc(iconCx + 1.5, iconCy, iconSize * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#36231B';
        ctx.beginPath();
        ctx.arc(iconCx + 1.5, iconCy, iconSize * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FDBA74';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(iconCx - iconSize * 0.45, iconCy);
        ctx.lineTo(iconCx - iconSize * 0.12, iconCy);
        ctx.stroke();
      } else if (itemForIcon) {
        this.drawItemGraphic(
          ctx,
          itemForIcon,
          iconCx,
          iconCy,
          iconSize * 0.46,
          st.cookStage === 'perfect',
          timeNow,
        );
      }

      // Label text
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        labelText,
        pillX + padX + iconSize + gap,
        anchorY + 0.5,
        Math.max(12, pillW - padX * 2 - iconSize - gap),
      );
      ctx.restore();
    }
  }

  private drawCustomersAndLine(
    ctx: CanvasRenderingContext2D,
    sim: KitchenSimulation,
    T: number,
    boardWidth: number,
    boardHeight: number,
    portrait: boolean,
    timeNow: number,
  ): void {
    // Striped Café Service Window Awning over the Customer Service Counter
    if (!portrait) {
      const winX = T * 0.95;
      const winW = T * 6.85;
      const stripeCount = 14;
      const stripeW = winW / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#C94136' : '#FFFBF7';
        this.roundRect(ctx, winX + i * stripeW, boardHeight - T * 0.12, stripeW + 0.5, T * 0.14, 4);
        ctx.fill();
      }
      ctx.strokeStyle = '#3D2921';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(winX, boardHeight - T * 0.12);
      ctx.lineTo(winX + winW, boardHeight - T * 0.12);
      ctx.stroke();
    } else {
      const winY = T * 0.95;
      const winH = T * 6.85;
      const stripeCount = 14;
      const stripeH = winH / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#C94136' : '#FFFBF7';
        this.roundRect(ctx, boardWidth - T * 0.12, winY + i * stripeH, T * 0.14, stripeH + 0.5, 4);
        ctx.fill();
      }
    }

    // Draw 4 Service Window Customer Placemats
    for (let i = 0; i < 4; i++) {
      const seat = this.getSeatScreenCoord(i, T, portrait);
      ctx.fillStyle = 'rgba(255, 251, 247, 0.78)';
      this.roundRect(ctx, seat.x - T * 0.36, seat.y - T * 0.26, T * 0.72, T * 0.52, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(132, 82, 58, 0.3)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Brass Queue Line Post & "LINE" sign
    const postX = portrait ? boardWidth - T * 0.45 : T * 8.18;
    const postY = portrait ? T * 8.05 : boardHeight - T * 0.45;
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(postX, postY, T * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3D2921';
    this.roundRect(ctx, postX - T * 0.24, postY - T * 0.28, T * 0.48, T * 0.16, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFBF7';
    ctx.font = `800 ${Math.max(5.5, Math.round(T * 0.1))}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LINE', postX, postY - T * 0.2);

    // Waiting Customer Queue (up to 2 eager next-in-line patrons behind the post)
    const lineCount = sim.timeRemaining > 6 ? 2 : sim.timeRemaining > 0 ? 1 : 0;

    for (let q = 0; q < lineCount; q++) {
      const qx = portrait ? boardWidth - T * 0.44 : T * (8.72 + q * 0.62);
      const qy = portrait ? T * (8.62 + q * 0.62) : boardHeight - T * 0.42;
      const sway = Math.sin(timeNow * 0.004 + q * 1.9) * (T * 0.03);
      drawCustomerSprite(ctx, {
        cx: qx + (portrait ? sway : 0),
        cy: qy + (portrait ? 0 : sway),
        radius: T * 0.24,
        avatarId: sim.nextTicketId + q,
        mood: 'calm',
        timeNow: timeNow + q * 400,
      });
    }

    // Active Service Window Customers with Above-Head Orders, Varieties & Visual Patience Bars
    const heldDish = sim.chef.held?.kind === 'plate' ? sim.chef.held.matchedDishId : null;
    for (const ticket of sim.tickets) {
      const seat = this.getSeatScreenCoord(ticket.seatIndex, T, portrait);
      const ratio = Math.max(0, Math.min(1, ticket.patience / ticket.maxPatience));
      const isUrgent = ticket.patience <= URGENT_ALARM_SECONDS;
      const mood: 'calm' | 'impatient' | 'urgent' = isUrgent
        ? 'urgent'
        : ratio <= 0.48
          ? 'impatient'
          : 'calm';

      const bounce = isUrgent
        ? Math.abs(Math.sin(timeNow * 0.014 + ticket.id)) * (T * 0.08)
        : Math.sin(timeNow * 0.0045 + ticket.id) * (T * 0.03);

      const gx = seat.x;
      const gy = seat.y - bounce;
      const isMatch = heldDish === ticket.dishId;
      const isTargeted =
        sim.chef.targetTicketId === ticket.id || sim.chef.queuedTicketId === ticket.id;

      // Golden glow halo for VIP or Green tap-to-serve pulse when holding matching dish
      if (isMatch) {
        const glow = 0.62 + Math.sin(timeNow * 0.012) * 0.3;
        ctx.strokeStyle = `rgba(34, 197, 94, ${glow})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(seat.x, seat.y, T * 0.36, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ticket.variety === 'vip') {
        const glow = 0.42 + Math.sin(timeNow * 0.007 + ticket.id) * 0.22;
        ctx.strokeStyle = `rgba(245, 158, 11, ${glow})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(seat.x, seat.y, T * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isTargeted) {
        ctx.strokeStyle = sim.chef.targetTicketId === ticket.id ? '#38BDF8' : '#F59E0B';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(seat.x, seat.y, T * 0.42, 0, Math.PI * 2);
        ctx.stroke();
      }

      drawCustomerSprite(ctx, {
        cx: gx,
        cy: gy,
        radius: T * 0.29,
        avatarId: ticket.avatarId,
        variety: ticket.variety,
        isVip: ticket.isVip,
        isExcited: isMatch,
        mood,
        timeNow: timeNow + ticket.id * 250,
      });

      // Above-head / Counter Order Card + Ingredient Steps + Visual Patience Progress Bar
      const recipe = RECIPES[ticket.dishId];
      const { bx, by, bw, bh } = this.getCustomerOrderCardRect(
        seat,
        T,
        boardWidth,
        boardHeight,
        portrait,
      );

      const cardFill = isMatch
        ? '#DCFCE7'
        : isUrgent
          ? '#FFE4E6'
          : ticket.variety === 'vip'
            ? '#FFF7D6'
            : ticket.variety === 'foodie'
              ? '#FFF1F5'
              : ticket.variety === 'express'
                ? '#F0F9FF'
                : '#FFFBF7';
      const cardStroke = isMatch
        ? '#16A34A'
        : isUrgent
          ? '#E11D48'
          : ticket.variety === 'vip'
            ? '#D97706'
            : ticket.variety === 'foodie'
              ? '#DB2777'
              : ticket.variety === 'express'
                ? '#0284C7'
                : '#3D2921';

      ctx.save();
      // Drop shadow under floating order card
      ctx.fillStyle = 'rgba(61, 41, 33, 0.2)';
      this.roundRect(ctx, bx, by + 2.5, bw, bh, 9);
      ctx.fill();

      ctx.fillStyle = cardFill;
      ctx.strokeStyle = cardStroke;
      ctx.lineWidth = isMatch || isUrgent || ticket.variety === 'vip' ? 2.1 : 1.5;
      this.roundRect(ctx, bx, by, bw, bh, 9);
      ctx.fill();
      ctx.stroke();

      // Tiny speech pointer connecting order card to the customer sprite
      ctx.fillStyle = cardFill;
      ctx.beginPath();
      if (!portrait) {
        ctx.moveTo(seat.x - 5, by + bh - 1);
        ctx.lineTo(seat.x + 5, by + bh - 1);
        ctx.lineTo(seat.x, by + bh + 5);
      } else {
        ctx.moveTo(bx + bw - 1, by + bh * 0.42);
        ctx.lineTo(bx + bw - 1, by + bh * 0.72);
        ctx.lineTo(bx + bw + 5, by + bh * 0.56);
      }
      ctx.closePath();
      ctx.fill();

      // Collect currently prepped/plated ingredients so recipe steps can show live green checkmarks
      const readyKinds = new Set<ItemKind>();
      if (sim.chef.held) {
        if (sim.chef.held.kind === 'plate') {
          for (const c of sim.chef.held.plateComponents) readyKinds.add(c.kind);
        } else {
          readyKinds.add(sim.chef.held.kind);
        }
      }
      for (const st of sim.stations) {
        if (st.type === 'plate_mat') {
          for (const c of st.plateComponents) readyKinds.add(c.kind);
        }
      }

      // Top Badge Pill (Variety or Serve Callout)
      const badgeLabel = isMatch
        ? 'SERVE!'
        : isUrgent
          ? `${Math.max(0, Math.ceil(ticket.patience))}s!`
          : ticket.variety === 'vip'
            ? 'VIP +2x'
            : ticket.variety === 'foodie'
              ? 'TIP+'
              : ticket.variety === 'express'
                ? 'FAST'
                : ticket.isDailySpecial
                  ? '★SPEC'
                  : '';

      const pad = Math.max(4, Math.round(T * 0.065));
      const headerH = Math.max(13, Math.round(bh * 0.24));
      const titleY = by + headerH * 0.56;
      const titleFontPx = Math.max(8.5, Math.min(11.5, Math.round(T * 0.15)));

      let badgeW = 0;
      if (badgeLabel) {
        const bFontPx = Math.max(6.5, Math.min(8.5, Math.round(T * 0.11)));
        ctx.font = `800 ${bFontPx}px "Plus Jakarta Sans", sans-serif`;
        badgeW = ctx.measureText(badgeLabel).width + 7;
        const bHeight = Math.max(10, Math.round(headerH * 0.78));
        const bX = bx + bw - pad - badgeW;
        const bY = titleY - bHeight * 0.5;
        ctx.fillStyle = isMatch
          ? '#15803D'
          : isUrgent
            ? '#E11D48'
            : ticket.variety === 'vip'
              ? '#B45309'
              : ticket.variety === 'foodie'
                ? '#BE185D'
                : ticket.variety === 'express'
                  ? '#0369A1'
                  : '#D97706';
        this.roundRect(ctx, bX, bY, badgeW, bHeight, 5);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeLabel, bX + badgeW * 0.5, titleY + 0.5);
      }

      // Dish short name
      ctx.font = `800 ${titleFontPx}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = isUrgent ? '#BE123C' : '#3D2921';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const titleMaxW = bw - pad * 2 - (badgeW > 0 ? badgeW + 3 : 0);
      ctx.fillText(recipe.shortName, bx + pad, titleY + 0.5, Math.max(24, titleMaxW));

      // Middle Row: Big Step-by-Step Ingredient Cards with Prep Action Tags (ADD / CHOP / SEAR / FRY)
      const barH = Math.max(5, Math.round(T * 0.085));
      const barY = by + bh - barH - Math.max(3.5, Math.round(bh * 0.065));
      const stepsTop = by + headerH + 2;
      const stepsH = Math.max(22, barY - stepsTop - 3.5);
      const stepCount = recipe.steps.length;
      const gap = stepCount >= 4 ? 2.5 : 4;
      const availStepsW = bw - pad * 2;
      const boxW = (availStepsW - gap * (stepCount - 1)) / Math.max(1, stepCount);
      const tagH = Math.max(9.5, Math.round(stepsH * 0.34));
      const tagFontPx = Math.max(6, Math.min(8.5, Math.round(tagH * 0.72)));

      recipe.steps.forEach((step, sIdx) => {
        const sx = bx + pad + sIdx * (boxW + gap);
        const sy = stepsTop;
        const stepReady = isMatch || readyKinds.has(step.resultKind);

        // Rounded clay step chip background
        ctx.fillStyle = stepReady ? '#DCFCE7' : '#FFF4E8';
        ctx.strokeStyle = stepReady ? '#16A34A' : '#E2C9B4';
        ctx.lineWidth = stepReady ? 1.4 : 1;
        this.roundRect(ctx, sx, sy, boxW, stepsH, 6);
        ctx.fill();
        ctx.stroke();

        // Big, unmistakable raw ingredient icon in upper portion of the step chip
        const iconAreaH = stepsH - tagH;
        const iconR = Math.max(
          5.5,
          Math.min(boxW * 0.34, iconAreaH * 0.42, T * 0.145),
        );
        const iconCx = sx + boxW * 0.5;
        const iconCy = sy + iconAreaH * 0.52;
        const rawKind = INGREDIENT_META[step.base].rawKind;
        this.drawItemGraphic(ctx, rawKind, iconCx, iconCy, iconR, false, timeNow);

        // Color-coded prep action pill along bottom of step chip
        let prepLabel = 'ADD';
        let prepBg = '#EAD8C8';
        let prepFg = '#5C4034';
        if (step.prep === 'chop') {
          prepLabel = 'CHOP';
          prepBg = '#15803D';
          prepFg = '#FFFFFF';
        } else if (step.prep === 'sear') {
          prepLabel = 'SEAR';
          prepBg = '#C2410C';
          prepFg = '#FFFFFF';
        } else if (step.prep === 'chop_sear') {
          prepLabel = boxW >= 34 ? 'CHOP+FRY' : 'FRY';
          prepBg = '#B45309';
          prepFg = '#FFFFFF';
        }

        const tagY = sy + stepsH - tagH;
        ctx.fillStyle = prepBg;
        this.roundRect(ctx, sx + 1, tagY, boxW - 2, tagH - 1, 4);
        ctx.fill();
        ctx.fillStyle = prepFg;
        ctx.font = `800 ${tagFontPx}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(prepLabel, sx + boxW * 0.5, tagY + (tagH - 1) * 0.52, boxW - 4);

        // Crisp green checkmark when this step's prepared ingredient is ready/plated
        if (stepReady) {
          const ckR = Math.max(4, Math.min(5.5, boxW * 0.16));
          const ckX = sx + boxW - ckR - 1;
          const ckY = sy + ckR + 1;
          ctx.fillStyle = '#15803D';
          ctx.beginPath();
          ctx.arc(ckX, ckY, ckR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `800 ${Math.max(6, Math.round(ckR * 1.35))}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', ckX, ckY + 0.5);
        }
      });

      // Bottom Row: Crisp Visual Patience Progress Bar
      const barX = bx + pad;
      const barW = bw - pad * 2;
      ctx.fillStyle = '#E8D5C5';
      this.roundRect(ctx, barX, barY, barW, barH, barH * 0.5);
      ctx.fill();

      const barFillColor = isUrgent
        ? Math.sin(timeNow * 0.02) > 0
          ? '#E11D48'
          : '#FB7185'
        : ratio > 0.55
          ? '#22C55E'
          : '#F59E0B';
      const fillW = Math.max(ratio > 0 ? barH : 0, barW * ratio);
      ctx.fillStyle = barFillColor;
      this.roundRect(ctx, barX, barY, fillW, barH, barH * 0.5);
      ctx.fill();
      ctx.restore();
    }

    // Floating Customer Reactions (Served Happy Tips / Walked Out Quips)
    for (const react of sim.customerReactions) {
      const seat = this.getSeatScreenCoord(react.seatIndex, T, portrait);
      const progress = 1 - react.timer / react.maxTimer;
      const alpha = Math.min(1, react.timer * 1.8);
      const rx = seat.x + (portrait ? progress * T * 0.32 : 0);
      const ry = seat.y - (portrait ? 0 : progress * T * 0.15);

      ctx.save();
      ctx.globalAlpha = alpha;
      drawCustomerSprite(ctx, {
        cx: rx,
        cy: ry,
        radius: T * 0.27,
        avatarId: react.avatarId,
        variety: react.variety,
        isVip: react.variety === 'vip',
        isExcited: react.kind === 'happy',
        mood: react.kind === 'happy' ? 'happy' : 'urgent',
        timeNow,
      });

      const tagX = portrait ? Math.min(boardWidth - T * 0.9, rx - T * 0.45) : rx;
      const tagY = portrait ? ry - T * 0.36 - progress * T * 0.22 : ry - T * 0.45 - progress * T * 0.28;
      ctx.font = `800 ${Math.max(10, Math.round(T * 0.19))}px "Fredoka", "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#3D2921';
      ctx.strokeText(react.text, tagX, tagY);
      ctx.fillStyle = react.kind === 'happy' ? '#FB7185' : '#FCA5A5';
      ctx.fillText(react.text, tagX, tagY);
      ctx.restore();
    }
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

    const traceNavPolyline = (endX: number, endY: number) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (const wp of chef.navPath) {
        const sp = this.toScreenGrid(wp.x, wp.y, portrait);
        ctx.lineTo(sp.x * T, sp.y * T);
      }
      ctx.lineTo(endX, endY);
      ctx.stroke();
    };

    if (chef.targetStationId) {
      const target = sim.stations.find((s) => s.id === chef.targetStationId);
      if (target) {
        const tp = this.toScreenGrid(target.col + 0.5, target.row + 0.5, portrait);
        const tx = tp.x * T;
        const ty = tp.y * T;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.setLineDash([5, 5]);
        traceNavPolyline(tx, ty);

        if (chef.queuedStationId) {
          const queued = sim.stations.find((s) => s.id === chef.queuedStationId);
          if (queued) {
            const qp = this.toScreenGrid(queued.col + 0.5, queued.row + 0.5, portrait);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(qp.x * T, qp.y * T);
            ctx.stroke();
          }
        } else if (chef.queuedTicketId !== null) {
          const qt = sim.tickets.find((t) => t.id === chef.queuedTicketId);
          if (qt) {
            const qSeat = this.getSeatScreenCoord(qt.seatIndex, T, portrait);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(qSeat.x, qSeat.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    } else if (chef.targetTicketId !== null) {
      const targetTicket = sim.tickets.find((t) => t.id === chef.targetTicketId);
      if (targetTicket) {
        const tSeat = this.getSeatScreenCoord(targetTicket.seatIndex, T, portrait);
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
        ctx.lineWidth = 2.4;
        ctx.lineJoin = 'round';
        ctx.setLineDash([5, 5]);
        traceNavPolyline(tSeat.x, tSeat.y);
        ctx.restore();
      }
    } else if (chef.targetPoint) {
      const wp = this.toScreenGrid(chef.targetPoint.x, chef.targetPoint.y, portrait);
      const wx = wp.x * T;
      const wy = wp.y * T;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash([4, 4]);
      traceNavPolyline(wx, wy);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.beginPath();
      ctx.arc(wx, wy, Math.max(3.5, T * 0.08), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
          T * 0.25,
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
          T * 0.25,
          chef.held.isPerfect,
          timeNow,
        );
      }

      // Crisp floating held-item badge right above Chef Pip
      const badgeLabel =
        chef.held.kind === 'plate'
          ? chef.held.matchedDishId
            ? `${RECIPES[chef.held.matchedDishId].shortName} ✓`
            : `Plate (${chef.held.plateComponents.length})`
          : ITEM_LABELS[chef.held.kind];
      const badgeFontSize = Math.max(8, Math.min(11, Math.round(T * 0.16)));
      ctx.font = `700 ${badgeFontSize}px "Plus Jakarta Sans", sans-serif`;
      const textW = ctx.measureText(badgeLabel).width + 10;
      const pillY = pos.y < 2.15 ? r * 1.48 : -r * 1.55;
      ctx.fillStyle = chef.held.matchedDishId ? '#15803D' : '#3D2921';
      this.roundRect(ctx, -textW * 0.5, pillY - 8, textW, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFBF7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, 0, pillY);
    }

    ctx.restore();
  }

  private drawBotChef(
    ctx: CanvasRenderingContext2D,
    sim: KitchenSimulation,
    T: number,
    portrait: boolean,
    timeNow: number,
  ): void {
    const bot = sim.bot;
    if (!bot) return;

    const pos = this.toScreenGrid(bot.x, bot.y, portrait);
    const px = pos.x * T;
    const py = pos.y * T;
    const r = T * 0.31;
    const faceX = portrait ? bot.facingY : bot.facingX;
    const faceY = portrait ? bot.facingX : bot.facingY;

    const speed = Math.hypot(bot.vx, bot.vy);
    const walkBob = speed > 0.2 ? Math.sin(bot.walkDistance * 7.5) * (T * 0.04) : 0;
    const happyBounce = bot.happyTimer > 0 ? Math.abs(Math.sin(bot.happyTimer * 18)) * (T * 0.12) : 0;

    // Subtle lavender A* path trail so player can read Rival Coco's next move
    if (bot.navPath.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.32)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (const wp of bot.navPath) {
        const sp = this.toScreenGrid(wp.x, wp.y, portrait);
        ctx.lineTo(sp.x * T, sp.y * T);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(px, py + walkBob - happyBounce);

    // Contact shadow
    ctx.fillStyle = 'rgba(107, 33, 168, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.92 - walkBob + happyBounce, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(bot.squashX, bot.squashY);

    // Lavender clay chef coat
    ctx.fillStyle = '#FAF5FF';
    ctx.strokeStyle = '#3B0764';
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Purple rival apron accent
    ctx.fillStyle = '#9333EA';
    ctx.beginPath();
    ctx.arc(faceX * r * 0.25, faceY * r * 0.25, r * 0.44, 0, Math.PI * 2);
    ctx.fill();

    // Head
    const headX = faceX * r * 0.14;
    const headY = faceY * r * 0.14 - r * 0.1;
    ctx.fillStyle = '#F3C6A5';
    ctx.strokeStyle = '#3B0764';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(headX, headY, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cute cheeks + eyes
    const perpX = -faceY;
    const perpY = faceX;
    const eyeBaseX = headX + faceX * r * 0.24;
    const eyeBaseY = headY + faceY * r * 0.24;
    const isBlink = (timeNow + 1400) % 3600 < 120;

    ctx.fillStyle = 'rgba(217, 70, 239, 0.32)';
    ctx.beginPath();
    ctx.arc(eyeBaseX + perpX * r * 0.26, eyeBaseY + perpY * r * 0.26 + 2, r * 0.1, 0, Math.PI * 2);
    ctx.arc(eyeBaseX - perpX * r * 0.26, eyeBaseY - perpY * r * 0.26 + 2, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1C1917';
    if (isBlink || bot.happyTimer > 0) {
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

    // Lavender Rival Chef Toque Hat
    ctx.fillStyle = '#E9D5FF';
    ctx.strokeStyle = '#6B21A8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(headX - faceX * 2, headY - r * 0.34, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Held ingredient or plate in Coco's hands
    if (bot.held) {
      const holdX = faceX * r * 1.12;
      const holdY = faceY * r * 1.12 - r * 0.14;
      if (bot.held.kind === 'plate') {
        this.drawPlateWithComponents(
          ctx,
          holdX,
          holdY,
          T * 0.24,
          bot.held.plateComponents,
          bot.held.matchedDishId,
          timeNow,
        );
      } else {
        this.drawItemGraphic(
          ctx,
          bot.held.kind,
          holdX,
          holdY,
          T * 0.24,
          bot.held.isPerfect,
          timeNow,
        );
      }
    }

    // Crisp "BOT" tag above Chef Coco so she's instantly distinguishable from Player
    const tagText = 'BOT';
    const fontSize = Math.max(8, Math.min(10, Math.round(T * 0.14)));
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const tagW = ctx.measureText(tagText).width + 10;
    const tagY = pos.y < 2.15 ? r * 1.44 : -r * 1.5;
    ctx.fillStyle = '#7E22CE';
    this.roundRect(ctx, -tagW * 0.5, tagY - 7.5, tagW, 15, 7.5);
    ctx.fill();
    ctx.fillStyle = '#FAF5FF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, 0, tagY);

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

    if (matchedDishId === 'bistro_burger' || matchedDishId === 'royale_burger') {
      // Layered gourmet burger stack
      this.drawItemGraphic(ctx, 'bun', cx, cy + radius * 0.16, radius * 0.65, false, timeNow);
      this.drawItemGraphic(ctx, 'patty_cooked', cx, cy, radius * 0.56, false, timeNow);
      this.drawItemGraphic(
        ctx,
        matchedDishId === 'royale_burger' ? 'egg_cooked' : 'lettuce_chopped',
        cx,
        cy - radius * 0.12,
        radius * 0.52,
        true,
        timeNow,
      );
      this.drawItemGraphic(ctx, 'bun', cx, cy - radius * 0.25, radius * 0.56, false, timeNow);
    } else if (
      matchedDishId === 'bruschetta' ||
      matchedDishId === 'avo_toast' ||
      matchedDishId === 'berry_toast' ||
      matchedDishId === 'morning_brioche'
    ) {
      // Toasted brioche base + signature topping
      this.drawItemGraphic(ctx, 'bun', cx, cy + radius * 0.08, radius * 0.68, false, timeNow);
      const topKind =
        matchedDishId === 'bruschetta'
          ? 'tomato_chopped'
          : matchedDishId === 'avo_toast'
            ? 'avocado_chopped'
            : matchedDishId === 'berry_toast'
              ? 'strawberry_chopped'
              : 'egg_cooked';
      this.drawItemGraphic(ctx, topKind, cx, cy - radius * 0.08, radius * 0.54, true, timeNow);
    } else {
      components.forEach((comp, idx) => {
        const angle = (idx / Math.max(1, components.length)) * Math.PI * 2 - Math.PI * 0.5;
        const offset = components.length === 1 ? 0 : radius * 0.26;
        const ix = cx + Math.cos(angle) * offset;
        const iy = cy + Math.sin(angle) * offset - idx * 1.2;
        this.drawItemGraphic(ctx, comp.kind, ix, iy, radius * 0.56, comp.isPerfect, timeNow);
      });
    }

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
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
    }

    switch (kind) {
      case 'bun': {
        // Golden domed brioche bun with sesame seeds & shine
        ctx.fillStyle = '#D99142';
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.08, r * 0.9, r * 0.74, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F3BD7A';
        ctx.beginPath();
        ctx.ellipse(-r * 0.14, -r * 0.14, r * 0.46, r * 0.28, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFBEB';
        for (const [sx, sy] of [[-0.28, -0.2], [0.22, -0.24], [-0.02, 0.1], [0.32, 0.08]]) {
          ctx.beginPath();
          ctx.ellipse(sx * r, sy * r, Math.max(1.4, r * 0.1), Math.max(0.9, r * 0.06), 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'tomato_raw': {
        // Plump glossy tomato + 4-leaf green star calyx
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#7F1D1D';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, r * 0.06, r * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FCA5A5';
        ctx.beginPath();
        ctx.ellipse(-r * 0.28, -r * 0.18, r * 0.18, r * 0.11, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.88);
        ctx.lineTo(r * 0.18, -r * 0.56);
        ctx.lineTo(r * 0.44, -r * 0.66);
        ctx.lineTo(r * 0.14, -r * 0.42);
        ctx.lineTo(0, -r * 0.24);
        ctx.lineTo(-r * 0.14, -r * 0.42);
        ctx.lineTo(-r * 0.44, -r * 0.66);
        ctx.lineTo(-r * 0.18, -r * 0.56);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'tomato_chopped': {
        // 3 distinct diced ruby tomato cubes with seed dots
        const cubes = [
          [-0.42, -0.34, 0.48],
          [0.06, -0.4, 0.48],
          [-0.18, 0.08, 0.5],
        ];
        for (const [cx0, cy0, sz] of cubes) {
          ctx.fillStyle = '#EF4444';
          ctx.strokeStyle = '#991B1B';
          ctx.lineWidth = 1.1;
          this.roundRect(ctx, cx0 * r, cy0 * r, sz * r, sz * r, 3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect((cx0 + 0.16) * r, (cy0 + 0.16) * r, Math.max(1.5, r * 0.1), Math.max(1.5, r * 0.1));
        }
        break;
      }
      case 'lettuce_raw': {
        // Ruffled multi-petal emerald lettuce head with crisp leaf ribs
        ctx.fillStyle = '#15803D';
        ctx.strokeStyle = '#14532D';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34, r * 0.54, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DCFCE7';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.28, 0.2, Math.PI * 1.4);
        ctx.stroke();
        break;
      }
      case 'lettuce_chopped': {
        // Fluffy jagged shredded green ribbons
        const ribbons = [
          [-0.28, -0.22, 0.45, '#22C55E'],
          [0.24, -0.26, -0.55, '#4ADE80'],
          [-0.12, 0.24, 0.12, '#16A34A'],
          [0.22, 0.2, -0.25, '#86EFAC'],
        ] as const;
        for (const [ox, oy, rot, col] of ribbons) {
          ctx.save();
          ctx.translate(ox * r, oy * r);
          ctx.rotate(rot);
          ctx.fillStyle = col;
          ctx.strokeStyle = '#14532D';
          ctx.lineWidth = 0.9;
          this.roundRect(ctx, -r * 0.38, -r * 0.12, r * 0.76, r * 0.24, 3);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'potato_raw': {
        // Plump golden-tan russet spud with dark dimple spots
        ctx.fillStyle = '#C98A3A';
        ctx.strokeStyle = '#713F12';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.88, r * 0.62, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#EAB308';
        ctx.beginPath();
        ctx.ellipse(-r * 0.2, -r * 0.18, r * 0.28, r * 0.12, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#713F12';
        ctx.beginPath();
        ctx.arc(r * 0.28, r * 0.1, Math.max(1.2, r * 0.08), 0, Math.PI * 2);
        ctx.arc(-r * 0.18, r * 0.22, Math.max(1.2, r * 0.07), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'potato_chopped': {
        // Raw pale-cream diagonal fry sticks
        ctx.save();
        ctx.rotate(-0.2);
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = '#FEF3C7';
          ctx.strokeStyle = '#B45309';
          ctx.lineWidth = 1.1;
          this.roundRect(ctx, i * r * 0.34 - r * 0.12, -r * 0.62, r * 0.24, r * 1.24, 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'fries_cooked': {
        // Golden crisp fries inside a red-and-white bistro fry cup
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = '#F59E0B';
          ctx.strokeStyle = '#92400E';
          ctx.lineWidth = 1;
          this.roundRect(ctx, i * r * 0.3 - r * 0.11, -r * 0.78, r * 0.22, r * 0.96, 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#7F1D1D';
        ctx.lineWidth = 1.2;
        this.roundRect(ctx, -r * 0.56, -r * 0.08, r * 1.12, r * 0.82, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFBF7';
        ctx.fillRect(-r * 0.36, r * 0.08, r * 0.72, r * 0.16);
        break;
      }
      case 'egg_raw': {
        // Cream egg nestled in a warm brown egg cup so it stands out
        ctx.fillStyle = '#D97706';
        this.roundRect(ctx, -r * 0.42, r * 0.26, r * 0.84, r * 0.44, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFBEB';
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.06, r * 0.52, r * 0.68, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'egg_cooked': {
        // Sunny-side-up egg with ruffled white + bright golden yolk
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.92, r * 0.78, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(-r * 0.12, -r * 0.12, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'patty_raw': {
        // Marbled pink-rose beef patty on white butcher sheet (unmistakable vs tomato)
        ctx.fillStyle = '#FFFBF7';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        this.roundRect(ctx, -r * 0.78, -r * 0.78, r * 1.56, r * 1.56, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E15A64';
        ctx.strokeStyle = '#881337';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.64, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FECDD3';
        ctx.fillRect(-r * 0.28, -r * 0.18, r * 0.22, r * 0.1);
        ctx.fillRect(r * 0.08, r * 0.14, r * 0.24, r * 0.1);
        break;
      }
      case 'patty_cooked': {
        // Rich dark cocoa seared patty with bold char grill lines
        ctx.fillStyle = '#6B3410';
        ctx.strokeStyle = '#3B1805';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#240D02';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.22);
        ctx.lineTo(r * 0.5, -r * 0.22);
        ctx.moveTo(-r * 0.5, r * 0.22);
        ctx.lineTo(r * 0.5, r * 0.22);
        ctx.stroke();
        break;
      }
      case 'avocado_raw': {
        ctx.fillStyle = '#3F6212';
        ctx.strokeStyle = '#1A2E05';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.65, r * 0.88, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#BEF264';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.08, r * 0.4, r * 0.52, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(0, r * 0.18, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'avocado_chopped': {
        ctx.fillStyle = '#84CC16';
        ctx.strokeStyle = '#3F6212';
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(i * r * 0.32, Math.abs(i) * r * 0.1, r * 0.38, Math.PI * 0.1, Math.PI * 0.9);
          ctx.fill();
          ctx.stroke();
        }
        break;
      }
      case 'strawberry_raw': {
        // Heart-shaped strawberry with golden seeds + green leafy crown
        ctx.fillStyle = '#E11D48';
        ctx.strokeStyle = '#881337';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.88);
        ctx.quadraticCurveTo(-r * 0.88, r * 0.08, -r * 0.62, -r * 0.52);
        ctx.quadraticCurveTo(0, -r * 0.78, r * 0.62, -r * 0.52);
        ctx.quadraticCurveTo(r * 0.88, r * 0.08, 0, r * 0.88);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FDE047';
        for (const [sx, sy] of [[-0.22, -0.1], [0.22, -0.1], [0, 0.28], [-0.14, 0.42]]) {
          ctx.fillRect(sx * r, sy * r, 2, 2);
        }
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, -r * 0.52);
        ctx.lineTo(0, -r * 0.82);
        ctx.lineTo(r * 0.42, -r * 0.52);
        ctx.lineTo(0, -r * 0.38);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'strawberry_chopped': {
        // Twin halved strawberry slices showing pink heart interiors
        for (const [ox, oy] of [[-0.3, -0.1], [0.3, 0.12]]) {
          ctx.fillStyle = '#F43F5E';
          ctx.strokeStyle = '#9F1239';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.ellipse(ox * r, oy * r, r * 0.42, r * 0.48, ox > 0 ? 0.3 : -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFE4E6';
          ctx.beginPath();
          ctx.ellipse(ox * r, oy * r, r * 0.2, r * 0.24, ox > 0 ? 0.3 : -0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'burnt': {
        ctx.fillStyle = '#1C1917';
        ctx.strokeStyle = '#57534E';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, -r * 0.26);
        ctx.lineTo(r * 0.26, r * 0.26);
        ctx.moveTo(r * 0.26, -r * 0.26);
        ctx.lineTo(-r * 0.26, r * 0.26);
        ctx.stroke();
        break;
      }
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

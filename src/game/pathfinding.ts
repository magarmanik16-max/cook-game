import type { StationState } from './types';

export interface NavPoint {
  x: number;
  y: number;
}

export interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const NAV_GRID_COLS = 10;
export const NAV_GRID_ROWS = 7;
export const NAV_CHEF_RADIUS = 0.34;
export const NAV_CLEARANCE = 0.42;

/**
 * Interior solid kitchen counters/islands that Chef Pip must navigate around.
 * Outer perimeter walls occupy col 0, col 9, row 0, row 6.
 */
export const KITCHEN_OBSTACLES: readonly ObstacleRect[] = [
  { x: 4.0, y: 3.0, w: 2.0, h: 1.0 }, // Center plating island
];

const CELL_STEP = 0.5;
const GRID_MIN_X = 1.5;
const GRID_MIN_Y = 1.5;
const NODE_COLS = Math.round((NAV_GRID_COLS - 3.0) / CELL_STEP) + 1; // 15 nodes: 1.5..8.5
const NODE_ROWS = Math.round((NAV_GRID_ROWS - 3.0) / CELL_STEP) + 1; // 9 nodes: 1.5..5.5

function pointToRectDistSq(px: number, py: number, rect: ObstacleRect): number {
  const cx = Math.max(rect.x, Math.min(px, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(py, rect.y + rect.h));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-9) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  const projX = ax + t * vx;
  const projY = ay + t * vy;
  const dx = px - projX;
  const dy = py - projY;
  return dx * dx + dy * dy;
}

function segmentIntersectsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rect: ObstacleRect,
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (
    clip(-dx, ax - rect.x) &&
    clip(dx, rect.x + rect.w - ax) &&
    clip(-dy, ay - rect.y) &&
    clip(dy, rect.y + rect.h - ay)
  ) {
    return t0 <= t1;
  }
  return false;
}

export function segmentToRectDist(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rect: ObstacleRect,
): number {
  if (segmentIntersectsRect(ax, ay, bx, by, rect)) return 0;

  let minSq = Math.min(pointToRectDistSq(ax, ay, rect), pointToRectDistSq(bx, by, rect));
  const x0 = rect.x;
  const x1 = rect.x + rect.w;
  const y0 = rect.y;
  const y1 = rect.y + rect.h;

  minSq = Math.min(
    minSq,
    pointToSegmentDistSq(x0, y0, ax, ay, bx, by),
    pointToSegmentDistSq(x1, y0, ax, ay, bx, by),
    pointToSegmentDistSq(x0, y1, ax, ay, bx, by),
    pointToSegmentDistSq(x1, y1, ax, ay, bx, by),
  );
  return Math.sqrt(minSq);
}

export function isPointWalkable(
  x: number,
  y: number,
  clearance: number = NAV_CLEARANCE,
  obstacles: readonly ObstacleRect[] = KITCHEN_OBSTACLES,
): boolean {
  const minX = 1.0 + Math.min(clearance, 0.36);
  const maxX = NAV_GRID_COLS - 1.0 - Math.min(clearance, 0.36);
  const minY = 1.0 + Math.min(clearance, 0.36);
  const maxY = NAV_GRID_ROWS - 1.0 - Math.min(clearance, 0.36);
  if (x < minX - 1e-4 || x > maxX + 1e-4 || y < minY - 1e-4 || y > maxY + 1e-4) {
    return false;
  }
  const cSq = (clearance - 1e-4) * (clearance - 1e-4);
  for (const rect of obstacles) {
    if (pointToRectDistSq(x, y, rect) < cSq) {
      return false;
    }
  }
  return true;
}

export function clampToWalkablePoint(
  x: number,
  y: number,
  clearance: number = NAV_CLEARANCE,
  obstacles: readonly ObstacleRect[] = KITCHEN_OBSTACLES,
): NavPoint {
  const wallPad = Math.max(NAV_CHEF_RADIUS + 0.02, Math.min(clearance, 0.38));
  let px = Math.max(1.0 + wallPad, Math.min(NAV_GRID_COLS - 1.0 - wallPad, x));
  let py = Math.max(1.0 + wallPad, Math.min(NAV_GRID_ROWS - 1.0 - wallPad, y));

  for (let pass = 0; pass < 2; pass++) {
    for (const rect of obstacles) {
      const cx = Math.max(rect.x, Math.min(px, rect.x + rect.w));
      const cy = Math.max(rect.y, Math.min(py, rect.y + rect.h));
      const dx = px - cx;
      const dy = py - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < clearance * clearance) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-4) {
          const push = clearance - dist + 0.005;
          px += (dx / dist) * push;
          py += (dy / dist) * push;
        } else {
          const leftPen = px - rect.x;
          const rightPen = rect.x + rect.w - px;
          const topPen = py - rect.y;
          const bottomPen = rect.y + rect.h - py;
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) px = rect.x - clearance - 0.005;
          else if (minPen === rightPen) px = rect.x + rect.w + clearance + 0.005;
          else if (minPen === topPen) py = rect.y - clearance - 0.005;
          else py = rect.y + rect.h + clearance + 0.005;
        }
      }
    }
    px = Math.max(1.0 + wallPad, Math.min(NAV_GRID_COLS - 1.0 - wallPad, px));
    py = Math.max(1.0 + wallPad, Math.min(NAV_GRID_ROWS - 1.0 - wallPad, py));
  }

  return { x: px, y: py };
}

export function isSegmentClear(
  a: NavPoint,
  b: NavPoint,
  clearance: number = NAV_CLEARANCE,
  obstacles: readonly ObstacleRect[] = KITCHEN_OBSTACLES,
): boolean {
  const wallPad = Math.max(NAV_CHEF_RADIUS, Math.min(clearance, 0.36));
  if (
    a.x < 1.0 + wallPad - 1e-3 ||
    a.x > NAV_GRID_COLS - 1.0 - wallPad + 1e-3 ||
    b.x < 1.0 + wallPad - 1e-3 ||
    b.x > NAV_GRID_COLS - 1.0 - wallPad + 1e-3 ||
    a.y < 1.0 + wallPad - 1e-3 ||
    a.y > NAV_GRID_ROWS - 1.0 - wallPad + 1e-3 ||
    b.y < 1.0 + wallPad - 1e-3 ||
    b.y > NAV_GRID_ROWS - 1.0 - wallPad + 1e-3
  ) {
    return false;
  }

  for (const rect of obstacles) {
    if (segmentToRectDist(a.x, a.y, b.x, b.y, rect) < clearance - 1e-3) {
      return false;
    }
  }
  return true;
}

function nodeCoord(ix: number, iy: number): NavPoint {
  return {
    x: GRID_MIN_X + ix * CELL_STEP,
    y: GRID_MIN_Y + iy * CELL_STEP,
  };
}

function smoothPath(
  points: NavPoint[],
  clearance: number,
  obstacles: readonly ObstacleRect[],
): NavPoint[] {
  if (points.length <= 2) return points.slice(1);
  const smoothed: NavPoint[] = [];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let furthest = anchor + 1;
    for (let j = points.length - 1; j > anchor + 1; j--) {
      if (isSegmentClear(points[anchor], points[j], clearance, obstacles)) {
        furthest = j;
        break;
      }
    }
    smoothed.push(points[furthest]);
    anchor = furthest;
  }
  return smoothed;
}

export function pathLength(start: NavPoint, waypoints: readonly NavPoint[]): number {
  let total = 0;
  let prev = start;
  for (const wp of waypoints) {
    total += Math.hypot(wp.x - prev.x, wp.y - prev.y);
    prev = wp;
  }
  return total;
}

/**
 * Computes a collision-free, line-of-sight smoothed A* waypoint path from `rawStart` to `rawGoal`.
 * Returns an ordered array of waypoints ending at the clamped goal (excluding start).
 */
export function findNavPath(
  rawStart: NavPoint,
  rawGoal: NavPoint,
  clearance: number = NAV_CLEARANCE,
  obstacles: readonly ObstacleRect[] = KITCHEN_OBSTACLES,
): NavPoint[] {
  const start = clampToWalkablePoint(rawStart.x, rawStart.y, clearance, obstacles);
  const goal = clampToWalkablePoint(rawGoal.x, rawGoal.y, clearance, obstacles);

  if (Math.hypot(goal.x - start.x, goal.y - start.y) < 0.04) {
    return [goal];
  }

  if (isSegmentClear(start, goal, clearance, obstacles)) {
    return [goal];
  }

  const totalGridNodes = NODE_COLS * NODE_ROWS;
  const startIdx = totalGridNodes;
  const goalIdx = totalGridNodes + 1;
  const totalNodes = totalGridNodes + 2;

  const walkable = new Uint8Array(totalGridNodes);
  for (let iy = 0; iy < NODE_ROWS; iy++) {
    for (let ix = 0; ix < NODE_COLS; ix++) {
      const p = nodeCoord(ix, iy);
      walkable[iy * NODE_COLS + ix] = isPointWalkable(p.x, p.y, clearance, obstacles) ? 1 : 0;
    }
  }

  const getPos = (idx: number): NavPoint => {
    if (idx === startIdx) return start;
    if (idx === goalIdx) return goal;
    return nodeCoord(idx % NODE_COLS, Math.floor(idx / NODE_COLS));
  };

  // Connect virtual start & goal nodes to nearby clear grid nodes
  const connectToGrid = (pt: NavPoint): number[] => {
    const out: number[] = [];
    const cx = Math.round((pt.x - GRID_MIN_X) / CELL_STEP);
    const cy = Math.round((pt.y - GRID_MIN_Y) / CELL_STEP);

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ix = cx + dx;
        const iy = cy + dy;
        if (ix < 0 || ix >= NODE_COLS || iy < 0 || iy >= NODE_ROWS) continue;
        const id = iy * NODE_COLS + ix;
        if (!walkable[id]) continue;
        const np = nodeCoord(ix, iy);
        if (isSegmentClear(pt, np, clearance, obstacles)) {
          out.push(id);
        }
      }
    }

    if (out.length === 0) {
      let bestId = -1;
      let bestDist = Infinity;
      for (let id = 0; id < totalGridNodes; id++) {
        if (!walkable[id]) continue;
        const np = nodeCoord(id % NODE_COLS, Math.floor(id / NODE_COLS));
        const d = Math.hypot(np.x - pt.x, np.y - pt.y);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
        }
      }
      if (bestId !== -1) out.push(bestId);
    }
    return out;
  };

  const startNeighbors = connectToGrid(start);
  const goalNeighborSet = new Set<number>(connectToGrid(goal));

  const gScore = new Float64Array(totalNodes);
  gScore.fill(Infinity);
  const fScore = new Float64Array(totalNodes);
  fScore.fill(Infinity);
  const cameFrom = new Int32Array(totalNodes);
  cameFrom.fill(-1);
  const closed = new Uint8Array(totalNodes);

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(goal.x - start.x, goal.y - start.y);
  const open: number[] = [startIdx];

  const dirs: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  while (open.length > 0) {
    let bestPos = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bestPos]]) {
        bestPos = i;
      }
    }
    const current = open[bestPos];
    open.splice(bestPos, 1);

    if (current === goalIdx) {
      const chain: NavPoint[] = [];
      let cur = goalIdx;
      while (cur !== -1) {
        chain.push(getPos(cur));
        cur = cameFrom[cur];
      }
      chain.reverse();
      return smoothPath(chain, clearance, obstacles);
    }

    if (closed[current]) continue;
    closed[current] = 1;

    const curPos = getPos(current);
    const neighbors: number[] = [];

    if (current === startIdx) {
      for (const n of startNeighbors) neighbors.push(n);
    } else if (current < totalGridNodes) {
      const ix = current % NODE_COLS;
      const iy = Math.floor(current / NODE_COLS);
      for (const [dx, dy] of dirs) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || nx >= NODE_COLS || ny < 0 || ny >= NODE_ROWS) continue;
        const nid = ny * NODE_COLS + nx;
        if (!walkable[nid]) continue;
        // Strict no-corner-cutting on diagonal transitions
        if (dx !== 0 && dy !== 0) {
          if (!walkable[iy * NODE_COLS + nx] || !walkable[ny * NODE_COLS + ix]) continue;
        }
        neighbors.push(nid);
      }
      if (goalNeighborSet.has(current)) {
        neighbors.push(goalIdx);
      }
    }

    for (const next of neighbors) {
      if (closed[next]) continue;
      const nextPos = getPos(next);
      const stepCost = Math.hypot(nextPos.x - curPos.x, nextPos.y - curPos.y);
      const tentativeG = gScore[current] + stepCost;
      if (tentativeG < gScore[next]) {
        cameFrom[next] = current;
        gScore[next] = tentativeG;
        fScore[next] = tentativeG + Math.hypot(goal.x - nextPos.x, goal.y - nextPos.y);
        if (!open.includes(next)) {
          open.push(next);
        }
      }
    }
  }

  return [goal];
}

/**
 * Returns all valid adjacent stand points for interacting with a station.
 * Center island stations (plating mats) expose multiple accessible sides so Chef Pip
 * always approaches from the closest reachable side instead of walking around the island.
 */
export function getStationCandidateStandPoints(station: StationState): NavPoint[] {
  if (station.row === 0) return [{ x: station.col + 0.5, y: 1.48 }];
  if (station.col === 0) return [{ x: 1.48, y: station.row + 0.5 }];
  if (station.col === NAV_GRID_COLS - 1) return [{ x: NAV_GRID_COLS - 1.48, y: station.row + 0.5 }];
  if (station.row === NAV_GRID_ROWS - 1) return [{ x: station.col + 0.5, y: NAV_GRID_ROWS - 1.48 }];

  // Interior station (e.g. center plating island at (4,3) and (5,3)):
  // test all 4 orthogonal neighbors and keep every unobstructed stand point.
  const cx = station.col + 0.5;
  const cy = station.row + 0.5;
  const rawCandidates: NavPoint[] = [
    { x: cx, y: cy - 1.0 },
    { x: cx, y: cy + 1.0 },
    { x: cx - 1.0, y: cy },
    { x: cx + 1.0, y: cy },
  ];

  const valid = rawCandidates.filter((p) => isPointWalkable(p.x, p.y, NAV_CLEARANCE));
  return valid.length > 0 ? valid : [{ x: cx, y: 2.5 }];
}

/**
 * Picks the shortest A* path from `start` to any of the provided candidate destinations.
 */
export function findShortestPathToAny(
  start: NavPoint,
  candidates: readonly NavPoint[],
  clearance: number = NAV_CLEARANCE,
  obstacles: readonly ObstacleRect[] = KITCHEN_OBSTACLES,
): NavPoint[] {
  let bestPath: NavPoint[] = [];
  let bestLen = Infinity;

  for (const cand of candidates) {
    const path = findNavPath(start, cand, clearance, obstacles);
    const len = pathLength(start, path);
    if (len < bestLen) {
      bestLen = len;
      bestPath = path;
    }
  }
  return bestPath;
}

/**
 * Sokoban Solver - main.ts
 * Competition: sokoban-solver-01-run-20261121
 * Erasable TypeScript syntax, Node 22 standard library only.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface Point {
  r: number;
  c: number;
}

interface Room {
  id: number;
  door: Point;
  hallwayConn: Point;
  cells: Set<string>; // 'r,c'
  walls: Set<string>;
  goals: Set<string>;
  initialBoxes: Point[];
  initialPlayer: Point;
}

interface Level {
  width: number;
  height: number;
  grid: string[][];
  walls: Set<string>;
  goals: Set<string>;
  initialBoxes: Point[];
  initialPlayer: Point;
  hallwayRow: number;
  hallwayCols: Set<number>;
  rooms: Room[];
}

const DIRS: { [key: string]: { dr: number; dc: number; char: string } } = {
  u: { dr: -1, dc: 0, char: 'u' },
  d: { dr: 1, dc: 0, char: 'd' },
  l: { dr: 0, dc: -1, char: 'l' },
  r: { dr: 0, dc: 1, char: 'r' },
};

function pointKey(p: Point): string {
  return `${p.r},${p.c}`;
}

function parsePoint(key: string): Point {
  const parts = key.split(',');
  return { r: parseInt(parts[0], 10), c: parseInt(parts[1], 10) };
}

function sortBoxes(boxes: Point[]): Point[] {
  return [...boxes].sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));
}

function boxesKey(boxes: Point[]): string {
  return sortBoxes(boxes)
    .map((b) => `${b.r},${b.c}`)
    .join(';');
}

function parseLevel(content: string): Level {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  const height = lines.length;
  let width = 0;
  for (const line of lines) {
    if (line.length > width) width = line.length;
  }

  const grid: string[][] = [];
  const walls = new Set<string>();
  const goals = new Set<string>();
  const initialBoxes: Point[] = [];
  let initialPlayer: Point | null = null;

  for (let r = 0; r < height; r++) {
    const rowChars: string[] = [];
    const line = lines[r] || '';
    for (let c = 0; c < width; c++) {
      const ch = c < line.length ? line[c] : ' ';
      rowChars.push(ch);
      const key = `${r},${c}`;
      if (ch === '#') {
        walls.add(key);
      } else if (ch === '.') {
        goals.add(key);
      } else if (ch === '$') {
        initialBoxes.push({ r, c });
      } else if (ch === '*') {
        goals.add(key);
        initialBoxes.push({ r, c });
      } else if (ch === '@') {
        initialPlayer = { r, c };
      } else if (ch === '+') {
        goals.add(key);
        initialPlayer = { r, c };
      }
    }
    grid.push(rowChars);
  }

  if (!initialPlayer) {
    throw new Error('Player start @ not found in level');
  }

  const hallwayRow = initialPlayer.r;
  const hallwayCols = new Set<number>();

  // Find connected hallway squares on hallwayRow starting from player
  const q: number[] = [initialPlayer.c];
  const visitedHallway = new Set<number>([initialPlayer.c]);
  hallwayCols.add(initialPlayer.c);

  while (q.length > 0) {
    const c = q.shift()!;
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (nc >= 0 && nc < width && !visitedHallway.has(nc)) {
        const key = `${hallwayRow},${nc}`;
        if (!walls.has(key)) {
          visitedHallway.add(nc);
          hallwayCols.add(nc);
          q.push(nc);
        }
      }
    }
  }

  // Find doors and rooms
  const doors: { door: Point; conn: Point; col: number }[] = [];
  for (const c of hallwayCols) {
    for (const dr of [-1, 1]) {
      const rr = hallwayRow + dr;
      const key = `${rr},${c}`;
      if (rr >= 0 && rr < height && !walls.has(key)) {
        // Check if this cell is not on hallwayRow and leads into a room
        doors.push({ door: { r: rr, c }, conn: { r: hallwayRow, c }, col: c });
      }
    }
  }

  doors.sort((a, b) => a.col - b.col);

  const rooms: Room[] = [];
  let roomId = 0;

  for (const dInfo of doors) {
    const door = dInfo.door;
    const roomCells = new Set<string>();
    const roomWalls = new Set<string>();
    const roomGoals = new Set<string>();
    const roomBoxes: Point[] = [];

    // Flood fill from door without crossing hallwayRow
    const rQueue: Point[] = [door];
    const rVisited = new Set<string>([pointKey(door)]);
    roomCells.add(pointKey(door));

    while (rQueue.length > 0) {
      const curr = rQueue.shift()!;
      for (const d of Object.values(DIRS)) {
        const nr = curr.r + d.dr;
        const nc = curr.c + d.dc;
        if (nr === hallwayRow) continue; // never step onto hallway row
        if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
        const nKey = `${nr},${nc}`;
        if (walls.has(nKey)) {
          roomWalls.add(nKey);
          continue;
        }
        if (!rVisited.has(nKey)) {
          rVisited.add(nKey);
          roomCells.add(nKey);
          rQueue.push({ r: nr, c: nc });
        }
      }
    }

    // Identify walls surrounding room cells
    for (const cellKey of roomCells) {
      const { r, c } = parsePoint(cellKey);
      if (goals.has(cellKey)) {
        roomGoals.add(cellKey);
      }
      for (const d of Object.values(DIRS)) {
        const nr = r + d.dr;
        const nc = c + d.dc;
        const nKey = `${nr},${nc}`;
        if (nr === hallwayRow || walls.has(nKey) || (!roomCells.has(nKey) && nr >= 0 && nr < height && nc >= 0 && nc < width)) {
          roomWalls.add(nKey);
        }
      }
    }

    // Find boxes initially in this room
    for (const b of initialBoxes) {
      if (roomCells.has(pointKey(b))) {
        roomBoxes.push(b);
      }
    }

    rooms.push({
      id: roomId++,
      door,
      hallwayConn: dInfo.conn,
      cells: roomCells,
      walls: roomWalls,
      goals: roomGoals,
      initialBoxes: roomBoxes,
      initialPlayer: door,
    });
  }

  return {
    width,
    height,
    grid,
    walls,
    goals,
    initialBoxes,
    initialPlayer,
    hallwayRow,
    hallwayCols,
    rooms,
  };
}

// Shortest path / reachability BFS
function getReachableFloor(
  start: Point,
  boxes: Set<string>,
  validCells: Set<string>,
  walls: Set<string>
): Set<string> {
  const reachable = new Set<string>();
  const startKey = pointKey(start);
  if (!validCells.has(startKey) && startKey !== pointKey(start)) return reachable; // if validCells doesn't include start but start is valid

  const q: Point[] = [start];
  reachable.add(startKey);

  while (q.length > 0) {
    const curr = q.shift()!;
    for (const d of Object.values(DIRS)) {
      const nr = curr.r + d.dr;
      const nc = curr.c + d.dc;
      const nKey = `${nr},${nc}`;
      if (validCells.has(nKey) && !walls.has(nKey) && !boxes.has(nKey) && !reachable.has(nKey)) {
        reachable.add(nKey);
        q.push({ r: nr, c: nc });
      }
    }
  }
  return reachable;
}

function findShortestPath(
  start: Point,
  target: Point,
  obstacles: Set<string>,
  validCells: Set<string>,
  walls: Set<string>
): string[] | null {
  if (start.r === target.r && start.c === target.c) return [];
  const startKey = pointKey(start);
  const targetKey = pointKey(target);

  const q: Point[] = [start];
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, { prev: string; move: string }>();

  while (q.length > 0) {
    const curr = q.shift()!;
    const currKey = pointKey(curr);
    if (currKey === targetKey) {
      // reconstruct path
      const path: string[] = [];
      let cKey = targetKey;
      while (cKey !== startKey) {
        const pInfo = parent.get(cKey)!;
        path.unshift(pInfo.move);
        cKey = pInfo.prev;
      }
      return path;
    }

    for (const [mName, d] of Object.entries(DIRS)) {
      const nr = curr.r + d.dr;
      const nc = curr.c + d.dc;
      const nKey = `${nr},${nc}`;
      if ((validCells.has(nKey) || nKey === targetKey) && !walls.has(nKey) && !obstacles.has(nKey) && !visited.has(nKey)) {
        visited.add(nKey);
        parent.set(nKey, { prev: currKey, move: mName });
        q.push({ r: nr, c: nc });
      }
    }
  }
  return null;
}

// Box-only shortest path for heuristic and unreachable goal check
function getBoxShortestPathDistance(
  from: Point,
  to: Point,
  cells: Set<string>,
  walls: Set<string>
): number {
  if (from.r === to.r && from.c === to.c) return 0;
  const startKey = pointKey(from);
  const targetKey = pointKey(to);

  const q: { p: Point; dist: number }[] = [{ p: from, dist: 0 }];
  const visited = new Set<string>([startKey]);

  while (q.length > 0) {
    const { p, dist } = q.shift()!;
    if (pointKey(p) === targetKey) return dist;

    for (const d of Object.values(DIRS)) {
      const nr = p.r + d.dr;
      const nc = p.c + d.dc;
      const nKey = `${nr},${nc}`;
      if (cells.has(nKey) && !walls.has(nKey) && !visited.has(nKey)) {
        visited.add(nKey);
        q.push({ p: { r: nr, c: nc }, dist: dist + 1 });
      }
    }
  }
  return Infinity;
}

// Precompute box-to-goal shortest path matrix for a room
function computeBoxGoalDistances(room: Room): number[][] {
  const boxes = room.initialBoxes;
  const goals = Array.from(room.goals).map(parsePoint);
  const matrix: number[][] = [];

  for (const b of boxes) {
    const rowDists: number[] = [];
    for (const g of goals) {
      rowDists.push(getBoxShortestPathDistance(b, g, room.cells, room.walls));
    }
    matrix.push(rowDists);
  }
  return matrix;
}

// Min assignment heuristic (all permutations for N <= 4)
function computeHeuristic(boxes: Point[], goals: Point[], distMatrixCache: Map<string, number>, roomCells: Set<string>, roomWalls: Set<string>): number {
  const n = boxes.length;
  if (n === 0) return 0;

  // Compute exact distances from current box positions to goals
  const matrix: number[][] = [];
  for (const b of boxes) {
    const rowDists: number[] = [];
    for (const g of goals) {
      rowDists.push(getBoxShortestPathDistance(b, g, roomCells, roomWalls));
    }
    matrix.push(rowDists);
  }

  if (n === 1) return matrix[0][0];
  if (n === 2) {
    return Math.min(
      matrix[0][0] + matrix[1][1],
      matrix[0][1] + matrix[1][0]
    );
  }
  if (n === 3) {
    return Math.min(
      matrix[0][0] + matrix[1][1] + matrix[2][2],
      matrix[0][0] + matrix[1][2] + matrix[2][1],
      matrix[0][1] + matrix[1][0] + matrix[2][2],
      matrix[0][1] + matrix[1][2] + matrix[2][0],
      matrix[0][2] + matrix[1][0] + matrix[2][1],
      matrix[0][2] + matrix[1][1] + matrix[2][0]
    );
  }
  if (n === 4) {
    // Permutations of 0,1,2,3
    const perms = [
      [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
      [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
      [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
      [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0],
    ];
    let minDist = Infinity;
    for (const p of perms) {
      const d = matrix[0][p[0]] + matrix[1][p[1]] + matrix[2][p[2]] + matrix[3][p[3]];
      if (d < minDist) minDist = d;
    }
    return minDist;
  }
  return 0;
}

// Deadlock checks. Walls are the level's REAL walls ('#' cells, or off the board):
// the open hallway row is never a wall, so a box on the door square (whose
// far side is the hallway) is not corner- or wall-run-deadlocked.
function isDeadlocked(boxes: Point[], goals: Set<string>, roomCells: Set<string>, levelWalls: Set<string>, height: number, width: number): boolean {
  const boxSet = new Set<string>(boxes.map(pointKey));
  const isWall = (key: string): boolean => {
    const p = parsePoint(key);
    return p.r < 0 || p.r >= height || p.c < 0 || p.c >= width || levelWalls.has(key);
  };

  for (const b of boxes) {
    const bKey = pointKey(b);
    if (goals.has(bKey)) continue;

    // 1. Unreachable goal check: can this box reach any goal?
    let canReachGoal = false;
    for (const gKey of goals) {
      const g = parsePoint(gKey);
      if (getBoxShortestPathDistance(b, g, roomCells, levelWalls) !== Infinity) {
        canReachGoal = true;
        break;
      }
    }
    if (!canReachGoal) return true;

    // 2. Corner deadlock: perpendicular walls
    const upWall = isWall(`${b.r - 1},${b.c}`);
    const downWall = isWall(`${b.r + 1},${b.c}`);
    const leftWall = isWall(`${b.r},${b.c - 1}`);
    const rightWall = isWall(`${b.r},${b.c + 1}`);

    if ((upWall || downWall) && (leftWall || rightWall)) {
      return true;
    }

    // 3. Wall-run deadlock: a box beside a wall can only move along the wall
    // while the wall stays beside it. It is stuck only when the whole maximal
    // run of wall-adjacent squares holds no goal AND the run is closed at
    // BOTH ends (the square past each end is a wall or leaves the room), so
    // the box can never step off the wall. If either end is open — the wall
    // ends there and the next square is open floor — the box can be pushed
    // out of the run and is not deadlocked.
    if (upWall || downWall) {
      let hasGoalInRun = false;
      let leftBlocked = false;
      let rightBlocked = false;
      for (let cc = b.c - 1; ; cc--) {
        const key = `${b.r},${cc}`;
        if (!roomCells.has(key) || isWall(key)) { leftBlocked = true; break; }
        if (goals.has(key)) { hasGoalInRun = true; break; }
        const wKey = upWall ? `${b.r - 1},${cc}` : `${b.r + 1},${cc}`;
        if (!isWall(wKey)) break;
      }
      for (let cc = b.c + 1; ; cc++) {
        const key = `${b.r},${cc}`;
        if (!roomCells.has(key) || isWall(key)) { rightBlocked = true; break; }
        if (goals.has(key)) { hasGoalInRun = true; break; }
        const wKey = upWall ? `${b.r - 1},${cc}` : `${b.r + 1},${cc}`;
        if (!isWall(wKey)) break;
      }
      if (!hasGoalInRun && leftBlocked && rightBlocked) return true;
    }

    if (leftWall || rightWall) {
      let hasGoalInRun = false;
      let upBlocked = false;
      let downBlocked = false;
      for (let rr = b.r - 1; ; rr--) {
        const key = `${rr},${b.c}`;
        if (!roomCells.has(key) || isWall(key)) { upBlocked = true; break; }
        if (goals.has(key)) { hasGoalInRun = true; break; }
        const wKey = leftWall ? `${rr},${b.c - 1}` : `${rr},${b.c + 1}`;
        if (!isWall(wKey)) break;
      }
      for (let rr = b.r + 1; ; rr++) {
        const key = `${rr},${b.c}`;
        if (!roomCells.has(key) || isWall(key)) { downBlocked = true; break; }
        if (goals.has(key)) { hasGoalInRun = true; break; }
        const wKey = leftWall ? `${rr},${b.c - 1}` : `${rr},${b.c + 1}`;
        if (!isWall(wKey)) break;
      }
      if (!hasGoalInRun && upBlocked && downBlocked) return true;
    }
  }

  // 4. Two-by-two block deadlock
  for (const cellKey of roomCells) {
    const { r, c } = parsePoint(cellKey);
    const sqs = [
      { r, c },
      { r: r + 1, c },
      { r, c: c + 1 },
      { r: r + 1, c: c + 1 },
    ];
    let allInRoomOrWall = true;
    let hasBox = false;
    let hasGoal = false;
    for (const sq of sqs) {
      const sk = pointKey(sq);
      if (!roomCells.has(sk) && !isWall(sk)) { allInRoomOrWall = false; break; }
      if (boxSet.has(sk)) hasBox = true;
      if (goals.has(sk)) hasGoal = true;
    }
    if (allInRoomOrWall && hasBox && !hasGoal) {
      let blockedCount = 0;
      for (const sq of sqs) {
        const sk = pointKey(sq);
        if (isWall(sk) || boxSet.has(sk)) blockedCount++;
      }
      if (blockedCount === 4) return true;
    }
  }

  return false;
}

interface SearchNode {
  player: Point;
  boxes: Point[];
  g: number;
  h: number;
  f: number;
  // Canonical state key: canonical player square + sorted box squares.
  key: string;
  // Each push records the pushed box's square BEFORE the push, plus the
  // direction: the stitching replays pushes by box square, not by direction
  // alone, because the box in front of the player is not always the next one.
  moves: { boxPos: Point; pushDir: string }[];
}

// Deterministic binary-heap priority queue over SearchNodes, ordered by
// (f, g, key): lowest f first, then fewest pushes, then the canonical key.
function nodeLess(a: SearchNode, b: SearchNode): boolean {
  if (a.f !== b.f) return a.f < b.f;
  if (a.g !== b.g) return a.g < b.g;
  return a.key < b.key;
}

function heapPush(heap: SearchNode[], node: SearchNode): void {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!nodeLess(heap[i], heap[parent])) break;
    heap[i] = heap[parent];
    heap[parent] = node;
    i = parent;
  }
}

function heapPop(heap: SearchNode[]): SearchNode {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < heap.length && nodeLess(heap[left], heap[smallest])) smallest = left;
      if (right < heap.length && nodeLess(heap[right], heap[smallest])) smallest = right;
      if (smallest === i) break;
      const tmp = heap[i];
      heap[i] = heap[smallest];
      heap[smallest] = tmp;
      i = smallest;
    }
  }
  return top;
}

// The player's exact square only matters through which squares it can reach:
// all squares in the same reachable region are equivalent for pushing. The
// canonical player square is the lexicographically smallest square of the
// reachable region, so states that differ only by where the player stands
// inside one region collapse to a single search state.
function canonicalPlayer(player: Point, boxes: Point[], cells: Set<string>, walls: Set<string>): Point {
  const boxSet = new Set<string>(boxes.map(pointKey));
  const reach = getReachableFloor(player, boxSet, cells, walls);
  let best: string | null = null;
  for (const k of reach) {
    if (best === null || k < best) best = k;
  }
  return best === null ? player : parsePoint(best);
}

function solveRoom(room: Room, level: Level, expansionCap: number, useHeuristic: boolean): { pushes: { box: Point; dir: string }[]; success: boolean } {
  const goalsArray = Array.from(room.goals).map(parsePoint);
  const distCache = new Map<string, number>();

  // The search starts with the player on the hallway square in front of the
  // door, not on the door itself: a box may start on the door square, and
  // only from the hallway can it be pushed up into the room. The search's
  // walkable set is the room cells plus that hallway square.
  const searchCells = new Set<string>(room.cells);
  searchCells.add(pointKey(room.hallwayConn));

  const initBoxes = sortBoxes(room.initialBoxes);
  const initH = useHeuristic ? computeHeuristic(initBoxes, goalsArray, distCache, room.cells, level.walls) : 0;

  const startPlayer = canonicalPlayer(room.hallwayConn, initBoxes, searchCells, level.walls);
  const startNode: SearchNode = {
    player: startPlayer,
    boxes: initBoxes,
    g: 0,
    h: initH,
    f: initH,
    key: `${pointKey(startPlayer)}|${boxesKey(initBoxes)}`,
    moves: [],
  };

  // Binary-heap open queue with deterministic (f, g, key) ordering, so
  // repeated runs expand states in the same order and produce the same
  // solution.
  const open: SearchNode[] = [startNode];
  const closed = new Set<string>();

  let expansions = 0;

  while (open.length > 0) {
    const curr = heapPop(open);
    expansions++;
    if (expansions > expansionCap) {
      return { pushes: [], success: false };
    }

    const stateKey = curr.key;
    if (closed.has(stateKey)) continue;
    closed.add(stateKey);

    // Goal test: all boxes on goals AND player can reach door
    let allOnGoals = true;
    for (const b of curr.boxes) {
      if (!room.goals.has(pointKey(b))) {
        allOnGoals = false;
        break;
      }
    }

    if (allOnGoals) {
      // Check if player can reach door from here
      const boxSet = new Set<string>(curr.boxes.map(pointKey));
      const reachable = getReachableFloor(curr.player, boxSet, searchCells, level.walls);
      if (reachable.has(pointKey(room.door))) {
        // Reconstruct the push sequence (box square + direction per push)
        const pushes: { box: Point; dir: string }[] = [];
        for (const m of curr.moves) {
          pushes.push({ box: { ...m.boxPos }, dir: m.pushDir });
        }
        return { pushes, success: true };
      }
    }

    // Generate successor states (pushes)
    const boxSet = new Set<string>(curr.boxes.map(pointKey));
    const reachableFloor = getReachableFloor(curr.player, boxSet, searchCells, level.walls);

    for (let i = 0; i < curr.boxes.length; i++) {
      const b = curr.boxes[i];
      for (const [dirName, d] of Object.entries(DIRS)) {
        // Square behind box
        const behindR = b.r - d.dr;
        const behindC = b.c - d.dc;
        const behindKey = `${behindR},${behindC}`;

        if (!reachableFloor.has(behindKey)) continue;

        // Square beyond box
        const beyondR = b.r + d.dr;
        const beyondC = b.c + d.dc;
        const beyondKey = `${beyondR},${beyondC}`;

        if (level.walls.has(beyondKey) || boxSet.has(beyondKey) || !room.cells.has(beyondKey)) continue;

        // Valid push!
        const newBoxes = [...curr.boxes];
        newBoxes[i] = { r: beyondR, c: beyondC };
        const sortedNewBoxes = sortBoxes(newBoxes);

        // Check deadlock on new boxes
        if (isDeadlocked(sortedNewBoxes, room.goals, room.cells, level.walls, level.height, level.width)) continue;

        // The player steps into the box's old square; canonicalise it to the
        // reachable region's representative square for state identity.
        const newPlayer = canonicalPlayer(b, sortedNewBoxes, searchCells, level.walls);
        const newBoxS = boxesKey(sortedNewBoxes);
        const newStateKey = `${pointKey(newPlayer)}|${newBoxS}`;
        if (closed.has(newStateKey)) continue;

        const newG = curr.g + 1;
        const newH = useHeuristic ? computeHeuristic(sortedNewBoxes, goalsArray, distCache, room.cells, level.walls) : 0;
        const newF = newG + newH;

        const newMoveList = [...curr.moves, { boxPos: { ...b }, pushDir: dirName }];

        heapPush(open, {
          player: newPlayer,
          boxes: sortedNewBoxes,
          g: newG,
          h: newH,
          f: newF,
          key: newStateKey,
          moves: newMoveList,
        });
      }
    }
  }

  return { pushes: [], success: false };
}

// Stitching room solutions into full level move string
function solveLevel(level: Level): string {
  let player = { ...level.initialPlayer };
  let boxes = level.initialBoxes.map((b) => ({ ...b }));
  const fullMoves: string[] = [];

  for (const room of level.rooms) {
    if (room.initialBoxes.length === 0) continue;

    // 1. Walk along hallway to square in front of room's door
    const targetHallwaySquare = room.hallwayConn;
    const currentBoxKeys = new Set<string>(boxes.map(pointKey));

    // To find walk path along hallway or floor
    const validHallwayAndRoomCells = new Set<string>();
    for (const c of level.hallwayCols) validHallwayAndRoomCells.add(`${level.hallwayRow},${c}`);
    for (const rc of room.cells) validHallwayAndRoomCells.add(rc);
    validHallwayAndRoomCells.add(pointKey(room.door));

    const walkToDoor = findShortestPath(player, targetHallwaySquare, currentBoxKeys, validHallwayAndRoomCells, level.walls);
    if (!walkToDoor) return '';
    fullMoves.push(...walkToDoor);
    player = { ...targetHallwaySquare };

    // 2. The room solution starts with the player on the hallway square in
    // front of the door (room.hallwayConn): do NOT step into the door first,
    // a box may be sitting on the door square. The player is already there
    // after step 1.
    const roomSearchCells = new Set<string>(room.cells);
    roomSearchCells.add(pointKey(room.hallwayConn));

    // 3. Solve room push-optimally
    // Try with heuristic first, cap 300,000
    let roomResult = solveRoom(room, level, 300000, true);
    if (!roomResult.success) {
      // Retry with uniform-cost search, cap 500,000
      roomResult = solveRoom(room, level, 500000, false);
    }
    if (!roomResult.success) {
      return ''; // fallback to empty solution
    }

    // Execute room push sequence and reconstruct walking moves
    for (const push of roomResult.pushes) {
      const d = DIRS[push.dir];
      // Find the box this push moves, by its square before the push
      const bIdx = boxes.findIndex((b) => b.r === push.box.r && b.c === push.box.c);
      if (bIdx === -1) return '';

      const boxPos = boxes[bIdx];
      const behindBox = { r: boxPos.r - d.dr, c: boxPos.c - d.dc };

      // Walk player to behindBox (walks may go through the door and the
      // hallway square in front of it, e.g. to push a box off the door)
      const boxSet = new Set<string>(boxes.map(pointKey));
      const walkToBehind = findShortestPath(player, behindBox, boxSet, roomSearchCells, level.walls);
      if (!walkToBehind) return '';
      fullMoves.push(...walkToBehind);
      player = { ...behindBox };

      // Push box
      fullMoves.push(push.dir);
      boxes[bIdx] = { r: boxPos.r + d.dr, c: boxPos.c + d.dc };
      player = { ...boxPos };
    }

    // 4. Walk back from player position to room door
    const finalBoxSet = new Set<string>(boxes.map(pointKey));
    const walkBackToDoor = findShortestPath(player, room.door, finalBoxSet, roomSearchCells, level.walls);
    if (!walkBackToDoor) return '';
    fullMoves.push(...walkBackToDoor);
    player = { ...room.door };

    // 5. Step back onto hallway
    const stepOutDir = getDirBetween(player, room.hallwayConn);
    if (!stepOutDir) return '';
    fullMoves.push(stepOutDir);
    player = { ...room.hallwayConn };
  }

  const moveStr = fullMoves.join('');

  // Internal replay verification
  if (!verifyReplay(level, moveStr)) {
    return '';
  }

  return moveStr;
}

function getDirBetween(from: Point, to: Point): string | null {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  for (const [name, d] of Object.entries(DIRS)) {
    if (d.dr === dr && d.dc === dc) return name;
  }
  return null;
}

// Internal Replay Verifier
function verifyReplay(level: Level, moveStr: string): boolean {
  let player = { ...level.initialPlayer };
  let boxes = level.initialBoxes.map((b) => ({ ...b }));
  const walls = level.walls;

  for (const ch of moveStr.toLowerCase()) {
    const d = DIRS[ch];
    if (!d) return false;

    const nr = player.r + d.dr;
    const nc = player.c + d.dc;
    const nKey = `${nr},${nc}`;

    if (walls.has(nKey)) return false;

    const bIdx = boxes.findIndex((b) => b.r === nr && b.c === nc);
    if (bIdx !== -1) {
      // Push box
      const nnr = nr + d.dr;
      const nnc = nc + d.dc;
      const nnKey = `${nnr},${nnc}`;

      if (walls.has(nnKey) || boxes.some((b) => b.r === nnr && b.c === nnc)) {
        return false;
      }
      boxes[bIdx] = { r: nnr, c: nnc };
      player = { r: nr, c: nc };
    } else {
      player = { r: nr, c: nc };
    }
  }

  // Check all boxes on goals
  for (const b of boxes) {
    if (!level.goals.has(pointKey(b))) {
      return false;
    }
  }

  return true;
}

// Main execution
function main() {
  const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory does not exist: ${inputDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const id = entry.name;
      const levelPath = path.join(inputDir, id, 'level.txt');
      if (fs.existsSync(levelPath)) {
        const levelContent = fs.readFileSync(levelPath, 'utf8');
        try {
          const level = parseLevel(levelContent);
          const solution = solveLevel(level);

          const outInstanceDir = path.join(outputDir, id);
          fs.mkdirSync(outInstanceDir, { recursive: true });
          const solutionPath = path.join(outInstanceDir, 'solution.txt');
          fs.writeFileSync(solutionPath, solution, 'utf8');
        } catch (err) {
          console.error(`Error solving instance ${id}:`, err);
          const outInstanceDir = path.join(outputDir, id);
          fs.mkdirSync(outInstanceDir, { recursive: true });
          fs.writeFileSync(path.join(outInstanceDir, 'solution.txt'), '', 'utf8');
        }
      }
    }
  }
}

main();

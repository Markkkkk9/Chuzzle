// Chuzzle rules engine. Pure logic, no DOM. Coordinates: x right, y down (y = 0 is the top row).

export const PIECE_TYPES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

const KNIGHT_JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const ORTHOGONAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export function buildState(level, placements = []) {
  return {
    width: level.width,
    height: level.height,
    moveLimit: level.moveLimit,
    player: { type: level.player.type, x: level.player.x, y: level.player.y, moved: false },
    enemies: level.enemies.map((e) => ({ ...e })),
    helpers: placements.map((p) => ({ ...p })),
    movesUsed: 0,
    status: 'playing',
  };
}

export function pieceAt(state, x, y) {
  const enemy = state.enemies.find((e) => e.x === x && e.y === y);
  if (enemy) return { kind: 'enemy', piece: enemy };
  const helper = state.helpers.find((h) => h.x === x && h.y === y);
  if (helper) return { kind: 'helper', piece: helper };
  return null;
}

export function legalMoves(state) {
  if (state.status !== 'playing' || state.movesUsed >= state.moveLimit) return [];
  const { x, y, type, moved } = state.player;
  const moves = [];
  const inBounds = (cx, cy) => cx >= 0 && cy >= 0 && cx < state.width && cy < state.height;

  const slide = (dirs) => {
    for (const [dx, dy] of dirs) {
      let cx = x + dx;
      let cy = y + dy;
      while (inBounds(cx, cy)) {
        moves.push({ x: cx, y: cy });
        if (pieceAt(state, cx, cy)) break;
        cx += dx;
        cy += dy;
      }
    }
  };

  const step = (offsets) => {
    for (const [dx, dy] of offsets) {
      const cx = x + dx;
      const cy = y + dy;
      if (inBounds(cx, cy)) moves.push({ x: cx, y: cy });
    }
  };

  switch (type) {
    case 'knight':
      step(KNIGHT_JUMPS);
      break;
    case 'king':
      step([...ORTHOGONAL, ...DIAGONAL]);
      break;
    case 'rook':
      slide(ORTHOGONAL);
      break;
    case 'bishop':
      slide(DIAGONAL);
      break;
    case 'queen':
      slide([...ORTHOGONAL, ...DIAGONAL]);
      break;
    case 'pawn': {
      // Pawns move up the board (towards y = 0).
      const oneY = y - 1;
      if (inBounds(x, oneY)) {
        const one = pieceAt(state, x, oneY);
        if (!one || one.kind === 'helper') moves.push({ x, y: oneY });
        const twoY = y - 2;
        if (!moved && !one && inBounds(x, twoY)) {
          const two = pieceAt(state, x, twoY);
          if (!two || two.kind === 'helper') moves.push({ x, y: twoY });
        }
      }
      for (const dx of [-1, 1]) {
        const cx = x + dx;
        if (inBounds(cx, oneY)) {
          const target = pieceAt(state, cx, oneY);
          if (target && target.kind === 'enemy') moves.push({ x: cx, y: oneY });
        }
      }
      break;
    }
    default:
      throw new Error(`Unknown piece type: ${type}`);
  }
  return moves;
}

export function applyMove(state, x, y) {
  if (!legalMoves(state).some((m) => m.x === x && m.y === y)) return null;

  const next = {
    ...state,
    player: { ...state.player },
    enemies: state.enemies.map((e) => ({ ...e })),
    helpers: state.helpers.map((h) => ({ ...h })),
  };
  const event = { x, y, captured: null, transformed: null, won: false };

  next.player.x = x;
  next.player.y = y;
  next.player.moved = true;
  next.movesUsed += 1;

  const enemyIndex = next.enemies.findIndex((e) => e.x === x && e.y === y);
  if (enemyIndex !== -1) {
    event.captured = next.enemies[enemyIndex].type;
    next.enemies.splice(enemyIndex, 1);
    if (event.captured === 'king') {
      next.status = 'won';
      event.won = true;
    }
  }

  const helperIndex = next.helpers.findIndex((h) => h.x === x && h.y === y);
  if (helperIndex !== -1) {
    event.transformed = next.helpers[helperIndex].type;
    next.player.type = event.transformed;
    next.player.moved = false;
    next.helpers.splice(helperIndex, 1);
  }

  return { state: next, event };
}

export function simulateRoute(level, placements, route) {
  let state = buildState(level, placements);
  const states = [state];
  const events = [];
  for (const step of route) {
    const result = applyMove(state, step.x, step.y);
    if (!result) break;
    state = result.state;
    states.push(state);
    events.push(result.event);
  }
  return { states, events, validCount: states.length - 1, finalState: state };
}

export function canPlace(level, placements, x, y, ignoreIndex = -1) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return false;
  if (level.player.x === x && level.player.y === y) return false;
  if (level.enemies.some((e) => e.x === x && e.y === y)) return false;
  return !placements.some((p, i) => i !== ignoreIndex && p.x === x && p.y === y);
}

export function trayRemaining(level, placements) {
  const remaining = [...level.tray];
  for (const p of placements) {
    const i = remaining.indexOf(p.type);
    if (i !== -1) remaining.splice(i, 1);
  }
  return remaining;
}

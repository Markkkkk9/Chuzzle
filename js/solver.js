import { buildState, legalMoves, applyMove, canPlace } from './engine.js';

function stateKey(state) {
  const { x, y, type, moved } = state.player;
  const pieces = (list) => list.map((p) => `${p.type}${p.x},${p.y}`).sort().join(';');
  return `${type}${x},${y}${moved ? 'm' : ''}|${state.movesUsed}|${pieces(state.enemies)}|${pieces(state.helpers)}`;
}

function findRoute(state, route, seen) {
  if (state.status === 'won') return route;
  const key = stateKey(state);
  if (seen.has(key)) return null;
  seen.add(key);
  for (const move of legalMoves(state)) {
    const result = applyMove(state, move.x, move.y);
    const found = findRoute(result.state, [...route, { x: move.x, y: move.y }], seen);
    if (found) return found;
  }
  return null;
}

export function solveWithPlacements(level, placements) {
  return findRoute(buildState(level, placements), [], new Set());
}

// Shortest winning route length for a placement, or null.
export function shortestRoute(level, placements) {
  let frontier = [{ state: buildState(level, placements), route: [] }];
  const seen = new Set();
  while (frontier.length) {
    const next = [];
    for (const { state, route } of frontier) {
      if (state.status === 'won') return route;
      const key = stateKey(state);
      if (seen.has(key)) continue;
      seen.add(key);
      for (const move of legalMoves(state)) {
        const result = applyMove(state, move.x, move.y);
        next.push({ state: result.state, route: [...route, { x: move.x, y: move.y }] });
      }
    }
    frontier = next;
  }
  return null;
}

// Tries every way of placing the tray on empty cells. Helpers may be left unused.
export function solve(level, tray = level.tray) {
  function place(index, placements) {
    if (index === tray.length) {
      const route = solveWithPlacements(level, placements);
      return route ? { placements, route } : null;
    }
    const skipped = place(index + 1, placements);
    if (skipped) return skipped;
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (!canPlace(level, placements, x, y)) continue;
        const found = place(index + 1, [...placements, { type: tray[index], x, y }]);
        if (found) return found;
      }
    }
    return null;
  }
  return place(0, []);
}

// Counts placements of the whole tray that can win, and the total number of placements.
export function countSolutions(level, tray = level.tray) {
  let wins = 0;
  let total = 0;
  const winning = [];
  function place(index, placements) {
    if (index === tray.length) {
      total += 1;
      if (solveWithPlacements(level, placements)) {
        wins += 1;
        winning.push(placements);
      }
      return;
    }
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (canPlace(level, placements, x, y)) place(index + 1, [...placements, { type: tray[index], x, y }]);
      }
    }
  }
  place(0, []);
  return { wins, total, winning };
}

// Which tray pieces are actually needed in at least one winning placement of the full tray.
export function minimumHelpers(level) {
  let best = null;
  const { winning } = countSolutions(level);
  for (const placements of winning) {
    const route = shortestRoute(level, placements);
    const used = route ? route.length : Infinity;
    if (!best || used < best.length) best = { placements, length: used };
  }
  return best;
}

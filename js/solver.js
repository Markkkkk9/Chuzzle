import { buildState, legalMoves, applyMove, canPlace } from './engine.js';

function findRoute(state, route) {
  if (state.status === 'won') return route;
  for (const move of legalMoves(state)) {
    const result = applyMove(state, move.x, move.y);
    const found = findRoute(result.state, [...route, { x: move.x, y: move.y }]);
    if (found) return found;
  }
  return null;
}

export function solveWithPlacements(level, placements) {
  return findRoute(buildState(level, placements), []);
}

// Tries every way of placing any subset of the tray (distinct types only once per slot) on empty cells.
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

export function countSolutions(level, tray = level.tray) {
  let count = 0;
  function place(index, placements) {
    if (index === tray.length) {
      if (solveWithPlacements(level, placements)) count += 1;
      return;
    }
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (canPlace(level, placements, x, y)) place(index + 1, [...placements, { type: tray[index], x, y }]);
      }
    }
  }
  place(0, []);
  return count;
}

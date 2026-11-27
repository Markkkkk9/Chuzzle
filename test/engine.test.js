import test from 'node:test';
import assert from 'node:assert/strict';
import { buildState, legalMoves, applyMove, simulateRoute, canPlace, trayRemaining } from '../js/engine.js';
import { solve, solveWithPlacements, countSolutions } from '../js/solver.js';
import { LEVELS } from '../js/levels.js';

function makeLevel(overrides = {}) {
  return {
    name: 'test',
    width: 5,
    height: 5,
    moveLimit: 5,
    player: { type: 'rook', x: 2, y: 2 },
    enemies: [{ type: 'king', x: 4, y: 0 }],
    tray: [],
    ...overrides,
  };
}

const key = (moves) => moves.map((m) => `${m.x},${m.y}`).sort();

test('knight in the centre has 8 moves, in a corner has 2', () => {
  const centre = buildState(makeLevel({ player: { type: 'knight', x: 2, y: 2 } }));
  assert.equal(legalMoves(centre).length, 8);
  const corner = buildState(makeLevel({ player: { type: 'knight', x: 0, y: 4 } }));
  assert.deepEqual(key(legalMoves(corner)), ['1,2', '2,3']);
});

test('knight jumps over pieces', () => {
  const level = makeLevel({
    player: { type: 'knight', x: 0, y: 4 },
    enemies: [{ type: 'king', x: 4, y: 0 }, { type: 'pawn', x: 0, y: 3 }, { type: 'pawn', x: 1, y: 4 }],
  });
  assert.deepEqual(key(legalMoves(buildState(level))), ['1,2', '2,3']);
});

test('king moves one cell in any direction', () => {
  const state = buildState(makeLevel({ player: { type: 'king', x: 2, y: 2 }, enemies: [{ type: 'king', x: 4, y: 4 }] }));
  assert.equal(legalMoves(state).length, 8);
  const corner = buildState(makeLevel({ player: { type: 'king', x: 0, y: 0 }, enemies: [{ type: 'king', x: 4, y: 4 }] }));
  assert.equal(legalMoves(corner).length, 3);
});

test('rook slides along lines on an empty board', () => {
  const state = buildState(makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }] }));
  assert.equal(legalMoves(state).length, 8);
});

test('rook is blocked by an enemy: can capture it but not pass', () => {
  const state = buildState(makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }, { type: 'pawn', x: 2, y: 0 }] }));
  const moves = key(legalMoves(state));
  assert.ok(moves.includes('2,0'));
  assert.ok(moves.includes('2,1'));
  const behind = buildState(makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }, { type: 'pawn', x: 2, y: 1 }] }));
  assert.ok(!key(legalMoves(behind)).includes('2,0'));
  assert.ok(key(legalMoves(behind)).includes('2,1'));
});

test('sliders are blocked by helpers but can land on them', () => {
  const state = buildState(makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }] }), [{ type: 'bishop', x: 2, y: 1 }]);
  const moves = key(legalMoves(state));
  assert.ok(moves.includes('2,1'));
  assert.ok(!moves.includes('2,0'));
});

test('bishop moves diagonally only', () => {
  const state = buildState(makeLevel({ player: { type: 'bishop', x: 2, y: 2 }, enemies: [{ type: 'king', x: 4, y: 0 }] }));
  const moves = key(legalMoves(state));
  assert.equal(moves.length, 8);
  assert.ok(moves.includes('0,0') && moves.includes('4,4') && moves.includes('4,0') && moves.includes('0,4'));
  assert.ok(!moves.includes('2,3'));
});

test('queen combines rook and bishop', () => {
  const state = buildState(makeLevel({ player: { type: 'queen', x: 2, y: 2 }, enemies: [{ type: 'king', x: 4, y: 0 }] }));
  assert.equal(legalMoves(state).length, 16);
});

test('pawn: two steps first, one step after', () => {
  const level = makeLevel({ player: { type: 'pawn', x: 0, y: 4 }, enemies: [{ type: 'king', x: 4, y: 0 }] });
  const start = buildState(level);
  assert.deepEqual(key(legalMoves(start)), ['0,2', '0,3']);
  const afterOne = applyMove(start, 0, 3).state;
  assert.deepEqual(key(legalMoves(afterOne)), ['0,2']);
});

test('pawn moves up only', () => {
  const state = buildState(makeLevel({ player: { type: 'pawn', x: 2, y: 0 }, enemies: [{ type: 'king', x: 4, y: 4 }] }));
  assert.deepEqual(legalMoves(state), []);
});

test('pawn captures diagonally but not straight ahead', () => {
  const level = makeLevel({
    player: { type: 'pawn', x: 2, y: 3 },
    enemies: [{ type: 'king', x: 4, y: 4 }, { type: 'knight', x: 2, y: 2 }, { type: 'rook', x: 3, y: 2 }],
  });
  assert.deepEqual(key(legalMoves(buildState(level))), ['3,2']);
});

test('pawn cannot move diagonally onto an empty cell', () => {
  const state = buildState(makeLevel({ player: { type: 'pawn', x: 2, y: 3 }, enemies: [{ type: 'king', x: 4, y: 4 }] }));
  assert.deepEqual(key(legalMoves(state)), ['2,1', '2,2']);
});

test('pawn cannot transform diagonally into a helper', () => {
  const state = buildState(
    makeLevel({ player: { type: 'pawn', x: 2, y: 3 }, enemies: [{ type: 'king', x: 4, y: 4 }] }),
    [{ type: 'rook', x: 3, y: 2 }],
  );
  assert.ok(!key(legalMoves(state)).includes('3,2'));
});

test('pawn can move straight forward onto a helper and transform', () => {
  const state = buildState(
    makeLevel({ player: { type: 'pawn', x: 2, y: 3 }, enemies: [{ type: 'king', x: 4, y: 4 }] }),
    [{ type: 'rook', x: 2, y: 2 }],
  );
  assert.ok(key(legalMoves(state)).includes('2,2'));
  const result = applyMove(state, 2, 2);
  assert.equal(result.state.player.type, 'rook');
});

test('pawn two-step: blocked by a piece in between, allowed onto a helper', () => {
  const level = makeLevel({ player: { type: 'pawn', x: 2, y: 4 }, enemies: [{ type: 'king', x: 4, y: 0 }, { type: 'knight', x: 2, y: 3 }] });
  assert.deepEqual(legalMoves(buildState(level)), []);
  const helperBetween = buildState(makeLevel({ player: { type: 'pawn', x: 2, y: 4 }, enemies: [{ type: 'king', x: 4, y: 0 }] }), [{ type: 'rook', x: 2, y: 3 }]);
  assert.ok(!key(legalMoves(helperBetween)).includes('2,2'));
  const helperLanding = buildState(makeLevel({ player: { type: 'pawn', x: 2, y: 4 }, enemies: [{ type: 'king', x: 4, y: 0 }] }), [{ type: 'rook', x: 2, y: 2 }]);
  assert.ok(key(legalMoves(helperLanding)).includes('2,2'));
});

test('landing on a helper transforms the player and uses the helper up', () => {
  const level = makeLevel({ player: { type: 'knight', x: 0, y: 4 } });
  const state = buildState(level, [{ type: 'rook', x: 1, y: 2 }]);
  const result = applyMove(state, 1, 2);
  assert.equal(result.state.player.type, 'rook');
  assert.equal(result.state.helpers.length, 0);
  assert.equal(result.state.movesUsed, 1);
  assert.equal(result.event.transformed, 'rook');
});

test('capturing a non-king enemy removes it and keeps the piece type', () => {
  const level = makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }, { type: 'bishop', x: 2, y: 0 }] });
  const result = applyMove(buildState(level), 2, 0);
  assert.equal(result.state.player.type, 'rook');
  assert.equal(result.state.enemies.length, 1);
  assert.equal(result.state.status, 'playing');
  assert.equal(result.event.captured, 'bishop');
});

test('capturing the king wins', () => {
  const level = makeLevel({ enemies: [{ type: 'king', x: 2, y: 0 }] });
  const result = applyMove(buildState(level), 2, 0);
  assert.equal(result.state.status, 'won');
  assert.deepEqual(legalMoves(result.state), []);
});

test('illegal moves are rejected', () => {
  const state = buildState(makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }] }));
  assert.equal(applyMove(state, 3, 3), null);
  assert.equal(applyMove(state, 2, 2), null);
});

test('no moves are allowed once the move limit is used up', () => {
  const level = makeLevel({ moveLimit: 1, enemies: [{ type: 'king', x: 4, y: 4 }] });
  const after = applyMove(buildState(level), 2, 0).state;
  assert.deepEqual(legalMoves(after), []);
});

test('applyMove does not mutate the previous state', () => {
  const level = makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }, { type: 'pawn', x: 2, y: 0 }] });
  const before = buildState(level);
  applyMove(before, 2, 0);
  assert.equal(before.enemies.length, 2);
  assert.equal(before.player.y, 2);
  assert.equal(before.movesUsed, 0);
});

test('simulateRoute keeps only the valid prefix', () => {
  const level = makeLevel({ enemies: [{ type: 'king', x: 4, y: 4 }] });
  const sim = simulateRoute(level, [], [{ x: 2, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 0 }]);
  assert.equal(sim.validCount, 1);
});

test('canPlace rejects the player cell, enemies, other helpers and out of bounds', () => {
  const level = makeLevel();
  const placements = [{ type: 'bishop', x: 1, y: 1 }];
  assert.equal(canPlace(level, placements, 2, 2), false);
  assert.equal(canPlace(level, placements, 4, 0), false);
  assert.equal(canPlace(level, placements, 1, 1), false);
  assert.equal(canPlace(level, placements, 1, 1, 0), true);
  assert.equal(canPlace(level, placements, 5, 0), false);
  assert.equal(canPlace(level, placements, 0, 0), true);
});

test('trayRemaining subtracts placed helpers', () => {
  const level = makeLevel({ tray: ['rook', 'rook', 'bishop'] });
  assert.deepEqual(trayRemaining(level, [{ type: 'rook', x: 0, y: 0 }]), ['rook', 'bishop']);
});

for (const level of LEVELS) {
  test(`level "${level.name}" is solvable with its tray`, () => {
    const solution = solve(level);
    assert.ok(solution, 'expected a solution');
    const sim = simulateRoute(level, solution.placements, solution.route);
    assert.equal(sim.finalState.status, 'won');
    assert.ok(sim.finalState.movesUsed <= level.moveLimit);
  });

  test(`level "${level.name}" is NOT solvable without helpers`, () => {
    assert.equal(solveWithPlacements(level, []), null);
  });

  test(`level "${level.name}" has several winning placements but not all`, () => {
    const total = level.tray.length ? countSolutions(level) : 0;
    assert.ok(total > 0);
    const cells = level.width * level.height - 1 - level.enemies.length;
    assert.ok(total < cells ** level.tray.length, 'puzzle should not be solved by any placement');
  });
}

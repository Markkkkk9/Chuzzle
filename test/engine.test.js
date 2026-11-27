import test from 'node:test';
import assert from 'node:assert/strict';
import { buildState, legalMoves, applyMove, simulateRoute, canPlace, trayRemaining, attackers } from '../js/engine.js';
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
    const { wins: total } = level.tray.length ? countSolutions(level) : { wins: 0 };
    assert.ok(total > 0);
    const cells = level.width * level.height - 1 - level.enemies.length;
    assert.ok(total < cells ** level.tray.length, 'puzzle should not be solved by any placement');
  });
}

for (const level of LEVELS) {
  test(`level "${level.name}" has a valid layout`, () => {
    const pieces = [level.player, ...level.enemies];
    for (const p of pieces) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x < level.width && p.y < level.height, `${p.type} is off the board`);
    }
    const cells = new Set(pieces.map((p) => `${p.x},${p.y}`));
    assert.equal(cells.size, pieces.length, 'two pieces share a cell');
    assert.equal(level.enemies.filter((e) => e.type === 'king').length, 1, 'exactly one enemy king');
    assert.ok(level.moveLimit >= 1);
    assert.ok(level.tray.length >= 1);
  });

  test(`level "${level.name}" needs every helper in its tray`, () => {
    for (let i = 0; i < level.tray.length; i++) {
      const without = level.tray.filter((_, j) => j !== i);
      assert.equal(solve(level, without), null, `solvable without the ${level.tray[i]}`);
    }
  });
}

test('levels get bigger or harder: the number of winning placements never grows by much', () => {
  const ratios = LEVELS.map((level) => {
    const { wins, total } = countSolutions(level);
    return wins / total;
  });
  assert.ok(ratios[ratios.length - 1] < ratios[0], 'last level should be harder than the first');
});

// The first enemy in these states is a filler king that is ignored when checking attacks.
function enemyState(enemies, helpers = [], player = { type: 'rook', x: 2, y: 2 }) {
  return buildState(
    { name: 't', width: 5, height: 5, moveLimit: 5, player, enemies: [{ type: 'king', x: 0, y: 0 }, ...enemies], tray: [] },
    helpers,
  );
}
const attacked = (state, x, y) =>
  attackers(state, x, y)
    .filter((e) => e !== state.enemies[0])
    .map((e) => e.type);

test('enemy pawns attack diagonally down the board, not up or straight', () => {
  const state = enemyState([{ type: 'pawn', x: 2, y: 1 }]);
  assert.deepEqual(attacked(state, 1, 2), ['pawn']);
  assert.deepEqual(attacked(state, 3, 2), ['pawn']);
  assert.deepEqual(attacked(state, 2, 2), []);
  assert.deepEqual(attacked(state, 1, 0), []);
  assert.deepEqual(attacked(state, 3, 0), []);
});

test('enemy knights attack by jumping, regardless of blockers', () => {
  const state = enemyState([{ type: 'knight', x: 2, y: 2 }, { type: 'pawn', x: 3, y: 2 }]);
  assert.deepEqual(attacked(state, 3, 4), ['knight']);
  assert.deepEqual(attacked(state, 3, 3), []);
});

test('enemy kings attack the 8 neighbouring cells only', () => {
  const state = enemyState([{ type: 'king', x: 3, y: 3 }]);
  assert.deepEqual(attacked(state, 2, 2), ['king']);
  assert.deepEqual(attacked(state, 4, 4), ['king']);
  assert.deepEqual(attacked(state, 1, 1), []);
});

test('enemy sliders are blocked by helpers and by other enemies', () => {
  const rook = enemyState([{ type: 'rook', x: 4, y: 4 }]);
  assert.deepEqual(attacked(rook, 4, 1), ['rook']);
  const blockedByHelper = enemyState([{ type: 'rook', x: 4, y: 4 }], [{ type: 'bishop', x: 4, y: 2 }]);
  assert.deepEqual(attacked(blockedByHelper, 4, 1), []);
  assert.deepEqual(attacked(blockedByHelper, 4, 3), ['rook']);
  const blockedByEnemy = enemyState([{ type: 'rook', x: 4, y: 4 }, { type: 'pawn', x: 4, y: 2 }]);
  assert.deepEqual(attacked(blockedByEnemy, 4, 1), []);
  const bishop = enemyState([{ type: 'bishop', x: 4, y: 4 }]);
  assert.deepEqual(attacked(bishop, 1, 1), ['bishop']);
  assert.deepEqual(attacked(bishop, 1, 4), []);
  const queen = enemyState([{ type: 'queen', x: 4, y: 4 }]);
  assert.deepEqual(attacked(queen, 4, 0), ['queen']);
  assert.deepEqual(attacked(queen, 1, 1), ['queen']);
  assert.deepEqual(attacked(queen, 3, 0), []);
});

test('landing on an attacked cell loses the run and records the attacker', () => {
  const level = makeLevel({
    moveLimit: 3,
    player: { type: 'rook', x: 0, y: 4 },
    enemies: [{ type: 'king', x: 4, y: 0 }, { type: 'knight', x: 2, y: 2 }],
  });
  const result = applyMove(buildState(level), 0, 3);
  assert.equal(result.state.status, 'lost');
  assert.deepEqual(result.event.lostTo, { type: 'knight', x: 2, y: 2 });
  assert.deepEqual(legalMoves(result.state), []);
  const safe = applyMove(buildState(level), 0, 2);
  assert.equal(safe.state.status, 'playing');
});

test('capturing the king wins even if another enemy attacks that cell', () => {
  const level = makeLevel({
    player: { type: 'rook', x: 0, y: 0 },
    enemies: [{ type: 'king', x: 2, y: 0 }, { type: 'knight', x: 3, y: 2 }],
  });
  const result = applyMove(buildState(level), 2, 0);
  assert.equal(result.state.status, 'won');
  assert.equal(result.event.lostTo, null);
});

test('a captured enemy stops attacking', () => {
  const level = makeLevel({
    player: { type: 'rook', x: 2, y: 4 },
    enemies: [{ type: 'king', x: 4, y: 0 }, { type: 'rook', x: 2, y: 2 }],
  });
  const before = buildState(level);
  assert.deepEqual(attackers(before, 2, 3).map((e) => e.type), ['rook']);
  const after = applyMove(before, 2, 2);
  assert.equal(after.state.status, 'playing');
  assert.deepEqual(attackers(after.state, 2, 3), []);
});

test('landing on a helper removes it as a blocker, so the attack can land on you', () => {
  const level = makeLevel({
    player: { type: 'bishop', x: 2, y: 0 },
    enemies: [{ type: 'king', x: 0, y: 4 }, { type: 'rook', x: 4, y: 4 }],
  });
  const state = buildState(level, [{ type: 'rook', x: 4, y: 2 }]);
  const result = applyMove(state, 4, 2);
  assert.equal(result.state.status, 'lost');
  assert.equal(result.event.lostTo.type, 'rook');
});

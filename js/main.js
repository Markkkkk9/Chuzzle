import { LEVELS } from './levels.js';
import { buildState, legalMoves, simulateRoute, canPlace, trayRemaining } from './engine.js';

const CELL = 80;
const GLYPH = { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟\uFE0E' };
const COLORS = { player: '#6fb7ff', enemy: '#ff7b7b', helper: '#7bd88f' };
const STEP_MS = 600;

const level = LEVELS[0];
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = level.width * CELL;
canvas.height = level.height * CELL;

const el = {
  levelName: document.getElementById('level-name'),
  moves: document.getElementById('moves'),
  currentPiece: document.getElementById('current-piece'),
  tray: document.getElementById('tray'),
  message: document.getElementById('message'),
  run: document.getElementById('run'),
  undo: document.getElementById('undo'),
  clear: document.getElementById('clear'),
  reset: document.getElementById('reset'),
};

let placements = [];
let route = [];
let run = null;
let drag = null;
let message = { text: '', kind: '' };

function setMessage(text, kind = '') {
  message = { text, kind };
  el.message.textContent = text;
  el.message.className = kind;
}

function stopRun() {
  if (!run) return;
  clearInterval(run.timer);
  run = null;
  setMessage('');
}

function simulate() {
  return simulateRoute(level, placements, route);
}

function truncateRoute() {
  route = route.slice(0, simulate().validCount);
}

function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * level.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * level.height);
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return null;
  return { x, y };
}

function drawPiece(type, x, y, color) {
  ctx.font = `${CELL * 0.75}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#111';
  ctx.strokeText(GLYPH[type], x * CELL + CELL / 2, y * CELL + CELL / 2 + 4);
  ctx.fillStyle = color;
  ctx.fillText(GLYPH[type], x * CELL + CELL / 2, y * CELL + CELL / 2 + 4);
}

function render() {
  const planning = !run;
  const sim = simulate();
  const shown = run ? run.states[run.index] : buildState(level, placements);

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#e8d9b5' : '#a67c52';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  if (planning) {
    route.forEach((step, i) => {
      ctx.fillStyle = 'rgba(111, 183, 255, 0.45)';
      ctx.fillRect(step.x * CELL, step.y * CELL, CELL, CELL);
      ctx.fillStyle = '#10305a';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), step.x * CELL + 6, step.y * CELL + 4);
    });

    if (!drag || drag.moved) {
      for (const move of legalMoves(sim.finalState)) {
        ctx.fillStyle = 'rgba(40, 40, 40, 0.35)';
        ctx.beginPath();
        ctx.arc(move.x * CELL + CELL / 2, move.y * CELL + CELL / 2, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const enemy of shown.enemies) drawPiece(enemy.type, enemy.x, enemy.y, COLORS.enemy);
  shown.helpers.forEach((helper, i) => {
    const hiddenWhileDragging = planning && drag && drag.moved && drag.index === i;
    if (!hiddenWhileDragging) drawPiece(helper.type, helper.x, helper.y, COLORS.helper);
  });
  drawPiece(shown.player.type, shown.player.x, shown.player.y, COLORS.player);

  el.levelName.textContent = level.name;
  const used = run ? shown.movesUsed : sim.finalState.movesUsed;
  el.moves.textContent = `Moves: ${used}/${level.moveLimit}`;
  const piece = run ? shown.player.type : sim.finalState.player.type;
  el.currentPiece.textContent = `Piece: ${piece}`;

  el.run.disabled = !!run && !run.done ? true : route.length === 0;
  el.undo.disabled = !!run && !run.done ? true : route.length === 0 && !run;
  el.clear.disabled = !!run && !run.done ? true : route.length === 0 && !run;
  el.reset.disabled = !!run && !run.done;

  renderTray();
}

function renderTray() {
  const remaining = trayRemaining(level, placements);
  const label = document.getElementById('tray-label');
  el.tray.replaceChildren(label);
  remaining.forEach((type) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = GLYPH[type];
    chip.dataset.type = type;
    chip.addEventListener('pointerdown', (event) => startDrag(event, { type, from: 'tray', index: -1 }));
    el.tray.appendChild(chip);
  });
  if (remaining.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = '(all placed, drag one off the board to take it back)';
    empty.style.opacity = '0.6';
    el.tray.appendChild(empty);
  }
}

function startDrag(event, info) {
  if (run && !run.done) return;
  event.preventDefault();
  stopRun();
  drag = { ...info, startX: event.clientX, startY: event.clientY, moved: false, ghost: null };
  render();
}

canvas.addEventListener('pointerdown', (event) => {
  if (run && !run.done) return;
  const cell = cellFromEvent(event);
  if (!cell) return;
  event.preventDefault();
  const index = placements.findIndex((p) => p.x === cell.x && p.y === cell.y);
  if (index !== -1) {
    startDrag(event, { type: placements[index].type, from: 'board', index });
  } else {
    drag = { type: null, from: 'cell', index: -1, startX: event.clientX, startY: event.clientY, moved: false, ghost: null };
  }
});

window.addEventListener('pointermove', (event) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
    drag.moved = true;
    if (drag.type) {
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'ghost';
      drag.ghost.textContent = GLYPH[drag.type];
      document.body.appendChild(drag.ghost);
    }
    render();
  }
  if (drag.ghost) {
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
  }
});

window.addEventListener('pointerup', (event) => {
  if (!drag) return;
  const finished = drag;
  drag = null;
  if (finished.ghost) finished.ghost.remove();
  const cell = cellFromEvent(event);

  if (!finished.moved) {
    if (cell) tryAddStep(cell);
    render();
    return;
  }
  if (finished.from === 'cell') {
    render();
    return;
  }

  if (finished.from === 'tray') {
    if (cell && canPlace(level, placements, cell.x, cell.y)) {
      placements.push({ type: finished.type, x: cell.x, y: cell.y });
      truncateRoute();
    }
  } else if (!cell) {
    placements.splice(finished.index, 1);
    truncateRoute();
  } else if (canPlace(level, placements, cell.x, cell.y, finished.index)) {
    placements[finished.index] = { ...placements[finished.index], x: cell.x, y: cell.y };
    truncateRoute();
  }
  render();
});

function tryAddStep(cell) {
  stopRun();
  const end = simulate().finalState;
  if (end.status === 'won') {
    setMessage('The king is already captured. Press Run!', 'win');
    return;
  }
  if (end.movesUsed >= level.moveLimit) {
    setMessage('No moves left. Undo a step to change your route.', 'lose');
    return;
  }
  if (!legalMoves(end).some((m) => m.x === cell.x && m.y === cell.y)) {
    setMessage(`A ${end.player.type} cannot move there.`, 'lose');
    return;
  }
  route.push({ x: cell.x, y: cell.y });
  setMessage('');
}

el.run.addEventListener('click', () => {
  stopRun();
  const sim = simulate();
  run = { states: sim.states, index: 0, done: false, timer: null };
  setMessage('Running...');
  run.timer = setInterval(() => {
    run.index += 1;
    if (run.index >= run.states.length - 1) {
      clearInterval(run.timer);
      run.done = true;
      const final = run.states[run.states.length - 1];
      if (final.status === 'won') setMessage('You captured the king! Level complete.', 'win');
      else setMessage('Out of moves without capturing the king. Edit your plan and try again.', 'lose');
    }
    render();
  }, STEP_MS);
  render();
});

el.undo.addEventListener('click', () => {
  stopRun();
  route.pop();
  render();
});

el.clear.addEventListener('click', () => {
  stopRun();
  route = [];
  render();
});

el.reset.addEventListener('click', () => {
  stopRun();
  placements = [];
  route = [];
  render();
});

render();

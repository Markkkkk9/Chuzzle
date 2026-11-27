import { LEVELS } from './levels.js';
import { buildState, legalMoves, simulateRoute, canPlace, trayRemaining } from './engine.js';

const CELL = 80;
const GLYPH = { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟\uFE0E' };
const COLORS = { player: '#6fb7ff', enemy: '#ff7b7b', helper: '#7bd88f' };
const START_COLOR = '#1f6fd1';
const SELECT_COLOR = '#ffd84a';
const STEP_MS = 600;
const STORAGE_KEY = 'chuzzle.completed';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const el = {
  levels: document.getElementById('levels'),
  levelName: document.getElementById('level-name'),
  moves: document.getElementById('moves'),
  currentPiece: document.getElementById('current-piece'),
  tray: document.getElementById('tray'),
  message: document.getElementById('message'),
  run: document.getElementById('run'),
  undo: document.getElementById('undo'),
  clear: document.getElementById('clear'),
  reset: document.getElementById('reset'),
  next: document.getElementById('next'),
};

let levelIndex = 0;
let level = LEVELS[0];
let placements = [];
let route = [];
let run = null;
let drag = null;

function loadCompleted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveCompleted(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Storage can be unavailable (private mode); progress just won't persist.
  }
}

const completed = loadCompleted();

function setMessage(text, kind = '') {
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

function loadLevel(index) {
  stopRun();
  levelIndex = index;
  level = LEVELS[index];
  placements = [];
  route = [];
  drag = null;
  canvas.width = level.width * CELL;
  canvas.height = level.height * CELL;
  setMessage('');
  renderLevelButtons();
  render();
}

function renderLevelButtons() {
  el.levels.replaceChildren();
  LEVELS.forEach((l, i) => {
    const button = document.createElement('button');
    button.textContent = String(i + 1);
    button.title = l.name;
    if (i === levelIndex) button.classList.add('current');
    if (completed.has(i)) button.classList.add('done');
    button.addEventListener('click', () => loadLevel(i));
    el.levels.appendChild(button);
  });
}

function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * level.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * level.height);
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return null;
  return { x, y };
}

function center(x, y) {
  return [x * CELL + CELL / 2, y * CELL + CELL / 2];
}

function drawPiece(type, x, y, color, alpha = 1) {
  const [cx, cy] = center(x, y);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${CELL * 0.75}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#111';
  ctx.strokeText(GLYPH[type], cx, cy + 4);
  ctx.fillStyle = color;
  ctx.fillText(GLYPH[type], cx, cy + 4);
  ctx.restore();
}

function drawRoutePath() {
  const points = [[level.player.x, level.player.y], ...route.map((s) => [s.x, s.y])];
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 48, 90, 0.8)';
  ctx.fillStyle = 'rgba(16, 48, 90, 0.8)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = center(...points[i - 1]);
    const [bx, by] = center(...points[i]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const angle = Math.atan2(by - ay, bx - ax);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(angle) * 10, my + Math.sin(angle) * 10);
    ctx.lineTo(mx + Math.cos(angle + 2.5) * 10, my + Math.sin(angle + 2.5) * 10);
    ctx.lineTo(mx + Math.cos(angle - 2.5) * 10, my + Math.sin(angle - 2.5) * 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStartMarker() {
  const { x, y } = level.player;
  ctx.save();
  ctx.strokeStyle = START_COLOR;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(x * CELL + 4, y * CELL + 4, CELL - 8, CELL - 8);
  ctx.setLineDash([]);
  ctx.fillStyle = START_COLOR;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('START', x * CELL + CELL / 2, y * CELL + CELL - 8);
  ctx.restore();
}

function drawSelectedMarker(x, y) {
  ctx.save();
  ctx.strokeStyle = SELECT_COLOR;
  ctx.lineWidth = 6;
  ctx.strokeRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
  ctx.restore();
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
    route.forEach((step) => {
      ctx.fillStyle = 'rgba(111, 183, 255, 0.4)';
      ctx.fillRect(step.x * CELL, step.y * CELL, CELL, CELL);
    });
    drawStartMarker();
    drawRoutePath();

    if (!drag || drag.moved) {
      for (const move of legalMoves(sim.finalState)) {
        const [mx, my] = center(move.x, move.y);
        ctx.fillStyle = 'rgba(40, 40, 40, 0.35)';
        ctx.beginPath();
        ctx.arc(mx, my, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const enemy of shown.enemies) drawPiece(enemy.type, enemy.x, enemy.y, COLORS.enemy);
  shown.helpers.forEach((helper, i) => {
    const hiddenWhileDragging = planning && drag && drag.moved && drag.index === i;
    if (!hiddenWhileDragging) drawPiece(helper.type, helper.x, helper.y, COLORS.helper);
  });

  if (planning && (!drag || drag.moved)) {
    for (const move of legalMoves(sim.finalState)) {
      const enemy = sim.finalState.enemies.some((p) => p.x === move.x && p.y === move.y);
      const helper = sim.finalState.helpers.some((p) => p.x === move.x && p.y === move.y);
      if (!enemy && !helper) continue;
      const [mx, my] = center(move.x, move.y);
      ctx.save();
      ctx.strokeStyle = enemy ? '#c0392b' : '#2d8a46';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(mx, my, CELL * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (planning) {
    const end = sim.finalState.player;
    drawPiece(shown.player.type, shown.player.x, shown.player.y, COLORS.player, route.length ? 0.45 : 1);
    if (route.length) drawPiece(end.type, end.x, end.y, COLORS.player);
    drawSelectedMarker(end.x, end.y);
    route.forEach((step, i) => {
      ctx.fillStyle = '#10305a';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), step.x * CELL + 6, step.y * CELL + 4);
    });
  } else {
    drawPiece(shown.player.type, shown.player.x, shown.player.y, COLORS.player);
  }

  el.levelName.textContent = `Level ${levelIndex + 1}: ${level.name}`;
  const used = run ? shown.movesUsed : sim.finalState.movesUsed;
  el.moves.textContent = `Moves: ${used}/${level.moveLimit}`;
  const piece = run ? shown.player.type : sim.finalState.player.type;
  el.currentPiece.textContent = `Selected piece: ${piece}`;

  const running = !!run && !run.done;
  el.run.disabled = running || route.length === 0;
  el.undo.disabled = running || (route.length === 0 && !run);
  el.clear.disabled = running || (route.length === 0 && !run);
  el.reset.disabled = running;
  el.next.hidden = !(run && run.done && run.states[run.states.length - 1].status === 'won' && levelIndex < LEVELS.length - 1);

  renderTray();
}

function renderTray() {
  const remaining = trayRemaining(level, placements);
  const label = document.createElement('span');
  label.id = 'tray-label';
  label.textContent = 'Helpers:';
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
      if (final.status === 'won') {
        completed.add(levelIndex);
        saveCompleted(completed);
        renderLevelButtons();
        setMessage(
          levelIndex < LEVELS.length - 1 ? 'You captured the king! Level complete.' : 'You captured the king! You finished every level.',
          'win',
        );
      } else {
        setMessage('Out of moves without capturing the king. Edit your plan and try again.', 'lose');
      }
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

el.next.addEventListener('click', () => loadLevel(levelIndex + 1));

const requested = Number(new URLSearchParams(location.search).get('level')) - 1;
loadLevel(Number.isInteger(requested) && requested >= 0 && requested < LEVELS.length ? requested : 0);

/**
 * 캔버스에 판을 그립니다.
 * 상태를 읽기만 하고 바꾸지 않습니다.
 */

import { S } from '../core/state.js';
import { COLS, ROWS, landingRow } from '../core/board.js';
import { isSyllable, VOWELS, DOUBLE_JONG } from '../core/hangul.js';

/** 화면에 맞춰 계산되는 칸 크기입니다. */
export const view = { cell: 34, width: 0, height: 0 };

let canvas = null;
let ctx = null;

/** 캔버스를 찾아 둡니다. main.js 가 화면을 띄울 때 한 번 부릅니다. */
export function initCanvas() {
  canvas = document.getElementById('gc');
  ctx = canvas.getContext('2d');
}

/** 다른 모듈이 캔버스에 이벤트를 걸거나 커서를 바꿀 때 씁니다. */
export function getCanvas() {
  return canvas;
}

export function setCursor(value) {
  if (canvas) canvas.style.cursor = value;
}

/**
 * 판이 놓일 자리를 지켜보다가 크기가 잡히면 캔버스를 다시 맞춥니다.
 *
 * 배경 탭에서 열리는 경우처럼 화면 크기가 0인 채로 시작하면 첫 계산이 건너뛰어집니다.
 * 창 크기 변경만 기다리면 그대로 비어 있게 되므로, 자리 자체를 지켜보게 합니다.
 */
export function observeCanvasArea() {
  const area = document.getElementById('canvas-area');
  if (!area || typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => resizeCanvas());
  observer.observe(area);
}

/** 남는 자리에 맞춰 칸 크기를 다시 계산합니다. */
export function resizeCanvas() {
  const area = document.getElementById('canvas-area');
  if (!area || !canvas) return;

  const availW = Math.floor(area.clientWidth) - 6;
  const availH = Math.floor(area.clientHeight) - 4;
  if (availW <= 0 || availH <= 0) return;

  view.cell = Math.max(16, Math.floor(Math.min(availW / COLS, availH / ROWS)));
  view.width = COLS * view.cell;
  view.height = ROWS * view.cell;

  // 화면 밀도가 높은 기기에서도 글자가 또렷하도록 두 배로 그립니다.
  canvas.width = view.width * 2;
  canvas.height = view.height * 2;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  canvas.style.width = `${view.width}px`;
  canvas.style.height = `${view.height}px`;

  if (S.field) draw();
}

/**
 * 블록 한 칸의 색을 정합니다.
 *   글자 블록  글자마다 다른 색을 주어 같은 글자를 찾기 쉽게 합니다.
 *   자모 블록  자음은 청록색, 모음은 보라색, 겹받침은 분홍색으로 구분합니다.
 */
export function unitStyle(unit) {
  if (isSyllable(unit)) {
    let h = 0;
    for (const ch of unit) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const hue = (h * 37) % 360;
    return { from: `hsl(${hue},72%,74%)`, to: `hsl(${hue},62%,58%)`, ink: '#12132A', wide: true };
  }
  if (DOUBLE_JONG.has(unit)) return { from: '#FF9BB0', to: '#F2647F', ink: '#2A0A12', wide: false };
  if (VOWELS.has(unit)) return { from: '#D7A6FF', to: '#B370FF', ink: '#1A0A2E', wide: false };
  return { from: '#2AE0F5', to: '#16B5CC', ink: '#04222A', wide: false };
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCell(col, row, unit, opt = {}) {
  const cell = view.cell;
  const pad = 1.5;
  const x = col * cell + pad;
  const y = row * cell + pad;
  const size = cell - pad * 2;
  const radius = Math.max(4, cell * 0.2);
  const style = unitStyle(unit);

  ctx.save();

  if (opt.ghost) {
    // 어디에 놓이는지 알려 주는 안내선입니다. 실제 블록과 헷갈리지 않도록 점선만 그립니다.
    roundRect(x, y, size, size, radius);
    ctx.setLineDash([Math.max(3, cell * 0.16), Math.max(3, cell * 0.12)]);
    ctx.strokeStyle = style.to;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (opt.flash) {
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = cell * 0.55;
  }

  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, style.from);
  grad.addColorStop(1, style.to);
  roundRect(x, y, size, size, radius);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  if (opt.active) {
    roundRect(x, y, size, size, radius);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = style.ink;
  ctx.font = `800 ${Math.floor(cell * (style.wide ? 0.5 : 0.56))}px 'Pretendard Variable',Pretendard,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(unit, col * cell + cell / 2, row * cell + cell / 2 + cell * 0.02);

  ctx.restore();
}

function drawGrid() {
  const { cell, width, height } = view;
  ctx.strokeStyle = 'rgba(255,255,255,.045)';
  ctx.lineWidth = 1;
  for (let r = 1; r < ROWS; r += 1) {
    ctx.beginPath();
    ctx.moveTo(0, r * cell);
    ctx.lineTo(width, r * cell);
    ctx.stroke();
  }
  for (let c = 1; c < COLS; c += 1) {
    ctx.beginPath();
    ctx.moveTo(c * cell, 0);
    ctx.lineTo(c * cell, height);
    ctx.stroke();
  }
}

/** 판 전체를 다시 그립니다. */
export function draw() {
  if (!ctx || !S.field) return;

  ctx.clearRect(0, 0, view.width, view.height);
  drawGrid();

  if (S.cur && !S.clearing) {
    const landing = landingRow();
    if (landing !== S.cur.row) drawCell(S.cur.col, landing, S.cur.u, { ghost: true });
  }

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const unit = S.field[r][c];
      if (unit !== null) drawCell(c, r, unit, { flash: S.clearSet.has(`${r},${c}`) });
    }
  }

  const hover = S.hoverCell;
  if (S.removeMode && hover && S.field[hover.row] && S.field[hover.row][hover.col] !== null) {
    const cell = view.cell;
    roundRect(hover.col * cell + 1, hover.row * cell + 1, cell - 2, cell - 2, cell * 0.2);
    ctx.strokeStyle = '#FF5E7A';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // 보석을 쓰는 중이면 지워질 줄 전체를 표시합니다.
  if (S.gemMode && S.hoverRow !== null && S.hoverRow >= 0 && S.hoverRow < ROWS) {
    const cell = view.cell;
    const y = S.hoverRow * cell;
    ctx.save();
    ctx.fillStyle = 'rgba(34,211,238,.18)';
    ctx.fillRect(0, y, view.width, cell);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(1, y + 1, view.width - 2, cell - 2);
    ctx.restore();
  }

  if (S.cur) drawCell(S.cur.col, S.cur.row, S.cur.u, { active: true });
}

/** 화면 좌표를 판의 행과 열로 바꿉니다. 지우개에서 씁니다. */
export function cellFromPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    col: Math.floor(((clientX - rect.left) / rect.width) * COLS),
    row: Math.floor(((clientY - rect.top) / rect.height) * ROWS)
  };
}

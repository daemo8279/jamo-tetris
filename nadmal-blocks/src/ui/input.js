/**
 * 버튼, 자판, 손가락 조작을 게임 동작에 연결합니다.
 */

import { S } from '../core/state.js';
import { getCanvas, cellFromPointer, draw, resizeCanvas } from './render.js';
import { toggleRemove, updateHintPanel } from './hud.js';
import {
  moveLeft, moveRight, hardDrop, setSoftDrop, doHold,
  eraseCell, togglePause, advanceYes, advanceNo, quitToHome
} from '../core/game.js';
import {
  showModal, hideOverlay, showStart, showHowto, showRankingModal,
  openNamePrompt, markScoreSubmitted
} from './modals.js';
import { playDemo, stepDemo, finishDemo } from './onboarding.js';
import { player } from '../services/player.js';
import { saveScore } from '../services/ranking.js';
import { ROWS, COLS } from '../core/board.js';

/* ── 손가락 조작 기준값 ── */
const TAP_SLOP = 9;        // 이만큼 안 움직이면 두드린 것으로 봅니다
const TAP_MS = 260;
const DOUBLE_TAP_MS = 290;
const SWIPE_MIN = 22;      // 이만큼 이상 밀어야 옆으로 옮깁니다
const SOFT_DROP_PULL = 26; // 이만큼 아래로 끌면 빨리 내립니다
const RESIZE_DEBOUNCE_MS = 120;

const on = (id, event, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
};

/**
 * 화면 조작을 모두 연결합니다.
 * @param {{ onStart: () => void, onRetry: () => void }} flow 시작과 다시하기를 어떻게 처리할지
 */
export function bindInput(flow) {
  bindMenus(flow);
  bindPad();
  bindKeyboard();
  bindCanvas();
  bindResize();
}

/* ══ 메뉴와 모달 ══ */

function bindMenus(flow) {
  on('s-play', 'click', flow.onStart);
  on('s-howto', 'click', showHowto);
  on('s-rank', 'click', showRankingModal);
  on('start-player-edit', 'click', () => {
    openNamePrompt(() => showStart(), { cancelable: true });
  });

  on('btn-help', 'click', showHowto);
  on('btn-pause', 'click', togglePause);

  on('p-resume', 'click', togglePause);
  on('p-howto', 'click', showHowto);
  on('p-home', 'click', quitToHome);

  on('howto-close', 'click', backFromInfo);
  on('howto-demo1', 'click', () => playDemo('syl', backFromInfo));
  on('howto-demo2', 'click', () => playDemo('jamo', backFromInfo));

  on('rank-close', 'click', backFromInfo);

  on('demo-next', 'click', stepDemo);
  on('demo-skip', 'click', finishDemo);

  on('adv-yes', 'click', advanceYes);
  on('adv-no', 'click', advanceNo);

  on('go-submit', 'click', submitScore);
  on('go-rename', 'click', () => {
    openNamePrompt(() => showModal('modal-gameover'), { cancelable: true, title: '닉네임 바꾸기' });
  });
  on('go-retry', 'click', flow.onRetry);
  on('go-home', 'click', quitToHome);

  on('hint-prev', 'click', () => {
    if (S.hintViewIdx > 0) {
      S.hintViewIdx -= 1;
      updateHintPanel();
    }
  });
  on('hint-next', 'click', () => {
    if (S.hintViewIdx < Math.min(S.targetQueue.length, 2)) {
      S.hintViewIdx += 1;
      updateHintPanel();
    }
  });
}

/** 안내 화면을 닫았을 때 돌아갈 자리를 고릅니다. */
function backFromInfo() {
  if (S.paused) showModal('modal-pause');
  else if (S.gameOver && S.score > 0) showModal('modal-gameover');
  else if (S.running) hideOverlay();
  else showStart();
}

async function submitScore() {
  await saveScore({
    name: player.name || '익명',
    score: S.score,
    level: S.level,
    words: S.wordCount
  });
  markScoreSubmitted();
  await showRankingModal();
}

/* ══ 아래쪽 조작판 ══ */

function bindPad() {
  on('b-left', 'click', moveLeft);
  on('b-right', 'click', moveRight);
  on('btn-drop', 'click', hardDrop);
  on('hold-btn', 'click', doHold);

  const soft = document.getElementById('b-soft');
  if (!soft) return;
  const press = (e) => { e.preventDefault(); setSoftDrop(true); };
  const release = () => setSoftDrop(false);
  ['pointerdown', 'touchstart'].forEach((ev) => soft.addEventListener(ev, press, { passive: false }));
  ['pointerup', 'pointerleave', 'pointercancel', 'touchend', 'touchcancel']
    .forEach((ev) => soft.addEventListener(ev, release));
}

/* ══ 자판 ══ */

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // 닉네임을 입력하는 중에는 자판을 조작으로 받지 않습니다.
    if (e.target instanceof HTMLInputElement) return;

    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();

    switch (e.key) {
      case 'ArrowLeft': moveLeft(); break;
      case 'ArrowRight': moveRight(); break;
      case 'ArrowDown': setSoftDrop(true); break;
      case ' ': hardDrop(); break;
      case 'c': case 'C': doHold(); break;
      case 'p': case 'P': togglePause(); break;
      case 'Escape': if (S.removeMode) toggleRemove(); break;
      default: break;
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown') setSoftDrop(false);
  });
}

/* ══ 판 위 조작 ══ */

function bindCanvas() {
  const canvas = getCanvas();
  if (!canvas) return;

  canvas.addEventListener('click', (e) => {
    if (!S.removeMode) return;
    const { row, col } = cellFromPointer(e.clientX, e.clientY);
    eraseCell(row, col);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!S.removeMode) {
      if (S.hoverCell) {
        S.hoverCell = null;
        draw();
      }
      return;
    }
    const { row, col } = cellFromPointer(e.clientX, e.clientY);
    S.hoverCell = row >= 0 && row < ROWS && col >= 0 && col < COLS ? { row, col } : null;
    draw();
  });

  canvas.addEventListener('mouseleave', () => {
    if (S.hoverCell) {
      S.hoverCell = null;
      draw();
    }
  });

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let lastTap = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (S.removeMode) {
      const t = e.touches[0];
      const { row, col } = cellFromPointer(t.clientX, t.clientY);
      eraseCell(row, col);
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (S.removeMode) return;
    if (e.touches[0].clientY - startY > SOFT_DROP_PULL) setSoftDrop(true);
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    setSoftDrop(false);
    if (S.removeMode) return;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (adx < TAP_SLOP && ady < TAP_SLOP && Date.now() - startT < TAP_MS) {
      const now = Date.now();
      if (now - lastTap < DOUBLE_TAP_MS) {
        hardDrop();
        lastTap = 0;
      } else {
        lastTap = now;
      }
      return;
    }

    if (adx > ady) {
      if (dx > SWIPE_MIN) moveRight();
      else if (dx < -SWIPE_MIN) moveLeft();
    }
  }, { passive: true });
}

/* ══ 창 크기 ══ */

function bindResize() {
  let timer = null;
  window.addEventListener('resize', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(resizeCanvas, RESIZE_DEBOUNCE_MS);
  });
}

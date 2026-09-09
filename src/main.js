/**
 * 시작점입니다. 화면을 준비하고, 놀이를 시작하는 흐름을 정합니다.
 *
 * 시작 순서
 *   게임 시작 → (닉네임이 없으면) 닉네임 입력 → (처음이면) 온보딩 → 판 시작
 */

import { S, seen, markDemoSeen } from './core/state.js';
import { createField } from './core/board.js';
import { initCanvas, resizeCanvas, observeCanvasArea } from './ui/render.js';
import { initNameForm, showStart, hideOverlay, openNamePrompt } from './ui/modals.js';
import { clearRail, updateAll } from './ui/hud.js';
import { playDemo } from './ui/onboarding.js';
import { bindInput } from './ui/input.js';
import { newGame } from './core/game.js';
import { hasName } from './services/player.js';
import { installDebugBridge } from './dev/debug.js';

/** 온보딩까지 마친 뒤 실제로 판을 엽니다. */
function beginGame() {
  hideOverlay();
  clearRail();
  newGame();
}

/** 처음 놀이하는 사람에게만 글자 블록 데모를 보여 줍니다. */
function startAfterName() {
  if (!seen.demoSyl) {
    playDemo('syl', () => {
      markDemoSeen('syl');
      beginGame();
    });
    return;
  }
  beginGame();
}

/** 「게임 시작」을 눌렀을 때의 흐름입니다. */
function onStart() {
  if (!hasName()) {
    openNamePrompt(() => startAfterName());
    return;
  }
  startAfterName();
}

/** 게임 종료 화면의 「다시하기」입니다. 판이 끝나면 언제나 1단계부터 다시 합니다. */
function onRetry() {
  beginGame();
}

function boot() {
  initCanvas();

  // 시작 화면 뒤로 빈 판이 비치도록 미리 그려 둡니다.
  S.field = createField();
  S.queue = [];
  S.clearSet = new Set();
  S.madeWords = [];
  S.running = false;
  S.gameOver = false;
  S.paused = false;
  S.clearing = false;

  resizeCanvas();
  observeCanvasArea();
  updateAll();

  initNameForm();
  bindInput({ onStart, onRetry });
  installDebugBridge();
  showStart();
}

boot();

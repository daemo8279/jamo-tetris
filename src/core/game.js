/**
 * 게임 진행을 맡습니다. 상태를 바꾸는 일은 모두 이 파일에 모아 두었습니다.
 */

import { S, seen, markDemoSeen } from './state.js';
import {
  ROWS, COLS, SPAWN_COL,
  createField, isFree, landingRow, applyGravity, dirtyFromColumns
} from './board.js';

import { chosungOf } from './hangul.js';
import {
  levelConfig, modeOf, modeLabel,
  JAMO_START_LEVEL, MASTER_START_LEVEL, COMBO_PER_GEM, MAX_GEMS
} from '../config/levels.js';
import { fillTargetQueue, refillQueue } from './supply.js';
import { findMatches } from './matcher.js';
import { draw, resizeCanvas, setCursor } from '../ui/render.js';
import {
  updateAll, updateScore, updateStageBar, updateUrgency, updateNext, updateHold,
  updateStars, updateGems, updateCombo, updateHintPanel, setHintChosung, revealBlanks,
  setMsg, showToast, addRail, clearRail
} from '../ui/hud.js';
import { showModal, hideOverlay, showAdvanceModal, showPauseModal, showGameOverModal } from '../ui/modals.js';
import { playDemo } from '../ui/onboarding.js';

/* ── 시간 상수 ── */
const CLEAR_HOLD_MS = 560;   // 낱말이 반짝이는 시간
const SETTLE_MS = 110;       // 블록이 내려앉은 뒤 다시 살펴보기까지 기다리는 시간
const SKIP_MS = 1700;        // 정답을 알려 준 뒤 다음 낱말로 넘어가기까지
const GAMEOVER_MS = 420;
const MASTER_NOTICE_MS = 1500;
const SOFT_DROP_MS = 45;

/** 연쇄로 이어서 지웠을 때 붙는 점수 배수입니다. */
const CHAIN_BONUS = 0.5;

/** 한 번 놓을 때 살펴보는 연쇄 깊이의 상한입니다. */
const MAX_CHAIN_DEPTH = 4;

/* ══ 판 시작 ══ */

export function newGame() {
  S.score = 0;
  S.wordCount = 0;
  S.madeWords = [];
  S.pauseLeft = 3;
  S.stars = 5;
  S.gems = 0;
  S.combo = 0;
  S.bestCombo = 0;
  S.targetWord = '';
  S.targetQueue = [];
  S.gameOver = false;
  S.paused = false;
  S.awaitingAdvance = false;

  clearRail();
  startLevel(1, false);

  S.running = true;
  if (S.animId) cancelAnimationFrame(S.animId);
  S.lastT = 0;
  S.animId = requestAnimationFrame(loop);
}

/**
 * 레벨을 시작합니다.
 * @param {number} level
 * @param {boolean} keepBoard 방식이 그대로면 쌓아 둔 판을 이어서 씁니다.
 */
export function startLevel(level, keepBoard) {
  S.level = level;
  S.levelWords = 0;
  S.clearing = false;
  S.clearSet = new Set();
  S.softDrop = false;
  S.dropAcc = 0;
  S.removeMode = false;
  S.gemMode = false;
  S.hoverCell = null;
  S.hoverRow = null;
  S.holdUnit = null;
  S.holdUsed = false;

  if (!keepBoard) S.field = createField();

  S.queue = [];
  S.unitQueue = [];
  S.targetQueue = [];
  setCursor('default');

  resizeCanvas();
  selectNewTarget(true);
  spawn();
  updateAll();
}

/**
 * 다음 목표 낱말을 고릅니다.
 * @param {boolean} silent 놓친 낱말을 알려 주지 않고 조용히 넘어갈지
 */
export function selectNewTarget(silent) {
  if (!silent && S.targetWord && !S.targetMatched && !S.skipMissedOnce) {
    showToast(S.targetWord, '이번 낱말은 놓쳤어요');
  }
  S.skipMissedOnce = false;

  fillTargetQueue();
  S.targetWord = S.targetQueue.shift();
  fillTargetQueue();

  S.targetMatched = false;
  S.hintViewIdx = 0;
  S.blocksDropped = 0;
  S.hintStage = 0;
  S.targetBag = [];
  S.unitQueue = [];

  if (S.skipTimer) {
    clearTimeout(S.skipTimer);
    S.skipTimer = null;
  }

  S.queue = [];
  refillQueue();
  updateHintPanel();
  updateNext();
  updateUrgency();
}

function spawn() {
  refillQueue();
  const unit = S.queue.shift();
  S.cur = { u: unit, row: 0, col: SPAWN_COL };
  S.holdUsed = false;
  updateHold();
  updateNext();

  if (S.field[0][S.cur.col] !== null) {
    S.cur = null;
    S.gameOver = true;
    S.running = false;
    setTimeout(() => showGameOverModal(false), GAMEOVER_MS);
  }
  draw();
}

/* ══ 블록 놓기와 판정 ══ */

function lock() {
  if (!S.cur) return;
  const at = { r: S.cur.row, c: S.cur.col };
  S.field[at.r][at.c] = S.cur.u;
  S.cur = null;
  S.blocksDropped += 1;
  checkHint();
  resolve(0, [at]);
}

function spawnIfIdle() {
  if (!S.gameOver && !S.cur && !S.awaitingAdvance) spawn();
}

/**
 * 완성된 낱말을 찾아 점수를 매기고 지웁니다.
 * @param {number} depth 연쇄 깊이
 * @param {{r:number,c:number}[]} dirty 방금 바뀐 칸들
 */
export function resolve(depth, dirty) {
  const found = findMatches(dirty);
  if (!found.length || depth >= MAX_CHAIN_DEPTH) {
    spawnIfIdle();
    draw();
    return;
  }

  // 겹치는 칸이 있으면 긴 낱말을 먼저 인정합니다.
  found.sort((a, b) => b.len - a.len);

  const used = new Set();
  const toRemove = new Set();
  const scored = [];
  let gemsWon = 0;

  for (const match of found) {
    if (match.cells.some((c) => used.has(`${c.r},${c.c}`))) continue;
    match.cells.forEach((c) => {
      used.add(`${c.r},${c.c}`);
      toRemove.add(`${c.r},${c.c}`);
    });
    const chain = 1 + depth * CHAIN_BONUS;
    S.score += [...match.word].length * 100 * (match.target ? 2 : 1) * S.level * chain;
    S.wordCount += 1;
    S.levelWords += 1;
    scored.push(match);
    addRail(match.word, match.target);

    // 낱말을 연달아 완성할 때마다 콤보가 오르고, 다섯 번마다 보석을 하나 받습니다.
    S.combo += 1;
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    if (S.combo % COMBO_PER_GEM === 0 && S.gems < MAX_GEMS) {
      S.gems += 1;
      gemsWon += 1;
    }
  }

  if (!toRemove.size) {
    spawnIfIdle();
    draw();
    return;
  }

  S.score = Math.round(S.score);
  S.clearSet = toRemove;
  S.clearing = true;

  const hitTarget = scored.some((m) => m.target && m.word === S.targetWord);
  if (gemsWon) {
    showToast(`${COMBO_PER_GEM}콤보!`, '💎 보석을 얻었습니다 · 한 줄을 지울 수 있어요');
    setMsg(`💎 ${S.combo}콤보 달성! 보석 +${gemsWon}`, 'var(--accent)');
  } else if (hitTarget) {
    S.targetMatched = true;
    revealBlanks(true);
    S.stars = Math.min(S.stars + 1, 5);
    showToast(S.targetWord, '정답! 점수 2배 · 별 +1');
    setMsg(`🎉 ${S.targetWord} 완성!`, 'var(--good)');
  } else {
    setMsg(`✨ ${scored.map((m) => m.word).join(', ')} 보너스!`, 'var(--accent)');
  }

  // 보석 알림이 떴더라도 목표를 맞힌 처리는 그대로 해 둡니다.
  if (hitTarget && !S.targetMatched) {
    S.targetMatched = true;
    revealBlanks(true);
    S.stars = Math.min(S.stars + 1, 5);
  }

  draw();
  updateScore();
  updateStars();
  updateGems();
  updateCombo();
  updateStageBar();

  setTimeout(() => {
    const touched = new Set();
    for (const key of S.clearSet) {
      const [r, c] = key.split(',').map(Number);
      S.field[r][c] = null;
      touched.add(c);
    }
    S.clearSet = new Set();
    S.clearing = false;
    applyGravity();

    const nextDirty = dirtyFromColumns(touched);
    setTimeout(() => {
      setMsg('');
      if (S.levelWords >= levelConfig(S.level).goal) {
        onLevelComplete();
        return;
      }
      if (hitTarget || S.targetMatched) selectNewTarget(false);
      resolve(depth + 1, nextDirty);
    }, SETTLE_MS);
  }, CLEAR_HOLD_MS);
}

/* ══ 레벨 넘김 ══ */

function onLevelComplete() {
  S.cur = null;
  const nextLevel = S.level + 1;

  // 글자 블록에서 자모 블록으로 넘어가는 자리에서는 계속할지 먼저 묻습니다.
  if (nextLevel === JAMO_START_LEVEL) {
    S.awaitingAdvance = true;
    showAdvanceModal();
    return;
  }

  // 겹받침이 처음 나오는 자리에서는 짧게 알려 주고 판을 비웁니다.
  if (nextLevel === MASTER_START_LEVEL) {
    S.awaitingAdvance = true;
    showToast(`${MASTER_START_LEVEL}단계`, '겹받침이 등장합니다!');
    setTimeout(() => {
      S.awaitingAdvance = false;
      startLevel(nextLevel, false);
    }, MASTER_NOTICE_MS);
    return;
  }

  const sameMode = modeOf(nextLevel) === modeOf(S.level);
  showToast(`${nextLevel}단계`, `${modeLabel(nextLevel)} · 속도가 빨라집니다`);
  startLevel(nextLevel, sameMode);
}

/** 「다음 단계로 진행할까요?」에서 예를 골랐을 때입니다. */
export function advanceYes() {
  S.awaitingAdvance = false;
  hideOverlay();
  if (!seen.demoJamo) {
    playDemo('jamo', () => {
      markDemoSeen('jamo');
      startLevel(JAMO_START_LEVEL, false);
    });
  } else {
    startLevel(JAMO_START_LEVEL, false);
  }
}

/** 아니오를 골랐을 때입니다. 여기까지의 점수로 정산하고 마칩니다. */
export function advanceNo() {
  S.awaitingAdvance = false;
  S.running = false;
  S.gameOver = true;
  showGameOverModal(true);
}

/* ══ 힌트 ══ */

function checkHint() {
  const cfg = levelConfig(S.level);
  const syllables = [...S.targetWord].length;
  const stage = Math.floor(S.blocksDropped / cfg.hintEvery);

  updateUrgency();
  if (stage <= S.hintStage || S.hintStage > syllables) return;
  S.hintStage = stage;

  if (S.hintStage <= syllables) {
    const char = chosungOf([...S.targetWord][S.hintStage - 1]);
    setHintChosung(S.hintStage - 1, char);
    setMsg(`💡 ${S.hintStage}번째 글자 첫소리는 "${char}"`, 'var(--warn)');
    return;
  }

  revealBlanks(false);
  setMsg(`💡 정답은 "${S.targetWord}" — 다음 낱말로 넘어갑니다`, 'var(--bad)');

  // 목표를 놓쳤으므로 이어 오던 콤보가 끊깁니다.
  if (S.combo > 0) {
    S.combo = 0;
    updateCombo();
  }

  if (S.skipTimer) clearTimeout(S.skipTimer);
  S.skipTimer = setTimeout(() => {
    setMsg('');
    S.skipMissedOnce = true;
    selectNewTarget(true);
    spawnIfIdle();
    draw();
  }, SKIP_MS);
}

/* ══ 조작 ══ */

function busy() {
  return !S.cur || S.clearing || S.gameOver || S.removeMode || S.paused || S.awaitingAdvance;
}

export function moveLeft() {
  if (busy()) return;
  if (isFree(S.cur.row, S.cur.col - 1)) {
    S.cur.col -= 1;
    draw();
  }
}

export function moveRight() {
  if (busy()) return;
  if (isFree(S.cur.row, S.cur.col + 1)) {
    S.cur.col += 1;
    draw();
  }
}

export function hardDrop() {
  if (busy()) return;
  S.cur.row = landingRow();
  lock();
  draw();
}

export function setSoftDrop(on) {
  S.softDrop = on;
}

export function doHold() {
  if (busy() || S.holdUsed) return;
  const prev = S.holdUnit;
  S.holdUnit = S.cur.u;
  if (prev !== null) {
    S.cur.u = prev;
  } else {
    S.cur = null;
    spawn();      // spawn 이 holdUsed 를 되돌리므로 그 뒤에 잠급니다.
  }
  S.holdUsed = true;
  updateHold();
  draw();
}

/** 지우개로 블록 하나를 없앱니다. */
export function eraseCell(row, col) {
  if (!S.removeMode || S.clearing || S.gameOver || S.paused) return;

  const valid = row >= 0 && row < ROWS && col >= 0 && col < COLS && S.field[row][col] !== null;
  S.removeMode = false;
  setCursor('default');
  setMsg('');

  if (!valid) {
    updateStars();
    draw();
    return;
  }

  S.field[row][col] = null;
  S.stars -= 1;
  applyGravity();
  updateStars();
  draw();
  resolve(0, dirtyFromColumns([col]));
}

/** 보석으로 한 줄을 통째로 없앱니다. */
export function eraseRow(row) {
  if (!S.gemMode || S.clearing || S.gameOver || S.paused) return;

  const valid = row >= 0 && row < ROWS && S.field[row].some((u) => u !== null);
  S.gemMode = false;
  S.hoverRow = null;
  setCursor('default');
  setMsg('');

  if (!valid) {
    updateGems();
    draw();
    return;
  }

  let cleared = 0;
  for (let c = 0; c < COLS; c += 1) {
    if (S.field[row][c] !== null) cleared += 1;
    S.field[row][c] = null;
  }
  S.gems -= 1;
  applyGravity();
  updateGems();
  draw();
  showToast('💎', `${cleared}칸을 지웠습니다`);

  const allColumns = Array.from({ length: COLS }, (_, c) => c);
  resolve(0, dirtyFromColumns(allColumns));
}

/* ══ 잠시 멈춤 ══ */

export function togglePause() {
  if (S.gameOver || !S.running || S.awaitingAdvance) return;
  if (!S.paused) {
    if (S.pauseLeft <= 0) {
      setMsg('정지 기회를 모두 썼어요', 'var(--bad)');
      return;
    }
    S.paused = true;
    S.pauseLeft -= 1;
    showPauseModal();
  } else {
    S.paused = false;
    S.lastT = 0;
    hideOverlay();
  }
}

/** 놀이를 멈추고 시작 화면으로 돌아갑니다. */
export function quitToHome() {
  S.running = false;
  S.gameOver = true;
  S.paused = false;
  if (S.animId) cancelAnimationFrame(S.animId);
  S.animId = null;
  showModal('modal-start');
}

/* ══ 되풀이 ══ */

function loop(t) {
  if (!S.lastT) S.lastT = t;
  const dt = t - S.lastT;
  S.lastT = t;

  const active = S.running && !S.clearing && !S.gameOver && !S.paused && !S.removeMode && !S.awaitingAdvance;
  if (active && S.cur) {
    S.dropAcc += dt;
    const interval = S.softDrop ? SOFT_DROP_MS : levelConfig(S.level).speed;
    if (S.dropAcc >= interval) {
      S.dropAcc = 0;
      if (isFree(S.cur.row + 1, S.cur.col)) S.cur.row += 1;
      else lock();
      draw();
    }
  }

  S.animId = requestAnimationFrame(loop);
}

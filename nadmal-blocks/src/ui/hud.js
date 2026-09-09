/**
 * 판 바깥의 화면 요소를 갱신합니다.
 * 점수, 단계 진행 바, 힌트 카드, 다음 블록, 보관 칸, 별, 완성 낱말 목록을 다룹니다.
 */

import { S } from '../core/state.js';
import { levelConfig, stageLabel } from '../config/levels.js';
import { meaningOf } from '../core/dictionary.js';
import { unitStyle, draw, setCursor } from './render.js';

const $ = (id) => document.getElementById(id);

/** 다음 블록을 몇 개까지 미리 보여 줄지 정합니다. */
const NEXT_PREVIEW = 3;

/** 알림이 화면에 머무는 시간입니다. */
const TOAST_MS = 1300;

export function updateAll() {
  updateScore();
  updateStageBar();
  updateHintPanel();
  updateUrgency();
  updateNext();
  updateHold();
  updateStars();
}

export function updateScore() {
  $('score-val').textContent = S.score.toLocaleString();
  $('h-level').textContent = S.level;
  const label = $('rail-lbl');
  if (label) label.textContent = S.wordCount ? `MADE ${S.wordCount}` : 'MADE';
}

export function updateStageBar() {
  const { goal } = levelConfig(S.level);
  $('stage-name').textContent = stageLabel(S.level);
  $('stage-count').textContent = `${Math.min(S.levelWords, goal)}/${goal}`;
  $('stage-fill').style.width = `${Math.min(100, (S.levelWords / goal) * 100)}%`;
}

/** 힌트가 나오기까지 남은 정도를 막대로 보여 줍니다. 빨라질수록 색이 진해집니다. */
export function updateUrgency() {
  const cfg = levelConfig(S.level);
  const syllables = [...S.targetWord].length || 2;
  const total = cfg.hintEvery * (syllables + 1);
  const pct = Math.min(100, (S.blocksDropped / total) * 100);

  const fill = $('urgency-fill');
  fill.style.width = `${pct}%`;
  fill.style.background =
    pct < 40 ? 'linear-gradient(90deg,var(--primary),var(--accent))'
    : pct < 75 ? 'linear-gradient(90deg,var(--warn),#ff8c00)'
    : 'linear-gradient(90deg,var(--bad),#ff0055)';
}

export function updateNext() {
  const row = $('next-row');
  row.innerHTML = '<span class="lbl">NEXT</span>';
  for (let i = 0; i < NEXT_PREVIEW; i += 1) {
    const unit = S.queue[i];
    if (!unit) break;
    const style = unitStyle(unit);
    const el = document.createElement('div');
    el.className = `nblock${i === 0 ? ' n0' : ''}`;
    el.style.background = `linear-gradient(160deg,${style.from},${style.to})`;
    el.style.color = style.ink;
    el.textContent = unit;
    row.appendChild(el);
  }
}

export function updateHold() {
  const el = $('hold-jamo');
  if (!S.holdUnit) {
    el.textContent = '—';
    el.className = 'empty';
    el.style.color = '';
  } else {
    el.textContent = S.holdUnit;
    el.className = '';
    el.style.color = unitStyle(S.holdUnit).to;
  }
  $('hold-btn').style.opacity = S.holdUsed ? '.45' : '1';
}

export function updateStars() {
  const row = $('stars-row');
  row.innerHTML = '';
  for (let i = 0; i < 5; i += 1) {
    const available = i < S.stars;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `star-btn ${available ? 'avail' : 'used'}${S.removeMode && available ? ' on' : ''}`;
    btn.textContent = available ? '★' : '☆';
    btn.title = available ? '지우개로 쓰기' : '이미 썼어요';
    if (available) btn.addEventListener('click', toggleRemove);
    row.appendChild(btn);
  }
}

/** 지우개 모드를 켜고 끕니다. */
export function toggleRemove() {
  if (S.gameOver || S.clearing || S.paused || S.awaitingAdvance) return;
  S.removeMode = !S.removeMode;
  setCursor(S.removeMode ? 'crosshair' : 'default');
  setMsg(S.removeMode ? '🗑 지울 블록을 누르세요' : '');
  updateStars();
  draw();
}

export function setMsg(text, color) {
  const el = $('board-msg');
  el.textContent = text || '';
  el.style.color = color || 'var(--dim)';
}

let toastTimer = null;
export function showToast(title, sub) {
  const el = $('toast');
  $('toast-w').textContent = title;
  $('toast-s').textContent = sub || '';
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), TOAST_MS);
}

export function addRail(word, isTarget) {
  S.madeWords.push(word);
  const rail = $('rail');
  const badge = document.createElement('div');
  badge.className = `word-badge${isTarget ? '' : ' bonus'}`;
  badge.textContent = word;
  rail.appendChild(badge);
  rail.scrollLeft = 99999;
}

export function clearRail() {
  $('rail').innerHTML = '<span class="lbl" id="rail-lbl">MADE</span>';
}

/** 힌트 카드를 다시 그립니다. 현재 목표와 예고 낱말을 좌우로 넘겨 볼 수 있습니다. */
export function updateHintPanel() {
  const word = S.hintViewIdx === 0 ? S.targetWord : S.targetQueue[S.hintViewIdx - 1];
  const total = Math.min(1 + S.targetQueue.length, 3);

  const tag = $('hint-tag');
  if (S.hintViewIdx === 0) {
    tag.textContent = '▶ 현재 목표';
    tag.style.color = 'var(--good)';
  } else {
    tag.textContent = `⏭ 다음 ${S.hintViewIdx}번째`;
    tag.style.color = 'var(--accent)';
  }

  $('hint-index').textContent = `${S.hintViewIdx + 1} / ${total}`;
  $('hint-prev').style.opacity = S.hintViewIdx > 0 ? '1' : '.3';
  $('hint-next').style.opacity = S.hintViewIdx < total - 1 ? '1' : '.3';

  if (!word) return;

  $('hint-meaning').textContent = meaningOf(word);

  const blanks = $('hint-blanks');
  blanks.innerHTML = '';
  const chars = [...word];
  chars.forEach((_, i) => {
    const box = document.createElement('div');
    box.className = 'blank-box';
    box.textContent = '?';
    if (S.hintViewIdx === 0) box.id = `blank-${i}`;
    else box.style.opacity = '.55';
    blanks.appendChild(box);

    if (i < chars.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'blank-sep';
      sep.textContent = '·';
      blanks.appendChild(sep);
    }
  });

  $('hint-glabel').textContent = `(${chars.length}글자)`;
}

/** 힌트 칸 하나에 첫소리를 채웁니다. */
export function setHintChosung(index, char) {
  const box = $(`blank-${index}`);
  if (box) {
    box.textContent = char;
    box.className = 'blank-box hint';
  }
}

/** 목표 낱말을 전부 드러냅니다. 맞혔을 때는 초록색, 시간이 다 됐을 때는 보라색입니다. */
export function revealBlanks(solved) {
  [...S.targetWord].forEach((ch, i) => {
    const box = $(`blank-${i}`);
    if (box) {
      box.textContent = ch;
      box.className = `blank-box ${solved ? 'done' : 'hint'}`;
    }
  });
}

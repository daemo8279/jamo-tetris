/**
 * 오버레이 위에 뜨는 화면들입니다.
 * 이 파일은 보여 주는 일만 맡습니다. 게임 상태를 바꾸는 판단은 core/game.js 가 합니다.
 */

import { S } from '../core/state.js';
import { player, setName, normalizeName, NAME_MAX } from '../services/player.js';
import { loadScores, SHOW_LIMIT } from '../services/ranking.js';

const $ = (id) => document.getElementById(id);

const MODAL_IDS = [
  'modal-start',
  'modal-name',
  'modal-demo',
  'modal-advance',
  'modal-pause',
  'modal-gameover',
  'modal-rank',
  'modal-howto'
];

export function showModal(id) {
  $('overlay').classList.remove('hidden');
  MODAL_IDS.forEach((m) => $(m).classList.toggle('hidden', m !== id));
}

export function hideOverlay() {
  $('overlay').classList.add('hidden');
}

export function isOverlayOpen() {
  return !$('overlay').classList.contains('hidden');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ══ 시작 화면 ══ */

/** 시작 화면에 지금 닉네임을 보여 줍니다. */
export function renderStartScreen() {
  const row = $('start-player');
  const nameEl = $('start-player-name');
  if (!row || !nameEl) return;
  if (player.name) {
    nameEl.textContent = player.name;
    row.style.display = '';
  } else {
    row.style.display = 'none';
  }
}

export function showStart() {
  renderStartScreen();
  showModal('modal-start');
}

/* ══ 닉네임 입력 ══ */

let onNameConfirm = null;

/**
 * 닉네임 입력 화면을 엽니다.
 * @param {(name:string)=>void} onConfirm 이름이 정해진 뒤에 이어서 할 일
 * @param {{title?:string, desc?:string, cancelable?:boolean}} [opt]
 */
export function openNamePrompt(onConfirm, opt = {}) {
  onNameConfirm = onConfirm;
  $('name-title').textContent = opt.title || (player.name ? '닉네임 바꾸기' : '닉네임을 정해 주세요');
  $('name-desc').textContent = opt.desc || '랭킹에 이 이름으로 기록이 남습니다.';
  $('name-cancel').style.display = opt.cancelable ? '' : 'none';

  const input = $('name-input');
  input.value = player.name || '';
  setNameError('');
  showModal('modal-name');

  // 화면이 뜬 뒤에 focus 를 주어야 모바일에서 자판이 제대로 올라옵니다.
  setTimeout(() => {
    input.focus();
    input.select();
  }, 60);
}

function setNameError(text) {
  const el = $('name-error');
  el.textContent = text || '';
  el.style.visibility = text ? 'visible' : 'hidden';
}

function confirmName() {
  const raw = $('name-input').value;
  const name = normalizeName(raw);
  if (!name) {
    setNameError('한 글자 이상 입력해 주세요.');
    $('name-input').focus();
    return;
  }
  setName(name);
  renderStartScreen();
  const next = onNameConfirm;
  onNameConfirm = null;
  if (next) next(player.name);
}

/** 닉네임 입력 화면의 버튼과 자판을 연결합니다. 시작할 때 한 번만 부릅니다. */
export function initNameForm() {
  const input = $('name-input');
  input.maxLength = NAME_MAX;

  $('name-confirm').addEventListener('click', confirmName);
  $('name-cancel').addEventListener('click', () => {
    onNameConfirm = null;
    showStart();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmName();
    }
  });
  input.addEventListener('input', () => setNameError(''));
}

/* ══ 레벨 넘김 ══ */

export function showAdvanceModal() {
  $('adv-score').textContent = S.score.toLocaleString();
  $('adv-words').textContent = S.wordCount;
  showModal('modal-advance');
}

/* ══ 잠시 멈춤 ══ */

export function showPauseModal() {
  $('pause-info').textContent = `남은 정지 기회: ${S.pauseLeft}회`;
  showModal('modal-pause');
}

/* ══ 게임 종료 ══ */

/**
 * @param {boolean} cleared 스스로 마친 것인지(true), 판이 막혀 끝난 것인지(false)
 */
export function showGameOverModal(cleared) {
  $('go-emoji').textContent = cleared ? '🎊' : '🏁';
  $('go-title').textContent = cleared ? '수고했어요!' : '게임 종료';
  $('go-player').textContent = player.name || '익명';
  $('go-score').textContent = S.score.toLocaleString();
  $('go-level').textContent = S.level;
  $('go-words').textContent = S.wordCount;

  const box = $('go-badges');
  box.innerHTML = '';
  if (!S.madeWords.length) {
    box.innerHTML = '<span class="empty-note">완성한 낱말이 없어요</span>';
  } else {
    [...new Set(S.madeWords)].forEach((w) => {
      const badge = document.createElement('span');
      badge.className = 'go-badge';
      badge.textContent = w;
      box.appendChild(badge);
    });
  }

  const submit = $('go-submit');
  submit.disabled = false;
  submit.textContent = '🏆 랭킹에 올리기';

  showModal('modal-gameover');
}

/** 랭킹 등록을 마쳤을 때 버튼을 잠급니다. 같은 기록이 여러 번 올라가지 않게 합니다. */
export function markScoreSubmitted() {
  const submit = $('go-submit');
  submit.disabled = true;
  submit.textContent = '✅ 등록했어요';
}

/* ══ 랭킹 ══ */

export async function showRankingModal() {
  const box = $('rank-list');
  box.innerHTML = '<p class="empty-note">불러오는 중…</p>';
  showModal('modal-rank');

  const list = (await loadScores()).slice(0, SHOW_LIMIT);
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<p class="empty-note">아직 기록이 없어요.</p>';
    return;
  }

  list.forEach((entry, i) => {
    const row = document.createElement('div');
    const isMe = entry.name === player.name;
    row.className = `rank-row${i < 3 ? ` top${i + 1}` : ''}${isMe ? ' me' : ''}`;
    row.innerHTML =
      `<span class="n">${i + 1}</span>` +
      `<span class="nm">${escapeHtml(entry.name)}</span>` +
      `<span class="lv">LV${entry.level} · ${entry.words}낱말</span>` +
      `<span class="sc">${(entry.score || 0).toLocaleString()}</span>`;
    box.appendChild(row);
  });
}

/* ══ 놀이 방법 ══ */

export function showHowto() {
  showModal('modal-howto');
}

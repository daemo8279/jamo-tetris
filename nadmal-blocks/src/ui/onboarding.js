/**
 * 온보딩 데모입니다.
 * 블록이 실제로 떨어지고 사라지는 장면을 보여 주어 규칙을 말보다 먼저 이해하게 합니다.
 *
 * 장면을 넘길 때마다 앞 장면의 상태를 즉시 확정하므로,
 * 「다음」을 빠르게 눌러도 블록이 남거나 어긋나지 않습니다.
 */

import { unitStyle } from './render.js';
import { showModal, hideOverlay } from './modals.js';

/** 장면 하나가 화면에 머무는 기본 시간입니다. */
const FRAME_MS = 1500;

/** 블록이 하나씩 나타나는 간격입니다. */
const PLACE_STEP_MS = 260;

/** 사라지는 연출에 걸리는 시간입니다. */
const CLEAR_MS = 380;
const FADE_MS = 320;

export const DEMOS = {
  syl: {
    pill: '1~5단계 · 글자 블록',
    pillClass: '',
    title: '글자 블록 익히기',
    cols: 4,
    rows: 4,
    frames: [
      { cap: '글자가 적힌 블록이 하나씩 떨어집니다.', place: [[3, 1, '나']] },
      { cap: '가로는 <b>왼쪽에서 오른쪽</b>으로 읽어요.', place: [[3, 2, '무']] },
      { cap: '「나무」 완성! 블록이 사라집니다.', clear: true },
      { cap: '세로는 <b>위에서 아래</b>로 읽어요.', place: [[3, 1, '무']] },
      { cap: '아래에 「무」, 위에 「나」를 놓으면 「나무」!', place: [[2, 1, '나']] },
      { cap: '보이는 그대로 읽어서 맞으면 사라집니다.', clear: true }
    ]
  },
  jamo: {
    pill: '6~15단계 · 자모 블록',
    pillClass: 'jamo',
    title: '자모 블록 익히기',
    cols: 5,
    rows: 4,
    frames: [
      { cap: '이제 <b>자음과 모음</b>이 따로 떨어집니다.', place: [[3, 0, 'ㄴ']] },
      { cap: 'ㄴ ㅏ ㅁ ㅜ 를 모으면 「나무」가 됩니다.', place: [[3, 1, 'ㅏ'], [3, 2, 'ㅁ'], [3, 3, 'ㅜ']] },
      { cap: '완성! 블록이 사라집니다.', clear: true },
      { cap: '위아래로 <b>이어져 있기만</b> 하면', place: [[3, 1, 'ㄴ'], [3, 2, 'ㅏ']] },
      { cap: '이렇게 꺾인 모양도 인정됩니다.', place: [[2, 2, 'ㅁ'], [2, 3, 'ㅜ']] },
      { cap: '자모만 다 모으면 순서가 달라도 괜찮아요.', clear: true }
    ]
  }
};

let demo = { spec: null, index: -1, timers: [], finals: [], onDone: null, placed: [] };

function cellId(r, c) {
  return `dc-${r}-${c}`;
}

function paint(r, c, unit) {
  const el = document.getElementById(cellId(r, c));
  if (!el) return;
  const style = unitStyle(unit);
  el.textContent = unit;
  el.style.background = `linear-gradient(160deg,${style.from},${style.to})`;
  el.style.color = style.ink;
  el.className = 'dcell drop';
}

function wipe(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'dcell empty';
  el.textContent = '';
  el.style.background = '';
}

function later(fn, ms) {
  demo.timers.push(setTimeout(fn, ms));
}

/** 예약된 동작을 모두 취소하고, 그 결과만 즉시 반영합니다. */
function flush() {
  demo.timers.forEach(clearTimeout);
  demo.timers = [];
  demo.finals.forEach((fn) => fn());
  demo.finals = [];
}

function buildGrid(spec) {
  const grid = document.getElementById('demo-grid');
  const size = Math.min(44, Math.floor((Math.min(window.innerWidth, 400) - 96) / spec.cols));
  grid.style.gridTemplateColumns = `repeat(${spec.cols},${size}px)`;
  grid.style.gridTemplateRows = `repeat(${spec.rows},${size}px)`;
  grid.innerHTML = '';
  for (let r = 0; r < spec.rows; r += 1) {
    for (let c = 0; c < spec.cols; c += 1) {
      const el = document.createElement('div');
      el.className = 'dcell empty';
      el.id = cellId(r, c);
      el.style.fontSize = `${Math.floor(size * 0.5)}px`;
      grid.appendChild(el);
    }
  }

  const dots = document.getElementById('demo-dots');
  dots.innerHTML = '';
  spec.frames.forEach(() => {
    const dot = document.createElement('div');
    dot.className = 'ddot';
    dots.appendChild(dot);
  });
}

/**
 * 데모를 재생합니다.
 * @param {'syl'|'jamo'} kind
 * @param {() => void} onDone 데모가 끝나거나 건너뛰었을 때 이어서 할 일
 */
export function playDemo(kind, onDone) {
  const spec = DEMOS[kind];
  flush();
  demo = { spec, index: -1, timers: [], finals: [], onDone, placed: [] };

  const pill = document.getElementById('demo-pill');
  pill.textContent = spec.pill;
  pill.className = `mode-pill ${spec.pillClass}`;
  document.getElementById('demo-title').textContent = spec.title;

  buildGrid(spec);
  showModal('modal-demo');
  stepDemo();
}

/** 다음 장면으로 넘어갑니다. 「다음」 버튼과 자동 재생이 같이 씁니다. */
export function stepDemo() {
  flush();
  const spec = demo.spec;
  if (!spec) return;

  demo.index += 1;
  if (demo.index >= spec.frames.length) {
    finishDemo();
    return;
  }

  const frame = spec.frames[demo.index];
  document.getElementById('demo-caption').innerHTML = frame.cap;
  [...document.getElementById('demo-dots').children].forEach((dot, i) => {
    dot.classList.toggle('on', i === demo.index);
  });

  if (frame.clear) {
    const ids = demo.placed.slice();
    demo.placed = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hit');
    });
    demo.finals.push(() => ids.forEach(wipe));
    later(() => {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('gone');
      });
      later(() => ids.forEach(wipe), FADE_MS);
    }, CLEAR_MS);
  }

  if (frame.place) {
    frame.place.forEach(([r, c, unit], i) => {
      demo.placed.push(cellId(r, c));
      later(() => paint(r, c, unit), i * PLACE_STEP_MS);
    });
    demo.finals.push(() => frame.place.forEach(([r, c, unit]) => paint(r, c, unit)));
  }

  const isLast = demo.index === spec.frames.length - 1;
  document.getElementById('demo-next').textContent = isLast ? '시작하기 ▶' : '다음 ›';

  const wait = (frame.place ? frame.place.length * PLACE_STEP_MS : 0) + FRAME_MS;
  later(stepDemo, wait);
}

/** 데모를 끝냅니다. 건너뛰기 버튼도 이 함수를 부릅니다. */
export function finishDemo() {
  flush();
  const next = demo.onDone;
  demo.onDone = null;
  demo.spec = null;
  hideOverlay();
  if (next) next();
}

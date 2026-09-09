/**
 * 판에서 완성된 낱말을 찾아냅니다.
 *
 * 읽는 방향은 두 방식 모두 같습니다. 가로는 왼쪽에서 오른쪽으로, 세로는 위에서 아래로
 * 읽습니다. 화면에 보이는 그대로 읽어서 맞아야 하므로, 세로로 「나무」를 만들려면
 * 「무」를 먼저 떨어뜨리고 그 위에 「나」를 얹어야 합니다.
 *
 * 인정 기준은 방식마다 다릅니다.
 *   글자 블록  순서를 그대로 맞춰야 합니다. 목표 낱말 외에 사전에 있는 낱말도 보너스로 인정합니다.
 *   자모 블록  자모 개수가 같고, 순서대로 조합해 목표와 같거나 자모 구성이 같으면 인정합니다.
 *              또한 상하좌우로 이어져 있으면 꺾인 모양도 인정합니다.
 */

import { S } from './state.js';
import { COLS, ROWS } from './board.js';
import { decompose, assemble, jamoSignature } from './hangul.js';
import { modeOf } from '../config/levels.js';
import { DICT } from './dictionary.js';

/** 글자 블록에서 살펴볼 구간 길이의 상한입니다. 낱말이 최대 3음절이기 때문입니다. */
const MAX_SYLLABLES = 3;

/**
 * 이어진 덩어리를 훑는 탐색의 상한입니다.
 * 판이 극단적으로 빽빽해도 이 횟수에서 멈춰 화면이 굳지 않게 합니다.
 */
const CONNECT_BUDGET = 200000;

/* ══ 인정 기준 ══ */

/** 자모 배열이 목표 낱말과 맞는지 봅니다. 순서가 맞거나 자모 구성이 같으면 인정합니다. */
export function matchTargetJamo(units) {
  if (!S.targetWord) return null;
  const target = decompose(S.targetWord);
  if (units.length !== target.length) return null;
  if (assemble(units) === S.targetWord) return S.targetWord;
  if (jamoSignature(units) === jamoSignature(target)) return S.targetWord;
  return null;
}

/** 음절 배열을 보이는 순서 그대로 읽어 목표 낱말 또는 사전 낱말과 견줍니다. */
export function matchSyllables(units) {
  const word = units.join('');
  if (word === S.targetWord) return { word, target: true };
  if (units.length >= 2 && DICT.has(word)) return { word, target: false };
  return null;
}

/* ══ 판 훑기 ══ */

/** 가로와 세로에서 블록이 끊기지 않고 이어진 구간을 모읍니다. */
function scanRuns() {
  const runs = [];

  for (let r = 0; r < ROWS; r += 1) {
    let run = [];
    for (let c = 0; c <= COLS; c += 1) {
      if (c < COLS && S.field[r][c] !== null) {
        run.push({ r, c });
      } else {
        if (run.length >= 2) runs.push({ dir: 'h', cells: run });
        run = [];
      }
    }
  }

  for (let c = 0; c < COLS; c += 1) {
    let run = [];
    for (let r = 0; r <= ROWS; r += 1) {
      if (r < ROWS && S.field[r][c] !== null) {
        run.push({ r, c });
      } else {
        if (run.length >= 2) runs.push({ dir: 'v', cells: run });
        run = [];
      }
    }
  }

  return runs;
}

/**
 * 완성된 낱말을 모두 찾습니다.
 * @param {{r:number,c:number}[]} [dirty] 방금 바뀐 칸들. 넘기면 탐색 범위를 크게 줄일 수 있습니다.
 */
export function findMatches(dirty) {
  const found = [];
  const runs = scanRuns();

  if (modeOf(S.level) === 'syl') {
    for (const run of runs) {
      const n = run.cells.length;
      for (let s = 0; s < n; s += 1) {
        for (let e = s + 2; e <= Math.min(n, s + MAX_SYLLABLES); e += 1) {
          const cells = run.cells.slice(s, e);
          const hit = matchSyllables(cells.map((x) => S.field[x.r][x.c]));
          if (hit) {
            found.push({ dir: run.dir, cells, word: hit.word, target: hit.target, len: cells.length });
          }
        }
      }
    }
    return found;
  }

  const targetLen = decompose(S.targetWord).length;
  for (const run of runs) {
    for (let s = 0; s + targetLen <= run.cells.length; s += 1) {
      const cells = run.cells.slice(s, s + targetLen);
      if (matchTargetJamo(cells.map((x) => S.field[x.r][x.c]))) {
        found.push({ dir: run.dir, cells, word: S.targetWord, target: true, len: targetLen });
      }
    }
  }

  findConnected(found, targetLen, dirty);
  return found;
}

/**
 * 상하좌우로 이어진 덩어리 안에서 목표 자모 구성과 같은 부분집합을 찾습니다.
 *
 * 이어진 부분집합의 수는 크기가 커질수록 폭발적으로 늘어납니다. 3음절 낱말은 자모가
 * 최대 9개라서 아무 대책 없이 훑으면 한 번 판정하는 데 수십 초가 걸립니다.
 * 그래서 네 가지 장치로 탐색량을 억제합니다.
 *
 *   1) 방금 바뀐 칸을 반드시 포함하는 조합만 살펴봅니다.
 *      바뀌지 않은 칸들끼리의 조합은 직전 판정에서 이미 확인했습니다.
 *   2) 목표 낱말에 없는 자모를 만나면 그 자리에서 가지를 쳐냅니다.
 *   3) 같은 조합을 여러 순서로 다시 훑지 않도록 진행 도중에 걸러 냅니다.
 *   4) 그래도 판이 빽빽하면 상한에서 멈춥니다.
 */
function findConnected(found, targetLen, dirty) {
  if (targetLen < 2) return;

  const keyOf = (r, c) => r * COLS + c;
  const unitAt = (k) => S.field[Math.floor(k / COLS)][k % COLS];

  const need = {};
  for (const j of decompose(S.targetWord)) need[j] = (need[j] || 0) + 1;

  const anchors = [];
  if (dirty && dirty.length) {
    for (const d of dirty) {
      if (S.field[d.r] && S.field[d.r][d.c] !== null) anchors.push(d);
    }
  } else {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (S.field[r][c] !== null) anchors.push({ r, c });
      }
    }
  }
  if (!anchors.length) return;

  const taken = new Set(
    found.map((f) => f.cells.map((x) => keyOf(x.r, x.c)).sort((a, b) => a - b).join(','))
  );
  const walked = new Set();
  const remaining = { ...need };
  const chosen = [];
  const inSet = new Set();
  let budget = CONNECT_BUDGET;

  function grow() {
    budget -= 1;
    if (budget <= 0) return;

    const sig = chosen.slice().sort((a, b) => a - b).join(',');
    if (walked.has(sig)) return;
    walked.add(sig);

    if (chosen.length === targetLen) {
      if (taken.has(sig)) return;
      taken.add(sig);
      found.push({
        dir: 'connected',
        target: true,
        word: S.targetWord,
        len: targetLen,
        cells: chosen.map((k) => ({ r: Math.floor(k / COLS), c: k % COLS }))
      });
      return;
    }

    const frontier = new Set();
    for (const k of chosen) {
      const r = Math.floor(k / COLS);
      const c = k % COLS;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (S.field[nr][nc] === null) continue;
        const nk = keyOf(nr, nc);
        if (!inSet.has(nk)) frontier.add(nk);
      }
    }

    for (const nk of frontier) {
      const u = unitAt(nk);
      if (!remaining[u]) continue;
      remaining[u] -= 1;
      inSet.add(nk);
      chosen.push(nk);
      grow();
      chosen.pop();
      inSet.delete(nk);
      remaining[u] += 1;
      if (budget <= 0) return;
    }
  }

  for (const a of anchors) {
    const u = S.field[a.r][a.c];
    if (!remaining[u]) continue;
    const k = keyOf(a.r, a.c);
    remaining[u] -= 1;
    inSet.add(k);
    chosen.push(k);
    grow();
    chosen.pop();
    inSet.delete(k);
    remaining[u] += 1;
    if (budget <= 0) break;
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';

import { S } from '../src/core/state.js';
import { COLS, ROWS, createField, applyGravity } from '../src/core/board.js';
import { findMatches } from '../src/core/matcher.js';
import { decompose } from '../src/core/hangul.js';

const BOTTOM = ROWS - 1;

function reset(level, targetWord) {
  S.level = level;
  S.targetWord = targetWord;
  S.field = createField();
}

/** 가로로 왼쪽부터 늘어놓습니다. */
function placeRow(row, startCol, units) {
  units.forEach((u, i) => {
    S.field[row][startCol + i] = u;
  });
}

/** 세로로 위에서부터 늘어놓습니다. */
function placeCol(col, startRow, units) {
  units.forEach((u, i) => {
    S.field[startRow + i][col] = u;
  });
}

const everywhere = () => {
  const out = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) if (S.field[r][c] !== null) out.push({ r, c });
  }
  return out;
};

/* ══ 글자 블록 (1~5단계) ══ */

test('글자 블록: 가로를 왼쪽에서 오른쪽으로 읽어 맞으면 인정합니다', () => {
  reset(1, '나무');
  placeRow(BOTTOM, 2, ['나', '무']);
  const found = findMatches(everywhere());
  assert.equal(found.length, 1);
  assert.equal(found[0].word, '나무');
  assert.equal(found[0].target, true);
});

test('글자 블록: 가로 순서가 뒤집히면 인정하지 않습니다', () => {
  reset(1, '나무');
  placeRow(BOTTOM, 2, ['무', '나']);
  assert.equal(findMatches(everywhere()).length, 0);
});

test('글자 블록: 세로를 위에서 아래로 읽어 맞으면 인정합니다', () => {
  reset(1, '나무');
  placeCol(4, BOTTOM - 1, ['나', '무']);
  const found = findMatches(everywhere());
  assert.equal(found.length, 1);
  assert.equal(found[0].dir, 'v');
});

test('글자 블록: 세로 순서가 뒤집히면 인정하지 않습니다', () => {
  reset(1, '나무');
  placeCol(4, BOTTOM - 1, ['무', '나']);
  assert.equal(findMatches(everywhere()).length, 0);
});

test('글자 블록: 3음절 낱말도 인정합니다', () => {
  reset(4, '무지개');
  placeRow(BOTTOM, 1, ['무', '지', '개']);
  const found = findMatches(everywhere());
  assert.ok(found.some((m) => m.word === '무지개' && m.target));
});

test('글자 블록: 목표가 아니어도 사전에 있으면 보너스로 인정합니다', () => {
  reset(1, '나무');
  placeRow(BOTTOM, 2, ['바', '다']);
  const found = findMatches(everywhere());
  assert.equal(found.length, 1);
  assert.equal(found[0].word, '바다');
  assert.equal(found[0].target, false);
});

test('글자 블록: 사전에 없는 조합은 인정하지 않습니다', () => {
  reset(1, '나무');
  placeRow(BOTTOM, 2, ['무', '개']);
  assert.equal(findMatches(everywhere()).length, 0);
});

/* ══ 자모 블록 (6단계~) ══ */

test('자모 블록: 순서대로 놓으면 인정합니다', () => {
  reset(7, '나무');
  placeRow(BOTTOM, 1, decompose('나무'));
  assert.ok(findMatches(everywhere()).length >= 1);
});

test('자모 블록: 순서가 달라도 자모만 다 모으면 인정합니다', () => {
  reset(7, '나무');
  placeRow(BOTTOM, 1, [...decompose('나무')].reverse());
  assert.ok(findMatches(everywhere()).length >= 1);
});

test('자모 블록: 자모 하나라도 모자라면 인정하지 않습니다', () => {
  reset(7, '나무');
  placeRow(BOTTOM, 1, ['ㄴ', 'ㅏ', 'ㅁ']);
  assert.equal(findMatches(everywhere()).length, 0);
});

test('자모 블록: 상하좌우로 이어져 있으면 꺾인 모양도 인정합니다', () => {
  reset(7, '나무');
  const [a, b, c, d] = decompose('나무');
  S.field[BOTTOM][1] = a;
  S.field[BOTTOM][2] = b;
  S.field[BOTTOM - 1][2] = c;
  S.field[BOTTOM - 1][3] = d;
  const found = findMatches(everywhere());
  assert.ok(found.some((m) => m.dir === 'connected'));
});

test('자모 블록: 떨어져 있으면 인정하지 않습니다', () => {
  reset(7, '나무');
  const [a, b, c, d] = decompose('나무');
  S.field[BOTTOM][0] = a;
  S.field[BOTTOM][1] = b;
  S.field[BOTTOM][8] = c;   // 사이가 비어 있어 이어지지 않습니다
  S.field[BOTTOM][9] = d;
  assert.equal(findMatches(everywhere()).length, 0);
});

test('자모 블록: 자모가 9개인 낱말도 가로 한 줄에 들어갑니다', () => {
  reset(15, '박물관');
  const jamo = decompose('박물관');
  assert.equal(jamo.length, 9);
  assert.ok(jamo.length <= COLS, '판 너비가 부족합니다');
  placeRow(BOTTOM, 0, jamo);
  assert.ok(findMatches(everywhere()).length >= 1);
});

/* ══ 성능 ══ */

test('판이 가득 차도 판정이 오래 걸리지 않습니다', () => {
  reset(15, '박물관');
  const jamo = decompose('박물관');
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      S.field[r][c] = jamo[(r * COLS + c) % jamo.length];
    }
  }
  const started = Date.now();
  findMatches([{ r: 5, c: 5 }]);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 500, `판정에 ${elapsed}ms 걸렸습니다`);
});

/* ══ 판 동작 ══ */

test('중력을 적용하면 블록이 아래로 내려앉습니다', () => {
  S.field = createField();
  S.field[0][3] = 'ㄱ';
  S.field[5][3] = 'ㄴ';
  applyGravity();
  assert.equal(S.field[ROWS - 1][3], 'ㄴ');
  assert.equal(S.field[ROWS - 2][3], 'ㄱ');
  assert.equal(S.field[0][3], null);
});

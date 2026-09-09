/**
 * 판의 크기와 판을 다루는 기본 동작입니다.
 *
 * 판 너비를 10칸으로 잡은 이유가 있습니다. 3음절 낱말 가운데 「박물관」처럼
 * 자모가 9개인 것이 있어서, 8칸이던 원래 크기로는 가로로 늘어놓을 수 없었습니다.
 */

import { S } from './state.js';

export const COLS = 10;
export const ROWS = 12;

/** 새 블록이 나타나는 열입니다. 이 칸이 막히면 판이 끝납니다. */
export const SPAWN_COL = Math.floor(COLS / 2);

/** 빈 판을 만듭니다. */
export function createField() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

/** 판 안이면서 비어 있는 칸인지 확인합니다. */
export function isFree(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS && S.field[row][col] === null;
}

/** 판 안의 칸인지 확인합니다. */
export function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/** 지금 떨어지는 블록이 닿을 바닥 행을 계산합니다. */
export function landingRow() {
  let r = S.cur.row;
  while (isFree(r + 1, S.cur.col)) r += 1;
  return r;
}

/** 빈 칸이 생긴 뒤 블록을 아래로 내려앉힙니다. */
export function applyGravity() {
  for (let c = 0; c < COLS; c += 1) {
    const stack = [];
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (S.field[r][c] !== null) stack.push(S.field[r][c]);
    }
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      S.field[r][c] = stack.length ? stack.shift() : null;
    }
  }
}

/**
 * 방금 바뀐 칸 목록을 만듭니다.
 * 낱말이 지워진 열은 위쪽이 통째로 내려앉으므로 그 열 전체를 바뀐 것으로 봅니다.
 * 이 목록은 낱말 탐색 범위를 좁히는 데 쓰입니다.
 */
export function dirtyFromColumns(cols) {
  const out = [];
  for (const c of cols) {
    for (let r = 0; r < ROWS; r += 1) {
      if (S.field[r][c] !== null) out.push({ r, c });
    }
  }
  return out;
}

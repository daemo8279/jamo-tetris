/**
 * 목표 낱말을 고르고 블록을 공급합니다.
 *
 * 무작위 자모를 뿌리면 판이 쓸모없는 블록으로 가득 차서 놀이가 성립하지 않습니다.
 * 그래서 목표 낱말과 예고 낱말에 실제로 들어 있는 단위만 풀에 넣고,
 * 목표 단위를 chunk 개수만큼 연달아 준 뒤 사이에 방해 블록을 끼우는 방식으로 공급합니다.
 */

import { S } from './state.js';
import { decompose } from './hangul.js';
import { levelConfig, modeOf } from '../config/levels.js';
import { POOL, HARD_WORD_LIST, EASY_WORDS, ALL_WORDS } from './dictionary.js';

/** 미리 채워 두는 다음 블록 개수입니다. */
const QUEUE_SIZE = 6;

/** 예고 낱말을 몇 개까지 보여 줄지 정합니다. */
const PREVIEW_COUNT = 3;

/** 16단계에서 겹받침 낱말이 나올 확률입니다. */
const HARD_WORD_CHANCE = 0.55;

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** 이미 나와 있는 낱말은 빼고 고릅니다. 뺄 것이 없으면 원래 목록에서 고릅니다. */
function pickFresh(list) {
  const fresh = list.filter((w) => w !== S.targetWord && !S.targetQueue.includes(w));
  return pickFrom(fresh.length ? fresh : list);
}

/** 해당 레벨에 맞는 목표 낱말을 하나 고릅니다. */
export function pickWord(level) {
  const cfg = levelConfig(level);

  if (cfg.master && Math.random() < HARD_WORD_CHANCE) {
    const hard = HARD_WORD_LIST.filter((w) => cfg.syllables.includes([...w].length));
    const fresh = hard.filter((w) => w !== S.targetWord && !S.targetQueue.includes(w));
    if (fresh.length) return pickFrom(fresh);
  }

  const table = cfg.master ? POOL.all : POOL.easy;
  const n = pickFrom(cfg.syllables);
  return pickFresh(table[n]);
}

/** 예고 낱말 자리를 채웁니다. */
export function fillTargetQueue() {
  while (S.targetQueue.length < PREVIEW_COUNT) {
    S.targetQueue.push(pickWord(S.level));
  }
}

/** 낱말을 현재 레벨의 블록 단위로 쪼갭니다. 글자 블록이면 음절, 자모 블록이면 자모입니다. */
export function unitsOf(word) {
  return modeOf(S.level) === 'syl' ? [...word] : decompose(word);
}

/** 배열을 뒤섞습니다. */
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 목표 낱말의 블록을 담아 둔 주머니입니다.
 * 낱말 순서 그대로 내보내면 좌우로만 옮겨도 풀리므로, 섞어서 한 개씩 꺼냅니다.
 * 주머니가 비면 다시 섞어 채우기 때문에 모든 블록이 고르게 나옵니다.
 */
function drawTargetUnit() {
  if (!S.targetBag.length) {
    const seq = unitsOf(S.targetWord);
    if (!seq.length) return undefined;
    S.targetBag = shuffle(seq);
  }
  return S.targetBag.shift();
}

/** 예고 낱말에서 뽑는 방해 블록입니다. 지금은 쓸모없지만 나중에 쓰일 수 있습니다. */
function previewUnit() {
  const pool = [];
  for (const w of S.targetQueue) unitsOf(w).forEach((u) => pool.push(u));
  if (!pool.length) unitsOf(S.targetWord).forEach((u) => pool.push(u));
  return pickFrom(pool);
}

/**
 * 목표에도 예고에도 없는 글자를 뽑습니다. 순수한 방해물입니다.
 * 몇 번 시도해도 겹치지 않는 글자를 찾지 못하면 예고 낱말 쪽으로 되돌립니다.
 */
function noiseUnit() {
  const known = new Set(unitsOf(S.targetWord));
  for (const w of S.targetQueue) unitsOf(w).forEach((u) => known.add(u));

  const source = levelConfig(S.level).master ? ALL_WORDS : EASY_WORDS;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const units = unitsOf(pickFrom(source));
    const candidate = pickFrom(units);
    if (candidate && !known.has(candidate)) return candidate;
  }
  return previewUnit();
}

/** 목표 블록 묶음 하나와 뒤따르는 방해 블록을 만들어 둡니다. */
function refillUnits() {
  if (S.unitQueue.length) return;

  const cfg = levelConfig(S.level);
  if (!unitsOf(S.targetWord).length) return;

  const take = randInt(cfg.chunk[0], cfg.chunk[1]);
  for (let i = 0; i < take; i += 1) {
    const unit = drawTargetUnit();
    if (unit !== undefined) S.unitQueue.push(unit);
  }

  const noiseRate = cfg.noise || 0;
  const fillerCount = randInt(cfg.filler[0], cfg.filler[1]);
  for (let i = 0; i < fillerCount; i += 1) {
    S.unitQueue.push(Math.random() < noiseRate ? noiseUnit() : previewUnit());
  }

  // 묶음 안에서도 목표와 방해가 섞이도록 한 번 더 흔듭니다.
  S.unitQueue = shuffle(S.unitQueue);
}

function nextUnit() {
  refillUnits();
  return S.unitQueue.shift();
}

/** 다음 블록 대기열을 채웁니다. */
export function refillQueue() {
  while (S.queue.length < QUEUE_SIZE) {
    const u = nextUnit();
    if (u === undefined) break;
    S.queue.push(u);
  }
}

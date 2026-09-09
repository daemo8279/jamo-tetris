import test from 'node:test';
import assert from 'node:assert/strict';

import { S } from '../src/core/state.js';
import { fillTargetQueue, refillQueue, unitsOf } from '../src/core/supply.js';
import { levelConfig, COMBO_PER_GEM, MAX_GEMS } from '../src/config/levels.js';

/** 해당 레벨에서 블록을 n개 뽑아 봅니다. */
function drawBlocks(level, count, forcedTarget) {
  S.level = level;
  S.targetWord = '';
  S.targetQueue = [];
  S.targetBag = [];
  S.unitQueue = [];
  S.queue = [];

  fillTargetQueue();
  S.targetWord = forcedTarget || S.targetQueue.shift();
  fillTargetQueue();

  const out = [];
  for (let i = 0; i < count; i += 1) {
    refillQueue();
    out.push(S.queue.shift());
  }
  return out;
}

function classify(blocks) {
  const target = new Set(unitsOf(S.targetWord));
  const preview = new Set();
  S.targetQueue.forEach((w) => unitsOf(w).forEach((u) => preview.add(u)));

  return {
    target: blocks.filter((u) => target.has(u)).length,
    preview: blocks.filter((u) => !target.has(u) && preview.has(u)).length,
    noise: blocks.filter((u) => !target.has(u) && !preview.has(u)).length
  };
}

test('목표 블록이 낱말 순서 그대로 나오지 않습니다', () => {
  // 순서대로만 나오면 좌우로 옮기기만 해도 풀리므로 학습 효과가 없습니다.
  let shuffledSomewhere = false;

  for (let trial = 0; trial < 20 && !shuffledSomewhere; trial += 1) {
    const blocks = drawBlocks(3, 60);
    const seq = unitsOf(S.targetWord);
    const targetSet = new Set(seq);
    const onlyTarget = blocks.filter((u) => targetSet.has(u));

    for (let i = 0; i < onlyTarget.length; i += 1) {
      if (onlyTarget[i] !== seq[i % seq.length]) {
        shuffledSomewhere = true;
        break;
      }
    }
  }

  assert.ok(shuffledSomewhere, '목표 블록이 늘 낱말 순서대로 나옵니다');
});

test('목표 낱말의 모든 블록이 고르게 나옵니다', () => {
  const blocks = drawBlocks(4, 120, '무지개');
  for (const unit of unitsOf('무지개')) {
    assert.ok(blocks.includes(unit), `${unit} 이(가) 한 번도 나오지 않았습니다`);
  }
});

test('1단계에도 방해 블록이 섞여 나옵니다', () => {
  // 예전에는 1단계에 방해가 전혀 없어 판단할 것이 없었습니다.
  let sawFiller = false;
  for (let trial = 0; trial < 10 && !sawFiller; trial += 1) {
    const blocks = drawBlocks(1, 40);
    const counts = classify(blocks);
    if (counts.preview + counts.noise > 0) sawFiller = true;
  }
  assert.ok(sawFiller, '1단계에서 방해 블록이 전혀 나오지 않습니다');
});

test('레벨이 오를수록 쓸모없는 블록이 늘어납니다', () => {
  const sample = (level) => {
    let noise = 0;
    let total = 0;
    for (let trial = 0; trial < 12; trial += 1) {
      const blocks = drawBlocks(level, 60);
      const counts = classify(blocks);
      noise += counts.noise;
      total += blocks.length;
    }
    return noise / total;
  };

  const low = sample(1);
  const high = sample(5);
  assert.ok(high > low, `1단계 ${low.toFixed(2)} 보다 5단계 ${high.toFixed(2)} 가 높아야 합니다`);
});

test('설정한 방해 비율이 실제 결과와 크게 어긋나지 않습니다', () => {
  for (const level of [1, 3, 5]) {
    let noise = 0;
    let filler = 0;
    for (let trial = 0; trial < 15; trial += 1) {
      const blocks = drawBlocks(level, 60);
      const counts = classify(blocks);
      noise += counts.noise;
      filler += counts.noise + counts.preview;
    }
    const observed = filler ? noise / filler : 0;
    const expected = levelConfig(level).noise;
    assert.ok(
      Math.abs(observed - expected) < 0.2,
      `LV${level}: 설정 ${expected} / 실제 ${observed.toFixed(2)}`
    );
  }
});

test('목표 블록이 완전히 사라지지는 않습니다', () => {
  // 방해가 늘어도 낱말을 만들 수 있어야 합니다.
  for (const level of [1, 3, 5, 9, 15]) {
    const blocks = drawBlocks(level, 60);
    const ratio = classify(blocks).target / blocks.length;
    assert.ok(ratio > 0.3, `LV${level} 목표 블록 비율이 ${ratio.toFixed(2)} 로 너무 낮습니다`);
  }
});

test('보석 규칙이 정해져 있습니다', () => {
  assert.equal(COMBO_PER_GEM, 5);
  assert.ok(MAX_GEMS >= 1 && MAX_GEMS <= 5);
});

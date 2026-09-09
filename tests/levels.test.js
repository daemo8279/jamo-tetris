import test from 'node:test';
import assert from 'node:assert/strict';

import { levelConfig, goalOf, modeOf, stageLabel } from '../src/config/levels.js';
import { POOL, ALL_WORDS } from '../src/core/dictionary.js';
import { hasDoubleJong } from '../src/core/hangul.js';

test('레벨 구간마다 필요한 낱말 수가 늘어납니다', () => {
  assert.equal(goalOf(1), 5);
  assert.equal(goalOf(5), 5);
  assert.equal(goalOf(6), 10);
  assert.equal(goalOf(10), 10);
  assert.equal(goalOf(11), 15);
  assert.equal(goalOf(15), 15);
  assert.equal(goalOf(16), 17);
  assert.equal(goalOf(99), 17);
});

test('1~5단계는 글자 블록, 6단계부터는 자모 블록입니다', () => {
  for (let lv = 1; lv <= 5; lv += 1) assert.equal(modeOf(lv), 'syl', `LV${lv}`);
  for (let lv = 6; lv <= 20; lv += 1) assert.equal(modeOf(lv), 'jamo', `LV${lv}`);
});

test('겹받침은 16단계부터 등장합니다', () => {
  assert.equal(levelConfig(15).master, false);
  assert.equal(levelConfig(16).master, true);
});

test('레벨이 오를수록 낙하가 빨라지고 하한에서 멈춥니다', () => {
  for (let lv = 1; lv < 5; lv += 1) {
    assert.ok(levelConfig(lv).speed > levelConfig(lv + 1).speed, `LV${lv}`);
  }
  for (let lv = 6; lv < 15; lv += 1) {
    assert.ok(levelConfig(lv).speed > levelConfig(lv + 1).speed, `LV${lv}`);
  }
  assert.ok(levelConfig(16).speed > levelConfig(20).speed);
  assert.ok(levelConfig(20).speed > levelConfig(30).speed);
  assert.equal(levelConfig(30).speed, 140);
  assert.equal(levelConfig(99).speed, 140);
});

test('목표 낱말은 3음절을 넘지 않습니다', () => {
  for (let lv = 1; lv <= 40; lv += 1) {
    for (const n of levelConfig(lv).syllables) {
      assert.ok(n >= 2 && n <= 3, `LV${lv} 에 ${n}음절이 들어 있습니다`);
    }
  }
});

test('모든 레벨에서 뽑을 낱말이 실제로 존재합니다', () => {
  for (let lv = 1; lv <= 40; lv += 1) {
    const cfg = levelConfig(lv);
    const table = cfg.master ? POOL.all : POOL.easy;
    for (const n of cfg.syllables) {
      assert.ok(table[n] && table[n].length > 0, `LV${lv} 의 ${n}음절 목록이 비어 있습니다`);
    }
  }
});

test('15단계까지 쓰는 낱말에는 겹받침이 없습니다', () => {
  for (const n of [2, 3]) {
    for (const word of POOL.easy[n]) {
      assert.equal(hasDoubleJong(word), false, word);
    }
  }
});

test('사전에는 2음절과 3음절 낱말만 들어 있습니다', () => {
  const bad = ALL_WORDS.filter((w) => ![2, 3].includes([...w].length));
  assert.deepEqual(bad, []);
});

test('단계 이름이 구간에 맞게 나옵니다', () => {
  assert.match(stageLabel(3), /글자 블록/);
  assert.match(stageLabel(9), /자모 블록/);
  assert.match(stageLabel(17), /겹받침/);
});

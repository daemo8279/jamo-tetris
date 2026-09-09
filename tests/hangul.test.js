import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decompose, assemble, combine, chosungOf, hasDoubleJong, jamoSignature, isSyllable
} from '../src/core/hangul.js';

test('음절을 자모로 풀어냅니다', () => {
  assert.deepEqual(decompose('나무'), ['ㄴ', 'ㅏ', 'ㅁ', 'ㅜ']);
  assert.deepEqual(decompose('한글'), ['ㅎ', 'ㅏ', 'ㄴ', 'ㄱ', 'ㅡ', 'ㄹ']);
  assert.deepEqual(decompose('닭'), ['ㄷ', 'ㅏ', 'ㄺ']);
});

test('자모를 음절로 되돌립니다', () => {
  assert.equal(assemble(['ㄴ', 'ㅏ', 'ㅁ', 'ㅜ']), '나무');
  assert.equal(assemble(['ㄷ', 'ㅏ', 'ㄺ']), '닭');
});

test('다음 자리가 모음이면 종성으로 쓰지 않습니다', () => {
  // ㅎㅏㄴㅏ 는 「한아」가 아니라 「하나」가 되어야 합니다.
  assert.equal(assemble(['ㅎ', 'ㅏ', 'ㄴ', 'ㅏ']), '하나');
  assert.equal(assemble(['ㅎ', 'ㅏ', 'ㄴ', 'ㄱ', 'ㅡ', 'ㄹ']), '한글');
});

test('조립할 수 없는 배열은 null 을 돌려줍니다', () => {
  assert.equal(assemble(['ㅏ', 'ㄴ']), null);   // 모음으로 시작
  assert.equal(assemble(['ㄴ']), null);          // 중성이 없음
  assert.equal(assemble(['ㄴ', 'ㅁ']), null);    // 중성 자리에 자음
});

test('풀었다가 다시 조립하면 원래 낱말로 돌아옵니다', () => {
  for (const word of ['사과', '무지개', '박물관', '얼룩말', '값어치']) {
    assert.equal(assemble(decompose(word)), word, word);
  }
});

test('초성을 뽑아냅니다', () => {
  assert.equal(chosungOf('무'), 'ㅁ');
  assert.equal(chosungOf('개'), 'ㄱ');
});

test('겹받침을 알아봅니다', () => {
  assert.equal(hasDoubleJong('닭장'), true);
  assert.equal(hasDoubleJong('여덟'), true);
  assert.equal(hasDoubleJong('나무'), false);
});

test('자모 구성이 같으면 순서가 달라도 같은 서명입니다', () => {
  assert.equal(jamoSignature(['ㄴ', 'ㅏ', 'ㅁ', 'ㅜ']), jamoSignature(['ㅜ', 'ㅁ', 'ㅏ', 'ㄴ']));
  assert.notEqual(jamoSignature(decompose('나무')), jamoSignature(decompose('나비')));
});

test('한글 음절인지 가려냅니다', () => {
  assert.equal(isSyllable('가'), true);
  assert.equal(isSyllable('ㄱ'), false);
  assert.equal(isSyllable('A'), false);
});

test('조합할 수 없는 자모는 null 입니다', () => {
  assert.equal(combine('ㅏ', 'ㅏ', ''), null);
  assert.equal(combine('ㄱ', 'ㅏ', ''), '가');
  assert.equal(combine('ㄱ', 'ㅏ', 'ㄱ'), '각');
});

/**
 * 개발용 점검 창구입니다.
 *
 * 모듈로 나눈 뒤로는 브라우저 콘솔에서 내부 함수를 부를 수 없습니다.
 * 판을 원하는 모양으로 만들어 놓고 판정을 확인하거나, 특정 레벨로 건너뛰어
 * 손으로 시험할 때 쓰려고 열어 둡니다.
 *
 * 개발 서버이거나 주소에 ?debug=1 을 붙였을 때만 열립니다.
 * 실제 배포본에서는 아무 일도 하지 않습니다.
 */

import { S, seen } from '../core/state.js';
import * as board from '../core/board.js';
import * as hangul from '../core/hangul.js';
import * as matcher from '../core/matcher.js';
import * as supply from '../core/supply.js';
import * as levels from '../config/levels.js';
import * as game from '../core/game.js';
import * as hud from '../ui/hud.js';
import * as render from '../ui/render.js';

function isEnabled() {
  const dev = Boolean(import.meta.env && import.meta.env.DEV);
  let flagged = false;
  try {
    flagged = new URLSearchParams(location.search).get('debug') === '1';
  } catch {
    flagged = false;
  }
  return dev || flagged;
}

export function installDebugBridge() {
  if (!isEnabled()) return;

  window.__nb = {
    S, seen, board, hangul, matcher, supply, levels, game, hud, render,

    /** 판을 비웁니다. */
    clearBoard() {
      S.field = board.createField();
      render.draw();
    },

    /** 가로로 늘어놓습니다. 예) put(11, 2, ['나','무']) */
    put(row, col, units) {
      units.forEach((u, i) => { S.field[row][col + i] = u; });
      render.draw();
    },

    /** 지금 판에서 완성된 낱말을 찾아 봅니다. */
    check() {
      const all = [];
      for (let r = 0; r < board.ROWS; r += 1) {
        for (let c = 0; c < board.COLS; c += 1) if (S.field[r][c] !== null) all.push({ r, c });
      }
      return matcher.findMatches(all);
    },

    /** 특정 레벨로 건너뜁니다. */
    goLevel(level) {
      game.startLevel(level, false);
    },

    /** 목표 낱말을 바꿔 봅니다. */
    setTarget(word) {
      S.targetWord = word;
      hud.updateHintPanel();
    },

    /** 지금 상태를 한눈에 봅니다. */
    info() {
      return {
        level: S.level,
        mode: levels.modeOf(S.level),
        target: S.targetWord,
        score: S.score,
        words: `${S.levelWords}/${levels.levelConfig(S.level).goal}`,
        stars: S.stars,
        next: S.queue.slice(0, 4).join(' ')
      };
    }
  };

  // eslint-disable-next-line no-console
  console.info('[낱말 블록] 개발용 창구가 열렸습니다. window.__nb.info() 로 시작해 보세요.');
}

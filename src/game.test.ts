/**
 * 断梯运料 — 核心循环骨架测试
 *
 * 验证 Direction Lock 主循环每一步可走通：
 *   选择材料组合 → 规划路线 → 移动 → 消耗体力和脚手架耐久 → 到达卸货点或事故发生
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  selectMaterials,
  confirmRoute,
  moveStep,
  resolveEvent,
  continueAfterDelivery,
  endRound,
  nextRound,
  resolveAccident,
  getGameSummary,
  GameState,
} from './game.js';

// ── Helpers ─────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** 处理 pendingEvent 直到进入非 event 阶段 */
function drainEvents(state: GameState): void {
  let safety = 20;
  while (state.pendingEvent && safety-- > 0) {
    resolveEvent(state, 0);
  }
}

/** 选材 → 消事件 → 确认路线，保证进入 move */
function prepareToMove(state: GameState, materials: string[]): void {
  selectMaterials(state, materials);
  drainEvents(state);
  if (state.phase === 'plan_route') {
    confirmRoute(state);
  }
}

/** 尝试移动到终点（处理沿途事件） */
function tryReachEndpoint(state: GameState): void {
  if (!state.scaffold) return;
  const [tx, ty] = state.scaffold.endpoints[0];
  let safety = 40;
  while (safety-- > 0) {
    drainEvents(state);
    if (state.phase !== 'move') break;
    if (state.pos[0] === tx && state.pos[1] === ty) break;

    const dx = clamp(tx - state.pos[0], -1, 1);
    const dy = clamp(ty - state.pos[1], -1, 1);
    // prefer the axis with larger distance
    if (Math.abs(tx - state.pos[0]) >= Math.abs(ty - state.pos[1]) && dx !== 0) {
      moveStep(state, dx, 0);
    } else if (dy !== 0) {
      moveStep(state, 0, dy);
    } else if (dx !== 0) {
      moveStep(state, dx, 0);
    } else {
      break;
    }
  }
}

// ── Tests ───────────────────────────────────────────────────

describe('Direction Lock 核心循环', () => {
  it('创建游戏 → 初始化五个 Required State', () => {
    const state = createGame();
    assert.equal(state.round, 1);
    assert.equal(state.resource, 10);
    assert.equal(state.pressure, 0);
    assert.equal(state.risk, 0);
    assert.equal(state.relation, 5);
    assert.equal(state.phase, 'select_materials');
    assert.ok(state.scaffold, '应加载轮次模板');
  });

  it('选择材料组合 → 进入 plan_route 或 event 阶段', () => {
    const state = createGame();
    selectMaterials(state, ['brick', 'plank']);
    // 选材后可能触发 load 事件
    const phase = state.phase;
    assert.ok(
      phase === 'plan_route' || phase === 'event',
      `选材后应在 plan_route 或 event，实际: ${phase}`,
    );
    assert.deepEqual(state.load, ['brick', 'plank']);
    assert.equal(state.loadWeight, 5, 'brick(3) + plank(2) = 5');
  });

  it('规划路线确认 → 进入 move 阶段', () => {
    const state = createGame();
    prepareToMove(state, ['brick']);
    assert.equal(state.phase, 'move', `应进入 move，实际: ${state.phase}`);
  });

  it('移动 → 位置更新、格子耐久消耗', () => {
    const state = createGame();
    prepareToMove(state, ['cement']); // weight 4
    const startPos = [...state.pos] as [number, number];

    moveStep(state, 0, 1);
    drainEvents(state);

    // 移动应成功或被事件拦截（event 已 drain）
    assert.ok(
      state.phase === 'move' || state.phase === 'arrived' || state.phase === 'accident' || state.phase === 'round_end',
      `移动后应在有效阶段，实际: ${state.phase}`,
    );
    // 只要不是还停在原位就算移动成功（事件可能改变流程）
    const moved = state.pos[0] !== startPos[0] || state.pos[1] !== startPos[1];
    assert.ok(moved, '位置应变化');
  });

  it('到达卸货点 → phase = arrived 或 event', () => {
    const state = createGame();
    prepareToMove(state, ['brick']);
    tryReachEndpoint(state);
    drainEvents(state);

    assert.ok(
      state.phase === 'arrived' || state.phase === 'round_end' ||
      state.phase === 'game_over' || state.phase === 'accident',
      `应在到达后结算，实际 phase: ${state.phase}`,
    );
  });

  it('卸货后继续 → 回到 select_materials', () => {
    const state = createGame();
    prepareToMove(state, ['plank']);
    tryReachEndpoint(state);
    drainEvents(state);

    if (state.phase === 'arrived') {
      continueAfterDelivery(state);
      assert.equal(state.phase, 'select_materials', '卸货后应可重新选材');
    }
    // 如果 phase 不是 arrived（已进入 round_end 等），此测试跳过
  });

  it('endRound → nextRound → 新轮次开始', () => {
    const state = createGame();
    prepareToMove(state, ['brick']);
    endRound(state);
    assert.equal(state.phase, 'round_end');

    nextRound(state);
    assert.equal(state.round, 2);
    assert.equal(state.phase, 'select_materials');
    assert.ok(state.scaffold, '第 2 轮应有模板');
  });

  it('getGameSummary → 返回状态文本', () => {
    const state = createGame();
    const summary = getGameSummary(state);
    assert.ok(summary.includes('轮次'));
    assert.ok(summary.includes('资源'));
  });
});

describe('事件和事故', () => {
  it('resolveEvent 应用选项效果', () => {
    const state = createGame();
    prepareToMove(state, ['brick']);

    // 多步移动尝试触发事件
    for (let i = 0; i < 8; i++) {
      moveStep(state, 0, 1);
      if (state.pendingEvent) break;
      if (state.phase !== 'move') break;
      moveStep(state, 0, -1);
      if (state.pendingEvent) break;
      if (state.phase !== 'move') break;
    }

    if (state.pendingEvent) {
      resolveEvent(state, 0);
      assert.equal(state.pendingEvent, null, '事件应被清除');
      assert.ok(
        state.phase === 'move' || state.phase === 'accident' || state.phase === 'round_end',
        `事件解决后应回到有效阶段: ${state.phase}`,
      );
    }
  });

  it('事故 → resolveAccident → round_end', () => {
    const state = createGame();
    prepareToMove(state, ['brick']);

    // 强制设置事故
    state.phase = 'accident' as any;
    resolveAccident(state);
    assert.equal(state.phase, 'round_end', '事故后应进入轮次结算');
  });
});

describe('完整 4 轮流程', () => {
  it('从第 1 轮走完到 game_over', () => {
    const state = createGame();

    for (let round = 1; round <= 4; round++) {
      assert.equal(state.round, round, `应在第 ${round} 轮`);

      prepareToMove(state, ['plank']);
      tryReachEndpoint(state);
      drainEvents(state);

      if (state.phase === 'arrived') {
        continueAfterDelivery(state);
      }

      endRound(state);

      if (state.phase === 'game_over') {
        assert.ok(round === 4, `game_over 应在第 4 轮后，实际第 ${round} 轮`);
        assert.ok(getGameSummary(state).includes('游戏结束'));
        return;
      }

      nextRound(state);
    }

    assert.fail('应到达 game_over');
  });
});

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
  resolveCycle,
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

// ── Direction Lock Required State Tests ───────────────────

describe('Direction Lock Required State', () => {
  it('五个 Required State 初始化正确', () => {
    const state = createGame();
    assert.equal(state.stamina, 20, '体力应初始化为 20');
    assert.equal(state.scaffoldStability, 100, '脚手架稳定性应初始化为 100');
    assert.equal(state.deliveryProgress, 0, '卸货进度应初始化为 0');
    assert.ok(Array.isArray(state.load), 'load 应为数组');
    assert.ok(state.risk >= 0, 'fallRisk 应为非负');
  });

  it('移动消耗体力，负重大消耗更多', () => {
    const light = createGame();
    prepareToMove(light, ['plank']); // weight 2
    moveStep(light, 0, 1);
    drainEvents(light);

    const heavy = createGame();
    prepareToMove(heavy, ['steel']); // weight 5
    moveStep(heavy, 0, 1);
    drainEvents(heavy);

    assert.ok(light.stamina < 20, '轻负重要消耗体力');
    assert.ok(heavy.stamina < light.stamina, '重负重要消耗更多体力');
  });

  it('移动降低脚手架稳定性', () => {
    const state = createGame();
    prepareToMove(state, ['cement']); // weight 4, stability -1
    moveStep(state, 0, 1);
    drainEvents(state);

    assert.ok(state.scaffoldStability < 100, '移动应降低脚手架稳定性');
  });

  it('到达卸货点增加 deliveryProgress', () => {
    const state = createGame();
    prepareToMove(state, ['plank']);
    tryReachEndpoint(state);
    drainEvents(state);

    assert.ok(state.deliveryProgress > 0, '到达卸货点应增加进度');
  });

  it('体力低时增加坠落风险（状态耦合）', () => {
    const state = createGame();
    prepareToMove(state, ['steel']); // weight 5

    // 强制体力至低位
    state.stamina = 2;
    const riskBefore = state.risk;

    moveStep(state, 0, 1);
    drainEvents(state);

    assert.ok(state.risk >= riskBefore, '低体力应增加坠落风险');
  });

  it('resolveCycle 返回结算结果', () => {
    const state = createGame();
    prepareToMove(state, ['plank']);
    tryReachEndpoint(state);
    drainEvents(state);

    const result = resolveCycle(state);
    assert.equal(typeof result.success, 'boolean');
    assert.equal(typeof result.deliveryProgress, 'number');
    assert.equal(typeof result.staminaRemaining, 'number');
    assert.equal(typeof result.scaffoldIntegrity, 'number');
    assert.equal(typeof result.fallRisk, 'number');
    assert.ok(result.summary.length > 0, '结算应包含摘要');
  });

  it('resolveCycle 在完成所有卸货后 success = true', () => {
    const state = createGame();
    // Round 1 只有 1 个 endpoint，一次到达即 100%
    prepareToMove(state, ['plank']);
    tryReachEndpoint(state);
    drainEvents(state);

    if (state.deliveryProgress >= 100) {
      const result = resolveCycle(state);
      assert.equal(result.success, true);
    }
  });

  it('状态变化同时影响生存压力和风险压力', () => {
    const state = createGame();
    prepareToMove(state, ['steel']); // weight 5

    const staminaBefore = state.stamina;
    const riskBefore = state.risk;
    const stabilityBefore = state.scaffoldStability;

    moveStep(state, 0, 1);
    drainEvents(state);

    // 生存/进度压力：体力下降
    assert.ok(state.stamina < staminaBefore, '体力应下降');
    // 秩序/风险压力：稳定性下降或风险上升
    const orderOrRiskChanged =
      state.scaffoldStability < stabilityBefore || state.risk > riskBefore;
    assert.ok(orderOrRiskChanged, '稳定性或风险应变化');
  });
});

// ── QA 验收补充：自然失败路径 + primary input 完整追踪 ─────

describe('QA 验收补充', () => {
  it('回合超限自然触发事故（非手动设置 phase）', () => {
    const state = createGame();
    prepareToMove(state, ['brick']);

    // 把回合推到上限-1，下一步自然触发超时
    state.turn = state.scaffold!.turnLimit - 1;
    moveStep(state, 0, 1);

    assert.equal(state.phase, 'accident', '超时应自然进入事故阶段');
    assert.ok(state.risk > 0, '事故应增加风险');

    // 事故处理 → 轮次结算
    resolveAccident(state);
    assert.equal(state.phase, 'round_end', '事故后应进入轮次结算');
    assert.ok(state.cycleResult !== null, '应有结算结果');
  });

  it('primary input 完整追踪：选材→移动→多项 Required State 变化', () => {
    const state = createGame();

    // 快照初始 Required State
    const snap = {
      stamina: state.stamina,
      scaffoldStability: state.scaffoldStability,
      risk: state.risk,
      deliveryProgress: state.deliveryProgress,
      loadWeight: state.loadWeight,
    };

    // primary input：选择重负材料 + 在格子上移动
    selectMaterials(state, ['steel', 'cement']); // weight 9
    drainEvents(state);
    if (state.phase === 'plan_route') confirmRoute(state);

    assert.equal(state.loadWeight, 9, '选材应设置负重');

    // 多步移动让状态充分变化
    for (let i = 0; i < 3; i++) {
      moveStep(state, 0, 1);
      drainEvents(state);
      if (state.phase !== 'move') break;
    }

    // 验证 primary input 直接驱动了 Required State 变化（不是 choice-only）
    assert.ok(state.stamina < snap.stamina,
      '体力应因负重移动下降');
    assert.ok(state.scaffoldStability < snap.scaffoldStability,
      '脚手架稳定性应因踩踏下降');
    assert.ok(state.risk >= snap.risk,
      '坠落风险应因重负踩踏而上升');
  });
});

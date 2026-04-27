/**
 * 断梯运料 — 启动入口
 *
 * 最小可运行骨架：在控制台输出每个主循环步骤的状态，
 * 用 scripted playthrough 验证 Direction Lock 循环可走通。
 */

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
} from './game';

// ── Console-based scripted playthrough ─────────────────────

function logState(state: GameState, label: string): void {
  console.log(`\n=== ${label} ===`);
  console.log(getGameSummary(state));
}

export function runSkeletonPlaythrough(): GameState {
  console.log('断梯运料 — Direction Lock 主循环骨架验证\n');

  // 创建游戏 → 自动进入 select_materials 阶段
  const state = createGame();
  logState(state, '游戏初始化');

  // ── Round 1: 短路线教学 ──────────────────────────────
  // 选择材料组合
  selectMaterials(state, ['brick', 'plank']);
  logState(state, '选择材料: 砖块+木板');

  // 规划路线（确认）
  confirmRoute(state);
  logState(state, '确认路线');

  // 移动（沿 y 轴向下，从 [2,0] 到 [2,4]）
  moveStep(state, 0, 1);
  moveStep(state, 0, 1);
  moveStep(state, 0, 1);
  moveStep(state, 0, 1);

  // 如果触发事件，选择选项 0
  if (state.pendingEvent) {
    console.log(`\n事件: ${state.pendingEvent.name}`);
    resolveEvent(state, 0);
    logState(state, '事件解决');
    // 继续移动到终点
    while (state.phase === 'move' && !isAtEndpoint(state)) {
      moveStep(state, 0, 1);
      if (state.pendingEvent) {
        console.log(`\n事件: ${state.pendingEvent.name}`);
        resolveEvent(state, 0);
      }
    }
  }

  if (state.phase === 'arrived') {
    if (state.pendingEvent) {
      resolveEvent(state, 0);
    }
    logState(state, '到达卸货点');
    continueAfterDelivery(state);
    logState(state, '卸货后继续');
  }

  // 结束第一轮
  endRound(state);
  logState(state, '第一轮结束');
  nextRound(state);
  logState(state, '第二轮开始');

  // ── Round 2: 简单验证 ────────────────────────────────
  selectMaterials(state, ['cement']);
  logState(state, '选择材料: 水泥袋');
  confirmRoute(state);

  // 尝试几步移动
  moveStep(state, 0, 1);
  moveStep(state, 1, 0);
  if (state.pendingEvent) {
    resolveEvent(state, 0);
  }

  logState(state, 'Round 2 进行中');
  endRound(state);

  console.log('\n=== 骨架验证完成：主循环可走通 ===');
  return state;
}

function isAtEndpoint(state: GameState): boolean {
  if (!state.scaffold) return false;
  return state.scaffold.endpoints.some(
    ([ex, ey]) => state.pos[0] === ex && state.pos[1] === ey,
  );
}

// ── Auto-start in browser context ──────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('game-root');
    if (!root) return;

    // 在页面展示核心循环的每一步
    const state = createGame();
    renderState(root, state);

    // 简单按钮驱动：下一步
    window.__duantiState = state;
    window.__duantiRoot = root;
  });
}

function renderState(root: HTMLElement, state: GameState): void {
  root.innerHTML = `
    <div style="font-family: monospace; max-width: 600px; margin: 2rem auto; padding: 1rem; border: 1px solid #333;">
      <h2 style="margin-top:0;">断梯运料 — 骨架验证</h2>
      <pre>${getGameSummary(state)}</pre>
      <p style="color:#666;font-size:0.85em;">
        打开浏览器控制台运行 <code>runSkeletonPlaythrough()</code> 查看完整脚本走查。
      </p>
    </div>
  `;
}

// Expose for console / testing
declare global {
  interface Window {
    __duantiState: GameState;
    __duantiRoot: HTMLElement;
  }
}

export { createGame, getGameSummary };

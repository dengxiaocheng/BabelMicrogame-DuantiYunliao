/**
 * 断梯运料 — 启动入口
 *
 * 交互式 UI：通过 GameUI 组件驱动核心循环，
 * 玩家点击脚手架格子移动、选择材料、应对事件。
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
import { GameUI, UIAction } from './ui/GameUI';

// ── Interactive Game Start ────────────────────────────────

function startGame(root: HTMLElement): void {
  let state = createGame();
  const ui = new GameUI(root, (action: UIAction) => {
    switch (action.type) {
      case 'select_materials':
        selectMaterials(state, action.materials);
        break;
      case 'confirm_route':
        confirmRoute(state);
        break;
      case 'move':
        moveStep(state, action.dx, action.dy);
        break;
      case 'resolve_event':
        resolveEvent(state, action.choiceIndex);
        break;
      case 'continue_after_delivery':
        continueAfterDelivery(state);
        break;
      case 'end_round':
        endRound(state);
        break;
      case 'next_round':
        nextRound(state);
        break;
      case 'resolve_accident':
        resolveAccident(state);
        break;
      case 'restart':
        state = createGame();
        break;
    }
    ui.render(state);
  });
  ui.render(state);
  window.__duantiState = state;
  window.__duantiRoot = root;
}

// ── Console scripted playthrough (for testing) ────────────

function logState(state: GameState, label: string): void {
  console.log(`\n=== ${label} ===`);
  console.log(getGameSummary(state));
}

export function runSkeletonPlaythrough(): GameState {
  console.log('断梯运料 — Direction Lock 主循环骨架验证\n');
  const state = createGame();
  logState(state, '游戏初始化');

  selectMaterials(state, ['brick', 'plank']);
  logState(state, '选择材料: 砖块+木板');
  confirmRoute(state);
  logState(state, '确认路线');

  moveStep(state, 0, 1);
  moveStep(state, 0, 1);
  moveStep(state, 0, 1);
  moveStep(state, 0, 1);

  if (state.pendingEvent) {
    console.log(`\n事件: ${state.pendingEvent.name}`);
    resolveEvent(state, 0);
    logState(state, '事件解决');
    while (state.phase === 'move' && !isAtEndpoint(state)) {
      moveStep(state, 0, 1);
      if (state.pendingEvent) {
        console.log(`\n事件: ${state.pendingEvent.name}`);
        resolveEvent(state, 0);
      }
    }
  }

  if (state.phase === 'arrived') {
    if (state.pendingEvent) resolveEvent(state, 0);
    logState(state, '到达卸货点');
    continueAfterDelivery(state);
    logState(state, '卸货后继续');
  }

  endRound(state);
  logState(state, '第一轮结束');
  nextRound(state);
  logState(state, '第二轮开始');

  selectMaterials(state, ['cement']);
  confirmRoute(state);
  moveStep(state, 0, 1);
  moveStep(state, 1, 0);
  if (state.pendingEvent) resolveEvent(state, 0);
  endRound(state);

  console.log('\n=== 骨架验证完成 ===');
  return state;
}

function isAtEndpoint(state: GameState): boolean {
  if (!state.scaffold) return false;
  return state.scaffold.endpoints.some(
    ([ex, ey]) => state.pos[0] === ex && state.pos[1] === ey,
  );
}

// ── Auto-start ────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('game-root');
    if (root) startGame(root);
  });
}

declare global {
  interface Window {
    __duantiState: GameState;
    __duantiRoot: HTMLElement;
  }
}

export { createGame, getGameSummary };

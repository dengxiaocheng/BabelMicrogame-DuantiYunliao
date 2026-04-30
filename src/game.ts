/**
 * 断梯运料 — 核心游戏引擎
 *
 * Direction Lock 主循环：
 *   选择材料组合 → 规划路线 → 移动 → 消耗体力和脚手架耐久 → 到达卸货点或事故发生
 *
 * 五个 Required State：resource / pressure / risk / relation / round
 */

import { MATERIALS, totalLoad, totalStability } from './content/materials';
import {
  SCAFFOLD_BY_ROUND,
  ScaffoldTemplate,
  cellDurability,
  isPassable,
  durabilityDrain,
} from './content/scaffolds';
import { randomEvent, EventTrigger, GameEvent, StateDelta } from './content/events';

// ── Phase & State ──────────────────────────────────────────

export type Phase =
  | 'select_materials'
  | 'plan_route'
  | 'move'
  | 'resolve'
  | 'event'
  | 'arrived'
  | 'accident'
  | 'round_end'
  | 'game_over';

export interface GameState {
  /** 五个 Required State */
  resource: number;
  pressure: number;
  risk: number;
  relation: number;
  round: number;

  /** 当前轮次模板 */
  scaffold: ScaffoldTemplate | null;
  /** 可变的格子耐久图（深拷贝自模板） */
  grid: number[][];
  /** 玩家位置 [x, y] */
  pos: [number, number];
  /** 本轮选中的材料 id 列表 */
  load: string[];
  /** 当前负重（缓存） */
  loadWeight: number;
  /** 当前回合 */
  turn: number;
  /** 当前阶段 */
  phase: Phase;
  /** 累计到达卸货点次数（本轮） */
  deliveries: number;
  /** 待处理的事件 */
  pendingEvent: GameEvent | null;
  /** 上一条反馈文本 */
  message: string;

  /** 最近一次轮次结算结果（null = 尚未结算） */
  cycleResult: CycleResolution | null;

  /** Direction Lock Required States */
  /** 体力 (0-20)：每步消耗，负重越大消耗越多 */
  stamina: number;
  /** 脚手架整体稳定性 (0-100)：基于格子耐久聚合计算 */
  scaffoldStability: number;
  /** 卸货进度 (0-100)：已送达次数 / 目标次数 */
  deliveryProgress: number;
}

// ── Constants ──────────────────────────────────────────────

const MAX_ROUNDS = 4;
const RISK_COLLAPSE_THRESHOLD = 10;
const INITIAL_STATE: Omit<GameState, 'scaffold' | 'grid' | 'pos' | 'load' | 'loadWeight' | 'turn' | 'deliveries' | 'pendingEvent' | 'message' | 'cycleResult'> = {
  resource: 10,
  pressure: 0,
  risk: 0,
  relation: 5,
  round: 1,
  phase: 'select_materials',
  stamina: 20,
  scaffoldStability: 100,
  deliveryProgress: 0,
};

// ── Helpers ────────────────────────────────────────────────

function deepCopyGrid(grid: number[][]): number[][] {
  return grid.map(row => [...row]);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function applyDelta(state: GameState, delta: StateDelta): void {
  if (delta.resource !== undefined) state.resource = clamp(state.resource + delta.resource, 0, 50);
  if (delta.pressure !== undefined) state.pressure = clamp(state.pressure + delta.pressure, 0, 20);
  if (delta.risk !== undefined) state.risk = clamp(state.risk + delta.risk, 0, 20);
  if (delta.relation !== undefined) state.relation = clamp(state.relation + delta.relation, 0, 10);
  if (delta.round !== undefined) state.round = clamp(state.round + delta.round, 1, MAX_ROUNDS);
}

function isEndpoint(state: GameState): boolean {
  if (!state.scaffold) return false;
  return state.scaffold.endpoints.some(
    ([ex, ey]) => state.pos[0] === ex && state.pos[1] === ey,
  );
}

/** 从可变格子耐久计算整体稳定性百分比 */
function computeScaffoldStability(grid: number[][], template: number[][]): number {
  let current = 0;
  let original = 0;
  for (let y = 0; y < template.length; y++) {
    for (let x = 0; x < template[y].length; x++) {
      if (template[y][x] > 0) {
        original += template[y][x];
        current += Math.max(0, grid[y][x]);
      }
    }
  }
  return original === 0 ? 0 : Math.round((current / original) * 100);
}

// ── Game Engine ────────────────────────────────────────────

export function createGame(): GameState {
  const state: GameState = {
    ...INITIAL_STATE,
    scaffold: null,
    grid: [],
    pos: [0, 0],
    load: [],
    loadWeight: 0,
    turn: 0,
    deliveries: 0,
    pendingEvent: null,
    message: '选择你的材料组合，准备出发。',
    cycleResult: null,
  };
  startRound(state, 1);
  return state;
}

export function startRound(state: GameState, round: number): void {
  const scaffold = SCAFFOLD_BY_ROUND.get(round);
  if (!scaffold) {
    state.phase = 'game_over';
    state.message = round > MAX_ROUNDS ? '所有轮次完成！' : '无法加载轮次模板。';
    return;
  }
  state.round = round;
  state.scaffold = scaffold;
  state.grid = deepCopyGrid(scaffold.grid);
  state.pos = [...scaffold.start] as [number, number];
  state.stamina = 20;
  state.scaffoldStability = 100;
  state.deliveryProgress = 0;
  state.turn = 0;
  state.deliveries = 0;
  state.load = [];
  state.loadWeight = 0;
  state.phase = 'select_materials';
  state.pendingEvent = null;
  state.cycleResult = null;
  state.message = `第 ${round} 轮：${scaffold.name} — ${scaffold.description}`;
}

// ── Phase: select_materials ────────────────────────────────
// 玩家选择材料组合 → 进入规划路线阶段

export function selectMaterials(state: GameState, materialIds: string[]): GameState {
  if (state.phase !== 'select_materials') return state;

  state.load = materialIds;
  state.loadWeight = totalLoad(materialIds);
  state.phase = 'plan_route';
  state.message = `负重 ${state.loadWeight}，规划你的路线。`;

  // 选材后可能触发 load 事件
  const ev = randomEvent('load');
  if (ev) {
    state.pendingEvent = ev;
    state.phase = 'event';
    state.message += `\n事件：${ev.name} — ${ev.description}`;
  }

  return state;
}

// ── Phase: plan_route → move ──────────────────────────────
// 路线确认后进入移动阶段（本骨架直接切换，UI 层负责展示路线）

export function confirmRoute(state: GameState): GameState {
  if (state.phase !== 'plan_route') return state;
  state.phase = 'move';
  state.message = '开始移动。';
  return state;
}

// ── Phase: move ────────────────────────────────────────────
// 玩家移动一格 → 消耗脚手架耐久 → 检查事件 → 检查终点

export function moveStep(state: GameState, dx: number, dy: number): GameState {
  if (state.phase !== 'move') return state;
  if (!state.scaffold) return state;

  const nx = state.pos[0] + dx;
  const ny = state.pos[1] + dy;

  if (!isPassable(state.scaffold, nx, ny)) {
    state.message = '前方不可通行，选择其他方向。';
    return state;
  }

  // 移动
  state.pos = [nx, ny];
  state.turn++;

  // 消耗体力（核心机制：负重越大消耗越多）
  const staminaCost = 1 + Math.floor(state.loadWeight / 2);
  state.stamina = clamp(state.stamina - staminaCost, 0, 20);

  // 消耗脚手架耐久（核心机制）
  const drain = durabilityDrain(state.scaffold, state.loadWeight);
  const stabilityMod = totalStability(state.load);
  const effectiveDrain = Math.max(0, drain - stabilityMod);

  // 更新当前格子耐久
  const cellDur = state.grid[ny][nx];
  const newDur = Math.max(0, cellDur - effectiveDrain);
  state.grid[ny][nx] = newDur;

  // 更新脚手架整体稳定性
  state.scaffoldStability = computeScaffoldStability(state.grid, state.scaffold.grid);

  // 耐久归零 → 格子断裂 → risk 上升
  if (newDur === 0) {
    state.risk += 3;
    state.message = `脚下格子断裂！耐久耗尽。risk 上升。`;
  }

  // 状态耦合：体力过低 → 坠落风险增加（生存压力 → 风险压力）
  if (state.stamina <= 3 && state.stamina >= 0) {
    state.risk = clamp(state.risk + 1, 0, 20);
  }

  // 状态耦合：脚手架稳定性过低 → 坠落风险增加（秩序压力 → 风险压力）
  if (state.scaffoldStability < 30) {
    state.risk = clamp(state.risk + 1, 0, 20);
  }

  // 体力耗尽警告
  if (state.stamina === 0) {
    state.message += ' 体力耗尽！每一步都摇摇欲坠。';
  }

  // 负重增加 pressure（每 3 点负重 +1 pressure/回合）
  const pressureGain = Math.floor(state.loadWeight / 3);
  if (pressureGain > 0) {
    applyDelta(state, { pressure: pressureGain });
  }

  // 检查是否到达卸货点
  if (isEndpoint(state)) {
    state.phase = 'arrived';
    state.deliveries++;

    // 更新卸货进度
    const targetDeliveries = state.scaffold.endpoints.length;
    state.deliveryProgress = Math.round((state.deliveries / targetDeliveries) * 100);

    // 到达结算：材料 value → resource
    const deliveredValue = state.load.reduce((sum, id) => {
      const m = MATERIALS.find(mat => mat.id === id);
      return sum + (m?.value ?? 0);
    }, 0);
    applyDelta(state, { resource: deliveredValue });
    state.load = [];
    state.loadWeight = 0;
    state.message = `到达卸货点！获得 ${deliveredValue} 资源。`;

    // 到达事件
    const ev = randomEvent('arrive');
    if (ev) {
      state.pendingEvent = ev;
      state.phase = 'event';
      state.message += `\n事件：${ev.name} — ${ev.description}`;
    }
    return state;
  }

  // 检查 collapse_risk 事件（risk 超阈值）
  if (state.risk >= RISK_COLLAPSE_THRESHOLD) {
    const ev = randomEvent('collapse_risk');
    if (ev) {
      state.pendingEvent = ev;
      state.phase = 'event';
      state.message += `\n⚠ ${ev.name} — ${ev.description}`;
      return state;
    }
  }

  // 普通移动事件（30% 概率）
  if (Math.random() < 0.3) {
    const ev = randomEvent('move');
    if (ev) {
      state.pendingEvent = ev;
      state.phase = 'event';
      state.message += `\n事件：${ev.name} — ${ev.description}`;
      return state;
    }
  }

  // 检查回合上限 → 事故
  if (state.scaffold.turnLimit > 0 && state.turn >= state.scaffold.turnLimit) {
    state.phase = 'accident';
    state.message = '超时！脚手架开始坍塌。';
    applyDelta(state, { risk: 5, resource: -3 });
    return state;
  }

  state.message = `移动至 (${nx}, ${ny})，格子耐久 ${newDur}。回合 ${state.turn}/${state.scaffold.turnLimit}。`;
  return state;
}

// ── Phase: event ───────────────────────────────────────────
// 玩家选择事件选项 → 应用效果 → 返回原阶段

export function resolveEvent(state: GameState, choiceIndex: number): GameState {
  if (state.phase !== 'event' || !state.pendingEvent) return state;

  const choice = state.pendingEvent.choices[choiceIndex];
  if (!choice) return state;

  applyDelta(state, choice.effects);
  state.message = choice.outcome;
  state.pendingEvent = null;

  // 事件解决后检查是否游戏结束
  if (state.risk >= RISK_COLLAPSE_THRESHOLD + 5) {
    state.phase = 'accident';
    state.message += '\n风险过高，事故发生！';
    return state;
  }

  // 回到事件前的阶段（如果在卸货点则回到 arrived）
  state.phase = isEndpoint(state) ? 'arrived' : 'move';
  return state;
}

// ── Phase: arrived / accident / round_end ──────────────────

export function continueAfterDelivery(state: GameState): GameState {
  if (state.phase !== 'arrived') return state;

  // 所有卸货点都送达或回合用完 → 轮次结算
  if (!state.scaffold) { state.phase = 'game_over'; return state; }

  // 允许继续搬运（重选材料）
  state.pos = [...state.scaffold.start] as [number, number];
  state.phase = 'select_materials';
  state.message = '卸货完成，选择下一趟的材料。';
  return state;
}

export function endRound(state: GameState): GameState {
  state.cycleResult = resolveCycle(state);
  state.phase = 'round_end';
  state.message = `第 ${state.round} 轮结束。${state.cycleResult.summary}`;

  if (state.round >= MAX_ROUNDS) {
    state.phase = 'game_over';
    state.message = `游戏结束！${state.cycleResult.summary}`;
    return state;
  }

  return state;
}

export function nextRound(state: GameState): GameState {
  if (state.phase !== 'round_end') return state;
  startRound(state, state.round + 1);
  return state;
}

// ── Phase: resolve（通用状态结算） ─────────────────────────

export interface CycleResolution {
  /** 本轮是否完全送达所有卸货点 */
  success: boolean;
  deliveryProgress: number;
  staminaRemaining: number;
  scaffoldIntegrity: number;
  fallRisk: number;
  summary: string;
}

/** 一次循环结算：基于当前五个 Required State 判定结算结果 */
export function resolveCycle(state: GameState): CycleResolution {
  const success = state.deliveryProgress >= 100;
  return {
    success,
    deliveryProgress: state.deliveryProgress,
    staminaRemaining: state.stamina,
    scaffoldIntegrity: state.scaffoldStability,
    fallRisk: state.risk,
    summary: success
      ? `卸货完成！进度 ${state.deliveryProgress}%，体力剩余 ${state.stamina}，架体稳定 ${state.scaffoldStability}%，风险 ${state.risk}`
      : `当前进度 ${state.deliveryProgress}%，体力剩余 ${state.stamina}，架体稳定 ${state.scaffoldStability}%，风险 ${state.risk}`,
  };
}

export function resolveAccident(state: GameState): GameState {
  if (state.phase !== 'accident') return state;
  // 事故后直接进入轮次结算
  return endRound(state);
}

// ── Query helpers ──────────────────────────────────────────

export function getAvailableMaterials(): typeof MATERIALS {
  return MATERIALS;
}

export function getGameSummary(state: GameState): string {
  return [
    `轮次: ${state.round}/${MAX_ROUNDS}`,
    `阶段: ${state.phase}`,
    `资源: ${state.resource}`,
    `压力: ${state.pressure}`,
    `风险: ${state.risk}`,
    `关系: ${state.relation}`,
    `体力: ${state.stamina}`,
    `架体稳定: ${state.scaffoldStability}%`,
    `卸货进度: ${state.deliveryProgress}%`,
    `负重: ${state.loadWeight}`,
    `位置: (${state.pos[0]}, ${state.pos[1]})`,
    `回合: ${state.turn}`,
    state.message,
  ].join('\n');
}

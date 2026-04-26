/**
 * 断梯运料 — 脚手架格子模板
 *
 * 按 20 分钟节奏拆为 4 轮，每轮一张格子图：
 *   Round 1 — 短路线，教学
 *   Round 2 — 破格与加固
 *   Round 3 — 多目标运料
 *   Round 4 — 限时抢运 + 高风险近路
 *
 * 格子编码：
 *   0       = 缺失（不可通过）
 *   1-9     = 耐久值，负重超过耐久则 risk 上升
 *   S / E   = 起点 / 卸货点（分别用特殊值标记）
 *
 * 每张模板导出纯数据，不含渲染逻辑。
 */

export interface ScaffoldTemplate {
  id: string;
  name: string;
  round: number;
  /** 每个元素是耐久值；0 = 缺失格。行 = y，列 = x */
  grid: number[][];
  /** 起点 [x, y] */
  start: [number, number];
  /** 卸货点列表 */
  endpoints: [number, number][];
  /** 负重对耐久的压力系数：每点负重消耗 = baseDrain * (1 + load) */
  baseDrain: number;
  /** 本轮限时（回合数上限） */
  turnLimit: number;
  description: string;
}

export const SCAFFOLDS: ScaffoldTemplate[] = [
  // ── Round 1: 短路线，教学 ──────────────────────
  {
    id: 'scaf_r1',
    name: '初登架',
    round: 1,
    grid: [
      [0, 0, 3, 0, 0],
      [0, 3, 4, 3, 0],
      [0, 4, 5, 4, 0],
      [0, 3, 4, 3, 0],
      [0, 0, 3, 0, 0],
    ],
    start: [2, 0],
    endpoints: [[2, 4]],
    baseDrain: 0.5,
    turnLimit: 12,
    description: '一条直上直下的简单路线。熟悉操作，感受负重对格子的影响。',
  },

  // ── Round 2: 破格与加固 ────────────────────────
  {
    id: 'scaf_r2',
    name: '断裂带',
    round: 2,
    grid: [
      [0, 3, 4, 0, 0, 0],
      [0, 2, 0, 3, 4, 0],
      [0, 4, 3, 2, 0, 0],
      [0, 0, 3, 4, 3, 0],
      [0, 0, 0, 3, 4, 0],
      [0, 0, 0, 0, 3, 0],
    ],
    start: [1, 0],
    endpoints: [[4, 5]],
    baseDrain: 0.8,
    turnLimit: 16,
    description: '多处断格需要绕路或冒险。木板和工具箱在本轮格外有用。',
  },

  // ── Round 3: 多目标运料 ─────────────────────────
  {
    id: 'scaf_r3',
    name: '三面卸货',
    round: 3,
    grid: [
      [0, 0, 3, 4, 3, 0, 0],
      [0, 3, 4, 0, 3, 4, 0],
      [0, 4, 5, 3, 0, 3, 0],
      [0, 3, 4, 2, 3, 4, 0],
      [0, 0, 3, 4, 3, 0, 0],
    ],
    start: [2, 2],
    endpoints: [[3, 0], [6, 2], [3, 4]],
    baseDrain: 1.0,
    turnLimit: 20,
    description: '三个卸货点分布在不同方向，需要规划多趟路线。中心格子薄弱。',
  },

  // ── Round 4: 限时抢运 + 高风险近路 ─────────────
  {
    id: 'scaf_r4',
    name: '最后的冲刺',
    round: 4,
    grid: [
      [0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 3, 2, 0, 1, 0, 0, 0, 0],
      [0, 0, 3, 4, 3, 0, 1, 0, 0],
      [0, 0, 0, 3, 5, 4, 3, 2, 0],
      [0, 0, 0, 0, 3, 0, 0, 3, 0],
      [0, 0, 0, 0, 0, 0, 0, 3, 0],
    ],
    start: [1, 0],
    endpoints: [[7, 5]],
    baseDrain: 1.2,
    turnLimit: 14,
    description:
      '安全路线远且费时，近路贯穿低耐久格（耐久 1）。大货走近路几乎是自杀，但时间不够了。',
  },
];

/** 按 round 快速索引 */
export const SCAFFOLD_BY_ROUND = new Map(
  SCAFFOLDS.map((s) => [s.round, s]),
);

/** 获取某格的耐久值；越界或缺失返回 0 */
export function cellDurability(
  scaffold: ScaffoldTemplate,
  x: number,
  y: number,
): number {
  const row = scaffold.grid[y];
  if (!row) return 0;
  return row[x] ?? 0;
}

/** 判断坐标是否为可通行格 */
export function isPassable(
  scaffold: ScaffoldTemplate,
  x: number,
  y: number,
): boolean {
  return cellDurability(scaffold, x, y) > 0;
}

/** 计算负重对某格的耐久消耗 */
export function durabilityDrain(
  scaffold: ScaffoldTemplate,
  load: number,
): number {
  return scaffold.baseDrain * (1 + load);
}

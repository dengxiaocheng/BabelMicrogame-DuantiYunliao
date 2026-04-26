/**
 * 断梯运料 — 材料目录
 *
 * 每种材料在「负重 vs 收益 vs 脚手架压力」三角上占不同位置，
 * 驱动玩家的「选择材料组合」决策。
 *
 * weight:     1-5，累加为玩家本轮负重
 * value:      送达卸货点时获得的结算分
 * stability:  -2 ~ +2，对所踩格子的耐久额外修正
 */

export interface Material {
  id: string;
  name: string;
  weight: number;
  value: number;
  stability: number;
  description: string;
  special?: string;
}

export const MATERIALS: Material[] = [
  {
    id: 'brick',
    name: '砖块',
    weight: 3,
    value: 2,
    stability: 0,
    description: '标准建材，重量适中，收益稳定。',
  },
  {
    id: 'cement',
    name: '水泥袋',
    weight: 4,
    value: 3,
    stability: -1,
    description: '沉重但值钱，会加速脚手架损耗。',
  },
  {
    id: 'steel',
    name: '钢筋',
    weight: 5,
    value: 4,
    stability: -2,
    description: '极重，利润最高，但对脚手架是致命负担。',
  },
  {
    id: 'plank',
    name: '木板',
    weight: 2,
    value: 1,
    stability: 1,
    description: '轻便、还能加固脚手架，只是不值钱。',
    special: '踩过的格子耐久 +1',
  },
  {
    id: 'paint',
    name: '涂料桶',
    weight: 2,
    value: 2,
    stability: 0,
    description: '中等重量，但如果坠落会直接报废。',
    special: '坠落时 value 归零',
  },
  {
    id: 'glass',
    name: '玻璃板',
    weight: 3,
    value: 5,
    stability: -1,
    description: '高价且脆弱——高风险高回报的典型。',
    special: '坠落时 value 归零',
  },
  {
    id: 'toolbox',
    name: '工具箱',
    weight: 1,
    value: 0,
    stability: 2,
    description: '不带收益，但能修脚手架，给后续趟铺路。',
    special: '可在任意格使用：该格耐久恢复至满值',
  },
  {
    id: 'pipe',
    name: '管件',
    weight: 4,
    value: 3,
    stability: -1,
    description: '又重又滑，转弯时额外消耗体力。',
    special: '转向移动时体力消耗 +1',
  },
];

/** 按重量分组，方便 UI 展示 */
export const MATERIALS_BY_WEIGHT = Object.groupBy(MATERIALS, (m) =>
  m.weight <= 2 ? 'light' : m.weight <= 3 ? 'medium' : 'heavy',
) as Record<'light' | 'medium' | 'heavy', Material[]>;

/** 计算一组材料的总负重 */
export function totalLoad(ids: string[]): number {
  const map = new Map(MATERIALS.map((m) => [m.id, m]));
  return ids.reduce((sum, id) => sum + (map.get(id)?.weight ?? 0), 0);
}

/** 计算一组材料对格子耐久的净修正 */
export function totalStability(ids: string[]): number {
  const map = new Map(MATERIALS.map((m) => [m.id, m]));
  return ids.reduce((sum, id) => sum + (map.get(id)?.stability ?? 0), 0);
}

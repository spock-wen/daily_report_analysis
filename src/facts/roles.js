'use strict';

const CLAUSE_SEP_RE = /[，,、；;。\n\r]/;

// B10：语义槽 → 允许的 role。槽名取自规则举例（掉榜/新上榜/今日新增/累计）
// 以及事实表 label 中同义的状态词，role 必须落在槽的允许集合内。
const REFERENCE_PREV_ROLES = [
  'prev_total_projects',
  'prev_ai_projects',
  'prev_avg_stars',
  'prev_hot_count',
  'prev_total_today',
  'prev_max_today',
];

const REFERENCE_AVG7_ROLES = [
  'avg7_total_projects',
  'avg7_ai_projects',
  'avg7_avg_stars',
  'avg7_hot_count',
  'avg7_total_today',
  'avg7_max_today',
];

const REFERENCE_MOM_ROLES = [
  'mom_total_projects',
  'mom_ai_projects',
  'mom_avg_stars',
  'mom_hot_count',
  'mom_total_today',
  'mom_max_today',
];

const COUNT_ROLES = [
  'total_projects',
  'ai_projects',
  'hot_count',
  'prev_total_projects',
  'prev_ai_projects',
  'prev_hot_count',
  'avg7_total_projects',
  'avg7_ai_projects',
  'avg7_hot_count',
  'mom_total_projects',
  'mom_ai_projects',
  'mom_hot_count',
  'new',
  'dropped',
  'kept',
  'returned',
  'daily_count',
  'recurring',
  'prior',
  'prev_new',
  'prev_prior',
  'churn_count',
];

// 「较昨日变化/提速」也属于昨日语义槽。
const PREV_SLOT_ROLES = [
  ...REFERENCE_PREV_ROLES,
  'category_shift',
  'language_shift',
  'acceleration',
  'acceleration_ratio',
];

const SLOT_RULES = [
  { pattern: /掉榜|出局/g, roles: ['dropped'] },
  { pattern: /新上榜|新面孔(?!率)/g, roles: ['new'] },
  { pattern: /回归/g, roles: ['returned'] },
  { pattern: /连续(?:在榜|\s*\d+\s*[天日])/g, roles: ['streak', 'kept'] },
  { pattern: /今日新增|当日新增|单日新增|当天新增/g, roles: ['today_stars', 'total_today'] },
  { pattern: /本周新增/g, roles: ['week_stars', 'total_week'] },
  { pattern: /本月新增/g, roles: ['month_stars', 'total_month'] },
  { pattern: /累计/g, roles: ['stars'] },
  { pattern: /Forks|Fork|fork|分支/g, roles: ['forks'] },
  { pattern: /个项目|项目数/g, roles: COUNT_ROLES },
  { pattern: /合计/g, roles: ['total_today', 'total_week', 'total_month', 'prev_total_today', 'avg7_total_today', 'mom_total_today', 'prev_week_total', 'prev_month_total'] },
  // B16：参照数、份额变化、提速、换血率的语义槽。
  { pattern: /昨日|前一有数据日|上一有数据日/g, roles: PREV_SLOT_ROLES },
  { pattern: /7\s*日均值|七日均值|前\s*7\s*个有数据日/g, roles: REFERENCE_AVG7_ROLES },
  { pattern: /上月同期|上月同日|前一月同日/g, roles: REFERENCE_MOM_ROLES },
  { pattern: /类目[^，,、；;。\n]{0,20}份额|语言[^，,、；;。\n]{0,20}份额|份额变化/g, roles: ['category_share', 'category_shift', 'language_share', 'language_shift'] },
  { pattern: /提速|加速/g, roles: ['acceleration', 'acceleration_ratio'] },
  // 「变化」专指提速/变化量，份额变化仍由上面的份额槽负责。
  { pattern: /(?<!份额)变化/g, roles: ['acceleration'] },
  { pattern: /留存率/g, roles: ['retention_rate'] },
  { pattern: /新面孔率/g, roles: ['new_face_rate'] },
];

function clauseRange(text, position) {
  const source = String(text || '');
  let start = 0;
  for (let index = position - 1; index >= 0; index -= 1) {
    if (CLAUSE_SEP_RE.test(source[index])) {
      start = index + 1;
      break;
    }
  }
  let end = source.length;
  for (let index = position; index < source.length; index += 1) {
    if (CLAUSE_SEP_RE.test(source[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function collectSlots(source, start, end) {
  const clauseText = source.slice(start, end);
  const slots = [];
  for (const rule of SLOT_RULES) {
    const regex = new RegExp(rule.pattern.source, 'g');
    let match;
    while ((match = regex.exec(clauseText)) !== null) {
      slots.push({ index: start + match.index, text: match[0], roles: rule.roles });
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }
  slots.sort((left, right) => left.index - right.index);
  return slots;
}

// 返回 Map<值位置, 允许的 role 数组>。
// 同一分句内槽数与值数相等时按顺序配对（「新上榜与掉榜分别为 A 与 B」），
// 否则取该值之前最近的槽，前面没有槽时取之后最近的槽。
function findSlotAssignments(text, positions) {
  const source = String(text || '');
  const assignments = new Map();
  const values = Array.from(new Set(positions || [])).sort((left, right) => left - right);
  if (values.length === 0) return assignments;

  const groups = [];
  for (const position of values) {
    const range = clauseRange(source, position);
    const last = groups[groups.length - 1];
    if (last && range.start === last.start && range.end === last.end) {
      last.values.push(position);
    } else {
      groups.push({ start: range.start, end: range.end, values: [position] });
    }
  }

  for (const group of groups) {
    const slots = collectSlots(source, group.start, group.end);
    if (slots.length === 0) continue;

    if (slots.length === group.values.length) {
      group.values.forEach((position, index) => assignments.set(position, slots[index].roles));
      continue;
    }

    for (const position of group.values) {
      let chosen = null;
      for (const slot of slots) {
        if (slot.index <= position) chosen = slot;
      }
      if (!chosen) chosen = slots.find(slot => slot.index > position) || null;
      if (chosen) assignments.set(position, chosen.roles);
    }
  }

  return assignments;
}

function roleFromPlaceholder(placeholder) {
  const match = /^\{\{f\d+(?::([a-z0-9_]+))?\}\}$/.exec(String(placeholder || '').trim());
  return match && match[1] ? match[1] : null;
}

module.exports = {
  SLOT_RULES,
  findSlotAssignments,
  roleFromPlaceholder,
};

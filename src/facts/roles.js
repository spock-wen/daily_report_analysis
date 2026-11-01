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
  'category_count',
  'prev_category_count',
  'language_count',
  'prev_language_count',
];

// 「较昨日变化/提速」也属于昨日语义槽。
const PREV_SLOT_ROLES = [
  ...REFERENCE_PREV_ROLES,
  'category_shift',
  'language_shift',
  'category_count',
  'prev_category_count',
  'language_count',
  'prev_language_count',
  'acceleration',
  'acceleration_ratio',
];

const SLOT_RULES = [
  { pattern: /掉榜|出局/g, roles: ['dropped'] },
  { pattern: /新上榜|新面孔(?!率)/g, roles: ['new'] },
  { pattern: /回归/g, roles: ['returned'] },
  // 「连续在榜 N 个」是在榜项目个数（kept）。「连续 N 天」是天数，不是个数。
  { pattern: /连续在榜/g, roles: ['streak', 'kept'] },
  { pattern: /连续\s*(?:\{\{f\d+:[a-z0-9_]+\}\}|\d+)\s*[天日]/g, roles: ['streak', 'appearance_days', 'days_on_list'] },
  // max_today：今日/单日峰值与「今日新增」同槽（FINDINGS W42）
  { pattern: /今日新增|当日新增|单日新增|当天新增|今日峰值|单日峰值|最大单[日项]/g, roles: ['today_stars', 'total_today', 'max_today'] },
  // week_stars 同义：周榜合计新增 / 本周合计新增（FINDINGS W42）
  { pattern: /周榜合计新增|本周合计新增|本周新增/g, roles: ['week_stars', 'total_week'] },
  // W44 nextWeekPoints：「周新增（本周 N 星）」里的数字在「本周新增」之前。
  // 不吃「上周新增 / 本周新增」，避免和上一行或 prev_week_total 抢同一个槽。
  { pattern: /(?<![上本])周新增/g, roles: ['week_stars', 'total_week'] },
  // 「占本月新增星的比例」是集中度的分母说法，不是本月新增星。
  // 月10 monthlyTheme.detailed：{{f8:top5_share}} 被「本月新增」最近槽抢走。
  { pattern: /头部集中度|占本月新增星的比例/g, roles: ['top5_share', 'prev_top5_share'] },
  { pattern: /本月新增(?!星的比例)/g, roles: ['month_stars', 'total_month'] },
  // 「贡献 N 星的新增」：数字在前。与「天的上榜」同句时必须单独成槽，
  // 否则最近槽会把 month_stars 判成 days_on_list（月10 trendEvolution[0].analysis）。
  // 不写「新增星」，避免碰到夹具里的「当日新增星合计」。
  { pattern: /星的新增/g, roles: ['today_stars', 'total_today', 'max_today', 'week_stars', 'total_week', 'month_stars', 'total_month'] },
  // 「中新增 N 星」：数字在「新增」后。与「天上榜」同句时必须单独成槽，
  // 否则最近槽会把 month_stars 判成 days_on_list（月10 longTermValue[0].oneSentence）。
  // 前面已有「本月/本周/今日/当日/单日/当天/合计/日报」时不重复开槽，免得盖住更窄的槽。
  // 「日报」留给上面的 top3_stars 槽（日报新增 N 星）。
  { pattern: /(?<!本月|本周|今日|当日|单日|当天|合计|日报)新增\s*(?:\{\{f\d+:[a-z0-9_]+\}\}|\d+(?:\.\d+)?)\s*星/g, roles: ['today_stars', 'total_today', 'max_today', 'week_stars', 'total_week', 'month_stars', 'total_month'] },
  // days_on_list：上榜 N 天 / 天上榜 / 上榜周期（FINDINGS 月09）
  // 月10 另两句用的是「天在榜」「天的在榜」，不是「天的上榜」。
  // top3_days：周报「日报上榜天数」（W44 nextWeekPoints「领先本周的 N 天」落在这个槽）。
  { pattern: /天上榜|天的上榜|天的在榜|天在榜|上榜天数|上榜周期/g, roles: ['days_on_list', 'top3_days'] },
  // 「上榜 N 天」数字在「上榜」后。周报 dailyTop3Notes 写 top3_days，月报写 days_on_list。
  { pattern: /上榜\s*(?:\{\{f\d+:[a-z0-9_]+\}\}|\d+(?:\.\d+)?)\s*天/g, roles: ['days_on_list', 'top3_days'] },
  // W44 dailyTop3Notes：「日报合计新增 N 星 / 日报新增 N 星」是 top3_stars
  // （label「本周日报新增星」）。模式吃到数字，并且下面的「合计」不再吃「日报合计」，
  // 否则更靠近数字的合计槽会把 top3_stars 判成 total_week / week_stars。
  { pattern: /日报合计新增\s*(?:\{\{f\d+:[a-z0-9_]+\}\}|\d+(?:\.\d+)?)\s*星/g, roles: ['top3_stars'] },
  { pattern: /日报新增\s*(?:\{\{f\d+:[a-z0-9_]+\}\}|\d+(?:\.\d+)?)\s*星/g, roles: ['top3_stars'] },
  // 「累计 N 天」是上榜天数，不是累计星（月10 monthlyTheme.detailed {{f30:days_on_list}}）。
  // 「累计 N 星与 M 天的在榜」里这个负向条件不吃掉前面的累计星槽。
  { pattern: /累计(?!\s*(?:\{\{f\d+:days_on_list\}\}|\d+(?:\.\d+)?)\s*天)/g, roles: ['stars'] },
  { pattern: /Forks|Fork|fork|分支/g, roles: ['forks'] },
  { pattern: /个在榜项目/g, roles: COUNT_ROLES },
  { pattern: /个项目|项目数/g, roles: COUNT_ROLES },
  // W44 nextWeekPoints 写的是「星看点阈值」，事实标签也是「看点阈值」，不是「星门槛」。
  { pattern: /看点阈值|星门槛/g, roles: ['threshold'] },
  { pattern: /百分点/g, roles: ['category_shift', 'language_shift'] },
  // 合计槽同时容纳 per-project week_stars/month_stars（「周榜合计新增」只命中「合计」时）。
  // 「日报合计」是 top3_stars，不进这个槽。
  { pattern: /(?<!日报)合计/g, roles: ['total_today', 'total_week', 'total_month', 'week_stars', 'month_stars', 'prev_total_today', 'avg7_total_today', 'mom_total_today', 'prev_week_total', 'prev_month_total'] },
  // B16：参照数、份额变化、提速、换血率的语义槽。
  { pattern: /上期|昨日|前一有数据日|上一有数据日/g, roles: PREV_SLOT_ROLES },
  { pattern: /7\s*日均值|七日均值|前\s*7\s*个有数据日/g, roles: REFERENCE_AVG7_ROLES },
  { pattern: /上月同期|上月同日|前一月同日/g, roles: REFERENCE_MOM_ROLES },
  { pattern: /类目[^，,、；;。\n]{0,20}份额|语言[^，,、；;。\n]{0,20}份额|份额变化/g, roles: ['category_share', 'category_shift', 'language_share', 'language_shift'] },
  { pattern: /倍/g, roles: ['ratioTop1Top2', 'ratio_top1_top2', 'acceleration_ratio'] },
  { pattern: /提速|加速/g, roles: ['acceleration', 'acceleration_ratio'] },
  // 「变化」专指提速/变化量，份额变化仍由上面的份额槽负责。
  // 日报变化量 role=acceleration；周报「较上周变化量」role=wow_delta（W44 weeklyTheme.detailed）。
  { pattern: /(?<!份额)变化/g, roles: ['acceleration', 'wow_delta'] },
  { pattern: /环比/g, roles: ['wow_rate'] },
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

// 模型常把事实 role 写成「看起来像」的别名。别名只在与所引事实的 role 对得上时生效。
const ROLE_ALIASES = {
  total_month_stars: 'total_month',
  total_week_stars: 'total_week',
  total_today_stars: 'total_today',
  month_total_stars: 'total_month',
  new_stars_total: 'total_month',
};

function sameProject(left, right) {
  return (left?.project || null) === (right?.project || null);
}

function pushCandidate(list, candidate) {
  if (!candidate || candidate.id === undefined || candidate.id === null) return;
  if (list.some(item => String(item.id) === String(candidate.id))) return;
  list.push(candidate);
}

// 占位 role 与所引事实 role 不一致时，选一个 role 能对上的事实：
// 优先语义槽允许、且与占位所写 role（或它的别名）一致的事实。
function resolveCitedFact(fact, requestedRole, facts, allowedRoles) {
  if (!fact) return fact;
  const candidates = [];
  pushCandidate(candidates, fact);
  if (requestedRole && requestedRole !== fact.role) {
    const pool = Array.isArray(facts) ? facts : [];
    pushCandidate(candidates, pool.find(candidate => candidate.role === requestedRole && sameProject(candidate, fact)));
    const alias = ROLE_ALIASES[requestedRole];
    if (alias) {
      pushCandidate(candidates, pool.find(candidate => candidate.role === alias && sameProject(candidate, fact)));
      if (!fact.project) {
        pushCandidate(candidates, pool.find(candidate => !candidate.project && candidate.role === alias));
      }
    }
  }

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : null;
  if (allowed && allowed.length > 0) {
    const fitting = candidates.filter(candidate => candidate.role && allowed.includes(candidate.role));
    if (fitting.length > 0) {
      const exact = requestedRole && fitting.find(candidate => candidate.role === requestedRole);
      if (exact) return exact;
      const alias = ROLE_ALIASES[requestedRole];
      const aliased = alias && fitting.find(candidate => candidate.role === alias);
      if (aliased) return aliased;
      return fitting[0];
    }
  }

  if (requestedRole) {
    const exact = candidates.find(candidate => candidate.role === requestedRole);
    if (exact) return exact;
    const alias = ROLE_ALIASES[requestedRole];
    if (alias) {
      const aliased = candidates.find(candidate => candidate.role === alias);
      if (aliased) return aliased;
    }
  }
  return fact;
}

module.exports = {
  SLOT_RULES,
  ROLE_ALIASES,
  findSlotAssignments,
  roleFromPlaceholder,
  resolveCitedFact,
};

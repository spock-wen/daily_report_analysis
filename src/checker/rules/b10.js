'use strict';

const { makeFinding } = require('./util');
const { findSlotAssignments, roleFromPlaceholder } = require('../../facts/roles');

function factsById(ctx) {
  const list = Array.isArray(ctx.facts) ? ctx.facts : (ctx.facts?.facts || []);
  const map = new Map();
  for (const fact of list) {
    if (fact && fact.id !== undefined && fact.id !== null) map.set(String(fact.id), fact);
  }
  return map;
}

function entriesForPath(ctx, fieldPath) {
  return (ctx.renderMap?.entries || []).filter(
    entry => entry && entry.factId && String(entry.path || '') === String(fieldPath || '')
  );
}

function checkRenderMap(ctx, doc, facts) {
  const findings = [];
  for (const entry of ctx.renderMap?.entries || []) {
    if (!entry || !entry.factId) continue;
    const fact = facts.get(String(entry.factId));
    if (!fact || !fact.role) continue;
    const placeholderRole = roleFromPlaceholder(entry.placeholder);
    if (entry.role && placeholderRole && entry.role !== placeholderRole) {
      findings.push(makeFinding('B10', doc, {
        field: entry.path || null,
        line: null,
        quote: entry.placeholder || '',
        message: `渲染记录 ${entry.placeholder} 的 role「${placeholderRole}」与记录 role「${entry.role}」不一致`,
      }));
    }
    const role = entry.role || placeholderRole;
    if (!role) {
      findings.push(makeFinding('B10', doc, {
        field: entry.path || null,
        line: null,
        quote: entry.placeholder || '',
        message: `渲染记录 ${entry.placeholder || entry.factId} 缺少 role，无法与事实 ${fact.id} 的 role「${fact.role}」核对`,
      }));
      continue;
    }
    if (role !== fact.role) {
      findings.push(makeFinding('B10', doc, {
        field: entry.path || null,
        line: null,
        quote: entry.placeholder || '',
        message: `渲染记录 ${entry.placeholder || entry.factId} 的 role「${role}」与事实 ${fact.id} 的 role「${fact.role}」不一致`,
      }));
    }
  }
  return findings;
}

function checkSlots(ctx, doc, facts) {
  const findings = [];
  for (const item of doc.strings) {
    const entries = entriesForPath(ctx, item.path);
    if (entries.length === 0) continue;

    const positions = [];
    const located = [];
    let cursor = 0;
    for (const entry of entries) {
      const text = String(entry.text === undefined || entry.text === null ? '' : entry.text);
      if (!text) continue;
      const index = String(item.value).indexOf(text, cursor);
      if (index < 0) continue;
      cursor = index + text.length;
      const fact = facts.get(String(entry.factId));
      const role = entry.role || fact?.role || roleFromPlaceholder(entry.placeholder);
      if (!role) continue;
      positions.push(index);
      located.push({ entry, role, index });
    }
    if (positions.length === 0) continue;

    const slotByOffset = findSlotAssignments(item.value, positions);
    for (const { entry, role, index } of located) {
      const allowedRoles = slotByOffset.get(index);
      if (!allowedRoles || allowedRoles.includes(role)) continue;
      findings.push(makeFinding('B10', doc, {
        field: item.path,
        line: item.line,
        quote: item.value,
        message: `渲染记录 ${entry.placeholder || entry.factId} 的 role「${role}」与句中语义槽不一致`,
      }));
    }
  }
  return findings;
}

function check(ctx, doc) {
  const facts = factsById(ctx);
  return [...checkRenderMap(ctx, doc, facts), ...checkSlots(ctx, doc, facts)];
}

module.exports = {
  id: 'B10',
  applies: (ctx, doc) => ctx.r3 && doc.role === 'insights',
  check,
};

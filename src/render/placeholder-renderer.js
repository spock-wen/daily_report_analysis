'use strict';

const fs = require('fs');
const path = require('path');

const FACT_PLACEHOLDER_RE = /\{\{f(\d+)\}\}/g;
const PROJECT_PLACEHOLDER_RE = /\{\{p:([^{}]+)\}\}/g;

function formatFactValue(value) {
  return String(value);
}

function projectNameFromPlaceholder(value) {
  if (typeof value !== 'string') return value;
  const match = /^\{\{p:([^{}]+)\}\}$/.exec(value.trim());
  return match ? match[1].trim() : value;
}

function isProjectPlaceholder(value) {
  return typeof value === 'string' && /^\{\{p:[^{}]+\}\}$/.test(value.trim());
}

function renderInsights({ insights, facts, projects, level, period }) {
  const factMap = new Map();
  for (const fact of facts || []) {
    if (fact && fact.id !== undefined && fact.id !== null) {
      factMap.set(String(fact.id), fact);
    }
  }

  const projectSet = new Set(
    (projects || [])
      .map(project => (typeof project === 'string' ? project : project?.fullName || project?.repo || project?.name))
      .filter(Boolean)
      .map(name => String(name).trim())
  );

  const entries = [];
  const errors = [];

  const renderString = (value, fieldPath) => {
    const invalidFactPlaceholders = new Set();
    const withFacts = value.replace(FACT_PLACEHOLDER_RE, (placeholder, id) => {
      const fact = factMap.get(`f${id}`);
      if (!fact) {
        invalidFactPlaceholders.add(placeholder);
        errors.push({
          path: fieldPath,
          placeholder,
          quote: value,
          message: `事实占位 ${placeholder} 不存在`,
        });
        return placeholder;
      }
      const text = formatFactValue(fact.value);
      entries.push({
        path: fieldPath,
        placeholder,
        factId: fact.id,
        text,
      });
      return text;
    });

    const leftoverFacts = withFacts.match(/\{\{f[^{}]*\}\}/g) || [];
    for (const placeholder of new Set(leftoverFacts)) {
      if (invalidFactPlaceholders.has(placeholder)) continue;
      errors.push({
        path: fieldPath,
        placeholder,
        quote: value,
        message: `事实占位 ${placeholder} 格式无效或 id 不存在`,
      });
    }

    return withFacts.replace(PROJECT_PLACEHOLDER_RE, (placeholder, rawName) => {
      const name = rawName.trim();
      if (!projectSet.has(name)) {
        errors.push({
          path: fieldPath,
          placeholder,
          quote: value,
          message: `仓库占位 ${placeholder} 不在当期项目清单`,
        });
        return placeholder;
      }
      entries.push({
        path: fieldPath,
        placeholder,
        factId: null,
        text: name,
      });
      return name;
    });
  };

  const walk = (value, fieldPath) => {
    if (typeof value === 'string') return renderString(value, fieldPath);
    if (Array.isArray(value)) {
      return value.map((item, index) => walk(item, `${fieldPath}[${index}]`));
    }
    if (value && typeof value === 'object') {
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = walk(item, fieldPath ? `${fieldPath}.${key}` : key);
      }
      return result;
    }
    return value;
  };

  return {
    level,
    period,
    insights: walk(insights, ''),
    entries,
    errors,
  };
}

function writeRenderMap({ level, period, entries, renderMapPath }) {
  const payload = {
    level,
    period,
    generatedAt: new Date().toISOString(),
    entries,
  };

  fs.mkdirSync(path.dirname(renderMapPath), { recursive: true });
  try {
    fs.writeFileSync(renderMapPath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`渲染记录已存在，拒绝覆盖：${renderMapPath}`);
    }
    throw error;
  }
  return payload;
}

module.exports = {
  renderInsights,
  writeRenderMap,
  projectNameFromPlaceholder,
  isProjectPlaceholder,
  formatFactValue,
  FACT_PLACEHOLDER_RE,
  PROJECT_PLACEHOLDER_RE,
};

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_DIR = path.join(__dirname, '../../config/checker');

function getConfigDir() {
  return process.env.REPORT_CHECKER_CONFIG_DIR
    ? path.resolve(process.env.REPORT_CHECKER_CONFIG_DIR)
    : DEFAULT_CONFIG_DIR;
}

function readLines(fileName) {
  const filePath = path.join(getConfigDir(), fileName);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

function readSections(fileName) {
  const filePath = path.join(getConfigDir(), fileName);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return [];
  }
  const entries = [];
  let kind = 'direction';
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      const match = /kind\s*=\s*([a-z_]+)/i.exec(trimmed);
      if (match) kind = match[1].toLowerCase();
      continue;
    }
    entries.push({ word: trimmed, kind });
  }
  return entries;
}

function readSpellingWords(fileName) {
  return readLines(fileName)
    .map(line => {
      const index = line.indexOf('=');
      if (index <= 0) return null;
      const wrong = line.slice(0, index).trim();
      const right = line.slice(index + 1).trim();
      return wrong && right ? { wrong, right } : null;
    })
    .filter(Boolean);
}

let cache = null;

function loadConfig(options = {}) {
  if (cache && !options.reload) return cache;
  cache = {
    dir: getConfigDir(),
    bannedWords: readLines('banned_words.txt'),
    compareWords: readLines('compare_words.txt'),
    cumulativeWords: readLines('cumulative_words.txt'),
    fixedPhrases: readLines('fixed_phrases.txt'),
    c4Whitelist: readLines('c4_whitelist.txt'),
    commonSlashWords: readLines('common_slash_words.txt'),
    spellingWords: readSpellingWords('spelling_words.txt'),
    directionStatusWords: readSections('direction_status_words.txt'),
    metricNameExempt: readLines('metric_name_exempt.txt'),
  };
  return cache;
}

module.exports = {
  DEFAULT_CONFIG_DIR,
  getConfigDir,
  loadConfig,
};

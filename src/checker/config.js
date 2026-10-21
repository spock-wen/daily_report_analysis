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
  };
  return cache;
}

module.exports = {
  DEFAULT_CONFIG_DIR,
  getConfigDir,
  loadConfig,
};

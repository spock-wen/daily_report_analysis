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

let cache = null;

function loadConfig(options = {}) {
  if (cache && !options.reload) return cache;
  cache = {
    dir: getConfigDir(),
    bannedWords: readLines('banned_words.txt'),
    compareWords: readLines('compare_words.txt'),
    fixedPhrases: readLines('fixed_phrases.txt'),
    c4Whitelist: readLines('c4_whitelist.txt'),
  };
  return cache;
}

module.exports = {
  DEFAULT_CONFIG_DIR,
  getConfigDir,
  loadConfig,
};

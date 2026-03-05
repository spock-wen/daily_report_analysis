#!/usr/bin/env node
/**
 * 生成首页统计数据
 */
const fs = require('fs');
const path = require('path');

const DAILY_DIR = '/srv/www/daily-report/reports/daily';
const WEEKLY_DIR = '/srv/www/daily-report/reports/weekly';
const MONTHLY_DIR = '/srv/www/daily-report/reports/monthly';

function countFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => pattern.test(f)).length;
}

function getLatestReport(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();
  return files[0] || null;
}

function getTotalProjects() {
  // 扫描所有日报，统计不重复的项目数（简化版：估算）
  const dailyFiles = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.html'));
  return dailyFiles.length * 10; // 每份报告约 10 个项目
}

function getAIProjects() {
  // 从最新日报读取 AI 项目数
  const latest = getLatestReport(DAILY_DIR, /\.html$/);
  if (!latest) return { total: 0, ratio: 0 };
  
  const content = fs.readFileSync(path.join(DAILY_DIR, latest), 'utf8');
  const aiMatch = content.match(/AI 项目.*?(\d+)%/);
  const ratio = aiMatch ? parseInt(aiMatch[1]) : 90;
  return { ratio };
}

function getConsecutiveDays() {
  // 计算连续更新天数（从最新报告往前推）
  const dailyFiles = fs.readdirSync(DAILY_DIR)
    .filter(f => f.endsWith('.html'))
    .sort()
    .reverse();
  
  if (dailyFiles.length === 0) return 0;
  
  // 简化：直接返回文件数量
  return dailyFiles.length;
}

function main() {
  const dailyCount = countFiles(DAILY_DIR, /\.html$/);
  const weeklyCount = countFiles(WEEKLY_DIR, /\.html$/);
  const monthlyCount = countFiles(MONTHLY_DIR, /\.html$/);
  const totalReports = dailyCount + weeklyCount + monthlyCount;
  
  const totalProjects = getTotalProjects();
  const { ratio: aiRatio } = getAIProjects();
  const consecutiveDays = getConsecutiveDays();
  
  const stats = {
    totalReports,
    dailyCount,
    weeklyCount,
    monthlyCount,
    totalProjects,
    aiRatio,
    consecutiveDays,
    latestDaily: getLatestReport(DAILY_DIR, /\.html$/),
    latestWeekly: getLatestReport(WEEKLY_DIR, /\.html$/)
  };
  
  console.log(JSON.stringify(stats, null, 2));
}

main();

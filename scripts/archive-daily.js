#!/usr/bin/env node
/**
 * 每日数据归档脚本
 * 将当天的 briefs/data.json 复制到 archive/年/月/日期.json
 */

const fs = require('fs');
const path = require('path');

const BRIEFS_FILE = '/srv/www/daily-report/briefs/data.json';
const ARCHIVE_BASE = '/srv/www/daily-report/archive';

function main() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const [year, month, day] = dateStr.split('/');
  const paddedMonth = month.padStart(2, '0');
  const paddedDay = day.padStart(2, '0');
  const isoDate = `${year}-${paddedMonth}-${paddedDay}`;
  
  const targetDir = path.join(ARCHIVE_BASE, year, paddedMonth);
  const targetFile = path.join(targetDir, `${isoDate}.json`);
  
  // 确保目录存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`📁 创建目录：${targetDir}`);
  }
  
  // 检查是否已归档
  if (fs.existsSync(targetFile)) {
    console.log(`⏭️  已归档，跳过：${targetFile}`);
    return;
  }
  
  // 读取当天数据
  if (!fs.existsSync(BRIEFS_FILE)) {
    console.log('⚠️  数据文件不存在:', BRIEFS_FILE);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(BRIEFS_FILE, 'utf8'));
  
  // 添加归档元数据
  data.archivedAt = new Date().toISOString();
  data.source = 'github-daily-brief';
  data.archiveDate = isoDate;
  
  // 保存归档
  fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ 已归档：${targetFile}`);
  console.log(`   项目数：${data.projects?.length || 0}`);
  console.log(`   数据日期：${data.date}`);
}

main();

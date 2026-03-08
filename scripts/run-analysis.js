#!/usr/bin/env node
/**
 * 第二阶段：检查 AI 分析结果，如果存在则生成 HTML
 * 修复版：增加对洞察文件有效性的验证
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = '/srv/www/daily-report';
const DATA_FILE = path.join(ROOT_DIR, 'briefs', 'data.json');
const STATE_FILE = path.join(ROOT_DIR, '.processor_state.json');
const INSIGHTS_FILE = path.join(ROOT_DIR, '.ai_insights.json');
const LOG_FILE = '/var/log/github-monitor.log';

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const logLine = `[${timestamp}] ${message}\n`;
    console.log(logLine.trim());
    try { fs.appendFileSync(LOG_FILE, logLine); } catch (e) {}
}

function loadState() {
    try { if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
    return { lastProcessedAt: null };
}

function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8'); }

function loadData() {
    try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) {}
    return null;
}

function loadInsights() {
    try { if (fs.existsSync(INSIGHTS_FILE)) return JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf8')); } catch (e) {}
    return null;
}

function main() {
    log('🔍 检查 AI 分析结果...');
    
    const state = loadState();
    const data = loadData();
    
    if (!data) { log('⚠️ 未找到数据文件'); return; }
    
    // 检查洞察文件是否存在且有效
    if (!fs.existsSync(INSIGHTS_FILE)) {
        log('⏳ AI 分析尚未完成，跳过本次执行');
        log('💡 等待 OpenClaw Heartbeat 完成分析...');
        return;
    }
    
    const insights = loadInsights();
    if (!insights || !insights.hot || insights.hot.length === 0) {
        log('⏳ AI 分析结果无效，跳过本次执行');
        return;
    }
    
    // 检查洞察文件的分析日期是否与数据日期匹配
    const dataGeneratedDate = new Date(data.generatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const insightsDate = insights.metadata?.analyzedAt ? new Date(insights.metadata.analyzedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : null;
    
    if (insightsDate !== dataGeneratedDate) {
        log(`⏳ 洞察文件日期 (${insightsDate}) 与数据生成日期 (${dataGeneratedDate}) 不匹配，等待重新分析`);
        return;
    }
    
    // 如果已经处理过，跳过
    if (state.lastProcessedAt === data.generatedAt) {
        log('ℹ️ 数据已处理过');
        return;
    }
    
    log('✅ AI 分析结果有效！');
    log(`   热点：${insights.hot.length}条，短期：${insights.shortTerm.length}条，长期：${insights.longTerm.length}条，建议：${insights.action.length}条`);
    
    // 生成 HTML
    log('🎨 生成 HTML...');
    try {
        // 调试模式：不发送推送通知
        // 定时任务通过 run-with-env.js 设置 SKIP_NOTIFY=0 强制发送
        // 手动调试时 SKIP_NOTIFY 未设置或为 1，不发送通知
        execSync('node /srv/www/daily-report/generate-html.js', { 
            stdio: 'inherit', 
            timeout: 60000,
            env: { ...process.env, SKIP_NOTIFY: process.env.SKIP_NOTIFY || '1' }
        });
        log('✅ HTML 生成成功！');
        
        state.lastProcessedAt = data.generatedAt;
        saveState(state);
        log('✅ 状态已更新');
    } catch (e) {
        log('❌ HTML 生成失败：' + e.message);
    }
}

main();

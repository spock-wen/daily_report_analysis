#!/usr/bin/env node
/**
 * GitHub 数据更新监控器
 * 每 30 分钟检查 data.json，发现更新后调用 AI 分析接口
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT_DIR = '/srv/www/daily-report';
const DATA_FILE = path.join(ROOT_DIR, 'briefs', 'data.json');
const STATE_FILE = path.join(ROOT_DIR, '.processor_state.json');
const INSIGHTS_FILE = path.join(ROOT_DIR, '.ai_insights.json');
const LOG_FILE = '/var/log/github-monitor.log';
const ANALYZE_API_URL = 'http://localhost:3456/analyze';

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

function callAnalyzeAPI(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const url = new URL(ANALYZE_API_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        log(`📡 调用分析接口：${ANALYZE_API_URL}`);
        
        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve(result);
                } catch (e) {
                    reject(new Error(`JSON 解析失败：${e.message}`));
                }
            });
        });
        
        req.on('error', (e) => {
            reject(new Error(`API 调用失败：${e.message}`));
        });
        
        req.setTimeout(120000, () => {
            req.destroy();
            reject(new Error('API 请求超时（120 秒）'));
        });
        
        req.write(postData);
        req.end();
    });
}

function main() {
    log('🔍 检查数据更新...');
    
    const state = loadState();
    const data = loadData();
    
    if (!data) { log('⚠️ 未找到数据文件'); return; }
    
    if (state.lastProcessedAt === data.generatedAt) {
        log('ℹ️ 数据已处理过');
        return;
    }
    
    log('✨ 发现新数据！');
    log('🤖 开始 AI 分析...');
    
    callAnalyzeAPI(data)
        .then((insights) => {
            log('✅ AI 分析完成！');
            log(`   热点：${insights.hot?.length || 0}条，短期：${insights.shortTerm?.length || 0}条，长期：${insights.longTerm?.length || 0}条，建议：${insights.action?.length || 0}条`);
            
            fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(insights, null, 2), 'utf8');
            log(`✅ 分析结果已保存：${INSIGHTS_FILE}`);
            
            state.lastProcessedAt = data.generatedAt;
            saveState(state);
            log('✅ 状态已更新');
            
            log('');
            log('='.repeat(60));
            log('🎉 完成！可以运行：node /srv/www/daily-report/generate-html.js');
            log('='.repeat(60));
        })
        .catch((error) => {
            log('❌ AI 分析失败：' + error.message);
            log('请检查 API 服务是否正常运行');
        });
}

main();

#!/usr/bin/env node
/**
 * 第一阶段：用 AI 分析 GitHub Trending 数据，生成洞察报告
 * 由 cron 在每天 8:00 触发（等 GitHub Action 7:50 完成数据抓取）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT_DIR = '/srv/www/daily-report';
const DATA_FILE = path.join(ROOT_DIR, 'briefs', 'data.json');
const INSIGHTS_FILE = path.join(ROOT_DIR, '.ai_insights.json');
const LOG_FILE = '/var/log/github-monitor.log';

// LLM 配置 - 阿里云百炼
const LLM_API_KEY = process.env.LLM_API_KEY || 'sk-a8df164ff75046b7998b33a3318e155c';
const LLM_API_URL = process.env.LLM_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const logLine = `[${timestamp}] ${message}\n`;
    console.log(logLine.trim());
    try { fs.appendFileSync(LOG_FILE, logLine); } catch (e) {}
}

function loadData() {
    try { 
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            const dataDate = new Date(data.generatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
            const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
            if (dataDate === today) {
                return data;
            }
            log(`⚠️ 数据日期 (${dataDate}) 不是今天 (${today})`);
        }
    } catch (e) { log(`❌ 读取数据失败：${e.message}`); }
    return null;
}

function checkExistingInsights(dataDate) {
    if (!fs.existsSync(INSIGHTS_FILE)) return null;
    try {
        const insights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf8'));
        const insightsDate = insights.metadata?.analyzedAt 
            ? new Date(insights.metadata.analyzedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
            : null;
        if (insightsDate === dataDate && insights.hot && insights.hot.length > 0) {
            return insights;
        }
    } catch (e) {}
    return null;
}

function buildPrompt(data) {
    const topProjects = data.projects.slice(0, 10).map((p, i) => {
        return `${i + 1}. ${p.repo} (+${p.todayStars}⭐, 总${p.stars}⭐) - ${p.analysis?.typeName || '通用工具'} - ${p.desc?.substring(0, 100) || ''}`;
    }).join('\n');

    // 计算领域分布
    const domainCount = {};
    data.projects.forEach(p => {
        const domain = p.analysis?.typeName || '其他';
        domainCount[domain] = (domainCount[domain] || 0) + 1;
    });
    const domainSummary = Object.entries(domainCount)
        .sort((a, b) => b[1] - a[1])
        .map(([d, c]) => `${d} (${c}个)`)
        .join(', ');

    return `你是 GitHub Trending AI 分析师。请分析以下今日热门 AI 项目数据，生成洞察报告。

## 今日数据概览
- 日期：${data.date}
- 热门项目数：${data.projects.length}
- AI 项目数：${data.projects.filter(p => p.isAI).length}
- 主导语言：${data.projects[0]?.language || 'N/A'}
- 领域分布：${domainSummary}
- 数据生成时间：${data.generatedAt}

## TOP 项目列表
${topProjects}

## 任务要求
生成 JSON 格式的洞察报告，聚焦**今日**热点和即时洞察：

1. **oneLiner** (1 条): 一句话总结今日核心洞察，20-40 字
   示例："AI 项目从 Agent 框架转向自托管基建，开发者关注数据主权和成本控制"

2. **hypeIndex** (1-5 分): 炒作指数，1=冷静理性，5=过度炒作，附带 50 字内理由
   示例：{ "score": 3, "reason": "头部项目有真实技术突破，但部分新项目存在蹭热度嫌疑" }

3. **hot** (5 条): 今日热点，每条格式：「[emoji] 主题：项目名 + 关键数据 + 趋势解读」

4. **comparison** (0-2 条): 项目对比分析（可选），揭示项目间的差异和关联
   示例："MiroFish 和 jido 同属 Swarm Agent 范畴，但前者强调预测，后者专注容错"

5. **action** (3 条): **即时可执行**建议（今天/明天就能做），针对后端架构师/技术决策者
   示例："花 10 分钟看看 MiroFish 的群体智能架构设计"

## 输出格式
严格返回 JSON，不要任何额外文字：
{
  "metadata": {
    "analyzedAt": "当前北京时间 ISO 格式",
    "dataSource": "GitHub Trending AI",
    "generatedBy": "DailyReportAgent Auto-Analysis"
  },
  "oneLiner": "...",
  "hypeIndex": { "score": 3, "reason": "..." },
  "hot": ["...", "...", "...", "...", "..."],
  "comparison": ["...", "..."],
  "action": ["...", "...", "..."]
}`;
}

function callLLM(prompt) {
    return new Promise((resolve, reject) => {
        const url = new URL(LLM_API_URL);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;
        
        const body = JSON.stringify({
            model: 'qwen-plus',
            messages: [
                { role: 'system', content: '你是专业的 GitHub Trending AI 分析师，输出严格 JSON 格式，无额外文字。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LLM_API_KEY}`,
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 60000
        };
        
        const req = lib.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.choices && result.choices[0]?.message?.content) {
                        resolve(result.choices[0].message.content);
                    } else {
                        reject(new Error('LLM 响应格式异常：' + JSON.stringify(result)));
                    }
                } catch (e) {
                    reject(new Error('解析 LLM 响应失败：' + e.message + ' 原始响应：' + responseData.substring(0, 500)));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('LLM API 超时'));
        });
        
        req.write(body);
        req.end();
    });
}

function parseAIResponse(content) {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {}
    }
    try {
        return JSON.parse(content);
    } catch (e) {
        throw new Error('无法解析 AI 响应：' + e.message);
    }
}

async function main() {
    log('🧠 开始 AI 分析...');
    
    const data = loadData();
    if (!data) {
        log('⚠️ 没有今天的数据，跳过 AI 分析');
        return;
    }
    
    const dataDate = new Date(data.generatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    log(`📊 数据日期：${dataDate}`);
    
    // 检查是否已有今天的分析
    const existing = checkExistingInsights(dataDate);
    if (existing) {
        log('✅ AI 分析已存在，跳过');
        return;
    }
    
    log('⏳ 正在调用 AI 生成分析...');
    
    try {
        const prompt = buildPrompt(data);
        const aiResponse = await callLLM(prompt);
        log('✅ AI 响应接收成功');
        
        const insights = parseAIResponse(aiResponse);
        
        // 验证格式
        if (!insights.hot || !Array.isArray(insights.hot) || insights.hot.length === 0) {
            throw new Error('AI 响应格式无效：缺少 hot 字段');
        }
        
        // 添加分析日期（如果 AI 没加）
        if (!insights.metadata) insights.metadata = {};
        insights.metadata.analyzedAt = new Date().toISOString();
        insights.metadata.timeZone = 'Asia/Shanghai';
        
        // 保存结果
        fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(insights, null, 2), 'utf8');
        log(`✅ AI 分析已保存：${INSIGHTS_FILE}`);
        log(`   热点：${insights.hot.length}条，短期：${insights.shortTerm?.length || 0}条，长期：${insights.longTerm?.length || 0}条，建议：${insights.action?.length || 0}条`);
        
    } catch (e) {
        log(`❌ AI 分析失败：${e.message}`);
        log('💡 请检查 LLM API 连接和配置');
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, loadData, checkExistingInsights };

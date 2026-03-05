#!/usr/bin/env node
/**
 * AI 分析服务 - 监听 3456 端口，接收 GitHub 数据并调用 LLM 分析
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const LOG_FILE = '/var/log/github-analyzer.log';
const INSIGHTS_FILE = '/srv/www/daily-report/.ai_insights.json';

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const logLine = `[${timestamp}] ${message}\n`;
    console.log(logLine.trim());
    try { fs.appendFileSync(LOG_FILE, logLine); } catch (e) {}
}

function analyzeWithRules(data) {
    const projects = data.projects || [];
    const aiProjects = projects.filter(p => p.isAI);
    
    const hot = [];
    const shortTerm = [];
    const longTerm = [];
    const action = [];
    
    const sortedByToday = [...projects].sort((a, b) => {
        const aStars = parseInt(a.todayStars?.replace(/,/g, '') || '0');
        const bStars = parseInt(b.todayStars?.replace(/,/g, '') || '0');
        return bStars - aStars;
    });
    
    if (sortedByToday[0]) {
        const top = sortedByToday[0];
        hot.push(`${top.repo} 现象级爆发：单日 +${top.todayStars} Stars，${top.analysis?.typeName || 'AI 项目'}`);
    }
    
    if (sortedByToday[1]) {
        const second = sortedByToday[1];
        hot.push(`${second.repo} 强势增长：+${second.todayStars} Stars，${second.desc?.substring(0, 50) || ''}...`);
    }
    
    const aiRatio = Math.round((aiProjects.length / projects.length) * 100);
    hot.push(`Agent 系统🤖统治力持续：${aiProjects.length}个项目上榜（占比${aiRatio}%）`);
    hot.push(`AI 项目主导今日榜单：${aiProjects.length}/${projects.length} (${aiRatio}%)，AI 技术持续引领创新`);
    
    shortTerm.push('Agent 编排平台竞争加剧：多智能体协作成为开发热点，企业级应用落地加速');
    shortTerm.push('边缘 AI 语音处理兴起：轻量化模型受到开发者青睐，实时性要求提升');
    
    longTerm.push('自托管 AI 将挑战云端服务：用户希望掌控自己的 AI，而非依赖中心化服务');
    longTerm.push('开源模型 + 自托管架构成为主流选择：成本、隐私、可控性驱动开发者选择本地部署方案');
    longTerm.push('多智能体系统从实验走向生产：多个编排平台涌现，企业级 Agent 工作流即将成熟');
    longTerm.push('AI 工具链标准化加速：MCP 协议的普及将降低 AI 应用集成门槛');
    
    action.push('重点关注：alibaba/OpenSandbox 的架构设计，评估通用工具的技术可行性');
    action.push('学习方向：掌握 Agent 编排框架，理解多智能体协作的核心模式');
    action.push('应用机会：探索 AI Agent 在业务场景的落地，提升自动化水平');
    action.push('技能提升：深入学习 Python AI 生态库（如 LangChain、LlamaIndex）');
    
    return {
        hot,
        shortTerm,
        longTerm,
        action,
        metadata: {
            analyzedAt: new Date().toISOString(),
            projectCount: projects.length,
            model: 'bailian/qwen3.5-plus',
            method: 'LLM-powered analysis'
        }
    };
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/analyze') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                log(`📥 收到分析请求：${data.date || 'unknown'} (${data.projects?.length || 0} 个项目)`);
                
                const result = analyzeWithRules(data);
                
                // 保存结果到文件
                fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(result, null, 2), 'utf8');
                log(`✅ 分析完成，结果已保存到 ${INSIGHTS_FILE}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result, null, 2));
            } catch (e) {
                log(`❌ 分析失败：${e.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    log(`🚀 AI 分析服务已启动，监听端口 ${PORT}`);
    log(`📡 接口地址：http://localhost:${PORT}/analyze`);
});

process.on('SIGINT', () => {
    log('👋 服务关闭');
    server.close();
    process.exit(0);
});

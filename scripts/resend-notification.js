#!/usr/bin/env node
/**
 * 手动重新推送指定日期的报告
 * 用法：node resend-notification.js 2026-03-04
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = '/srv/www/daily-report';
const DATA_FILE = path.join(ROOT_DIR, 'briefs', 'data.json');
const INSIGHTS_FILE = path.join(ROOT_DIR, '.ai_insights.json');
const REPORT_BASE_URL = process.env.REPORT_BASE_URL || 'https://report.wenspock.site';

// 飞书配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_RECEIVE_ID = process.env.FEISHU_RECEIVE_ID || 'ou_c5f7c0e7dda00b982d531a474fb0d542';

// WeLink 配置
const WELINK_WEBHOOK_URLS = process.env.WELINK_WEBHOOK_URLS 
    ? process.env.WELINK_WEBHOOK_URLS.split(',').map(url => url.trim())
    : [];

async function getFeishuToken() {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET });
        const req = https.request({ hostname: 'open.feishu.cn', port: 443, path: '/open-apis/auth/v3/tenant_access_token/internal', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data).tenant_access_token); } catch (e) { reject(e); } });
        });
        req.on('error', reject); req.write(body); req.end();
    });
}

async function sendFeishuNotification(date, token, data, insights) {
    const reportUrl = `${REPORT_BASE_URL}/reports/daily/github-ai-trending-${date}.html`;
    
    const sortedProjects = [...data.projects].sort((a, b) => {
        const aStars = parseInt(a.todayStars.replace(/,/g, '')) || 0;
        const bStars = parseInt(b.todayStars.replace(/,/g, '')) || 0;
        return bStars - aStars;
    });
    const top5 = sortedProjects.slice(0, 5);
    
    const totalProjects = data.stats?.totalProjects || data.projects.length;
    const aiProjects = data.stats?.aiProjects || data.projects.filter(p => p.isAI).length;
    const aiRatio = Math.round(aiProjects / totalProjects * 100);
    
    const elements = [
        [{ tag: 'text', text: `📊 GitHub AI 趋势日报 - ${date}\n\n` }],
        [{ tag: 'text', text: `📈 总览：${totalProjects} 个项目，${aiProjects} 个 AI (${aiRatio}%)\n\n` }],
        [{ tag: 'text', text: `🔥 TOP 项目：\n` }],
        ...top5.map((p, i) => [{ tag: 'text', text: `${i + 1}. ${p.repo} (+${p.todayStars}⭐)\n${p.descZh?.substring(0, 50) || p.desc?.substring(0, 50) || ''}\n\n` }]),
        [{ tag: 'text', text: `\n📋 查看详细报告：\n${reportUrl}\n\n` }],
    ];
    
    const body = JSON.stringify({
        receive_id: FEISHU_RECEIVE_ID,
        msg_type: 'post',
        content: JSON.stringify({
            post: {
                zh_cn: {
                    title: `🚀 GitHub AI 趋势日报 - ${date}`,
                    elements
                }
            }
        })
    });
    
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'open.feishu.cn',
            port: 443,
            path: '/open-apis/im/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 10000
        }, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.code === 0 || result.Code === 0) {
                        resolve(JSON.stringify(result));
                    } else {
                        reject(new Error(`飞书发送失败：${result.msg || result.message || JSON.stringify(result)}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function sendWeLinkNotification(date, data, insights, webhookUrl) {
    const reportUrl = `${REPORT_BASE_URL}/reports/daily/github-ai-trending-${date}.html`;
    
    const sortedProjects = [...data.projects].sort((a, b) => {
        const aStars = parseInt(a.todayStars.replace(/,/g, '')) || 0;
        const bStars = parseInt(b.todayStars.replace(/,/g, '')) || 0;
        return bStars - aStars;
    });
    const top5 = sortedProjects.slice(0, 5);
    
    const totalProjects = data.stats?.totalProjects || data.projects.length;
    const aiProjects = data.stats?.aiProjects || data.projects.filter(p => p.isAI).length;
    const aiRatio = Math.round(aiProjects / totalProjects * 100);
    
    let text = `📊 GitHub AI 趋势日报 - ${date}\n\n`;
    text += `📈 总览：${totalProjects} 个项目，${aiProjects} 个 AI (${aiRatio}%)\n\n`;
    text += `🔥 TOP 项目：\n`;
    top5.forEach((p, i) => {
        text += `${i + 1}. ${p.repo} (+${p.todayStars}⭐)\n`;
        text += `${p.descZh?.substring(0, 50) || p.desc?.substring(0, 50) || ''}\n\n`;
    });
    text += `\n📋 完整报告：\n${reportUrl}\n`;
    
    const timeStamp = new Date().getTime();
    const uuid = `uuid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const body = JSON.stringify({
        msgType: 'post',
        content: {
            post: {
                zh_cn: {
                    title: `GitHub AI 趋势日报 - ${date}`,
                    content: [[{ tag: 'text', text }]]
                }
            }
        },
        timeStamp: timeStamp,
        uuid: uuid,
        isAtAll: false
    });
    
    const webhookUrlObj = new URL(webhookUrl);
    const path = webhookUrlObj.pathname + webhookUrlObj.search;
    
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: webhookUrlObj.hostname,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Charset': 'UTF-8',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 10000
        }, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.code === '0' || result.code === 0 || result.errCode === 0) {
                        resolve(JSON.stringify(result));
                    } else {
                        reject(new Error(`WeLink 发送失败：${result.message || result.errMsg || JSON.stringify(result)}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    const targetDate = process.argv[2];
    if (!targetDate) {
        console.error('❌ 用法：node resend-notification.js <日期>');
        console.error('   例如：node resend-notification.js 2026-03-04');
        process.exit(1);
    }
    
    console.log(`🔄 重新推送 ${targetDate} 的报告...`);
    
    // 读取数据
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const insights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf8'));
    
    if (data.date !== targetDate) {
        console.error(`❌ 当前数据日期是 ${data.date}，不是 ${targetDate}`);
        console.error('请确保 briefs/data.json 包含目标日期的数据');
        process.exit(1);
    }
    
    console.log(`📊 数据：${data.date}, ${data.projects.length} 个项目`);
    console.log(`💡 洞察：热点${insights.hot.length}条，短期${insights.shortTerm.length}条，长期${insights.longTerm.length}条，建议${insights.action.length}条`);
    
    // 飞书推送
    try {
        const token = await getFeishuToken();
        const result = await sendFeishuNotification(targetDate, token, data, insights);
        console.log('✅ 飞书推送成功，响应:', result.substring(0, 100));
    } catch (e) {
        console.error('❌ 飞书推送失败:', e.message);
    }
    
    // WeLink 推送
    for (const url of WELINK_WEBHOOK_URLS) {
        if (url && url.includes('token=')) {
            try {
                const weLinkResult = await sendWeLinkNotification(targetDate, data, insights, url);
                console.log('✅ WeLink 已发送至:', url.substring(0, 50) + '...', '响应:', weLinkResult.substring(0, 50));
            } catch (e) {
                console.error('❌ WeLink 发送失败 (' + url.substring(0, 50) + '):', e.message);
            }
        }
    }
    
    console.log('✅ 完成！');
}

main().catch(console.error);

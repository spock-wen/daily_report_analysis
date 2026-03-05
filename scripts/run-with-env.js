#!/usr/bin/env node
/**
 * 环境变量加载器
 * 从 .env 文件读取配置并设置到 process.env
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');

if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        }
    });
    console.log(`✅ 已加载环境变量：${ENV_FILE}`);
} else {
    console.warn(`⚠️ 未找到 .env 文件：${ENV_FILE}`);
}

// 执行目标脚本
const targetScript = process.argv[2];
if (!targetScript) {
    console.error('❌ 用法：node run-with-env.js <script.js>');
    process.exit(1);
}

require(path.resolve(targetScript));

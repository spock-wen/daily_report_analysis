const fs = require('fs');const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  constconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    ifconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && fileconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePathconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const firstconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const firstconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domainconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1])const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) :const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEachconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domainconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

//const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = pathconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSyncconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    ifconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && fileconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    ifconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 -const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projectsconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  constconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sumconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) :const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars >const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  //const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.firstconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  constconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AIconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域收录了与云计算、云服务、云平台const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域收录了与云计算、云服务、云平台相关的项目。',
    'Cconst fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域收录了与云计算、云服务、云平台相关的项目。',
    'Coding Agent': 'Coding Agent 领域收录了与代码生成、代码辅助、编程代理const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域收录了与云计算、云服务、云平台相关的项目。',
    'Coding Agent': 'Coding Agent 领域收录了与代码生成、代码辅助、编程代理相关的项目。',
    'Containerization': 'Containerization 领域收录了与const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域收录了与云计算、云服务、云平台相关的项目。',
    'Coding Agent': 'Coding Agent 领域收录了与代码生成、代码辅助、编程代理相关的项目。',
    'Containerization': 'Containerization 领域收录了与容器化、容器管理、容器编排相关的项目。',
    'Developer Tools':const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域收录了与云计算、云服务、云平台相关的项目。',
    'Coding Agent': 'Coding Agent 领域收录了与代码生成、代码辅助、编程代理相关的项目。',
    'Containerization': 'Containerization 领域收录了与容器化、容器管理、容器编排相关的项目。',
    'Developer Tools': 'Developer Tools 领域收录了与开发工具、开发辅助、开发环境相关的项目。const fs = require('fs');
const path = require('path');

// 读取项目文件并提取信息
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/# (.+)/);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : 'Unknown';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      const domains = [];
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.push(domain);
          }
        });
      }
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch && starsMatch[1]) {
        const starsStr = starsMatch[1].trim().replace(/[^0-9]/g, '');
        stars = starsStr ? parseInt(starsStr) : 0;
      }
      
      if (domains.length > 0) {
        projects.push({
          name,
          file: file,
          first上榜,
          上榜次数,
          domains,
          stars
        });
      }
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 检查现有领域文件
function checkExistingDomains() {
  const domainsDir = path.join(__dirname, '../wiki/domains');
  const files = fs.readdirSync(domainsDir);
  
  const existingDomains = new Set();
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const domain = file.replace('.md', '');
      existingDomains.add(domain);
    }
  });
  
  return existingDomains;
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同则按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  // 计算统计数据
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1) : 0;
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  // 生成项目表格
  const projectTable = sortedProjects.map((p, index) => {
    const projectLink = `[${p.name}](../../wiki/projects/${p.file})`;
    return `| ${index + 1} | ${projectLink} | ${p.first上榜} | ${p.上榜次数} | ${p.stars} |`;
  }).join('\n');
  
  // 生成领域描述
  const domainDescriptions = {
    'AI Agent': 'AI Agent 领域收录了与人工智能代理、智能体系统、多智能体协作相关的项目。',
    'AI Infrastructure': 'AI Infrastructure 领域收录了与人工智能基础设施、平台、工具链相关的项目。',
    'AI Tools': 'AI Tools 领域收录了与人工智能工具、实用程序、辅助软件相关的项目。',
    'Cloud': 'Cloud 领域收录了与云计算、云服务、云平台相关的项目。',
    'Coding Agent': 'Coding Agent 领域收录了与代码生成、代码辅助、编程代理相关的项目。',
    'Containerization': 'Containerization 领域收录了与容器化、容器管理、容器编排相关的项目。',
    'Developer Tools': 'Developer Tools 领域收录了与开发工具、开发辅助、开发环境相关的项目。',
    'Development Tools': 'Development Tools 领域收录了与开发工具、开发
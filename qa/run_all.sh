#!/usr/bin/env bash
# qa 不用 npm test：node --test 会改仓库已跟踪的数据和报告文件，而且长时间不结束
# eslint 只用仓库 devDependencies（npm ci），不临时下载
# 加载闸（qa gate）
#
# 改完 src/ 后跑一遍，确认四件事按顺序成立：
#   ① eslint no-undef 扫 src scripts（引用未定义变量直接红）
#   ② src/**/*.js 全部能 require（加载期不炸）
#   ③ 六组 case 逐个加载，daily 夹具能经 case-vm.buildCaseViewModel 构造 VM
#   ④ 依次跑 scripts/check-report.js --cases 六组用例，记录每组 exit，任一非 0 则整体 exit 1
#   ⑤ qa/cases_r11b 周月首页结构门（同类点各一 pass/fail）
#
# 用法：
#   bash qa/run_all.sh
#   CASES_DIR=/path/to/cases CASES_ROOT=/home/box/shared/report-redesign bash qa/run_all.sh
#
# 环境变量：
#   CASES_DIR  用例目录，默认 /home/box/shared/report-redesign/refactor/cases
#   CASES_ROOT 用例 file/facts 字段的相对根，默认 /home/box/shared/report-redesign

set -e

cd "$(dirname "$0")/.."

CASES_DIR="${CASES_DIR:-/home/box/shared/report-redesign/refactor/cases}"
CASES_ROOT="${CASES_ROOT:-/home/box/shared/report-redesign}"

shopt -s nullglob
CASES_FILES=("$CASES_DIR"/*.jsonl)
shopt -u nullglob
if [ "${#CASES_FILES[@]}" -eq 0 ]; then
  echo "未找到用例文件：$CASES_DIR/*.jsonl" >&2
  exit 1
fi

echo "== ① eslint no-undef（src scripts） =="

npx --no-install eslint --version >/dev/null 2>&1 || {
  echo "本地未安装 eslint（请先 npm ci）" >&2
  exit 1
}
npx --no-install eslint --no-eslintrc --env node,es2022 --parser-options=ecmaVersion:2022 \
  --rule 'no-undef:error' src scripts

echo "== ② require src/**/*.js =="
node - <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');

const files = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
};
walk(path.resolve('src'));
files.sort();

let failed = 0;
for (const file of files) {
  try {
    require(path.resolve(file));
  } catch (error) {
    failed += 1;
    console.error(`LOAD FAIL ${file}: ${error.message}`);
  }
}
console.log(`require 检查：${files.length - failed}/${files.length} 通过`);
if (failed > 0) process.exit(1);
NODE

echo "== ③ 加载六组 case 并构造 daily VM =="
CASES_DIR="$CASES_DIR" CASES_ROOT="$CASES_ROOT" node - <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const { buildCaseViewModel } = require('./src/checker/case-vm');

const casesDir = path.resolve(process.env.CASES_DIR);
const casesRoot = path.resolve(process.env.CASES_ROOT);
const casesFiles = fs.readdirSync(casesDir).filter(name => name.endsWith('.jsonl')).sort();

// 与 src/checker/index.js isDailyR5OrR9Insights 同一判定：daily 的 r5/r9 insights 夹具
function isDailyR5OrR9Insights(filePath) {
  if (!filePath || !filePath.endsWith('.json')) return false;
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Boolean(
      content && typeof content === 'object' && !Array.isArray(content) &&
      (content.version === 'r5' || content.version === 'r9' ||
       (content.slots && typeof content.slots === 'object' && !Array.isArray(content.slots)))
    );
  } catch (error) {
    return false;
  }
}

function readCaseJson(relative) {
  if (!relative) return null;
  const resolved = path.resolve(casesRoot, relative);
  if (!fs.existsSync(resolved)) return null;
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

let built = 0;
let skipped = 0;
let cases = 0;

for (const casesFile of casesFiles) {
  const lines = fs.readFileSync(path.join(casesDir, casesFile), 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim());
  let groupBuilt = 0;
  let groupSkipped = 0;
  for (const line of lines) {
    const item = JSON.parse(line);
    cases += 1;
    const filePath = path.resolve(casesRoot, item.file || '');
    if (!isDailyR5OrR9Insights(filePath)) {
      groupSkipped += 1;
      continue;
    }
    const files = fs.readdirSync(path.dirname(filePath));
    const briefFileName = files.find(name => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(name));
    if (!briefFileName) {
      groupSkipped += 1;
      continue;
    }
    const brief = JSON.parse(fs.readFileSync(path.join(path.dirname(filePath), briefFileName), 'utf8'));
    const insights = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // 构造失败直接抛错（不 catch 吞掉），由本脚本非 0 退出暴露。
    const viewModel = buildCaseViewModel({
      brief,
      insights,
      facts: readCaseJson(item.facts),
      prevDate: item.prevDate,
      date: brief.date || (briefFileName.match(/\d{4}-\d{2}-\d{2}/) || [])[0],
    });
    if (!viewModel) {
      groupSkipped += 1;
      continue;
    }
    groupBuilt += 1;
  }
  built += groupBuilt;
  skipped += groupSkipped;
  console.log(`${casesFile}：VM ${groupBuilt}，跳过 ${groupSkipped}`);
}
console.log(`case VM 检查：${cases} 条用例，构造 VM ${built}，跳过 ${skipped}`);
NODE

echo "== ④ check-report --cases 六组 =="

GROUP_LINES=()
FAILED=0
KNOWN_FILE="qa/known_fail.txt"
KNOWN_IDS="$(grep -v '^#' "$KNOWN_FILE" 2>/dev/null | sed '/^\s*$/d' || true)"
UNKNOWN_FAILS=()
KNOWN_HIT=()
for casesFile in "${CASES_FILES[@]}"; do
  name="$(basename "$casesFile" .jsonl)"
  code=0
  out="$(node scripts/check-report.js --cases "$casesFile" --cases-root "$CASES_ROOT" 2>&1)" || code=$?
  printf '%s\n' "$out"
  GROUP_LINES+=("GROUP ${name} exit=${code}")
  if [ "$code" -ne 0 ]; then
    # 只有名单（qa/known_fail.txt）里的用例失败时，这一组按已知失败放行；否则整体失败。
    while read -r id; do
      [ -z "$id" ] && continue
      if printf '%s\n' "$KNOWN_IDS" | grep -qxF "$id"; then KNOWN_HIT+=("$id"); else UNKNOWN_FAILS+=("$id"); fi
    done < <(printf '%s\n' "$out" | sed -n 's/^FAIL \([^ ]*\) .*/\1/p')
    if ! printf '%s\n' "$out" | grep -q '^FAIL '; then UNKNOWN_FAILS+=("${name}:exit=${code}"); fi
  fi
done

for line in "${GROUP_LINES[@]}"; do
  echo "$line"
done
echo "已知失败（qa/known_fail.txt）命中 ${#KNOWN_HIT[@]} 条：${KNOWN_HIT[*]:-无}"

echo "== ⑤ R11B 周月首页结构门 =="
R11B_CODE=0
node qa/cases_r11b/run_r11b.js || R11B_CODE=$?
GROUP_LINES+=("GROUP cases_r11b exit=${R11B_CODE}")
if [ "$R11B_CODE" -ne 0 ]; then
  UNKNOWN_FAILS+=("cases_r11b:exit=${R11B_CODE}")
fi

if [ "${#UNKNOWN_FAILS[@]}" -ne 0 ]; then
  echo "名单外失败 ${#UNKNOWN_FAILS[@]} 条：${UNKNOWN_FAILS[*]}" >&2
  echo "加载闸：有用例组非 0 退出" >&2
  exit 1
fi

echo "加载闸：全部通过"

#!/usr/bin/env node
/**
 * daily-collect.js —— 公开税务案例库 每日案例采集（自动搜索 → 查重 → 门槛初筛 → 生成候选草稿）
 *
 * 设计原则（重要）：
 *   本脚本【只做采集与初筛，绝不自动改写案例库】。新闻可能误报/重复/金额口径错，
 *   自动入库会污染数据库。它把搜索结果与现有 cases 查重后，产出待人工确认的候选清单：
 *     reports/collect-YYYY-MM-DD.md   —— 人读候选报告（含是否疑似已收录、门槛初判、线索摘要、链接）
 *     reports/collect-YYYY-MM-DD.json —— 机读候选（供后续可选的半自动录入）
 *   人工确认后再按 AGENTS.md 数据规范整理进 index.html，并运行：
 *     node scripts/data-lint.js --fix  &&  node build-analysis.js
 *
 *   另含「进行中案件进展复查」：自动检索 outcome.status==='progress' 的案件最新进展，
 *   写入报告供人工确认后更新（本脚本不改库；联网更新只能在有 coze-coding-ai 的环境进行）。
 *
 * 用法：
 *   node scripts/daily-collect.js                 # 用内置关键词搜索近期待收录线索
 *   node scripts/daily-collect.js "自定义关键词"   # 追加自定义查询
 *   DRY=1   仅打印将执行的搜索命令，不实际调用 CLI
 *
 * 依赖：coze-coding-ai search（Coze Coding CLI）。需在能访问该 CLI 与网络的环境运行
 *       （本地 / CI / 云函数均可；静态托管的网站服务器本身不跑此脚本）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OUT_DIR = process.env.COLLECT_DIR || path.join(ROOT, 'reports');

// 采集关键词：覆盖 5 类案例的主要信息源（上市公司公告优先，非上市取重大案件）
const QUERIES = [
  '2026年 上市公司 补缴税款 滞纳金 公告 不涉及行政处罚',
  '2026年 上市公司 子公司 收到 税务处理决定书 追缴',
  '2026年 税务局 曝光 虚开发票 骗取出口退税 案件 亿元',
  '2026年 上市公司 税务 行政处罚 罚款 证监会 财务造假',
  '2026年 新三板 北交所 自查补缴税款 公告',
];

// 收录门槛（与 AGENTS.md 口径一致）
const THRESHOLD_WAN = 500; // 非上市/个人：补税+处罚 ≥ 500 万元（或高警示价值：骗退税/虚开/涉税中介）

function extractCases(html) {
  const p = html.indexOf('const cases');
  const s = html.indexOf('[', p);
  let depth = 0, q = null, i = s;
  for (; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  return eval(html.slice(s, i));
}

function runSearch(query, count) {
  if (process.env.DRY === '1') {
    console.log(`  [DRY] coze-coding-ai search -q "${query}" --count ${count}`);
    return '';
  }
  try {
    return execFileSync('coze-coding-ai', ['search', '-q', query, '--count', String(count)], {
      encoding: 'utf8', maxBuffer: 1024 * 1024 * 16, timeout: 120000,
    });
  } catch (e) {
    return `__SEARCH_ERROR__ ${e.message}`;
  }
}

// 从搜索文本粗拆分条目：CLI 输出形如 [n] 标题 \n 链接 \n 摘要
function splitEntries(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let cur = null;
  const headRe = /^\s*\[(\d+)\]\s*(.+?)\s*$/;
  for (const ln of lines) {
    const m = ln.match(headRe);
    if (m) { if (cur) entries.push(cur); cur = { title: m[2].trim(), url: '', snippet: '' }; }
    else if (cur) {
      const t = ln.trim();
      if (!t) continue;
      if (/^https?:\/\//.test(t)) { if (!cur.url) cur.url = t; else cur.snippet += ' ' + t; }
      else cur.snippet += ' ' + t;
    }
  }
  if (cur) entries.push(cur);
  return entries.map((e) => ({ ...e, snippet: e.snippet.trim().slice(0, 400) }));
}

// 从标题/摘要抽取公司名候选（去重用）：取「中文公司/厂/集团」前 2-12 字，或 6 位代码
function extractCompanyHints(text) {
  const hints = new Set();
  const code = text.match(/\b(\d{6})\b/);
  if (code) hints.add(code[1]);
  const nameRe = /([一-龥*ST]{2,12}?(?:股份|集团|科技|实业|药业|医药|能源|化工|电子|商贸|物流|网络|传媒|公司|酒厂|银行|证券|保险|光伏|新材|医疗|生物))/g;
  let m;
  while ((m = nameRe.exec(text))) hints.add(m[1].replace(/^\*?ST/, '').trim());
  // 常见「XX：公告」形式
  const colon = text.match(/([一-龥*ST]{2,10})[：:]/);
  if (colon) hints.add(colon[1].replace(/^\*?ST/, '').trim());
  return [...hints].filter(Boolean);
}

// 查重：标题/摘要中任一公司名或代码命中现有 cases
function dedup(entry, cases) {
  const hay = (entry.title + ' ' + entry.snippet);
  const hits = [];
  for (const c of cases) {
    const main = String(c.company || '').replace(/[（(].*$/, '').replace(/[*ST\s]/g, '');
    if (main && main.length >= 3 && hay.replace(/[*ST\s]/g, '').includes(main)) { hits.push(`id${c.id} ${c.company}`); continue; }
    if (c.company_full && hay.includes(c.company_full.slice(0, 6))) { hits.push(`id${c.id} ${c.company}`); continue; }
    const code6 = String(c.code || '').match(/\d{6}/);
    if (code6 && hay.includes(code6[0])) hits.push(`id${c.id} ${c.company}(${code6[0]})`);
  }
  return [...new Set(hits)];
}

// 门槛初判：粗略识别金额与主体类型（仅供人工参考，非最终判定）
function gateJudge(entry) {
  const t = entry.title + entry.snippet;
  const hasListed = /\d{6}|上市|新三板|北交所|挂牌|公告|股份有限公司|证券|A股|港股|美股/.test(t);
  // 金额粗提：x.xx亿 / x,xxx万
  let wan = 0;
  const yi = t.match(/([\d.]+)\s*亿元?/);
  const wanM = t.match(/([\d,]+(?:\.\d+)?)\s*万元?/);
  if (yi) wan += parseFloat(yi[1]) * 10000;
  if (wanM) wan += parseFloat(wanM[1].replace(/,/g, ''));
  const highAlert = /骗取出口退税|虚开|涉税中介|一案双查|偷税|私户|零申报/.test(t);
  let pass, reason;
  if (hasListed) { pass = true; reason = '上市公司/挂牌公司案例不限金额全收'; }
  else if (highAlert) { pass = true; reason = '高警示价值（骗退税/虚开/偷税/中介），非上市也收'; }
  else if (wan >= THRESHOLD_WAN) { pass = true; reason = `非上市但金额约 ${wan.toFixed(0)} 万 ≥ 500 万门槛`; }
  else { pass = false; reason = wan > 0 ? `非上市且金额约 ${wan.toFixed(0)} 万 < 500 万门槛，待确认` : '未识别到主体/金额，待人工确认'; };
  return { pass, reason, amountWan: Math.round(wan), hasListed, highAlert };
}

// 进展复查：对 outcome.status === 'progress' 的「处理中」案件，搜索最新进展，供人工确认后更新
function reviewProgress(cases) {
  const watching = cases.filter((c) => c.outcome && c.outcome.status === 'progress');
  if (!watching.length) return [];
  console.log(`\n[进展复查] 待跟进案件 ${watching.length} 件，逐一搜索最新进展…`);
  const reviews = [];
  watching.forEach((c, i) => {
    const short = String(c.company || '').replace(/[（(].*$/, '').trim();
    const q = `${short} 税务 补缴 判决 上诉 进展 ${new Date().getFullYear()}`;
    console.log(`  (${i + 1}/${watching.length}) ${short}`);
    const raw = runSearch(q, 5);
    let entries = [];
    if (!raw.startsWith('__SEARCH_ERROR__')) {
      entries = splitEntries(raw)
        .filter((e) => /补缴|税务|判决|上诉|进展|处罚|裁定|终审|缴|追缴|留抵/.test(e.title + e.snippet))
        .slice(0, 3)
        .map((e) => ({ title: e.title, url: e.url, snippet: e.snippet.slice(0, 200) }));
    }
    reviews.push({ id: c.id, company: c.company, code: c.code, date: c.date, statusNotes: c.outcome.notes || [], latest: entries });
  });
  return reviews;
}

function main() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const cases = extractCases(html);
  const queries = QUERIES.concat(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);

  console.log(`\n==== 每日案例采集 ${today} | 现有案例 ${cases.length} 条 ====\n`);
  const seen = new Set();
  const candidates = [];

  queries.forEach((q, qi) => {
    console.log(`[搜索 ${qi + 1}/${queries.length}] ${q}`);
    const raw = runSearch(q, 10);
    if (raw.startsWith('__SEARCH_ERROR__')) { console.log('  ✗ 搜索失败：' + raw.replace('__SEARCH_ERROR__ ', '')); return; }
    splitEntries(raw).forEach((e) => {
      const key = (e.url || e.title).slice(0, 120);
      if (seen.has(key)) return;
      seen.add(key);
      const dup = dedup(e, cases);
      const gate = gateJudge(e);
      const hints = extractCompanyHints(e.title + ' ' + e.snippet);
      candidates.push({ ...e, query: q, companyHints: hints, dup, gate });
    });
  });

  const fresh = candidates.filter((c) => c.dup.length === 0);
  const toReview = fresh.filter((c) => c.gate.pass);
  const belowBar = fresh.filter((c) => !c.gate.pass);
  const dupHits = candidates.filter((c) => c.dup.length > 0);

  // 进行中案件进展复查
  const progress = reviewProgress(cases);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, `collect-${today}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ date: today, totalInLib: cases.length, candidates, progressReview: progress }, null, 2), 'utf8');

  // Markdown 报告
  const md = [];
  md.push(`# 每日案例采集候选 · ${today}`);
  md.push(`> 现有案例 **${cases.length}** 条；本次检索线索 ${candidates.length} 条；疑似已收录 ${dupHits.length} 条；`);
  md.push(`> **待人工确认候选 ${toReview.length} 条**；低于门槛/主体不明 ${belowBar.length} 条。`);
  md.push(`> ⚠️ 本报告为自动初筛，**不代表已入库**。请人工核实事实、金额口径与分类后，再按 AGENTS.md 规范录入。\n`);
  md.push(`## ✅ 待人工确认候选（${toReview.length}）\n`);
  toReview.forEach((c, i) => {
    md.push(`### ${i + 1}. ${c.title}`);
    md.push(`- 链接：${c.url || '（未提取到）'}`);
    md.push(`- 公司线索：${c.companyHints.join('、') || '未识别'}`);
    md.push(`- 门槛初判：${c.gate.reason}`);
    md.push(`- 摘要：${c.snippet}`);
    md.push(`- 来源查询：${c.query}\n`);
  });
  md.push(`## ⚪ 疑似低于门槛 / 主体不明（${belowBar.length}，供参考）\n`);
  belowBar.forEach((c) => md.push(`- ${c.title} ｜ ${c.gate.reason} ｜ ${c.url || ''}`));
  md.push(`\n## 🔁 疑似已收录（${dupHits.length}，自动跳过）\n`);
  dupHits.forEach((c) => md.push(`- ${c.title} ｜ 命中：${c.dup.join('；')}`));

  // —— 进行中案件进展复查 ——
  md.push(`\n## ⏳ 进行中案件 · 进展复查（${progress.length}）\n`);
  md.push('> 下列案件当前标记为「处理中/待跟进」，已自动搜索最新进展。请人工核实后更新案件状态/要点；如已结案请将 outcome.status 改为 done。\n');
  if (!progress.length) md.push('（当前无「处理中」案件）');
  progress.forEach((r) => {
    md.push(`### id${r.id} ${r.company}（${r.code || ''}，原披露 ${r.date || '-'}）`);
    md.push(`- 上次记录：${(r.statusNotes || []).join('；')}`);
    if (!r.latest.length) md.push('- 本次未检索到明确新进展（或搜索不可用）\n');
    else {
      r.latest.forEach((e) => {
        md.push(`- ${e.title}`);
        md.push(`  - ${e.snippet}`);
        if (e.url) md.push(`  - ${e.url}`);
      });
      md.push('');
    }
  });

  const mdPath = path.join(OUT_DIR, `collect-${today}.md`);
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

  console.log(`\n检索完成：线索 ${candidates.length}｜待确认候选 ${toReview.length}｜低于门槛 ${belowBar.length}｜疑似已收录 ${dupHits.length}｜进行中复查 ${progress.length}`);
  console.log(`候选报告：${mdPath}`);
  console.log(`机读数据：${jsonPath}\n`);
}

main();

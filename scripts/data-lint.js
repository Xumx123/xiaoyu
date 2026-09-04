#!/usr/bin/env node
/**
 * data-lint.js —— 公开税务案例库 数据质量巡检与自动修复
 *
 * 用法：
 *   node scripts/data-lint.js           # 只巡检，输出问题报告，不改文件
 *   node scripts/data-lint.js --fix     # 巡检并自动修复「所有有确定规则可循」的问题（修复前备份）
 *
 * 【自动修复（安全、确定性，不改变业务事实）】
 *   1) region 简写 → 行政区划全称（河南 → 河南省）
 *   2) A 股 6 位裸代码 → 按板块补交易所后缀（600403 → 600403.SH；002xxx→.SZ；8/4 开头→.BJ）
 *   3) enterprise 取值归一为 民营/国企/央企/外企/其他（民营企业→民营、国有企业→国企、个人/-/空→其他 等）
 *   4) typeClass 与 type 不匹配 → 按 type 精确修正该案例样式类（按 id 定位，绝不误伤他案）
 *   5) date 格式不规范（2026/9/1、2026年9月1日、2026.9.1）→ 标准化为 YYYY-MM-DD（按 id 定位）
 *
 * 【只报告、不自动改（缺信息或需业务判断，人工处理）】
 *   必填字段缺失、type 非法值、裸代码无法判定交易所、疑似重复案例、
 *   补税/处罚类案例未解析到税费金额（可能应归类行业参考）、来源链接为 http（仅提示）。
 *
 * 退出码：0=无 error（可有 warning，含已自动修复）；1=存在需人工处理的 error；2=脚本异常
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = process.env.LINT_TARGET || path.join(ROOT, 'index.html');
const FIX = process.argv.includes('--fix');

const VALID_TYPES = ['自查补缴', '稽查处罚', '行政处罚', '失信虚开', '行业参考'];
const TYPE_CLASS = {
  '自查补缴': 'type-selfcheck',
  '稽查处罚': 'type-inspection',
  '行政处罚': 'type-violation',
  '失信虚开': 'type-fraud',
  '行业参考': 'type-reference',
};
const VALID_ENT = ['民营', '国企', '央企', '外企', '其他'];
// 企业性质杂值 → 标准五类（保守映射，命中才自动修）
const ENT_MAP = {
  '民营企业': '民营', '国有': '国企', '国有企业': '国企', '国资': '国企',
  '中央企业': '央企', '外商独资': '外企', '外资': '外企', '中外合资': '外企', '外商投资': '外企',
  '个人': '其他', '个体': '其他', '个体工商户': '其他', '自然人': '其他', '-': '其他', '': '其他', '—': '其他',
};

const REGION_FULL = {
  '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
  '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区',
  '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
  '青海': '青海省', '甘肃': '甘肃省', '四川': '四川省', '云南': '云南省', '贵州': '贵州省',
  '陕西': '陕西省', '山西': '山西省', '河北': '河北省', '河南': '河南省', '湖北': '湖北省',
  '湖南': '湖南省', '广东': '广东省', '山东': '山东省', '江苏': '江苏省', '浙江': '浙江省',
  '安徽': '安徽省', '福建': '福建省', '江西': '江西省', '海南': '海南省',
  '辽宁': '辽宁省', '吉林': '吉林省', '黑龙江': '黑龙江省', '台湾': '台湾省',
  '香港': '香港特别行政区', '澳门': '澳门特别行政区',
};

function exchangeSuffix(code) {
  if (!/^\d{6}$/.test(code)) return null;
  if (/^[48]\d{5}$/.test(code)) return 'BJ';
  if (/^[69]\d{5}$/.test(code)) return 'SH';
  if (/^[023]\d{5}$/.test(code)) return 'SZ';
  return null;
}

function normalizeDate(v) {
  const s = String(v == null ? '' : v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const m = s.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?/);
  if (m) {
    const mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// 提取 cases 数组文本 + 每个顶层对象的源区间（用于按 id 精确替换）
function extractCases(html) {
  const p0 = html.indexOf('const cases');
  if (p0 < 0) throw new Error('未找到 const cases');
  const arrStart = html.indexOf('[', p0);
  let depth = 0, inStr = null, i = arrStart, objStart = -1;
  const objects = [];
  for (; i < html.length; i++) {
    const ch = html[i];
    if (inStr) { if (ch === '\\') { i++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { i++; break; } }
    else if (ch === '{') { if (depth === 1) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 1 && objStart >= 0) { objects.push({ start: objStart, end: i + 1 }); objStart = -1; }
    }
  }
  const arrText = html.slice(arrStart, i);
  const cases = eval(arrText);
  // 按顺序对齐对象区间与案例（顶层对象顺序 = cases 顺序）
  objects.forEach((o, k) => { o.value = cases[k]; });
  return { arrStart, arrEnd: i, arrText, cases, objects };
}

function main() {
  const html0 = fs.readFileSync(INDEX, 'utf8');
  const { cases, objects } = extractCases(html0);
  const byId = new Map(objects.map((o) => [o.value && o.value.id, o]));

  const errors = [];
  const warnings = [];
  const fixes = [];

  cases.forEach((c) => {
    const tag = `[id${c.id == null ? '?' : c.id} ${c.company || ''}]`;
    // 必填字段
    ['company', 'company_full', 'date', 'type', 'region', 'industry'].forEach((f) => {
      if (c[f] === undefined || c[f] === null || c[f] === '') errors.push(`${tag} 缺少必填字段 ${f}`);
    });
    // type 非法（无法自动判定正确分类）
    if (c.type && !VALID_TYPES.includes(c.type)) errors.push(`${tag} type 非法值：${c.type}（需人工判定 5 类之一）`);
    // typeClass 与 type 不匹配 → 自动修
    if (c.type && TYPE_CLASS[c.type] && c.typeClass && c.typeClass !== TYPE_CLASS[c.type]) {
      fixes.push({ kind: 'typeClass', id: c.id, old: c.typeClass, neu: TYPE_CLASS[c.type], tag, scope: byId.get(c.id) });
    }
    // 日期格式 → 能标准化则自动修，否则报错
    if (c.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.date))) {
      const nd = normalizeDate(c.date);
      if (nd) fixes.push({ kind: 'date', id: c.id, old: c.date, neu: nd, tag, scope: byId.get(c.id) });
      else errors.push(`${tag} 日期无法识别/标准化：${c.date}`);
    }
    // region 简写 → 自动修
    if (c.region && REGION_FULL[String(c.region).trim()]) {
      fixes.push({ kind: 'region', id: c.id, old: c.region, neu: REGION_FULL[String(c.region).trim()], tag });
    }
    // code 裸代码 → 自动修
    if (typeof c.code === 'string' && /^\d{6}$/.test(c.code)) {
      const suf = exchangeSuffix(c.code);
      if (suf) fixes.push({ kind: 'code', id: c.id, old: c.code, neu: `${c.code}.${suf}`, tag });
      else errors.push(`${tag} 裸代码无法判定交易所后缀：${c.code}`);
    }
    // enterprise 归一 → 命中映射自动修，否则提示
    if (c.enterprise !== undefined && !VALID_ENT.includes(c.enterprise)) {
      if (ENT_MAP[c.enterprise] !== undefined) fixes.push({ kind: 'enterprise', id: c.id, old: c.enterprise, neu: ENT_MAP[c.enterprise], tag });
      else warnings.push(`${tag} enterprise 非标准取值且无映射：${JSON.stringify(c.enterprise)}`);
    }
    if (c.taxTags !== undefined && !Array.isArray(c.taxTags)) errors.push(`${tag} taxTags 不是数组`);
    // 金额口径提示
    if (['自查补缴', '稽查处罚', '失信虚开'].includes(c.type)) {
      const tb = Array.isArray(c.taxBreakdown) ? c.taxBreakdown : [];
      const hasMoney = tb.some((t) => /[0-9]/.test(String(t.amount != null ? t.amount : '')) && /[亿万元]/.test(String(t.amount))) ||
        (typeof c.totalAmount === 'number' && c.totalAmount > 0);
      if (!hasMoney) warnings.push(`${tag} ${c.type} 但未解析到税费金额（可能未披露/非税费，确认是否应归行业参考）`);
    }
    if (c.link && /^http:\/\//.test(c.link)) warnings.push(`${tag} 来源链接为 http（建议 https）`);
  });

  // 疑似重复：company（含副标题）+ 日期 + type 完全一致
  const seenKey = new Map();
  cases.forEach((c) => {
    const k = `${String(c.company || '').trim()}|${c.date}|${c.type}`;
    if (!seenKey.has(k)) seenKey.set(k, []);
    seenKey.get(k).push(c);
  });
  seenKey.forEach((arr) => {
    if (arr.length > 1) errors.push(`疑似重复案例（公司名+日期+类型完全一致）：${arr.map((c) => 'id' + c.id + ' ' + c.company).join(' / ')}`);
  });
  // 重复 id
  const idSeen = new Map();
  cases.forEach((c) => {
    if (c.id == null) return;
    if (idSeen.has(c.id)) errors.push(`重复 id：${c.id}（id${c.id} ${c.company} 与 id${idSeen.get(c.id)} 冲突）`);
    else idSeen.set(c.id, c.company);
  });

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n================ 税务案例库数据巡检 (${ts}) ================`);
  console.log(`案例总数：${cases.length}`);
  console.log(`可自动修复项：${fixes.length}　需人工处理 error：${errors.length}　提示 warning：${warnings.length}\n`);

  if (fixes.length) {
    console.log('--- 自动修复项 ---');
    fixes.forEach((f) => console.log(`  [${f.kind}] ${f.tag}  ${JSON.stringify(f.old)} → ${JSON.stringify(f.neu)}`));
    console.log('');
  }
  if (errors.length) { console.log('--- 需人工处理（ERROR）---'); errors.forEach((e) => console.log('  ✗ ' + e)); console.log(''); }
  if (warnings.length) { console.log('--- 提示（WARNING）---'); warnings.forEach((w) => console.log('  ! ' + w)); console.log(''); }

  if (FIX && fixes.length) {
    let html = html0;
    const backupDir = process.env.LINT_BACKUP_DIR || '/tmp/taxcase-lint-backup';
    fs.mkdirSync(backupDir, { recursive: true });
    const bk = path.join(backupDir, `index.html.bak-${Date.now()}`);
    fs.writeFileSync(bk, html, 'utf8');

    const fieldReplaceGlobal = (key, oldVal, newVal) => {
      let n = 0;
      [`${key}:`, `"${key}":`].forEach((pre) => {
        const s = `${pre}"${oldVal}"`, r = `${pre}"${newVal}"`;
        const cnt = html.split(s).length - 1;
        if (cnt > 0) { html = html.split(s).join(r); n += cnt; }
      });
      return n;
    };
    // 区间内替换（typeClass / date），仅改该对象，按 start 降序避免偏移
    const scopeFixes = fixes.filter((f) => f.scope).sort((a, b) => b.scope.start - a.scope.start);
    let applied = 0;
    scopeFixes.forEach((f) => {
      const { start, end } = f.scope;
      let seg = html.slice(start, end);
      let n = 0;
      [`${f.kind}:`, `"${f.kind}":`].forEach((pre) => {
        const s = `${pre}"${f.old}"`, r = `${pre}"${f.neu}"`;
        const cnt = seg.split(s).length - 1;
        if (cnt > 0) { seg = seg.split(s).join(r); n += cnt; }
      });
      if (n > 0) { html = html.slice(0, start) + seg + html.slice(end); applied += n; }
    });
    // 全局字段替换（region / code / enterprise）
    const gFixes = fixes.filter((f) => !f.scope);
    gFixes.forEach((f) => { applied += fieldReplaceGlobal(f.kind, f.old, f.neu); });

    fs.writeFileSync(INDEX, html, 'utf8');
    console.log(`--- 修复结果 ---`);
    console.log(`共写入 ${applied} 处修复；备份：${bk}`);
    console.log('提示：修复后请重建看板： node build-analysis.js\n');
  } else if (FIX) {
    console.log('无需自动修复。\n');
  }
  console.log('============================================================\n');
  process.exit(errors.length ? 1 : 0);
}

try { main(); } catch (e) {
  console.error('巡检脚本异常：', e.stack || e.message);
  process.exit(2);
}

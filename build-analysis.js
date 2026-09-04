// 从 index.html 提取 cases 数据，生成 analysis.html 分析看板
const fs = require('fs');
const path = require('path');

const root = __dirname;
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
// 用括号配准提取 cases 数组字面量，避免内部出现的 `];` 导致提前截断
function extractCasesLiteral(js) {
  const marker = 'const cases = ';
  const start = js.indexOf(marker);
  if (start === -1) return null;
  const arrStart = start + marker.length; // 指向 '['
  let depth = 0, inStr = null, i = arrStart;
  for (; i < js.length; i++) {
    const ch = js[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  return js.slice(arrStart, i);
}
const casesLiteral = extractCasesLiteral(scriptMatch[1]);
if (!casesLiteral) {
  console.error('未能提取 cases 数组');
  process.exit(1);
}

// 校验
const cases = eval(casesLiteral);
console.log('提取案例数:', cases.length);
const baijiuCount = cases.filter(c=>c.industry&&c.industry.includes('白酒')).length;


const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>数据看板 - 公开税务案例库</title>
<script src="chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#059669;--primary-dark:#047857;--primary-deep:#065f46;--primary-light:#ecfdf5;--teal:#0d9488;--danger:#dc2626;--success:#059669;--warning:#ca8a04;--info:#0d9488;--text:#1e293b;--muted:#64748b;--border:#e2e8f0;--bg:#f3f8f5}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.header{position:relative;background:linear-gradient(135deg,#064e3b 0%,#059669 55%,#10b981 100%);color:#fff;padding:22px 24px;display:flex;flex-direction:row;align-items:center;min-height:100px}
.header-head{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
.header h1{font-size:24px;font-weight:700;letter-spacing:1px;margin-bottom:2px}
.header p{opacity:.92;margin-top:2px;font-size:14px;font-weight:400}
.header-btn{flex-shrink:0;margin-left:16px;align-self:center;display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:rgba(255,255,255,0.96);color:#047857;border:1px solid rgba(255,255,255,0.7);border-radius:26px;font-size:15px;font-weight:700;text-decoration:none;transition:all .25s cubic-bezier(.4,0,.2,1);box-shadow:0 6px 18px rgba(6,78,59,0.32),0 1px 2px rgba(6,78,59,0.18);letter-spacing:0.5px;backdrop-filter:blur(8px)}
.header-btn:hover{background:#fff;color:#065f46;transform:translateY(-2px);box-shadow:0 10px 26px rgba(6,78,59,0.42),0 2px 4px rgba(6,78,59,0.22)}
@media(max-width:900px){.header{flex-direction:column;align-items:flex-start;gap:10px;padding:16px;min-height:0}.header-btn{margin-left:0;align-self:flex-end;padding:7px 16px;font-size:13px;white-space:nowrap}.header-btn:hover{transform:translateY(-2px)}}
.container{max-width:1280px;margin:0 auto;padding:24px 24px 60px}
.section-title{font-size:22px;font-weight:700;margin:30px 0 14px;padding-left:12px;border-left:4px solid var(--primary);color:var(--primary-deep)}
.section-lead{background:var(--primary-light);border:1px solid #a7f3d0;border-left:4px solid var(--primary);border-radius:8px;padding:12px 16px;margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75}
.section-lead b{color:var(--primary-dark)}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}
.kpi{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.06);border-top:3px solid var(--primary)}
.kpi .num{font-size:32px;font-weight:800;color:var(--primary);line-height:1.2;font-variant-numeric:tabular-nums}
.kpi .label{font-size:14px;color:var(--muted);margin-top:4px}
.kpi.danger{border-top-color:var(--danger)}.kpi.danger .num{color:var(--danger)}
.kpi.warning{border-top-color:var(--warning)}.kpi.warning .num{color:var(--warning)}
.kpi.success{border-top-color:var(--success)}.kpi.success .num{color:var(--success)}
.kpi.teal{border-top-color:var(--teal)}.kpi.teal .num{color:var(--teal)}
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:900px){.grid-2,.grid-3{grid-template-columns:1fr}}
.card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.card h3{font-size:17px;font-weight:700;margin-bottom:14px;color:var(--text)}
.card canvas{max-height:280px}
.insight{background:#fff;border-radius:12px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.insight h3{font-size:18px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:var(--primary-deep)}
.insight ul{list-style:none;padding:0}
.insight li{padding:9px 0 9px 22px;position:relative;border-bottom:1px dashed var(--border);font-size:15.5px}
.insight li:last-child{border-bottom:none}
.insight li::before{content:"";position:absolute;left:4px;top:17px;width:6px;height:6px;border-radius:50%;background:var(--primary)}
.insight .sub{display:block;margin:6px 0 2px;padding-left:2px;line-height:1.7;color:#475569;font-size:15px}
.insight .sub b{color:var(--primary-dark);font-weight:700;font-style:normal}
.insight li:last-child .sub:last-child{margin-bottom:0}
.tag{display:inline-block;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-right:6px;white-space:nowrap}
.tag-red{background:#fee2e2;color:#b91c1c}.tag-green{background:#dcfce7;color:#15803d}
.tag-blue{background:#ccfbf1;color:#0f766e}.tag-orange{background:#ffedd5;color:#c2410c}
.tag-purple{background:#f3e8ff;color:#7e22ce}.tag-cyan{background:#cffafe;color:#0e7490}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{padding:10px 10px;text-align:left;border-bottom:1px solid var(--border)}
th{background:var(--primary-light);font-weight:700;color:var(--primary-deep);font-size:14px}
td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.baijiu-banner{background:linear-gradient(135deg,#064e3b 0%,#059669 50%,#0d9488 100%);color:#fff;border-radius:12px;padding:22px 26px;margin-bottom:16px}
.baijiu-banner h2{font-size:24px;margin-bottom:6px}
.baijiu-banner p{opacity:.94;font-size:15px;line-height:1.7;max-width:1050px}
.risk-box{border-left:4px solid var(--primary);background:var(--primary-light);padding:12px 16px;border-radius:0 8px 8px 0;margin:10px 0}
.risk-box.warn{border-left-color:var(--warning);background:#fefce8}
.risk-box.info{border-left-color:var(--teal);background:#f0fdfa}
.risk-box.purple{border-left-color:#7e22ce;background:#faf5ff}
.risk-box .t{font-weight:700;margin-bottom:4px;font-size:15.5px;color:var(--primary-deep)}
.risk-box.warn .t{color:#a16207}.risk-box.info .t{color:#0f766e}.risk-box.purple .t{color:#7e22ce}
.risk-box .d{font-size:14.5px;color:#475569;line-height:1.7}
.back{display:inline-block;margin-top:10px}
.foot{text-align:center;color:var(--muted);font-size:14px;padding:20px}
/* 关键结论高亮 */
.hl{color:var(--danger);font-weight:700}
.hl-g{color:var(--primary-dark);font-weight:700}
.hl-b{font-weight:700;color:#0f172a}
.callout{background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 100%);border:1px solid #a7f3d0;border-left:4px solid var(--primary);border-radius:8px;padding:16px 18px;margin:14px 0;line-height:1.8;color:#334155;font-size:15.5px}
.callout.red{background:linear-gradient(135deg,#fef2f2 0%,#fff7ed 100%);border-color:#fecaca;border-left-color:var(--danger)}
.callout .ct{font-weight:700;color:var(--primary-dark);font-size:16px;display:block;margin-bottom:6px}
.callout.red .ct{color:var(--danger)}
.callout .big{font-size:22px;font-weight:800;color:var(--primary-dark);font-variant-numeric:tabular-nums}
.callout.red .big{color:var(--danger)}
/* 精炼结论卡片 */
.concl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:6px 0}
.concl{background:var(--primary-light);border:1px solid #a7f3d0;border-radius:10px;padding:16px;min-height:100%}
.concl .ct{font-weight:700;color:var(--primary-dark);font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.concl .cd{font-size:14.5px;color:#374151;line-height:1.75}
@media(max-width:900px){.concl-grid{grid-template-columns:1fr}}
/* 白酒三图紧凑布局：与左侧四主线等高 */
.bj-charts{display:flex;flex-direction:column;gap:4px}
.bj-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center}
.bj-chart-col h3{font-size:14px;margin:0 0 2px;text-align:center;font-weight:700}
.bj-chart-col canvas{max-height:150px!important;height:150px!important}
.bj-chart-full{margin-top:6px}
.bj-chart-full h3{font-size:14px;margin:0 0 2px;text-align:center;font-weight:700}
.bj-chart-full canvas{max-height:120px!important;height:120px!important}
.bj-note{flex:1;margin-top:12px;background:var(--primary-light);border:1px solid #a7f3d0;border-left:4px solid var(--primary);border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;justify-content:center;gap:6px}
.bj-note .ni{font-size:13.5px;line-height:1.6;color:#374151;display:flex;gap:8px;align-items:flex-start}
.bj-note .ni b{color:var(--primary-dark)}
.bj-note .ni .dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--primary);margin-top:7px}
.concl .k{font-size:26px;font-weight:800;color:var(--primary);font-variant-numeric:tabular-nums;line-height:1.1;display:block;margin-bottom:2px}
/* 合规自检清单（紧凑） */
.check-list{list-style:none;padding:0;margin:4px 0}
.check-list li{position:relative;padding:8px 0 8px 26px;border-bottom:1px dashed var(--border);font-size:14.5px;color:#334155;line-height:1.6}
.check-list li:last-child{border-bottom:none}
.check-list li::before{content:"✔";position:absolute;left:2px;top:8px;color:var(--primary);font-weight:700}
.check-list b{color:var(--primary-deep)}
/* 榜单 */
.rank-list{list-style:none;padding:0;margin:0}
.rank-list li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed var(--border);font-size:15px}
.rank-list li:last-child{border-bottom:none}
.rank-list .rk{flex:none;width:24px;height:24px;border-radius:6px;background:var(--primary-light);color:var(--primary-dark);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px}
.rank-list .rk.top{background:var(--primary);color:#fff}
.rank-list .rn{flex:1;font-weight:600}
.rank-list .rv{font-weight:800;color:var(--primary-dark);font-variant-numeric:tabular-nums}
.rank-list .rs{color:var(--muted);font-size:13px;font-weight:400}
.advice-group{list-style:none;padding:12px 0 4px;margin:10px 0 0;border-top:2px solid #a7f3d0;font-weight:700;color:var(--primary-dark);font-size:15.5px}
.advice-group:first-child{border-top:none;padding-top:4px;margin-top:0}
.mini-note{font-size:13.5px;color:var(--muted);margin-top:10px;line-height:1.6}
</style>
</head>
<body>
<div class="header">
  <div class="header-head">
    <h1>📊 公开税务案例库 · 数据看板</h1>
    <p>基于 ${cases.length} 条收录案例的结构化分析 · 整体税务环境 + 多维交叉透视 + 白酒行业专项</p>
  </div>
  <a href="/" class="header-btn">← 返回案例库</a>
</div>
<div class="container">
  <div class="kpi-grid" id="kpiGrid"></div>

  <div class="section-title">一、整体税务环境概览</div>
  <div class="grid-2">
    <div class="card"><h3>案例类型分布</h3><canvas id="chartType"></canvas></div>
    <div class="card"><h3>信息披露/公告时间分布（按月）</h3><canvas id="chartMonth"></canvas></div>
  </div>
  <div class="grid-2" style="margin-top:16px">
    <div class="card"><h3>涉税行为发生年度分布（按案例追溯期间）</h3><canvas id="chartOccurYear"></canvas></div>
    <div class="card"><h3>追溯周期分布（披露年−最早行为年）</h3><canvas id="chartLag"></canvas></div>
  </div>
  <div class="grid-2" style="margin-top:16px">
    <div class="card"><h3>企业性质分布</h3><canvas id="chartEnt"></canvas></div>
    <div class="card"><h3>涉及税种 TOP8</h3><canvas id="chartTax"></canvas></div>
  </div>
  <div class="grid-2" style="margin-top:16px">
    <div class="card"><h3>补税/涉案金额区间分布</h3><canvas id="chartAmount"></canvas></div>
    <div class="card"><h3>税费金额构成（本金 / 滞纳金 / 罚款）</h3><canvas id="chartComposition"></canvas></div>
  </div>
  <div class="grid-2" style="margin-top:16px">
    <div class="card"><h3>行业分布 TOP10</h3><canvas id="chartIndustry" style="max-height:320px"></canvas></div>
    <div class="insight" id="costCallout"></div>
  </div>
  <div class="grid-2" style="margin-top:16px">
    <div class="card"><h3>地区分布 TOP10</h3><canvas id="chartRegion" style="max-height:300px"></canvas><div id="regionSummary" style="margin-top:14px;padding-top:12px;border-top:1px dashed #e2e8f0;color:#475569;font-size:15px;line-height:1.8"></div></div>
    <div class="insight">
      <h3>🔍 环境洞察</h3>
      <ul id="envInsights"></ul>
    </div>
  </div>
  <div class="insight" style="margin-top:16px">
    <h3>📝 整体环境核心结论</h3>
    <div id="envNarrative"></div>
  </div>

  <div class="section-title">二、风险定位 · 高频场景与重点行业地区</div>
  <div class="section-lead">本部分跳出单一维度，把 ${cases.length} 条案例按 <b>风险场景、行业×类型、地区税费、处置成本</b> 四个角度交叉透视：企业最常踩的是<b>关联交易/转让定价、子公司涉税、虚开与历史欠缴</b>；风险高度集中在<b>医药、白酒</b>等行业；少数大额案例集中在湖南、内蒙古等地区；<b>自查补缴几乎不产生罚款，而稽查/虚开除滞纳金外还要承担 0.5–5 倍罚款</b>。企业可据此对号入座，优先排查自身所属行业与高频场景。</div>
  <div class="grid-2">
    <div class="card"><h3>高频风险场景 TOP10</h3><canvas id="chartScenario" style="max-height:320px"></canvas>
      <div class="mini-note">按案例关键词自动归类（一笔案例可命中多个场景）。</div>
    </div>
    <div class="card"><h3>行业 × 案件类型（重点行业，堆叠）</h3><canvas id="chartIndType" style="max-height:340px"></canvas></div>
  </div>
  <div class="grid-2" style="margin-top:16px">
    <div class="card"><h3>各地区税费金额 TOP5（亿元）</h3><canvas id="chartRegionAmt" style="max-height:280px"></canvas></div>
    <div class="card"><h3>处置类型成本对比（本金 / 滞纳金 / 罚款，亿元）</h3><canvas id="chartTypeCost"></canvas>
      <div class="mini-note">仅汇总可解析人民币金额的案例；自查补缴以本金+滞纳金为主，稽查/虚开额外产生大额罚款。</div>
    </div>
  </div>

  <div class="section-title">三、白酒行业专项分析</div>
  <div class="baijiu-banner">
    <h2>🍶 白酒行业：${baijiuCount} 个案例 · "税务稽查 + 交易所问询"双线施压</h2>
    <p>白酒为消费税重点行业，2026 年税务与交易所问询集中爆发。覆盖茅台、泸州老窖、水井坊、金徽酒、华致酒行、金种子酒、枝江酒业、茅台镇酒厂等，从行业龙头到区域酒企、从上市到非上市酒厂。</p>
  </div>
  <div class="kpi-grid" id="baijiuKpi" style="margin-bottom:16px"></div>
  <div class="grid-2">
    <div class="insight">
      <h3>⚠️ 四大风险主线</h3>
      <div class="risk-box">
        <div class="t">① 消费税征收环节与计税价格</div>
        <div class="d">生产环节从价20%+从量0.5元/斤；设销售公司低价"出厂"转移利润是行业惯例，也是稽查重点。<span class="hl-g">金种子消费税及附加占营收18.8%被问询</span>，鹏程酒厂隐匿收入追缴消费税<span class="hl">1337.81万</span>。</div>
      </div>
      <div class="risk-box warn">
        <div class="t">② 关联交易定价（税务+交易所双关注）</div>
        <div class="d">华致酒行西藏空壳套15%税率被穿透补税<span class="hl">1.27亿</span>；金徽酒问询后不足一月补缴三税<span class="hl">8381.81万</span>；泸州老窖前五大经销商占比<span class="hl-g">72.47%</span>多为内部专营公司。</div>
      </div>
      <div class="risk-box info">
        <div class="t">③ 历史欠缴集中"翻旧账"</div>
        <div class="d">枝江补缴历史税款超<span class="hl">8500万</span>；华致滞纳金<span class="hl">4861.74万</span>（占本金62%）。金税四期交叉比对下，3–5年前安排被集中穿透，滞纳金<span class="hl-g">年化约18.25%</span>滚动。</div>
      </div>
      <div class="risk-box purple">
        <div class="t">④ 资金流与发票合规（私户/虚开）</div>
        <div class="d">鹏程酒厂经法定代表人亲属账户收款被定偷税；私户返利、促销费白条入账普遍。银行与发票数据已打通，<span class="hl">最高0.5–5倍罚款乃至刑责</span>。</div>
      </div>
    </div>
    <div class="card bj-charts">
      <div class="bj-chart-row">
        <div class="bj-chart-col"><h3>案例类型分布</h3><canvas id="chartBaijiuType"></canvas></div>
        <div class="bj-chart-col"><h3>税费金额构成</h3><canvas id="chartBaijiuComp"></canvas></div>
      </div>
      <div class="bj-chart-full">
        <h3>涉及税种（白酒${baijiuCount}例）</h3><canvas id="chartBaijiuTax"></canvas>
      </div>
      <div class="bj-note" id="bjNote"></div>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <h3>白酒行业案例明细</h3>
    <table id="baijiuTable"></table>
  </div>
  <div class="insight" style="margin-top:16px">
    <h3>🍶 一图看懂白酒专项</h3>
    <div class="concl-grid" id="baijiuConcl"></div>
  </div>
  <div class="insight" style="margin-top:16px">
    <h3>🎯 白酒/食品饮料企业合规自检清单</h3>
    <div class="grid-3" id="baijiuAdvice" style="gap:20px"></div>
  </div>

  <div class="foot">数据基于公开税务案例库收录案例自动统计生成，仅供研究参考，不构成税务意见。</div>
</div>

<script>
const cases = __CASES_PLACEHOLDER__;

// ===== DOM 引用 =====
const chartType=document.getElementById('chartType');
const chartMonth=document.getElementById('chartMonth');
const chartEnt=document.getElementById('chartEnt');
const chartTax=document.getElementById('chartTax');
const chartAmount=document.getElementById('chartAmount');
const chartComposition=document.getElementById('chartComposition');
const chartIndustry=document.getElementById('chartIndustry');
const chartRegion=document.getElementById('chartRegion');
const chartOccurYear=document.getElementById('chartOccurYear');
const chartLag=document.getElementById('chartLag');
const chartBaijiuType=document.getElementById('chartBaijiuType');
const chartBaijiuTax=document.getElementById('chartBaijiuTax');
const chartBaijiuComp=document.getElementById('chartBaijiuComp');
const chartScenario=document.getElementById('chartScenario');
const chartIndType=document.getElementById('chartIndType');
const chartRegionAmt=document.getElementById('chartRegionAmt');
const chartTypeCost=document.getElementById('chartTypeCost');

// ===== 工具函数 =====
// 从一段文本中提取「人民币金额」并统一换算为万元。
// 规则：
//  1) 若文本含括号内的人民币换算（如"2.3亿美元（约16.5亿）"），优先取括号内数值，避免外币与人民币重复累加；
//  2) 否则只认真正带中文金额单位（亿/万/元）的数字，且该单位不紧跟外币名（美元/港元/欧元/日元）；
//  3) 份数、百分比、文号、股票代码等不会被误当金额。无法解析返回 null。
function extractWan(text){
  if(text===null||text===undefined) return null;
  const s=String(text).replace(/,/g,'');
  // 优先：括号内的人民币换算（约XX亿/万元）
  const paren=s.match(/[（(][^（）()]*?([0-9]+(?:\\.[0-9]+)?)\\s*(亿元|亿|万元|万)[^（）()]*?[）)]/);
  if(paren){ const n=parseFloat(paren[1]); return paren[2].indexOf('亿')!==-1?n*10000:n; }
  // 外币且未给人民币换算 → 不计入人民币口径（先剥离数字单位判断是否为美元/港元等）
  if(/美元|港元|港币|欧元|日元|亿港元|万港元|亿港币|万港币|亿美元|万美元/.test(s)) return null;
  const m=s.match(/([0-9]+(?:\\.[0-9]+)?)\\s*(亿元|亿|万元|万|元)(?!港币|港元|美元|欧元|日元)/);
  if(!m) return null;
  let n=parseFloat(m[1]);
  if(isNaN(n)) return null;
  const unit=m[2];
  if(unit.indexOf('亿')!==-1) n*=10000;
  else if(unit.indexOf('万')!==-1) n*=1;
  else n/=10000; // 元
  return n;
}
// 非税费口径：资金占用、拍卖/成交金额、关联交易/采购/应收、分红/回购、营收/调减、
// 信用证、商誉、资产交易、工程交易等，均为业务金额而非税款/滞纳金/罚款
const NONTAX_RE=/资金占用|占用款|占用发生额|非经营性占用|拍卖|成交(额|价)?|以物抵债|未披露关联交易|内部购销|内部采购|购销金额|关联交易|关联采购|关联应收|关联工程|工程(设计|施工|总承包|建设|交易|项目|款)?|建设项目|分红|回购|营业总收入|营业收入|营业成本|利润总额|归母净利润|净利润|营收|虚增|调减|信用证|商誉|资产(收购|转让|交易|重组)?|交易额|交易类型|采购额|销售额(?!税负)|占营收比|占净资产|拆分收入|收入(?!.*补税)|虚开(发票)?(价税|金额|数量|份数|组|份|张)?|担保费|停止(办理)?出口退税|关税退税|收到退税款/;
// 税费细类关键词（注意顺序：先判定更具体的"罚款/滞纳金"，再判定本金）
const LATEFEE_RE=/滞纳金|加收利息/;
const FINE_RE=/罚款|罚没|罚金|没收(违法)?所得|行政处罚/;
const PRINCIPAL_RE=/补缴|补税|税款|税费|少缴|偷逃?(?!税)|欠缴税|追缴(?!.*滞纳金)|未缴|应纳税|企业所得税|所得税款|增值税|消费税|印花税|房产税|环保税|资源税|关税|附加税?|城建税|追征|征收消费税|征收增值税|出口退税追回|骗(取)?出口退税|骗取退税款|出口退税款|挽回税款|缴回税款|追加税项/;
// 合计/总计类明细（其金额已由分项明细体现，避免重复累加）。含"欠缴税款合计/税费合计"等也视为汇总项。
const SUMMARY_RE=/^[\\s"']*(合计|总计|小计|累计|总金额|金额合计|税费合计|补缴合计|欠缴税款合计|税款合计|三起合计|价税合计)/;
// 明细金额为"未披露/未单独披露/—/-/待核实/无"等占位时视为无可用金额
const PLACEHOLDER_AMT_RE=/^(未披露|未单独披露|待核实|暂无|无|—|--|-|)$/;
// 判断一个明细项名称是否为「非税费业务项」
function isNonTaxName(name){ if(!name) return false; return NONTAX_RE.test(name); }
// 判断明细金额字段是否携带可用的人民币金额。
function itemWan(amt){
  if(amt===null||amt===undefined||amt==='') return null;
  if(typeof amt==='number') return isFinite(amt)?amt:null;
  const s=String(amt).replace(/,/g,'').trim();
  if(PLACEHOLDER_AMT_RE.test(s)) return null;
  // 含非金额标记（份、%、年、号、日、家、个、起、倍、户、名、条）且不带中文金额单位 → 非金额
  if(/[份%]|^[0-9]{4}年|[0-9]+号|[0-9]+日|[0-9]+家|[0-9]+个|[0-9]+起|[0-9]+倍|[0-9]+户|[0-9]+名|[0-9]+条/.test(s) && !/[亿万元]/.test(s)) return null;
  return extractWan(s);
}
// 把明细归入某一类。返回 'principal' | 'latefee' | 'fine' | 'mixed' | 'summary' | null(非税费)
function classifyItem(name){
  if(!name) return 'mixed';
  if(SUMMARY_RE.test(name)) return 'summary';          // 合计项跳过，金额由分项体现
  if(isNonTaxName(name)) return null;                  // 业务金额项跳过
  const isLate=LATEFEE_RE.test(name);
  const isFine=FINE_RE.test(name);
  // 明确本金/税种关键词才归本金；仅含"税"字但语义偏义务/负债/调整等，归 mixed
  const isPri=PRINCIPAL_RE.test(name);
  if(isFine && !isPri && !isLate) return 'fine';
  if(isLate && !isPri && !isFine) return 'latefee';
  if(isPri && !isLate && !isFine) return 'principal';
  // 名称含明显税费/处罚字样但未细分 → 混合项；否则（如"关联方""交易类型"等业务描述）视为非税费项
  if(/税|补|罚|滞纳|追缴|偷|少缴|没收|缴回|征收/.test(name)) return 'mixed';
  return null;
}
/**
 * 解析单个案例的税费金额构成
 * 返回 { total, principal, latefee, fine, hasMixed, hasUnparsed, hasTaxText, hasAmount }
 */
function parseCaseMoney(c){
  let total=0, principal=0, latefee=0, fine=0;
  let hasMixed=false, hasItemAmount=false, hasTaxItem=false;
  // 整条案例以美元/港元等外币计价、且未给出人民币换算括号 → 不计入人民币口径
  const headStr=String(c.totalAmount||'')+' '+String(c.amountDisplay||'');
  const isForeign=/美元|港元|港币|欧元|日元/.test(headStr) && !/[（(][^（）()]*[0-9][^（）()]*[亿万][^（）()]*[）)]/.test(headStr);
  if(isForeign){
    const blob=String(c.amountDesc||'')+' '+headStr;
    const hasTaxText=/补税|补缴|追缴|偷|漏|虚开|罚款|滞纳金|税款|税费|少缴|没收(违法)?所得|罚没|欠税/.test(blob) || c.type==='自查补缴';
    return { total:0, principal:0, latefee:0, fine:0, hasMixed:false, hasUnparsed:hasTaxText, hasTaxText, hasAmount:false, foreign:true };
  }
  const items=c.taxBreakdown||[];
  items.forEach(t=>{
    // 兼容明细字段 name / item 两种命名
    const rawName=t.name!==undefined?t.name:t.item;
    const cls=classifyItem(String(rawName==null?'':rawName));
    if(cls===null || cls==='summary') return;   // 非税费业务项/合计项不计入
    hasTaxItem=true;                            // 存在税费类明细项（即使金额占位，也可回退总额）
    const amt=itemWan(t.amount);
    if(amt===null || amt<=0) return;
    hasItemAmount=true;
    if(cls==='fine'){ fine+=amt; total+=amt; }
    else if(cls==='latefee'){ latefee+=amt; total+=amt; }
    else if(cls==='principal'){ principal+=amt; total+=amt; }
    else { hasMixed=true; total+=amt; }
  });
  // 仅当"存在税费类明细但未解析到金额"，或"根本没有明细"时，回退到 totalAmount/amountDisplay 文本。
  // 若明细全部是业务金额项（如关联交易/占用），则不回退，避免把业务总额误当税费。
  if(!hasItemAmount && (hasTaxItem || items.length===0)){
    [c.totalAmount, c.amountDisplay, c.amountDesc].forEach(raw=>{
      if(raw===null||raw===undefined) return;
      if(typeof raw!=='string'){ const n=itemWan(raw); if(n!==null&&n>0){ hasItemAmount=true; total+=n; hasMixed=true; } return; }
      // 整个字段为外币口径且无人民币换算括号 → 跳过该字段
      if(/美元|港元|港币|欧元|日元/.test(raw) && !/[（(][^（）()]*[0-9][^（）()]*[亿万][^（）()]*[）)]/.test(raw)) return;
      // 先去除千分位逗号，再按顿号/全角逗号/分号/加号切分（半角逗号是千分位，不能作分隔符）
      raw.replace(/,/g,'').split(/\\s*[、，；;+]\\s*|\\s{2,}/).forEach(seg0=>{
        const seg=String(seg0);
        if(!seg) return;
        if(isNonTaxName(seg) && !/补|税|罚|滞纳|追缴|偷|少缴|没收/.test(seg)) return;
        // 外币片段（且无人民币换算括号）跳过，不计入人民币口径
        if(/美元|港元|港币|欧元|日元/.test(seg) && !/[（(][^（）()]*[0-9][^（）()]*[亿万][^（）()]*[）)]/.test(seg)) return;
        const w=extractWan(seg);
        if(w===null||w<=0) return;
        // 存在税费明细时（如分项金额写"未披露"但总额有数），可直接采用总额；否则要求片段含税费词
        if(hasTaxItem || ((/补|税|罚|滞纳金|追缴|偷|少缴|没收/.test(seg)) && !isNonTaxName(seg))){
          hasItemAmount=true; total+=w; hasMixed=true;
        }
      });
    });
  }
  const blob=String(c.amountDesc||'')+' '+String(c.amountDisplay||'')+' '+String(c.totalAmount||'')+' '+(c.taxBreakdown||[]).map(t=>t.name+' '+t.amount).join(' ');
  const hasTaxText=/补税|补缴|追缴|偷|漏|虚开|罚款|滞纳金|税款|税费|少缴|没收(违法)?所得|罚没|欠税/.test(blob) || c.type==='自查补缴';
  if(/非补税|不涉及补[缴税]|不是补税/.test(blob)){ total=principal=latefee=fine=0; hasItemAmount=false; }
  return { total, principal, latefee, fine, hasMixed, hasUnparsed: hasTaxText && !hasItemAmount, hasTaxText, hasAmount: hasItemAmount && total>0 };
}
// 兼容旧调用：返回该案例可统计的税费金额合计（万元）
function parseAmount(c){ return parseCaseMoney(c).total; }
// 该案例是否计入"可统计税费金额"：能解析出人民币税费金额，且非明确"非补税"
function isCountable(c){ const m=parseCaseMoney(c); return m.hasAmount && m.total>0; }
// 兼容旧调用
function isTaxAmount(c){ return isCountable(c); }
const GREENS=['#047857','#059669','#10b981','#34d399','#0d9488','#14b8a6','#65a30d','#84cc16','#0f766e','#6b7280'];
const COLORS=GREENS;
// 地区名称归一：补全省/市/自治区后缀，合并同一行政区；境外/全国/未知返回 null（不计入国内地区统计）
const REGION_FULL={
  '北京':'北京市','天津':'天津市','上海':'上海市','重庆':'重庆市',
  '内蒙古':'内蒙古自治区','广西':'广西壮族自治区','西藏':'西藏自治区','宁夏':'宁夏回族自治区','新疆':'新疆维吾尔自治区',
  '青海':'青海省','甘肃':'甘肃省','四川':'四川省','云南':'云南省','贵州':'贵州省','陕西':'陕西省','山西':'山西省',
  '河北':'河北省','河南':'河南省','湖北':'湖北省','湖南':'湖南省','广东':'广东省','广西省':'广西壮族自治区',
  '山东':'山东省','江苏':'江苏省','浙江':'浙江省','安徽':'安徽省','福建':'福建省','江西':'江西省','海南':'海南省',
  '辽宁':'辽宁省','吉林':'吉林省','黑龙江':'黑龙江省','台湾':'台湾省','香港':'香港特别行政区','澳门':'澳门特别行政区'
};
function normRegion(r){
  if(!r)return null;
  let s=String(r).trim();
  if(/^(美国|海外|境外|全国|-|—|)$/.test(s))return null;
  if(REGION_FULL[s])return REGION_FULL[s];
  if(/(省|市|自治区|特别行政区)$/.test(s))return s;
  return s;
}
Chart.defaults.font.family='-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
Chart.defaults.font.size=13;

// ===== KPI =====
const total=cases.length;
// 逐案例解析金额构成（本金/滞纳金/罚款/混合项），只汇总可识别的人民币金额
const moneyList=cases.map(c=>parseCaseMoney(c));
const countableCases=cases.filter((c,i)=>moneyList[i].hasAmount);
const uncountable=total-countableCases.length;
let sumPrincipal=0, sumLatefee=0, sumFine=0, sumTotal=0, mixedCount=0;
moneyList.forEach(m=>{ if(!m.hasAmount)return; sumTotal+=m.total; sumPrincipal+=m.principal; sumLatefee+=m.latefee; sumFine+=m.fine; if(m.hasMixed)mixedCount++; });
// 混合未拆分项计入总额，但无法归入本金/滞纳/罚款；故 本金+滞纳+罚款 <= 总额
// 混合未拆分项（mixed）本质为未单列滞纳/罚款的税费合计，归入"本金"口径；
// 故 可统计税费本金 = 总额 − 滞纳金 − 罚款（本金已含未拆分的税费合计）
const sumMixed=sumTotal-sumPrincipal-sumLatefee-sumFine;
const sumTaxPrincipal=sumTotal-sumLatefee-sumFine;   // 可统计税费本金（含未拆分税费合计）
const yi=v=>(v/10000>=1?(v/10000).toFixed(1)+'亿':Math.round(v)+'万');
// 可统计税费本金：存在未披露/非税费案例时末尾带 +，表示为下限约数
const principalDisplay=yi(sumTaxPrincipal)+(uncountable>0?'+':'');
const countableNote=uncountable>0?('（'+countableCases.length+'例可统计，余'+uncountable+'例未披露/非税费）'):'';
// 滞纳金、罚款占可统计税费本金的百分比（用于 KPI 小字体）
const latefeePct=(sumLatefee/sumTaxPrincipal*100);
const finePct=(sumFine/sumTaxPrincipal*100);
const latefeeNote='占本金 '+(latefeePct>=10?latefeePct.toFixed(0):latefeePct.toFixed(1))+'%（年化约18.25%）';
const fineNote='占本金 '+(finePct>=10?finePct.toFixed(0):finePct.toFixed(1))+'%';
const selfCheck=cases.filter(c=>c.type==='自查补缴').length;
const penalized=cases.filter(c=>['稽查处罚','失信虚开'].includes(c.type)).length;
const listed=cases.filter(c=>c.code&&c.code!=='-'&&c.code!=='非上市'&&c.code!=='—').length;
const year2026=cases.filter(c=>c.date&&c.date.startsWith('2026')).length;
// 板块归属（与案例库 boardOf 一致）
function boardOf(code){
  const s=String(code||'');
  if(/HK/i.test(s))return '港股';
  if(/US/i.test(s)||/^[A-Z]{2,}$/.test(s))return '美股';
  if(s==='非上市'||!s||s==='-'||s==='—')return '非上市';
  const six=(s.match(/\\d{6}/)||[])[0];
  if(!six)return '非上市';
  if(/^(688|689)/.test(six))return '科创板';
  if(/^(300|301)/.test(six))return '创业板';
  if(/^(43|83|87|88|92|93|4|8)/.test(six))return '北交所';
  return '主板';
}
// 【锁定规则】顶部 KPI 固定 4 张卡片（顺序/文案/口径/配色见 AGENTS.md「KPI 顶部卡片锁定规则」）：
// 案例总数 → 可统计税费本金 → 滞纳金 → 罚款/罚没。仅允许数值随 cases 自动更新；增删卡片或改口径必须经用户明确要求。
document.getElementById('kpiGrid').innerHTML=[
  {n:total,l:'收录案例总数',c:''},
  {n:principalDisplay,l:'可统计税费本金'+countableNote,c:'teal'},
  {n:yi(sumLatefee),l:'滞纳金 · '+latefeeNote,c:'warning'},
  {n:yi(sumFine),l:'罚款 / 罚没 · '+fineNote+'<br><span style="font-size:12px;opacity:.72">含行政罚款 · 刑事罚金 · 没收违法所得</span>',c:'danger'}
].map(k=>'<div class="kpi '+k.c+'"><div class="num">'+k.n+'</div><div class="label">'+k.l+'</div></div>').join('');

// ===== 类型分布 =====
function groupCount(arr,keyFn){const m={};arr.forEach(x=>{const k=keyFn(x);if(k)m[k]=(m[k]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);}
// 类型固定顺序：自查补缴→稽查处罚→行政处罚→失信虚开→行业参考（与案例库 typeConfig 一致）
const TYPE_ORDER=['自查补缴','稽查处罚','行政处罚','失信虚开','行业参考'];
const TYPE_COLORS={'自查补缴':'#16a34a','稽查处罚':'#ea580c','行政处罚':'#dc2626','失信虚开':'#7e22ce','行业参考':'#0d9488'};
const typeStats=TYPE_ORDER.map(t=>[t,cases.filter(c=>c.type===t).length]).filter(x=>x[1]>0);
new Chart(chartType,{type:'doughnut',data:{labels:typeStats.map(x=>x[0]),datasets:[{data:typeStats.map(x=>x[1]),backgroundColor:typeStats.map(x=>TYPE_COLORS[x[0]])}]},options:{plugins:{legend:{position:'right'},tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+'例 ('+(c.parsed/total*100).toFixed(1)+'%)'}}}}});

// ===== 信息披露/公告时间（按年月，覆盖全部年份） =====
const ymCount={};
cases.forEach(c=>{ if(c.date&&/^20[0-9]{2}-[0-9]{2}/.test(c.date)){ const k=c.date.slice(0,7); ymCount[k]=(ymCount[k]||0)+1; } });
const ymSorted=Object.keys(ymCount).sort();
new Chart(chartMonth,{type:'bar',data:{labels:ymSorted,datasets:[{label:'案例数',data:ymSorted.map(k=>ymCount[k]),backgroundColor:'#10b981',borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});

// ===== 企业性质 =====
const entMap={'-':'其他','个人':'其他'};
new Chart(chartEnt,{type:'bar',data:{labels:groupCount(cases,c=>entMap[c.enterprise]||c.enterprise).map(x=>x[0]),datasets:[{data:groupCount(cases,c=>entMap[c.enterprise]||c.enterprise).map(x=>x[1]),backgroundColor:['#059669','#0d9488','#65a30d','#0f766e','#94a3b8'],borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});

// ===== 税种 TOP8 =====
const taxCount={};cases.forEach(c=>(c.taxTags||[]).forEach(t=>{
  // 归并非税种标签
  if(/审计|造假|披露|资金占用|二手房|滞纳金/.test(t))return;
  taxCount[t]=(taxCount[t]||0)+1;
}));
const taxTop=Object.entries(taxCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
new Chart(chartTax,{type:'bar',data:{labels:taxTop.map(x=>x[0]),datasets:[{data:taxTop.map(x=>x[1]),backgroundColor:'#0d9488',borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});

// ===== 金额区间（仅统计可解析的税费类金额） =====
const ranges={'<100万':0,'100-500万':0,'500-1000万':0,'1000-5000万':0,'5000万-1亿':0,'1-10亿':0,'>10亿':0};
countableCases.forEach(c=>{const n=parseAmount(c);if(n<=0)return;if(n<100)ranges['<100万']++;else if(n<500)ranges['100-500万']++;else if(n<1000)ranges['500-1000万']++;else if(n<5000)ranges['1000-5000万']++;else if(n<10000)ranges['5000万-1亿']++;else if(n<100000)ranges['1-10亿']++;else ranges['>10亿']++;});
new Chart(chartAmount,{type:'bar',data:{labels:Object.keys(ranges),datasets:[{data:Object.values(ranges),backgroundColor:['#34d399','#10b981','#0d9488','#f59e0b','#f97316','#ef4444','#b91c1c'],borderRadius:4}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:()=>uncountable>0?'另有'+uncountable+'例未披露具体/非税费金额':''}}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{ticks:{maxRotation:45,minRotation:45,font:{size:10}}}}}});

// ===== 税费金额构成（本金 / 滞纳金 / 罚款），单位亿元 =====
// 口径与顶部 KPI「可统计税费本金」一致：本金 = 总额 − 滞纳金 − 罚款（未拆分税费合计归入本金）
const compData=[
  {label:'补缴税款本金',val:+(sumTaxPrincipal/10000).toFixed(2),color:'#059669'},
  {label:'滞纳金',val:+(sumLatefee/10000).toFixed(2),color:'#ca8a04'},
  {label:'罚款/罚没',val:+(sumFine/10000).toFixed(2),color:'#dc2626'}
];
new Chart(chartComposition,{type:'doughnut',data:{labels:compData.map(x=>x.label),datasets:[{data:compData.map(x=>x.val),backgroundColor:compData.map(x=>x.color)}]},options:{plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+'亿元 ('+(c.parsed/(sumTotal/10000)*100).toFixed(1)+'%)'}}}}});

// ===== 行业分布 TOP10（横向条形，行业作为纵轴） =====
const indAll=groupCount(cases,c=>c.industry).slice(0,10);
new Chart(chartIndustry,{type:'bar',data:{labels:indAll.map(x=>x[0]),datasets:[{data:indAll.map(x=>x[1]),backgroundColor:indAll.map((_,i)=>i===0?'#047857':'#34d399'),borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>'占总数 '+(c.parsed/total*100).toFixed(1)+'%'}}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});

// ===== 处罚成本对比 callout：主动补缴 vs 被动稽查的代价差 =====
// 计算罚款+滞纳金占本金比例（本金口径同 KPI；未拆分税费已归入本金）
const burdenPct=sumTaxPrincipal>0?((sumLatefee+sumFine)/sumTaxPrincipal*100):0;
const fineVsLatePct=sumTaxPrincipal>0?(sumFine/sumTaxPrincipal*100):0;
document.getElementById('costCallout').innerHTML=
 '<h3>💰 主动补 vs 被动罚：成本差在哪里</h3>'+
 '<div class="callout red"><span class="ct">核心结论</span>'+
 '主动<span class="hl-g">自查补缴</span>通常只需承担税款本金 + 滞纳金（<span class="hl">按日万分之五、年化约18.25%</span>），<span class="hl-g">不触发行政罚款</span>；一旦被稽查定性为偷税或虚开，还将额外面临 <span class="big">0.5–5倍</span> 罚款，情节严重的移送司法。'+
 '</div>'+
 '<p style="margin:10px 0;line-height:1.8;color:#334155;font-size:15.5px">从本批可统计案例看：补缴税款本金约 <span class="hl-g">'+yi(sumTaxPrincipal)+(uncountable>0?'+':'')+'</span>，滞纳金约 <span class="hl-g">'+yi(sumLatefee)+'</span>、罚款/罚没约 <span class="hl-g">'+yi(sumFine)+'</span>；'+
 (burdenPct>0?'滞纳金+罚款合计约相当于本金的 <span class="hl">'+burdenPct.toFixed(0)+'%</span>，越晚暴露、越被定性为偷税，附加成本越高。':'')+'</p>'+
 '<p style="margin:10px 0;line-height:1.8;color:#334155;font-size:15.5px">典型对照：华致酒行滞纳金占补税本金约 <span class="hl">62%</span>；偷税/虚开类案件除补税滞纳金外，普遍并处 <span class="hl">0.5–3倍</span> 罚款，部分伴随市场准入与刑事追责。<span class="hl-g">"主动补、尽早补"是成本最低的选择。</span></p>';

// ===== 地区 TOP10 =====
const regionTop=groupCount(cases,c=>normRegion(c.region)).slice(0,10);
new Chart(chartRegion,{type:'bar',data:{labels:regionTop.map(x=>x[0]),datasets:[{data:regionTop.map(x=>x[1]),backgroundColor:'#0d9488',borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});
// 地区分布文字总结：TOP省份、集中度、与经济活跃度/行业的关联
const top3Sum=regionTop.slice(0,3).reduce((s,x)=>s+x[1],0);
const top5Sum=regionTop.slice(0,5).reduce((s,x)=>s+x[1],0);
const top10Sum=regionTop.reduce((s,x)=>s+x[1],0);
// 各地区可统计税费金额（万元），找出金额最高的地区
const regionAmt={};
cases.forEach(c=>{ const r=normRegion(c.region); if(!r)return; const m=parseCaseMoney(c); if(m.hasAmount) regionAmt[r]=(regionAmt[r]||0)+m.total; });
const regionAmtTop=Object.entries(regionAmt).sort((a,b)=>b[1]-a[1]).slice(0,3);
document.getElementById('regionSummary').innerHTML=
 '<strong style="color:#0d9488">区域高度集中：</strong>'+regionTop[0][0]+'以<span class="hl-b">'+regionTop[0][1]+'例</span>居首，'+
 regionTop.slice(1,3).map(x=>x[0]+x[1]+'例').join('、')+'紧随其后，前三省（市）合计'+top3Sum+'例，占总数<span class="hl">'+(top3Sum/total*100).toFixed(0)+'%</span>；'+
 'TOP5合计'+top5Sum+'例（'+(top5Sum/total*100).toFixed(0)+'%），TOP10合计'+top10Sum+'例（'+(top10Sum/total*100).toFixed(0)+'%）。'+
 '<br><strong style="color:#0d9488">区域特征：</strong>广东、浙江、江苏、上海、山东等东南沿海经济活跃省份上市公司密集、税源基数大，案例数量自然居前；'+
 '四川、贵州则因<span class="hl-b">白酒等消费税重点行业</span>排名靠前，呈现明显的行业聚集效应。建议按"区域+行业"双维度配置税务合规资源。'+
 '<br><strong style="color:#0d9488">金额分布：</strong>按可统计税费金额看，'+regionAmtTop.map(x=>x[0]+'约'+(x[1]/10000).toFixed(1)+'亿元').join('、')+'位居前列，与案例数量排名<span class="hl-b">并不完全一致</span>——部分地区案例不多但单案金额巨大，提示大额补税风险并不只集中在案例高频省份，跨区域经营的集团企业应对成员公司所在地税务口径同等关注。'+
 '<br><strong style="color:#0d9488">合规启示：</strong>经济活跃地区税务机关<span class="hl-b">数字化征管能力强、发票与资金流比对频次高</span>，企业应优先保障这些区域主体的申报质量；同时对中西部、低税率地区的成员企业加强实质性运营核查，避免因<span class="hl">"空壳注册地"成为被穿透对象</span>。';

// ===== 涉税行为发生年度 & 追溯周期 =====
// 从 taxBreakdown.note / keyPoints / referenceValue / amountDesc 中抽取年份，取最早年份作为"行为发生年"
function extractYears(c){
  const blob=[c.amountDesc,...(c.taxBreakdown||[]).map(t=>t.note+' '+(t.name||'')),...(c.keyPoints||[]),c.referenceValue,c.amountDisplay].filter(Boolean).join(' ');
  const years=[];
  const re=/20[0-9]{2}/g; let mm;
  while((mm=re.exec(blob))!==null){ const y=+mm[0]; if(y>=2000&&y<=2030) years.push(y); }
  return years;
}
function occurYear(c){
  const ys=extractYears(c);
  if(!ys.length) return null;
  return Math.min(...ys);
}
const occurCount={}; let occurKnown=0;
cases.forEach(c=>{ const y=occurYear(c); if(y){occurCount[y]=(occurCount[y]||0)+1; occurKnown++;} });
const occurSorted=Object.keys(occurCount).sort();
new Chart(chartOccurYear,{type:'bar',data:{labels:occurSorted.map(y=>y+'年'),datasets:[{label:'案例数',data:occurSorted.map(y=>occurCount[y]),backgroundColor:'#0d9488',borderRadius:4}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:()=>'共识别'+occurKnown+'例，其余'+(total-occurKnown)+'例未在文本中明确行为年度'}}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});

// 追溯周期 = 披露年 - 最早行为年
const lagBuckets={'当年':0,'1-2年':0,'3-4年':0,'5-7年':0,'8年以上':0};
let lagKnown=0;
cases.forEach(c=>{
  const y=occurYear(c); if(!y||!c.date) return;
  const dy=parseInt(c.date.slice(0,4)); const lag=dy-y;
  lagKnown++;
  if(lag<=0)lagBuckets['当年']++;
  else if(lag<=2)lagBuckets['1-2年']++;
  else if(lag<=4)lagBuckets['3-4年']++;
  else if(lag<=7)lagBuckets['5-7年']++;
  else lagBuckets['8年以上']++;
});
new Chart(chartLag,{type:'bar',data:{labels:Object.keys(lagBuckets),datasets:[{label:'案例数',data:Object.values(lagBuckets),backgroundColor:['#34d399','#0d9488','#f59e0b','#f97316','#dc2626'],borderRadius:4}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:()=>'基于'+lagKnown+'例可识别追溯周期的案例'}}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});

// ===== 环境洞察 =====
// 动态统计披露高峰、税种、金额分布，避免硬编码与实际数据不符
const ymPeaks=ymSorted.map(k=>({k,c:ymCount[k]})).sort((a,b)=>b.c-a.c).slice(0,2);
const eit=taxCount['企业所得税']||0;
const vat=taxCount['增值税']||0;
const countedAmts=countableCases.map(parseAmount).sort((a,b)=>a-b);
const medianAmt=countedAmts.length?countedAmts[Math.floor(countedAmts.length/2)]:0;
const maxAmt=countedAmts.length?countedAmts[countedAmts.length-1]:0;
const yiCases=Object.values(ranges).slice(5).reduce((a,b)=>a+b,0);
const midCases=ranges['1000-5000万'];
const ymPeakStr=ymPeaks.map(p=>p.k+'（'+p.c+'例）').join('、');
const topOccur=Object.entries(occurCount).sort((a,b)=>b[1]-a[1])[0];
const longLag=lagBuckets['3-4年']+lagBuckets['5-7年']+lagBuckets['8年以上'];
document.getElementById('envInsights').innerHTML=[
  '<strong>自查补缴成为绝对主流：</strong>'+selfCheck+'例（占<span class="hl">'+(selfCheck/total*100).toFixed(0)+'%</span>）为企业主动自查补缴，普遍<span class="hl-b">不触发行政处罚</span>，仅补缴税款+滞纳金，体现"主动补、不处罚"的监管导向。',
  '<strong>披露时间集中在：</strong>'+ymPeakStr+'，多集中在<span class="hl-b">中报/年报披露窗口</span>，税务问题随定期报告集中曝光。',
  '<strong>涉税行为多发生在：</strong>'+(topOccur?topOccur[0]+'年（'+topOccur[1]+'例提及）':'早期年度')+'，与披露年存在明显时间差——<span class="hl">"翻旧账"是常态</span>。',
  '<strong>追溯周期普遍较长：</strong>'+lagKnown+'例可识别追溯周期中，3年以上的'+longLag+'例（占<span class="hl">'+(longLag/lagKnown*100).toFixed(0)+'%</span>），金税四期大数据下历史问题被穿透。',
  '<strong>民营企业是主力：</strong>民营主体'+(cases.filter(c=>(entMap[c.enterprise]||c.enterprise)==='民营').length)+'例，占'+(cases.filter(c=>(entMap[c.enterprise]||c.enterprise)==='民营').length/total*100).toFixed(0)+'%，但<span class="hl-b">国企/央企的大额补税金额</span>同样值得关注。',
  '<strong>企业所得税、增值税是两大核心税种：</strong>企业所得税涉及<span class="hl">'+eit+'例</span>、增值税<span class="hl">'+vat+'例</span>，合计占绝大多数；消费税集中在白酒等特定行业。',
  '<strong>金额两极分化：</strong>'+(uncountable>0?'可统计案例中，':'')+'中位案例约'+Math.round(medianAmt)+'万元，最高达<span class="hl">'+(maxAmt>=10000?(maxAmt/10000).toFixed(1)+'亿元':Math.round(maxAmt)+'万元')+'</span>；千万至5000万区间'+midCases+'例，亿级案例'+yiCases+'例，头部效应明显。'+(uncountable>0?'（另有'+uncountable+'例未披露具体金额，实际规模更大）':''),
  '<strong>子公司/孙公司是风险高发点：</strong>大量案例由下属子公司涉税问题引发集团合并补税，<span class="hl-b">集团税务统管与穿透监控</span>成为刚需。'
].map(t=>'<li>'+t+'</li>').join('');

// ===== 整体图文分析（多段落） =====
const indTop=groupCount(cases,c=>c.industry).slice(0,5);
const topRegion=regionTop[0];
const selfCheckPct=(selfCheck/total*100).toFixed(0);
const regTop3=regionTop.slice(0,3).map(x=>x[0].replace(/省|市|维吾尔自治区|壮族自治区|回族自治区/g,'')+x[1]+'例').join('、');
document.getElementById('envNarrative').innerHTML=
 '<div class="callout"><span class="ct">六句话看懂整体税务环境</span>'+
 '<b>① 监管基调：</b>自查补缴 <b>'+selfCheck+'</b> 例占 <span class="hl">'+selfCheckPct+'%</span>，监管"以查促补、主动免罚"，但虚开/长期偷税/拒改仍处 <span class="hl">0.5–5倍</span> 罚款并伴市场准入限制。<br>'+
 '<b>② 时间错配：</b>披露高峰在 '+ymPeakStr+'，可追溯 '+lagKnown+' 例中 3 年以上 '+longLag+' 例——历史问题不会随时间消弭，滞纳金年化约 <b>18.25%</b>。<br>'+
 '<b>③ 税种与行业：</b>企业所得税 <b>'+eit+'</b> 例、增值税 <b>'+vat+'</b> 例为两条主线，消费税集中于白酒；行业以 '+indTop.map(x=>x[0]+x[1]).join('、')+' 最密集。<br>'+
 '<b>④ 主体与区域：</b>民营约占 '+(cases.filter(c=>(entMap[c.enterprise]||c.enterprise)==='民营').length/total*100).toFixed(0)+'% 是数量主力，但<span class="hl-g">国企/央企单案金额更大</span>；区域集中在 '+regTop3+'。<br>'+
 '<b>⑤ 金额特征：</b>'+countableCases.length+' 例可统计合计约 <b>'+(sumTotal/10000).toFixed(1)+'亿元</b>'+(uncountable>0?'+（另有'+uncountable+'例未披露/外币）':'')+'，中位约 '+Math.round(medianAmt)+'万、亿级 '+yiCases+' 例，呈"长尾+头部"。<br>'+
 '<b>⑥ 组织风险：</b>子/孙公司、并购标的、历史注销主体是高发区，经销商、空壳贸易、无实质经营的低税率主体为重点穿透对象。'+
 '</div>';

// ===== 多维交叉透视 =====
// --- 高频风险场景（按关键词归类，一案可命中多场景）---
const SCENARIOS=[
  ['关联交易/转让定价',/关联交易|转让定价|特别纳税|关联方|关联销售|关联采购|经销商|定价公允|内部购销/],
  ['虚开发票/发票违规',/虚开|发票|进项|抵扣|白条|收购发票/],
  ['私户收款/隐匿收入',/私户|个人账户|亲属账户|隐匿收入|账外|未申报收入|隐瞒/],
  ['收入确认/成本费用',/收入确认|跨期|成本费用|费用列支|总额法|净额法|虚增|调减|研发费用加计/],
  ['税收洼地/空壳架构',/洼地|空壳|税收优惠|低税率|西藏|财政返还|霍尔果斯|无实质经营/],
  ['骗取出口退税',/出口退税|骗税|骗取/],
  ['子公司/并购标的涉税',/子公司|孙公司|分公司|并购|标的|下属公司/],
  ['历史欠缴/滞纳金',/滞纳金|历史|翻旧账|加收利息|以前年度|欠缴/],
  ['信披违规/财务造假',/信息披露|信披|财务造假|资金占用|未勤勉尽责|审计/],
  ['消费税(白酒等)',/消费税|白酒|从价|从量/],
  ['个人所得税/股权转让',/个人所得税|股权转让|股息|分红.*税|限售股/],
  ['涉税中介违规',/中介|税务师|代理记账|会计.*违规|一案双查/]
];
const scenHits=SCENARIOS.map(([name,re])=>[name,cases.filter(c=>{
  const blob=[c.company,c.amountDesc,c.referenceValue,...(c.keyPoints||[]),(c.taxTags||[]).join(','),c.natureTag,c.industry].filter(Boolean).join(' ');
  return re.test(blob);
}).length]).sort((a,b)=>b[1]-a[1]).slice(0,10);
new Chart(chartScenario,{type:'bar',data:{labels:scenHits.map(x=>x[0]),datasets:[{data:scenHits.map(x=>x[1]),backgroundColor:scenHits.map((_,i)=>i<3?'#047857':'#34d399'),borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});

// --- 行业 × 案件类型（取案例数 TOP8 行业，按类型堆叠）---
const indTop8=groupCount(cases,c=>c.industry).slice(0,8).map(x=>x[0]);
new Chart(chartIndType,{type:'bar',data:{labels:indTop8,datasets:TYPE_ORDER.map(t=>({
  label:t,data:indTop8.map(ind=>cases.filter(c=>c.industry===ind&&c.type===t).length),
  backgroundColor:TYPE_COLORS[t]
}))},options:{plugins:{legend:{position:'bottom'}},scales:{x:{stacked:true,ticks:{font:{size:11}}},y:{stacked:true,beginAtZero:true,ticks:{precision:0}}}}});

// --- 各地区税费金额 TOP5（亿元，国内地区、名称归一）---
const regionAmtAll={};
cases.forEach(c=>{const r=normRegion(c.region);if(!r)return;const m=parseCaseMoney(c);if(m.hasAmount)regionAmtAll[r]=(regionAmtAll[r]||0)+m.total;});
const regionAmtTop5=Object.entries(regionAmtAll).sort((a,b)=>b[1]-a[1]).slice(0,5);
new Chart(chartRegionAmt,{type:'bar',data:{labels:regionAmtTop5.map(x=>x[0]),datasets:[{label:'税费金额(亿元)',data:regionAmtTop5.map(x=>+(x[1]/10000).toFixed(2)),backgroundColor:regionAmtTop5.map((_,i)=>i===0?'#047857':'#10b981'),borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});

// --- 处置类型成本对比（本金/滞纳金/罚款，亿元）---
// 本金口径同 KPI：m.total - m.latefee - m.fine（未拆分税费合计归入本金）
const typeCost=TYPE_ORDER.map(t=>{
  let p=0,l=0,f=0;
  cases.forEach(c=>{if(c.type!==t)return;const m=parseCaseMoney(c);if(!m.hasAmount)return;p+=m.total-m.latefee-m.fine;l+=m.latefee;f+=m.fine;});
  return {t,p:p/10000,l:l/10000,f:f/10000};
});
new Chart(chartTypeCost,{type:'bar',data:{labels:TYPE_ORDER,datasets:[
  {label:'本金',data:typeCost.map(x=>+x.p.toFixed(2)),backgroundColor:'#059669'},
  {label:'滞纳金',data:typeCost.map(x=>+x.l.toFixed(2)),backgroundColor:'#f59e0b'},
  {label:'罚款',data:typeCost.map(x=>+x.f.toFixed(2)),backgroundColor:'#dc2626'}
]},options:{plugins:{legend:{position:'bottom'}},scales:{x:{stacked:true,ticks:{font:{size:11}}},y:{stacked:true,beginAtZero:true,title:{display:true,text:'亿元'}}}}});

// ===== 白酒专项 =====
const baijiu=cases.filter(c=>c.industry&&c.industry.includes('白酒'));
const bjSelf=baijiu.filter(c=>c.type==='自查补缴').length;
const bjRef=baijiu.filter(c=>c.type==='行业参考').length;
const bjPen=baijiu.filter(c=>['稽查处罚','失信虚开'].includes(c.type)).length;
const bjListed=baijiu.filter(c=>/^[0-9]{6}$/.test(c.code||'')).length;
document.getElementById('baijiuKpi').innerHTML=[
  {n:baijiu.length,l:'白酒相关案例',c:''},
  {n:bjListed,l:'上市公司 / 知名主体',c:'teal'},
  {n:bjSelf,l:'自查补缴',c:'success'},
  {n:bjRef,l:'问询 / 行业参考',c:''},
  {n:bjPen,l:'稽查处罚 / 虚开',c:'danger'}
].map(k=>'<div class="kpi '+k.c+'"><div class="num" style="font-size:30px">'+k.n+'</div><div class="label">'+k.l+'</div></div>').join('');

// 白酒类型分布（按固定顺序，配色与全局一致）
const bjTypeOrder=TYPE_ORDER.filter(t=>baijiu.some(c=>c.type===t));
new Chart(chartBaijiuType,{type:'doughnut',data:{labels:bjTypeOrder,datasets:[{data:bjTypeOrder.map(t=>baijiu.filter(c=>c.type===t).length),backgroundColor:bjTypeOrder.map(t=>TYPE_COLORS[t])}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+'例'}}}}});

const bjTax={};baijiu.forEach(c=>(c.taxTags||[]).forEach(t=>{bjTax[t]=(bjTax[t]||0)+1;}));
new Chart(chartBaijiuTax,{type:'bar',data:{labels:Object.keys(bjTax),datasets:[{data:Object.values(bjTax),backgroundColor:['#b91c1c','#0d9488','#ca8a04','#059669','#7e22ce','#ea580c'],borderRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});

// 白酒税费金额构成（本金口径同 KPI：total - latefee - fine，未拆分税费归入本金）
let bjPri=0,bjLate=0,bjFine=0;
baijiu.forEach(c=>{const m=parseCaseMoney(c);if(!m.hasAmount)return;bjPri+=m.total-m.latefee-m.fine;bjLate+=m.latefee;bjFine+=m.fine;});
const bjComp=[];
if(bjPri>0)bjComp.push({label:'补缴本金',val:+bjComp0(bjPri),color:'#059669'});
if(bjLate>0)bjComp.push({label:'滞纳金',val:+bjComp0(bjLate),color:'#f59e0b'});
if(bjFine>0)bjComp.push({label:'罚款',val:+bjComp0(bjFine),color:'#dc2626'});
function bjComp0(v){return (v/10000).toFixed(2);}
if(bjComp.length){
  new Chart(chartBaijiuComp,{type:'doughnut',data:{labels:bjComp.map(x=>x.label),datasets:[{data:bjComp.map(x=>x.val),backgroundColor:bjComp.map(x=>x.color)}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+'亿元'}}}}});
} else {
  chartBaijiuComp.parentElement.querySelector('h3:last-of-type') && (chartBaijiuComp.style.display='none');
}

// 白酒图表卡底部小结（填充空白）
const bjAmtText=(bjFine>0)?'补缴本金 + 滞纳金 + 罚款':'补缴本金 + 滞纳金（无罚款）';
document.getElementById('bjNote').innerHTML=[
  '<b>'+baijiu.length+' 例</b>白酒案例以<b> 消费税、企业所得税 </b>为核心税种，消费税（生产环节从价20%+从量0.5元/斤）是行业特有红线。',
  '处置以<b>自查补缴 '+bjSelf+' 例</b>与问询/参考 '+bjRef+' 例为主，稽查或涉票 '+bjPen+' 例；多数主体主动补正后<b>未被定性偷税</b>。',
  '税费构成均为<b>'+bjAmtText+'</b>，滞纳金年化约 18.25% 滚动，<b>越早自查补正成本越低</b>。'
].map(t=>'<div class="ni"><span class="dot"></span><span>'+t+'</span></div>').join('');

const typeTag={
  '自查补缴':'<span class="tag tag-green">自查补缴</span>',
  '稽查处罚':'<span class="tag tag-orange">稽查处罚</span>',
  '行政处罚':'<span class="tag tag-red">行政处罚</span>',
  '失信虚开':'<span class="tag tag-purple">失信虚开</span>',
  '行业参考':'<span class="tag tag-blue">行业参考</span>'
};
document.getElementById('baijiuTable').innerHTML=
  '<tr><th>公司</th><th>类型</th><th>披露日期</th><th>金额</th><th>核心要点</th></tr>'+
  baijiu.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(c=>{
    let kp=(c.keyPoints&&c.keyPoints[0])?c.keyPoints[0].replace(/<[^>]+>/g,''):'';
    if(kp.length>42)kp=kp.slice(0,42)+'…';
    return '<tr><td><strong>'+c.company+'</strong><br><span style="color:#94a3b8;font-size:11px">'+(c.code&&/^[0-9]{6}$/.test(c.code)?c.code:'')+'</span></td>'+
      '<td>'+(typeTag[c.type]||c.type)+'</td><td>'+(c.date||'-')+'</td><td class="num">'+(c.amountDisplay||'-')+'</td><td style="color:#475569">'+kp+'</td></tr>';
  }).join('');

// 白酒结论卡片（替代大段文字）
const bjAmtCases=baijiu.filter(isCountable);
const bjAmt=bjAmtCases.reduce((s,c)=>s+parseAmount(c),0);
const bjAmtStr=bjAmt/10000>=1?(bjAmt/10000).toFixed(2)+'亿元':Math.round(bjAmt)+'万元';
const bjPenRate=baijiu.length?Math.round((bjPen/baijiu.length)*100):0;
document.getElementById('baijiuConcl').innerHTML=[
  {ct:'📌 双线施压',cd:'税务稽查与交易所问询同时收紧：9 例中自查补缴 <b>'+bjSelf+'</b> 例、问询/参考 <b>'+bjRef+'</b> 例、稽查或涉票 <b>'+bjPen+'</b> 例（约 <b>'+bjPenRate+'%</b>）。税务端追补税与滞纳金，交易所追问关联定价与信披，企业需同时应对两套监管。'},
  {ct:'🎯 核心矛盾',cd:'白酒消费税在生产环节征收（从价 20% + 从量 0.5 元/斤），酒企普遍设立关联销售公司低价出厂、再高价对外销售，以切割税基。关联定价是否公允、是否人为转移利润，是稽查与问询共同聚焦的核心。'},
  {ct:'💰 税费规模',cd:'可统计 <b>'+bjAmtCases.length+'</b> 例合计约 <b>'+bjAmtStr+'</b>，单笔可达亿元级：华致酒行补税及滞纳金 <b>1.27 亿</b>、金徽酒相关税款 <b>8381.81 万</b>、枝江酒业历史税款超 <b>8500 万</b>，龙头与区域酒企均有涉及。'},
  {ct:'⏳ 翻旧账',cd:'多起追溯 3–5 个年度，历史问题被集中清算。华致滞纳金 <b>4861.74 万</b>、约占本金 62%；滞纳金年化约 <b>18.25%</b> 持续滚动，拖得越久成本越高，主动自查补正可显著降低损失。'},
  {ct:'⚠️ 高危红线',cd:'利用私人账户收款隐匿收入、以促销/广告/咨询费名义虚开发票、在低税率地区设空壳架构转移利润，均属高危行为；一经查实面临 <b>0.5–5 倍罚款</b>，情节严重还将追究刑事责任。'},
  {ct:'📈 趋势判断',cd:'消费税后移至批发/零售环节的政策预期升温，金税四期可穿透关联交易与资金流，交易所对酒企问询持续高频，行业合规不断收紧；<b>中小酒企与高度依赖关联销售公司的企业风险敞口更大</b>，应尽早规范定价与票据。'}
].map(x=>'<div class="concl"><div class="ct">'+x.ct+'</div><div class="cd">'+x.cd+'</div></div>').join('');

// 合规自检清单（3 列，精炼）
function col(title,items){
  return '<div><div style="font-weight:700;color:var(--primary-dark);font-size:15.5px;margin-bottom:6px">'+title+'</div><ul class="check-list">'+
    items.map(t=>'<li>'+t+'</li>').join('')+'</ul></div>';
}
document.getElementById('baijiuAdvice').innerHTML=[
  col('① 架构与定价',[
    '<b>销售公司定价留痕、公允</b>：留存出厂/批发/零售价分润与职能费用，做可比性分析，调整走董事会/独董审批并披露。',
    '<b>慎用低税率空壳架构</b>：洼地主体必须有场所、员工、履职董监高、独立资金流水；四流合一，财政返还协议备查。',
    '<b>经销商穿透管理</b>：建关联关系台账、穿透到受益人，对内部专营经销商的拿货价/返利/库存/动销专项留痕。'
  ]),
  col('② 票、款、账三条线',[
    '<b>杜绝私户收款</b>：货款/返利/促销款一律对公，禁用法人/股东/员工/亲属个人卡及第三方账户，定期核对银行流水。',
    '<b>费用发票真实</b>：促销/广告/会议/咨询费凭合同、方案、签到/现场照片、成果、付款凭证取票，确保三流一致。',
    '<b>供应商准入核验</b>：对新设、集中开票、经营范围异常的服务商重点核查，杜绝白条入账与找票冲费用。'
  ]),
  col('③ 历史清理与长效机制',[
    '<b>主动自查优于被查</b>：进场/问询前做近3–5年消费税、所得税、关联交易专项体检，优先走主动补正、争取仅补税+滞纳金。',
    '<b>尽早清理历史遗留</b>：测算补税+滞纳金敞口、预留资金，避免"翻旧账"集中冲击利润与现金流。',
    '<b>集团穿透+政策前瞻</b>：子/孙公司、并购标的纳入统一税务管理与尽调；跟踪消费税征收环节后移，提前测算定价与架构调整窗口。'
  ])
].join('');
</script>

</body>
</html>`;

fs.writeFileSync(path.join(root, 'analysis.html'), page.replace('__CASES_PLACEHOLDER__', casesLiteral), 'utf8');
console.log('已生成 analysis.html');

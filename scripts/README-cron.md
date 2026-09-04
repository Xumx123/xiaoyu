# 定时任务调度说明（每日案例采集 + 数据质检）

本项目是 Coze 托管的**静态站点**（`node server.js` 提供静态服务），沙箱/生产环境内**没有常驻 cron 守护**，
所以「每天 5 点采集 / 7 点质检」不能依赖网站服务器自身定时，需在**外部持久化调度器**上挂载。

脚本入口：`scripts/run-daily-tasks.sh`
- `collect`：调用 `coze-coding-ai search` 搜索近期税务案例 → 与现有 cases 查重 → 门槛初筛 →
  产出 `reports/collect-YYYY-MM-DD.md` / `.json` **候选草稿**（**不自动改库**，需人工核实后录入）。
- `lint`：`node scripts/data-lint.js --fix`（自动修地区全称/代码后缀/企业性质等确定性问题）→ `node build-analysis.js` 重建看板。
  分类存疑、字段缺失等只报告不擅改。

## 方式一：GitHub Actions（推荐，免维护）

将项目推到 GitHub 仓库，新建 `.github/workflows/daily.yml`：

```yaml
name: daily-taxcase
on:
  schedule:
    - cron: "0 5 * * *"   # 每天 05:00 UTC（按你的时区调整）
    - cron: "0 7 * * *"   # 每天 07:00 UTC
  workflow_dispatch:        # 也支持手动触发
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm i -g @coze/coze-coding-cli   # 搜索 CLI（按实际包名/鉴权方式配置）
      - name: 05:00 采集
        if: github.event.schedule == '0 5 * * *'
        run: bash scripts/run-daily-tasks.sh collect
      - name: 07:00 质检+重建
        if: github.event.schedule == '0 7 * * *'
        run: bash scripts/run-daily-tasks.sh lint
      - name: 上传候选报告
        uses: actions/upload-artifact@v4
        with: { name: collect-report, path: reports/ }
      # 如需自动提交 lint 修复与重建结果，可加 git commit & push；采集结果建议人工确认后再合入
```

> 说明：采集（collect）结果建议以 artifact / PR 形式给你**人工确认**后再录入，避免误报污染数据库；
> 质检（lint）的确定性修复可在确认 diff 后自动提交。

## 方式二：自有服务器 crontab

```cron
# m h dom mon dow command
0 5 * * * cd /path/to/project && bash scripts/run-daily-tasks.sh collect >> /app/work/logs/bypass/daily-tasks.log 2>&1
0 7 * * * cd /path/to/project && bash scripts/run-daily-tasks.sh lint    >> /app/work/logs/bypass/daily-tasks.log 2>&1
```

## 方式三：本地 / 临时手动运行

```bash
bash scripts/run-daily-tasks.sh collect   # 立即采集一次
bash scripts/run-daily-tasks.sh lint      # 立即质检+重建
node scripts/data-lint.js                 # 只巡检不改文件
```

## 为什么采集不做「全自动入库」

新闻/公告可能误报、重复、金额口径不清或分类错误，全自动写入会污染案例库。因此：
- **可全自动**：质检中的确定性规范化（地区简称→全称、A 股裸代码补后缀、企业性质取值归一）。
- **需人工确认**：新案例的事实、金额拆分（本金/滞纳金/罚款）、5 类分类判定、是否达门槛。

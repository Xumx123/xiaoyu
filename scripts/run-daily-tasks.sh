#!/usr/bin/env bash
# run-daily-tasks.sh —— 每日定时任务统一入口
#
# 用法：
#   bash scripts/run-daily-tasks.sh collect   # 5:00 采集：搜索新案例 → 查重 → 产出候选草稿（reports/collect-YYYY-MM-DD.md）
#   bash scripts/run-daily-tasks.sh lint      # 7:00 质检：数据巡检 → 自动修复确定性问题 → 重建 analysis.html
#   bash scripts/run-daily-tasks.sh all       # 采集 + 质检（便于手动/CI 一键跑）
#
# 重要：collect 只产出候选报告，不自动改写案例库（需人工核实后按 AGENTS.md 录入）；
#       lint --fix 仅自动修复安全的确定性问题（地区全称/代码后缀/企业性质归一），分类等需判断的只报告。
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

LOG_DIR="/app/work/logs/bypass"
mkdir -p "$LOG_DIR"
TS="$(date +%Y-%m-%d)"
LOG="$LOG_DIR/daily-tasks.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

collect() {
  log "=== [collect] 每日案例采集开始 ==="
  node scripts/daily-collect.js "$@" >> "$LOG" 2>&1 \
    && log "=== [collect] 采集完成，候选报告见 reports/collect-${TS}.md（待人工确认录入）===" \
    || log "=== [collect] 采集失败，请检查日志 ==="
}

lint() {
  log "=== [lint] 数据质检+自动修复开始 ==="
  node scripts/data-lint.js --fix >> "$LOG" 2>&1
  log "--- 重建看板 analysis.html ---"
  node build-analysis.js >> "$LOG" 2>&1 \
    && log "=== [lint] 质检+重建完成（exit $?）===" \
    || log "=== [lint] 重建失败，请检查日志 ==="
}

case "${1:-all}" in
  collect) shift; collect "$@" ;;
  lint)    lint ;;
  all)     collect; lint ;;
  *) echo "用法: bash scripts/run-daily-tasks.sh [collect|lint|all]"; exit 1 ;;
esac

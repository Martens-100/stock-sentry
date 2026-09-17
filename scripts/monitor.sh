#!/usr/bin/env bash
# StockSentry 运行状态监控（针对本地 Node 后端 / launchd 守护）
#   · 每 30s 探一次 /api/health
#   · 异常（DOWN）时记录到 data/monitor.log 并尝试经 launchctl 重启守护
#   · 与 com.stocksentry.server.plist 配合：launchd 负责崩溃自愈，本脚本负责可观测与告警
#
# 手动用法：PORT=8848 HOST=127.0.0.1 bash scripts/monitor.sh
# 常驻用法：作为第二个 launchd 任务加载（见说明），或在 tmux/nohup 下后台运行。
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8848}"
HOST="${HOST:-127.0.0.1}"
LABEL="com.stocksentry.server"
MON_LOG="$ROOT/data/monitor.log"
mkdir -p "$(dirname "$MON_LOG")"
URL="http://$HOST:$PORT/api/health"
TS() { date '+%Y-%m-%d %H:%M:%S'; }

echo "[$(TS)] monitor: start (target=$URL)" >> "$MON_LOG"
while true; do
  if curl -s -m 5 "$URL" >/dev/null 2>&1; then
    echo "[$(TS)] monitor: OK" >> "$MON_LOG"
  else
    echo "[$(TS)] monitor: DOWN — try restart via launchctl ($LABEL)" >> "$MON_LOG"
    # 优先用 modern 语法，失败回退旧语法；两者都不存在则忽略（仅记录告警）
    launchctl kickstart "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl kickstart "$LABEL" 2>/dev/null || true
  fi
  sleep 30
done

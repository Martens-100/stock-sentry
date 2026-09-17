#!/usr/bin/env bash
# StockSentry 服务监督器（进程守护的执行体）
#   · 崩溃自重启：node server.js 退出后 2s 内拉起
#   · 健康检查日志：每次启停都写 data/monitor.log / data/server.log
#   · 由 launchd (com.stocksentry.server) 在开机/崩溃时拉起本脚本，并处理 SIGTERM
#
# 手动用法：PORT=8848 HOST=127.0.0.1 bash scripts/run-server.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

NODE="/usr/local/bin/node"
PORT="${PORT:-8848}"
HOST="${HOST:-127.0.0.1}"
LOG_DIR="$ROOT/data"
mkdir -p "$LOG_DIR"
SRV_LOG="$LOG_DIR/server.log"
MON_LOG="$LOG_DIR/monitor.log"
TS() { date '+%Y-%m-%d %H:%M:%S'; }

echo "[$(TS)] supervisor: start (PORT=$PORT HOST=$HOST, node=$( "$NODE" -v 2>/dev/null ))" >> "$SRV_LOG"

# 收到停止信号时优雅退出，交给 launchd 决定是否重启
trap 'echo "[$(TS)] supervisor: received stop signal" >> "$SRV_LOG"; exit 0' TERM INT

while true; do
  echo "[$(TS)] supervisor: launching node server.js (pid follows)" >> "$SRV_LOG"
  PORT="$PORT" HOST="$HOST" "$NODE" "$ROOT/server.js" >> "$SRV_LOG" 2>&1 &
  NODE_PID=$!
  echo "[$(TS)] supervisor: node pid=$NODE_PID" >> "$SRV_LOG"
  wait "$NODE_PID"
  CODE=$?
  echo "[$(TS)] supervisor: node exited code=$CODE, restart in 2s" >> "$SRV_LOG"
  echo "[$(TS)] monitor: node exited code=$CODE (supervisor will restart)" >> "$MON_LOG"
  sleep 2
done

#!/bin/bash
# ==============================================================================
# Damascus Evidence Map Platform — One-Click Unified Launcher
# Launches Django Backend (Port 8000) & Next.js Frontend (Port 3000)
# ==============================================================================

set -e

# Project root path
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Visual Identity Palette (ANSI Colors)
GREEN="\033[38;2;6;66;57m"
GOLD="\033[38;2;200;167;106m"
CREAM="\033[38;2;247;244;237m"
RED="\033[0;31m"
BOLD="\033[1m"
RESET="\033[0m"

echo -e "${GREEN}${BOLD}"
echo "  ================================================================"
echo "    منصة خريطة محافظة دمشق الموحدة | Damascus Map Platform        "
echo "  ================================================================"
echo -e "${RESET}"

# 1. Clean up old processes on ports 8000 and 3000
echo -e "${GOLD}➔ [1/4] Checking and clearing ports 8000 and 3000...${RESET}"
PID_8000=$(lsof -ti :8000 2>/dev/null || true)
if [ -n "$PID_8000" ]; then
    echo -e "  Clearing old process on port 8000 (PID: $PID_8000)..."
    kill -9 $PID_8000 2>/dev/null || true
fi

PID_3000=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$PID_3000" ]; then
    echo -e "  Clearing old process on port 3000 (PID: $PID_3000)..."
    kill -9 $PID_3000 2>/dev/null || true
fi

# 2. Verify Python environment
echo -e "${GOLD}➔ [2/4] Initializing Django Backend...${RESET}"
PYTHON_BIN="$BACKEND_DIR/venv/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then
    if [ -f "$BACKEND_DIR/venv_mac/bin/python" ]; then
        PYTHON_BIN="$BACKEND_DIR/venv_mac/bin/python"
    elif command -v python3 &>/dev/null; then
        PYTHON_BIN="$(command -v python3)"
    else
        echo -e "${RED}Error: Python virtual environment not found in backend/venv!${RESET}"
        exit 1
    fi
fi

# Launch Django in background
mkdir -p "$PROJECT_DIR/logs"
cd "$BACKEND_DIR"
"$PYTHON_BIN" manage.py runserver 8000 > "$PROJECT_DIR/logs/django.log" 2>&1 &
DJANGO_PID=$!

# Cleanup trap on exit / Ctrl+C
cleanup() {
    echo -e "\n${GOLD}➔ Shutting down Damascus Map Platform...${RESET}"
    kill $DJANGO_PID 2>/dev/null || true
    if [ -n "$NEXT_PID" ]; then
        kill $NEXT_PID 2>/dev/null || true
    fi
    kill $(lsof -ti :8000 2>/dev/null) 2>/dev/null || true
    kill $(lsof -ti :3000 2>/dev/null) 2>/dev/null || true
    echo -e "${GREEN}✓ All services stopped cleanly. Goodbye!${RESET}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Wait for Django API health check
echo -n "  Waiting for Django API to become healthy"
for i in {1..20}; do
    if curl -s http://127.0.0.1:8000/api/health/ > /dev/null 2>&1; then
        echo -e " ${GREEN}✓ [API Ready]${RESET}"
        break
    fi
    echo -n "."
    sleep 0.5
    if [ $i -eq 20 ]; then
        echo -e " ${RED}✕ (Timeout starting Django. Check logs/django.log)${RESET}"
        cat "$PROJECT_DIR/logs/django.log" | tail -n 15
        exit 1
    fi
done

# 3. Launch Next.js Frontend
echo -e "${GOLD}➔ [3/4] Starting Next.js 16 + Turbopack Frontend...${RESET}"
cd "$FRONTEND_DIR"
npx next dev -p 3000 > "$PROJECT_DIR/logs/nextjs.log" 2>&1 &
NEXT_PID=$!

# Wait for Frontend
echo -n "  Waiting for Next.js web interface"
for i in {1..25}; do
    if curl -s http://localhost:3000/ > /dev/null 2>&1; then
        echo -e " ${GREEN}✓ [Web Ready]${RESET}"
        break
    fi
    echo -n "."
    sleep 0.5
done

# 4. Success banner & open browser
echo -e "${GREEN}${BOLD}"
echo "  ================================================================"
echo "    🚀 Damascus Map Platform is running live!                      "
echo "  ================================================================"
echo -e "${RESET}"
echo -e "  🌐 ${BOLD}Interactive Map:${RESET}     ${GOLD}http://localhost:3000/viewer${RESET}"
echo -e "  📡 ${BOLD}Django API Health:${RESET}   ${GOLD}http://127.0.0.1:8000/api/health/${RESET}"
echo -e "  🏛️ ${BOLD}Admin Areas (114):${RESET}   ${GOLD}http://127.0.0.1:8000/api/admin-areas/${RESET}"
echo -e "  🚌 ${BOLD}Transit Lines (42):${RESET}  ${GOLD}http://127.0.0.1:8000/api/transit/lines/${RESET}"
echo -e "  📑 ${BOLD}Audit Report PDF:${RESET}    ${GOLD}$PROJECT_DIR/docs/DAMASCUS_MAP_AUDIT_REPORT.pdf${RESET}"
echo ""
echo -e "  ${BOLD}Press [Ctrl+C] at any time to stop all services cleanly.${RESET}"
echo -e "${GREEN}  ----------------------------------------------------------------${RESET}"

# Open in default macOS browser
if command -v open &>/dev/null; then
    sleep 0.5
    open "http://localhost:3000/viewer"
fi

# Stream logs or wait for interrupt
tail -f "$PROJECT_DIR/logs/nextjs.log" "$PROJECT_DIR/logs/django.log" 2>/dev/null || wait

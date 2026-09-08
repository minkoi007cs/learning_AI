#!/usr/bin/env bash
#
# Bật AI Study OS bằng một lệnh.
#
#   ./scripts/start.sh            Chạy cho riêng mình  → http://localhost:3000
#   ./scripts/start.sh --share    Mở thêm cho bạn bè truy cập từ xa
#   ./scripts/start.sh --api-only Chỉ chạy backend (khi frontend đã ở Vercel)
#
# Bấm Ctrl+C để tắt tất cả.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ROOT="$(repo_root)"
cd "$ROOT"

MODEL_TEXT="qwen3:8b"
MODEL_VISION="qwen2.5vl:7b"
MODEL_EMBED="bge-m3"

API_PORT=3001
WEB_PORT=3000

SHARE=0
API_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --share)    SHARE=1 ;;
    --api-only) API_ONLY=1 ;;
    -h|--help)
      sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) die "Không hiểu tuỳ chọn: $arg  (dùng --help để xem hướng dẫn)" ;;
  esac
done

LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/backend.log"
WEB_LOG="$LOG_DIR/frontend.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

API_PID=""; WEB_PID=""; TUNNEL_PID=""

cleanup() {
  # Nếu chưa kịp khởi động gì (thoát ở bước kiểm tra) thì im lặng, để thông báo
  # lỗi thật sự không bị đẩy lên trên và lọt khỏi tầm mắt.
  if [ -z "$API_PID$WEB_PID$TUNNEL_PID" ]; then
    return
  fi
  say ""
  step "Đang tắt..."
  for pid in "$TUNNEL_PID" "$WEB_PID" "$API_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  ok "Đã tắt hết. Hẹn gặp lại!"
}
trap cleanup EXIT INT TERM

say ""
say "${C_BOLD}${C_CYAN}AI Study OS${C_RESET}"

# ══════════════════════════════════════════════════════════════
step "Kiểm tra trước khi chạy"

# --- Ollama ---
if ollama_up; then
  ok "Ollama đang chạy"
else
  warn "Ollama chưa chạy — đang bật..."
  open -a Ollama >/dev/null 2>&1 || nohup ollama serve >/dev/null 2>&1 &
  if wait_for_url "http://127.0.0.1:11434/api/tags" 30; then
    ok "Ollama đã lên"
  else
    die "Không bật được Ollama. Mở app Ollama thủ công rồi chạy lại."
  fi
fi

# --- Model ---
MISSING=()
for m in "$MODEL_TEXT" "$MODEL_VISION" "$MODEL_EMBED"; do
  ollama_has_model "$m" || MISSING+=("$m")
done
if [ "${#MISSING[@]}" -gt 0 ]; then
  err "Thiếu model: ${MISSING[*]}"
  hint "Tải bằng: ollama pull ${MISSING[0]}"
  hint "Hoặc chạy lại: ./scripts/setup-mac.sh"
  exit 1
fi
ok "Đủ 3 model AI"

# --- Cấu hình ---
ENV_FILE="$ROOT/backend/.env"
[ -f "$ENV_FILE" ] || die "Chưa có backend/.env — chạy ./scripts/setup-mac.sh trước."

DB_URL="$(env_get DATABASE_URL "$ENV_FILE" || true)"
case "$DB_URL" in
  ""|*xxxx*) die "DATABASE_URL trong backend/.env chưa điền thật." ;;
esac
JWT="$(env_get JWT_SECRET "$ENV_FILE" || true)"
case "$JWT" in
  ""|*doi-thanh-mot-chuoi*) die "JWT_SECRET trong backend/.env vẫn là giá trị mẫu. Tạo mới: openssl rand -base64 48" ;;
esac
ok "backend/.env hợp lệ"

# --- Cổng trống ---
if port_busy "$API_PORT"; then
  die "Cổng $API_PORT đang bị chiếm. Tìm và tắt: lsof -nP -iTCP:$API_PORT -sTCP:LISTEN"
fi
if [ "$API_ONLY" -eq 0 ] && port_busy "$WEB_PORT"; then
  die "Cổng $WEB_PORT đang bị chiếm. Tìm và tắt: lsof -nP -iTCP:$WEB_PORT -sTCP:LISTEN"
fi
if [ "$API_ONLY" -eq 0 ]; then
  ok "Cổng $API_PORT và $WEB_PORT đang trống"
else
  ok "Cổng $API_PORT đang trống"
fi

# ══════════════════════════════════════════════════════════════
step "Biên dịch backend"

# Chỉ build lại khi mã nguồn mới hơn bản đã build — tiết kiệm thời gian mỗi lần bật.
NEEDS_BUILD=0
if [ ! -f "$ROOT/backend/dist/main.js" ]; then
  NEEDS_BUILD=1
elif [ -n "$(find "$ROOT/backend/src" "$ROOT/backend/prisma/schema.prisma" \
              -newer "$ROOT/backend/dist/main.js" -print -quit 2>/dev/null)" ]; then
  NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
  say "Có thay đổi mã nguồn — đang biên dịch..."
  (cd "$ROOT/backend" && npx prisma generate >/dev/null && npm run build >/dev/null) \
    || die "Biên dịch thất bại. Xem lỗi bằng: cd backend && npm run build"
  ok "Biên dịch xong"
else
  ok "Bản build còn mới, bỏ qua"
fi

# ══════════════════════════════════════════════════════════════
step "Khởi động"

(cd "$ROOT/backend" && npm run start:prod) > "$API_LOG" 2>&1 &
API_PID=$!

if wait_for_url "http://127.0.0.1:$API_PORT/v1/health" 90; then
  ok "Backend chạy ở cổng $API_PORT"
else
  err "Backend không lên sau 90 giây. 20 dòng log cuối:"
  tail -20 "$API_LOG" >&2
  exit 1
fi

if [ "$API_ONLY" -eq 0 ]; then
  (cd "$ROOT/frontend" && npm run dev -- --port "$WEB_PORT") > "$WEB_LOG" 2>&1 &
  WEB_PID=$!
  if wait_for_url "http://127.0.0.1:$WEB_PORT" 90; then
    ok "Giao diện chạy ở cổng $WEB_PORT"
  else
    warn "Giao diện chưa lên — xem $WEB_LOG"
  fi
fi

# ══════════════════════════════════════════════════════════════
PUBLIC_URL=""
if [ "$SHARE" -eq 1 ]; then
  step "Mở đường cho bạn bè truy cập"

  if ! have cloudflared; then
    warn "Chưa cài cloudflared — bỏ qua bước này"
    hint "Cài bằng: brew install cloudflared"
  else
    : > "$TUNNEL_LOG"
    cloudflared tunnel --url "http://localhost:$API_PORT" > "$TUNNEL_LOG" 2>&1 &
    TUNNEL_PID=$!

    say "Đang tạo địa chỉ công khai..."
    for _ in $(seq 1 40); do
      PUBLIC_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)"
      [ -n "$PUBLIC_URL" ] && break
      sleep 1
    done

    if [ -n "$PUBLIC_URL" ]; then
      ok "Địa chỉ công khai đã sẵn sàng"
    else
      warn "Chưa lấy được địa chỉ — xem $TUNNEL_LOG"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════
say ""
say "${C_BOLD}${C_GREEN}Sẵn sàng.${C_RESET}"
say ""
if [ "$API_ONLY" -eq 0 ]; then
  say "  Mở trình duyệt:   ${C_BOLD}http://localhost:$WEB_PORT${C_RESET}"
fi
say "  Tài liệu API:     ${C_DIM}http://localhost:$API_PORT/api/docs${C_RESET}"

if [ -n "$PUBLIC_URL" ]; then
  say ""
  say "  ${C_BOLD}Địa chỉ API công khai:${C_RESET}"
  say "  ${C_CYAN}$PUBLIC_URL/v1${C_RESET}"
  say ""
  say "  ${C_YELLOW}Để bạn bè dùng được, làm 2 việc sau:${C_RESET}"
  say "  1. Vào Vercel → dự án frontend → Settings → Environment Variables"
  say "     đặt  NEXT_PUBLIC_API_URL = $PUBLIC_URL/v1  rồi deploy lại"
  say "  2. Thêm địa chỉ frontend trên Vercel vào CORS_ORIGINS trong backend/.env"
  say ""
  hint "Địa chỉ này ĐỔI mỗi lần bật lại. Muốn địa chỉ cố định, xem tech.md §4.6."
fi

say ""
say "  ${C_DIM}Log: .logs/backend.log · .logs/frontend.log${C_RESET}"
say "  ${C_DIM}Bấm Ctrl+C để tắt tất cả.${C_RESET}"
say ""

# Giữ script sống; nếu backend chết thì thoát luôn để không treo lơ lửng.
while kill -0 "$API_PID" 2>/dev/null; do
  sleep 2
done

err "Backend đã dừng bất thường. 20 dòng log cuối:"
tail -20 "$API_LOG" >&2
exit 1

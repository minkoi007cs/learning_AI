#!/usr/bin/env bash
#
# Kiểm tra bản đã deploy trên Vercel có chạy đúng không.
#
#   ./scripts/check-deploy.sh https://<backend>.vercel.app https://<frontend>.vercel.app
#   ./scripts/check-deploy.sh            (tự đọc từ frontend/.env.production)
#
# Kiểm 5 thứ, theo đúng thứ tự hay hỏng:
#   1. Backend có sống không
#   2. Database có nối được không
#   3. Đang chạy bằng Gemini hay Qwen  (trên Vercel PHẢI là Gemini)
#   4. CORS có cho tên miền frontend gọi vào không
#   5. Frontend có đang trỏ đúng vào backend này không

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ROOT="$(repo_root)"

case "${1:-}" in
  -h|--help) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac

API="${1:-}"
WEB="${2:-}"

# ── Tự đoán địa chỉ nếu không truyền vào ──────────────────────
PROD_ENV="$ROOT/frontend/.env.production"
if [ -z "$API" ] && [ -f "$PROD_ENV" ]; then
  API="$(env_get NEXT_PUBLIC_API_URL "$PROD_ENV" || true)"
  API="${API%/v1}"      # bỏ hậu tố /v1 để lấy gốc
fi

[ -n "$API" ] || die "Chưa biết địa chỉ backend. Dùng: ./scripts/check-deploy.sh https://<backend>.vercel.app"

API="${API%/}"
PREFIX="$(env_get API_PREFIX "$ROOT/backend/.env" 2>/dev/null || echo v1)"
[ -n "$PREFIX" ] || PREFIX=v1

say ""
say "${C_BOLD}${C_CYAN}Kiểm tra bản trên Vercel${C_RESET}"
say ""
say "  Backend:   ${C_DIM}$API${C_RESET}"
say "  Frontend:  ${C_DIM}${WEB:-(chưa truyền)}${C_RESET}"
say ""

FAIL=0

# ── 1. Backend sống chưa ──────────────────────────────────────
step "1/5  Backend có trả lời không"
HEALTH="$(curl -fsS -m 30 "$API/$PREFIX/health" 2>/dev/null || true)"

if [ -z "$HEALTH" ]; then
  err "Không gọi được $API/$PREFIX/health"
  hint "Sai địa chỉ, deploy lỗi, hoặc dự án đang bật Deployment Protection."
  hint "Xem log:  Vercel → dự án backend → Deployments → bản mới nhất → Logs"
  exit 1
fi
ok "Backend trả lời"

# ── 2 & 3. Database và nhà cung cấp AI ────────────────────────
step "2/5  Database"
HEALTH="$HEALTH" python3 <<'PY' || FAIL=1
import os, json, sys
try:
    d = json.loads(os.environ['HEALTH'])
except Exception:
    print("  ✗ Phản hồi không phải JSON — có thể đang bị trang đăng nhập của Vercel chặn")
    sys.exit(1)
d = d.get('data', d)
db = d.get('database')
if db == 'connected':
    print("  ✓ Database nối được")
else:
    print("  ✗ Database: %s" % db)
    print("      Kiểm tra DATABASE_URL trong Vercel → Settings → Environment Variables.")
    print("      Nhớ dùng chuỗi POOLED (cổng 6543) kèm ?pgbouncer=true&connection_limit=1")
    sys.exit(1)
PY

step "3/5  Nhà cung cấp AI"
HEALTH="$HEALTH" python3 <<'PY' || FAIL=1
import os, json, sys
d = json.loads(os.environ['HEALTH'])
d = d.get('data', d)
ai = d.get('ai')
if not ai:
    print("  ! Bản backend này chưa có thông tin AI trong /health — deploy lại bản mới nhất")
    sys.exit(0)

kind, model = ai.get('kind'), ai.get('model')
print("  Đang dùng: %s  (model: %s)" % (ai.get('label'), model))

if kind == 'gemini':
    print("  ✓ Đúng — bản trên Vercel phải dùng Gemini")
elif kind == 'local':
    print("  ✗ SAI — bản trên Vercel đang trỏ vào 127.0.0.1")
    print("      Vercel chạy trong máy chủ Amazon; 127.0.0.1 ở đó KHÔNG phải MacBook")
    print("      của bạn, nên mọi lời gọi AI sẽ lỗi. Vào Vercel → Settings →")
    print("      Environment Variables, đặt OPENAI_BASE_URL thành địa chỉ Gemini.")
    sys.exit(1)
else:
    print("  ! Nhà cung cấp lạ — tự kiểm tra lại nếu không cố ý")

# khoá API tuyệt đối không được lọt ra endpoint công khai
raw = json.dumps(d)
for moi in ('AIza', 'sk-', 'Bearer '):
    if moi in raw:
        print("  ✗ NGUY HIỂM: /health đang lộ thứ giống khoá API (%r)" % moi)
        sys.exit(1)
print("  ✓ /health không lộ khoá API")
PY

# ── 4. CORS ───────────────────────────────────────────────────
step "4/5  CORS (frontend có được phép gọi backend không)"
if [ -z "$WEB" ] && [ -f "$PROD_ENV" ]; then
  hint "Không truyền địa chỉ frontend — bỏ qua. Thêm vào để kiểm tra:"
  hint "  ./scripts/check-deploy.sh $API https://<frontend>.vercel.app"
else
  WEB="${WEB%/}"
  ACAO="$(curl -fsS -m 20 -o /dev/null -D - \
      -H "Origin: $WEB" \
      -H "Access-Control-Request-Method: POST" \
      -X OPTIONS "$API/$PREFIX/health" 2>/dev/null \
      | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}' | tail -1)"

  if [ -z "$ACAO" ]; then
    err "Backend KHÔNG cho $WEB gọi vào (thiếu Access-Control-Allow-Origin)"
    hint "Vào Vercel → dự án backend → Settings → Environment Variables,"
    hint "đặt  CORS_ORIGINS = $WEB  rồi deploy lại. (BUG-10)"
    FAIL=1
  else
    ok "CORS cho phép: $ACAO"
  fi
fi

# ── 5. Frontend trỏ đúng backend chưa ─────────────────────────
step "5/5  Frontend trỏ vào đâu"
if [ -f "$PROD_ENV" ]; then
  TRO="$(env_get NEXT_PUBLIC_API_URL "$PROD_ENV" || echo '')"
  say "  frontend/.env.production:  ${C_DIM}$TRO${C_RESET}"
  case "$TRO" in
    "$API/$PREFIX"|"$API/$PREFIX/") ok "Khớp với backend đang kiểm tra" ;;
    *) warn "Không khớp — frontend đang gọi '$TRO' chứ không phải '$API/$PREFIX'"
       hint "Sửa trong Vercel → dự án frontend → Environment Variables (giá trị ở"
       hint "đó ĐÈ LÊN file .env.production), rồi deploy lại."
       FAIL=1 ;;
  esac
else
  hint "Không có frontend/.env.production — bỏ qua"
fi

say ""
if [ "$FAIL" -eq 0 ]; then
  ok "Bản trên Vercel sẵn sàng cho bạn bè dùng."
else
  err "Còn lỗi ở trên — sửa xong chạy lại script này."
  exit 1
fi
say ""

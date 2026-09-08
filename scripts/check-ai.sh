#!/usr/bin/env bash
#
# Kiểm tra nhà cung cấp AI đang cấu hình có chạy thật không.
#
#   ./scripts/check-ai.sh              Kiểm tra theo backend/.env
#   ./scripts/check-ai.sh --list       Liệt kê mọi model nhà cung cấp đang có
#
# Vì sao cần: tên model thay đổi liên tục (Gemini, Groq, Ollama đều vậy). Đoán
# tên model là cách nhanh nhất để gặp lỗi khó hiểu. Script này hỏi thẳng nhà
# cung cấp xem họ đang có model nào, rồi thử gọi thật một lần.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ROOT="$(repo_root)"
ENV_FILE="$ROOT/backend/.env"

LIST_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --list) LIST_ONLY=1 ;;
    -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Không hiểu tuỳ chọn: $arg" ;;
  esac
done

[ -f "$ENV_FILE" ] || die "Chưa có backend/.env"

BASE_URL="$(env_get OPENAI_BASE_URL "$ENV_FILE" || echo 'http://127.0.0.1:11434/v1')"
API_KEY="$(env_get OPENAI_API_KEY "$ENV_FILE" || echo 'ollama')"
MODEL="$(env_get OPENAI_MODEL "$ENV_FILE" || echo '')"
VISION="$(env_get OPENAI_VISION_MODEL "$ENV_FILE" || echo '')"
EMBED="$(env_get OPENAI_EMBEDDING_MODEL "$ENV_FILE" || echo '')"

BASE_URL="${BASE_URL%/}"

# Chốt chặn: nếu giá trị đọc ra còn dính dấu nháy, dấu # hay khoảng trắng thì
# KHÔNG phải model lạ — là env_get đọc sai file .env. Báo đúng bệnh, đừng bắt
# người dùng đi tìm tên model như sự cố 2026-09-08.
for _pair in "OPENAI_BASE_URL=$BASE_URL" "OPENAI_MODEL=$MODEL" \
             "OPENAI_VISION_MODEL=$VISION" "OPENAI_EMBEDDING_MODEL=$EMBED"; do
  _v="${_pair#*=}"
  [ -n "$_v" ] || continue
  case "$_v" in
    *'"'*|*"'"*|*'#'*|*' '*|*'	'*)
      err "Đọc sai backend/.env — biến ${_pair%%=*} ra: ${_v}"
      hint "Giá trị còn dính dấu nháy hoặc chú thích → lỗi ở hàm env_get trong"
      hint "scripts/lib.sh, KHÔNG phải lỗi tên model. Xem process.md 2026-09-08."
      exit 1 ;;
  esac
done
unset _pair _v

say ""
say "${C_BOLD}${C_CYAN}Kiểm tra nhà cung cấp AI${C_RESET}"
say ""
say "  Địa chỉ:    ${C_DIM}$BASE_URL${C_RESET}"
say "  Sinh chữ:   ${C_BOLD}$MODEL${C_RESET}"
say "  Đọc ảnh:    ${C_BOLD}$VISION${C_RESET}"
say "  Embedding:  ${C_BOLD}$EMBED${C_RESET}"
say ""

# ── 1. Có kết nối được không ──────────────────────────────────
step "1/4  Kết nối"
MODELS_JSON="$(curl -fsS -m 20 "$BASE_URL/models" -H "Authorization: Bearer $API_KEY" 2>/dev/null || true)"

if [ -z "$MODELS_JSON" ]; then
  err "Không gọi được $BASE_URL/models"
  hint "Ollama: app đã bật chưa?  Gemini/Groq: khoá API đúng chưa?"
  exit 1
fi
ok "Kết nối được"

# ── 2. Model đang cấu hình có tồn tại không ───────────────────
step "2/4  Kiểm tra tên model"

MODELS_JSON="$MODELS_JSON" MODEL="$MODEL" VISION="$VISION" EMBED="$EMBED" \
LIST_ONLY="$LIST_ONLY" python3 <<'PY'
import os, json, sys, difflib

try:
    data = json.loads(os.environ['MODELS_JSON'])
except Exception:
    print("  ! Nhà cung cấp trả về dữ liệu không đọc được — bỏ qua bước này")
    sys.exit(0)

names = []
for m in (data.get('data') or data.get('models') or []):
    n = m.get('id') or m.get('name') or ''
    # Gemini trả về dạng "models/gemini-..."; cắt tiền tố cho dễ so
    names.append(n.split('/')[-1] if '/' in n else n)
names = [n for n in names if n]

if os.environ.get('LIST_ONLY') == '1':
    print("  Nhà cung cấp đang có %d model:" % len(names))
    for n in sorted(names):
        print("    " + n)
    sys.exit(0)

missing = 0
for nhan, key in (('Sinh chữ', 'MODEL'), ('Đọc ảnh', 'VISION'), ('Embedding', 'EMBED')):
    want = os.environ.get(key, '').strip()
    if not want:
        continue
    if want in names:
        print("  ✓ %-10s %s" % (nhan + ':', want))
    else:
        missing += 1
        goi_y = difflib.get_close_matches(want, names, n=3, cutoff=0.4)
        print("  ✗ %-10s %s  — KHÔNG có ở nhà cung cấp này" % (nhan + ':', want))
        if goi_y:
            print("      Gần giống: %s" % ', '.join(goi_y))

if missing:
    print()
    print("  Xem toàn bộ model:  ./scripts/check-ai.sh --list")
PY

[ "$LIST_ONLY" -eq 1 ] && exit 0

# ── 3. Gọi thử thật, bắt trả JSON ─────────────────────────────
step "3/4  Gọi thử và bắt trả JSON"
[ -n "$MODEL" ] || die "OPENAI_MODEL đang trống"

REQ=$(cat <<JSON
{
  "model": "$MODEL",
  "messages": [
    {"role":"system","content":"Trả về JSON hợp lệ, không kèm gì khác."},
    {"role":"user","content":"Trả về đúng JSON này: {\\"ok\\": true, \\"vi\\": \\"xin chào\\"}"}
  ],
  "temperature": 0
}
JSON
)

RESP="$(curl -fsS -m 90 "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQ" 2>/dev/null || true)"

if [ -z "$RESP" ]; then
  err "Gọi thất bại"
  hint "Sai tên model, hết hạn mức, hoặc khoá API không hợp lệ."
  exit 1
fi

RESP="$RESP" python3 <<'PY'
import os, json, sys, re

try:
    data = json.loads(os.environ['RESP'])
except Exception:
    print("  ✗ Phản hồi không phải JSON"); sys.exit(1)

if 'error' in data:
    print("  ✗ Nhà cung cấp báo lỗi: %s" % str(data['error'])[:300]); sys.exit(1)

content = (data.get('choices') or [{}])[0].get('message', {}).get('content') or ''
if not content:
    print("  ✗ Trả về nội dung rỗng"); sys.exit(1)

print("  Model trả về: %s" % content.strip().replace('\n', ' ')[:120])

# Chạy đúng lớp sửa JSON mà backend dùng
cleaned = re.sub(r'<think>[\s\S]*?</think>', '', content)
fenced = re.search(r'```(?:json)?\s*([\s\S]*?)```', cleaned)
if fenced:
    cleaned = fenced.group(1)
block = re.search(r'\{[\s\S]*\}', cleaned)
if block:
    cleaned = block.group(0)

try:
    obj = json.loads(cleaned)
    print("  ✓ Đọc được JSON: %s" % obj)
    if 'vi' in obj and 'chào' in str(obj.get('vi', '')):
        print("  ✓ Tiếng Việt có dấu không bị vỡ")
except Exception:
    print("  ! Không parse thẳng được — nhưng backend có lớp sửa JSON nên vẫn chạy")

u = data.get('usage') or {}
if u:
    print("  Token dùng: %s" % u.get('total_tokens', '?'))
PY

ok "Gọi thử thành công"

# ── 4. Embedding ──────────────────────────────────────────────
step "4/4  Embedding (dùng cho tìm kiếm tài liệu)"
if [ -z "$EMBED" ]; then
  warn "Chưa cấu hình OPENAI_EMBEDDING_MODEL — bỏ qua"
else
  ERESP="$(curl -fsS -m 60 "$BASE_URL/embeddings" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$EMBED\",\"input\":\"kiến trúc sư thiết kế mặt bằng\"}" 2>/dev/null || true)"

  if [ -z "$ERESP" ]; then
    warn "Không gọi được embedding — tính năng tìm kiếm tài liệu sẽ chưa dùng được"
  else
    ERESP="$ERESP" python3 <<'PY'
import os, json
try:
    d = json.loads(os.environ['ERESP'])
    v = d['data'][0]['embedding']
    print("  ✓ Embedding chạy được — %d chiều" % len(v))
except Exception as e:
    print("  ! Phản hồi lạ: %s" % str(e)[:150])
PY
  fi
fi

say ""
ok "Xong. Nhà cung cấp AI sẵn sàng."
say ""

#!/usr/bin/env bash
#
# Nhập khoá API của nhà cung cấp AI vào backend/.env — an toàn.
#
#   ./scripts/set-ai-key.sh
#
# Vì sao cần script này: khoá API là mật khẩu. Dán nó vào khung chat, vào tin
# nhắn, hay gõ thẳng trong Terminal đều để lại dấu vết (lịch sử lệnh, log,
# lịch sử hội thoại). Script này nhận khoá bằng ô nhập KHÔNG hiện chữ, ghi
# thẳng vào backend/.env, và không in khoá ra màn hình lần nào.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ROOT="$(repo_root)"
ENV_FILE="$ROOT/backend/.env"
EXAMPLE="$ROOT/backend/.env.example"

case "${1:-}" in
  -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac

# ── Bảo đảm có file .env ──────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  [ -f "$EXAMPLE" ] || die "Không thấy backend/.env lẫn backend/.env.example"
  cp "$EXAMPLE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "Đã tạo backend/.env từ .env.example"
fi

# .env chứa mật khẩu — chỉ mình đọc được
chmod 600 "$ENV_FILE" 2>/dev/null || true

# ── Cảnh báo nếu đang trỏ vào Ollama ──────────────────────────
BASE_URL="$(env_get OPENAI_BASE_URL "$ENV_FILE" || echo '')"
say ""
say "${C_BOLD}${C_CYAN}Nhập khoá API cho nhà cung cấp AI${C_RESET}"
say ""
say "  Đang cấu hình:  ${C_DIM}${BASE_URL:-(chưa đặt)}${C_RESET}"
case "$BASE_URL" in
  *127.0.0.1*|*localhost*)
    warn "Địa chỉ đang là Ollama chạy trên máy — Ollama không cần khoá."
    hint "Nếu muốn dùng Gemini, mở backend/.env và đổi sang khối 'CÁCH A'."
    ;;
esac
say ""

# ── Nhận khoá, không hiện chữ ─────────────────────────────────
say "  Lấy khoá Gemini tại: ${C_BOLD}https://aistudio.google.com/apikey${C_RESET}"
say "  ${C_DIM}Dán vào ô dưới rồi Enter. Màn hình sẽ KHÔNG hiện gì — bình thường.${C_RESET}"
say ""
printf '  Khoá: '
IFS= read -rs KEY || true
printf '\n\n'

# bỏ khoảng trắng, xuống dòng, nháy thừa hai đầu (hay dính khi copy)
KEY="${KEY#"${KEY%%[![:space:]]*}"}"
KEY="${KEY%"${KEY##*[![:space:]]}"}"
KEY="${KEY%\"}"; KEY="${KEY#\"}"
KEY="${KEY%\'}"; KEY="${KEY#\'}"

[ -n "$KEY" ] || die "Không nhập gì cả — huỷ, file .env giữ nguyên."

# ── Kiểm tra hình dạng khoá (chỉ cảnh báo, không chặn) ────────
case "$BASE_URL" in
  *generativelanguage.googleapis.com*)
    case "$KEY" in
      AIza*) ;;
      *)
        warn "Khoá Gemini thường bắt đầu bằng 'AIza'. Chuỗi bạn dán thì không."
        hint "Có thể bạn đang dán nhầm mã đăng nhập (OAuth) thay vì khoá API."
        hint "Khoá API lấy ở https://aistudio.google.com/apikey — nút 'Create API key'."
        printf '  Vẫn muốn ghi? [y/N] '
        read -r YN
        case "$YN" in y|Y|yes|YES) ;; *) die "Đã huỷ, file .env giữ nguyên." ;; esac
        ;;
    esac
    ;;
esac

# ── Ghi vào .env (python để không vỡ với ký tự đặc biệt) ──────
KEY="$KEY" ENV_FILE="$ENV_FILE" python3 <<'PY'
import os, re, tempfile

path = os.environ['ENV_FILE']
key  = os.environ['KEY']

with open(path, 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

new_line = 'OPENAI_API_KEY="%s"' % key
found = False
out = []
for ln in lines:
    if re.match(r'^\s*OPENAI_API_KEY\s*=', ln):
        # chỉ thay dòng ĐANG DÙNG, không đụng dòng đã ghi chú (#)
        out.append(new_line)
        found = True
    else:
        out.append(ln)

if not found:
    out.append('')
    out.append(new_line)

# ghi qua file tạm cùng thư mục rồi đổi tên — mất điện giữa chừng
# cũng không làm hỏng .env đang có
d = os.path.dirname(path)
fd, tmp = tempfile.mkstemp(dir=d)
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out) + '\n')
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PY

# ── Xác nhận, có che ──────────────────────────────────────────
SAVED="$(env_get OPENAI_API_KEY "$ENV_FILE" || echo '')"
MASK="$(printf '%s' "$SAVED" | sed -E 's/^(.{4}).*(.{4})$/\1••••••••••••\2/')"
unset KEY

ok "Đã ghi vào backend/.env  ($MASK)"
say ""
hint "backend/.env đã nằm trong .gitignore — khoá không bị đẩy lên GitHub."
say ""
step "Bước tiếp theo"
say "  ./scripts/check-ai.sh    ${C_DIM}# kiểm tra khoá chạy được và tên model có đúng không${C_RESET}"
say ""

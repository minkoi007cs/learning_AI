#!/usr/bin/env bash
#
# Cài đặt lần đầu cho AI Study OS trên macOS.
# Chạy MỘT LẦN duy nhất:   ./scripts/setup-mac.sh
# Sau đó dùng hằng ngày:   ./scripts/start.sh
#
# Script này KHÔNG xoá gì và KHÔNG ghi đè file .env đã có.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ROOT="$(repo_root)"
cd "$ROOT"

# Model cần có. Xem tech.md §4.5 để biết vì sao chọn đúng 3 model này.
MODEL_TEXT="qwen3:8b"
MODEL_VISION="qwen2.5vl:7b"
MODEL_EMBED="bge-m3"

say ""
say "${C_BOLD}${C_CYAN}AI Study OS — cài đặt lần đầu${C_RESET}"
say "${C_DIM}Máy đích: macOS (Apple Silicon). Toàn bộ AI chạy local, không tốn tiền API.${C_RESET}"

# ══════════════════════════════════════════════════════════════
step "1/6  Kiểm tra công cụ cơ bản"

[ "$(uname -s)" = "Darwin" ] || warn "Script này viết cho macOS. Trên hệ khác có thể cần chỉnh tay."

if have node; then
  NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$NODE_MAJOR" -ge 20 ]; then
    ok "Node.js $(node -v)"
  else
    die "Node.js quá cũ ($(node -v)). Cần từ v20 trở lên. Cài bằng: brew install node"
  fi
else
  die "Chưa có Node.js. Cài bằng: brew install node"
fi

have npm || die "Chưa có npm (thường đi kèm Node.js)."
ok "npm $(npm -v)"

if have ollama; then
  ok "Ollama đã cài"
else
  die "Chưa có Ollama. Tải tại https://ollama.com hoặc chạy: brew install ollama"
fi

if have cloudflared; then
  ok "cloudflared đã cài (dùng để mở cho bạn bè truy cập)"
else
  warn "Chưa có cloudflared — bạn bè sẽ chưa truy cập được từ xa"
  hint "Cài sau bằng: brew install cloudflared"
  hint "Không có cũng không sao, bạn vẫn dùng được một mình ở localhost"
fi

# ══════════════════════════════════════════════════════════════
step "2/6  Kiểm tra Ollama đang chạy"

if ollama_up; then
  ok "Ollama đang chạy ở cổng 11434"
else
  warn "Ollama chưa chạy — đang thử khởi động..."
  # Trên macOS Ollama thường là app trên thanh menu.
  open -a Ollama >/dev/null 2>&1 || nohup ollama serve >/dev/null 2>&1 &
  if wait_for_url "http://127.0.0.1:11434/api/tags" 30; then
    ok "Ollama đã lên"
  else
    die "Không khởi động được Ollama. Hãy mở app Ollama thủ công rồi chạy lại script này."
  fi
fi

# ══════════════════════════════════════════════════════════════
step "3/6  Tải model AI (khoảng 12 GB, tải một lần)"

MISSING=()
for m in "$MODEL_TEXT" "$MODEL_VISION" "$MODEL_EMBED"; do
  if ollama_has_model "$m"; then
    ok "$m — đã có"
  else
    MISSING+=("$m")
  fi
done

if [ "${#MISSING[@]}" -eq 0 ]; then
  ok "Đủ cả 3 model"
else
  say ""
  say "Cần tải ${#MISSING[@]} model: ${MISSING[*]}"
  hint "Tuỳ tốc độ mạng, có thể mất 15–40 phút. Cứ để chạy nền."
  say ""
  for m in "${MISSING[@]}"; do
    say "${C_BOLD}→ Đang tải $m${C_RESET}"
    if ollama pull "$m"; then
      ok "$m xong"
    else
      err "Tải $m thất bại"
      hint "Thử lại thủ công: ollama pull $m"
    fi
  done
fi

# ══════════════════════════════════════════════════════════════
step "4/6  Cấu hình Ollama cho máy 24GB"

# Trên macOS, Ollama chạy như một app GUI nên KHÔNG đọc ~/.zshrc.
# Cách đúng để đặt biến môi trường cho nó là launchctl setenv.
launchctl setenv OLLAMA_MAX_LOADED_MODELS 2 2>/dev/null \
  && ok "OLLAMA_MAX_LOADED_MODELS=2 (không giữ quá 2 model trong RAM cùng lúc)" \
  || warn "Không đặt được OLLAMA_MAX_LOADED_MODELS"

launchctl setenv OLLAMA_KEEP_ALIVE 15m 2>/dev/null \
  && ok "OLLAMA_KEEP_ALIVE=15m (khỏi nạp lại model liên tục giữa các bước)" \
  || warn "Không đặt được OLLAMA_KEEP_ALIVE"

hint "Hai biến trên chỉ có hiệu lực sau khi khởi động lại app Ollama."
hint "Chúng cũng mất khi bạn khởi động lại máy — chạy lại script này là có lại."

# ══════════════════════════════════════════════════════════════
step "5/6  Chuẩn bị file cấu hình backend"

ENV_FILE="$ROOT/backend/.env"
if [ -f "$ENV_FILE" ]; then
  ok "backend/.env đã có — giữ nguyên, không ghi đè"
else
  cp "$ROOT/backend/.env.example" "$ENV_FILE"
  ok "Đã tạo backend/.env từ mẫu"
  warn "PHẢI điền 3 giá trị này trước khi chạy được:"
  hint "DATABASE_URL  — chuỗi kết nối Supabase (cổng 6543)"
  hint "DIRECT_URL    — chuỗi kết nối Supabase (cổng 5432)"
  hint "JWT_SECRET    — một chuỗi ngẫu nhiên dài, ví dụ tạo bằng lệnh dưới"
  say ""
  say "  ${C_DIM}Tạo JWT_SECRET ngẫu nhiên:${C_RESET}"
  say "  openssl rand -base64 48"
fi

# Cảnh báo nếu người dùng vẫn để nguyên giá trị mẫu
for key in DATABASE_URL JWT_SECRET; do
  val="$(env_get "$key" "$ENV_FILE" || true)"
  case "$val" in
    *xxxx*|*doi-thanh-mot-chuoi*|"")
      warn "$key trong backend/.env vẫn là giá trị mẫu — nhớ sửa"
      ;;
  esac
done

# ══════════════════════════════════════════════════════════════
step "6/6  Cài thư viện và chuẩn bị cơ sở dữ liệu"

say "Backend..."
(cd "$ROOT/backend" && npm install --silent) && ok "Đã cài thư viện backend"
(cd "$ROOT/backend" && npx prisma generate >/dev/null 2>&1) && ok "Đã sinh Prisma client"

DB_URL="$(env_get DATABASE_URL "$ENV_FILE" || true)"
case "$DB_URL" in
  ""|*xxxx*)
    warn "Bỏ qua bước cập nhật cấu trúc database — DATABASE_URL chưa điền"
    hint "Điền xong thì chạy: cd backend && npx prisma migrate deploy"
    ;;
  *)
    say "Cập nhật cấu trúc database..."
    if (cd "$ROOT/backend" && npx prisma migrate deploy); then
      ok "Database đã đúng cấu trúc mới nhất"
    else
      warn "Cập nhật database thất bại — kiểm tra lại DATABASE_URL và DIRECT_URL"
    fi
    ;;
esac

say ""
say "Frontend..."
(cd "$ROOT/frontend" && npm install --silent) && ok "Đã cài thư viện frontend"

FE_ENV="$ROOT/frontend/.env.local"
if [ -f "$FE_ENV" ]; then
  ok "frontend/.env.local đã có"
else
  printf 'NEXT_PUBLIC_API_URL=http://localhost:3001/v1\n' > "$FE_ENV"
  ok "Đã tạo frontend/.env.local trỏ về backend ở máy"
fi

# ══════════════════════════════════════════════════════════════
say ""
say "${C_BOLD}${C_GREEN}Cài đặt xong.${C_RESET}"
say ""
say "Từ giờ mỗi lần muốn dùng, chỉ cần một lệnh:"
say "  ${C_BOLD}./scripts/start.sh${C_RESET}"
say ""
say "Muốn mở cho bạn bè truy cập từ xa:"
say "  ${C_BOLD}./scripts/start.sh --share${C_RESET}"
say ""

#!/usr/bin/env bash
# Hàm dùng chung cho setup-mac.sh và start.sh.
# Không chạy trực tiếp file này.

# ── Màu sắc (tự tắt khi output không phải terminal, ví dụ khi ghi ra file log)
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m';  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'; C_CYAN=$'\033[36m'
else
  C_RESET=''; C_BOLD=''; C_DIM=''
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_CYAN=''
fi

say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
step() { printf '\n%s%s%s\n' "$C_BOLD$C_BLUE" "$*" "$C_RESET"; }
hint() { printf '%s  %s%s\n' "$C_DIM" "$*" "$C_RESET"; }

die() { err "$*"; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# Thư mục gốc của repo, suy ra từ vị trí script (không phụ thuộc chỗ gọi lệnh).
repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

# Đọc một biến từ file .env mà không cần source cả file
# (source dễ vỡ vì .env có dấu ngoặc kép, dấu & trong chuỗi kết nối...).
#
# ⚠️ BẪY ĐÃ CẮN MỘT LẦN (2026-09-08): bản cũ chỉ cắt dấu nháy ở hai đầu, nên
# dòng   OPENAI_MODEL="qwen3:8b"   # chú thích
# bị đọc thành   qwen3:8b"   # chú thích   → check-ai.sh báo "model không tồn
# tại" trong khi model có thật. Phải cắt CẢ phần chú thích. Xem process.md.
#
# Quy tắc: giá trị trong nháy → lấy đúng phần trong nháy (dấu # bên trong là
# một phần của mật khẩu, không phải chú thích). Giá trị trần → cắt từ chỗ
# "khoảng trắng + #" trở đi.
env_get() {
  local key="$1" file="$2"
  [ -f "$file" ] || return 1
  local line
  line=$(grep -E "^[[:space:]]*${key}=" "$file" | tail -1) || return 1
  [ -n "$line" ] || return 1
  line="${line#*=}"
  # bỏ khoảng trắng ở đầu
  line="${line#"${line%%[![:space:]]*}"}"
  case "$line" in
    '"'*)
      line="${line#\"}"; line="${line%%\"*}" ;;
    "'"*)
      line="${line#\'}"; line="${line%%\'*}" ;;
    *)
      # giá trị không có nháy: cắt chú thích, rồi cắt khoảng trắng cuối
      line="${line%%[[:space:]]#*}"
      line="${line%"${line##*[![:space:]]}"}" ;;
  esac
  printf '%s' "$line"
}

# Cổng nào đang có tiến trình nghe?
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# Ollama có đang chạy và trả lời không?
ollama_up() {
  curl -fsS -m 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1
}

# Liệt kê tên model Ollama đang có, mỗi dòng một tên.
ollama_models() {
  curl -fsS -m 5 http://127.0.0.1:11434/api/tags 2>/dev/null \
    | grep -oE '"name"[[:space:]]*:[[:space:]]*"[^"]+"' \
    | sed -E 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

# Model đã tải chưa?
#
# So khớp bằng chuỗi thuần (không phải regex) vì tên model có dấu chấm —
# "qwen2.5vl:7b" nếu đem làm regex thì dấu chấm khớp mọi ký tự.
#
# Ngoài ra Ollama tự thêm tag ":latest" khi người dùng pull không kèm tag:
# `ollama pull bge-m3` cho ra model tên "bge-m3:latest". Nếu chỉ so khớp
# chính xác thì script sẽ báo thiếu model vĩnh viễn dù đã cài đúng.
ollama_has_model() {
  local want="$1" line
  while IFS= read -r line; do
    [ "$line" = "$want" ] && return 0
    case "$want" in
      *:*) : ;;                                   # đã có tag, không đoán thêm
      *)   [ "$line" = "${want}:latest" ] && return 0 ;;
    esac
  done < <(ollama_models)
  return 1
}

# Đợi một URL trả về 2xx, tối đa N giây.
wait_for_url() {
  local url="$1" timeout="${2:-60}" i=0
  while [ "$i" -lt "$timeout" ]; do
    if curl -fsS -m 3 "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

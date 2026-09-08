#!/usr/bin/env bash
#
# Nối backend với database Supabase.
#
#   ./scripts/set-db.sh          Chỉ cần nhập mật khẩu, script tự dựng chuỗi
#   ./scripts/set-db.sh --full   Tự dán trọn 2 chuỗi kết nối (khi đổi project)
#
# Mật khẩu bạn gõ KHÔNG hiện ra màn hình, KHÔNG vào lịch sử lệnh, và chỉ được
# ghi vào backend/.env trên máy bạn.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ROOT="$(repo_root)"
ENV_FILE="$ROOT/backend/.env"

# Hai giá trị này KHÔNG phải bí mật — chúng nằm công khai trong địa chỉ project.
# Đổi ở đây nếu bạn chuyển sang project Supabase khác.
PROJECT_REF="ltyvalyxgsnmbllloghk"
REGION="aws-0-us-east-2"

MODE="simple"
for arg in "$@"; do
  case "$arg" in
    --full) MODE="full" ;;
    -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Không hiểu tuỳ chọn: $arg" ;;
  esac
done

[ -f "$ENV_FILE" ] || die "Chưa có backend/.env — chạy ./scripts/setup-mac.sh trước."

say ""
say "${C_BOLD}${C_CYAN}Nối với database Supabase${C_RESET}"
say ""

if [ "$MODE" = "simple" ]; then
  say "Project:  ${C_BOLD}$PROJECT_REF${C_RESET}   Khu vực: ${C_BOLD}$REGION${C_RESET}"
  say ""
  say "${C_YELLOW}Nếu bạn vừa đổi mật khẩu database, dùng mật khẩu MỚI.${C_RESET}"
  say "${C_DIM}Gõ xong bấm Enter. Màn hình không hiện gì là bình thường.${C_RESET}"
  say ""

  read -r -s -p "Mật khẩu database: " DB_PASS; echo
  [ -n "$DB_PASS" ] || die "Bạn chưa nhập gì."

  # Script tự mã hoá ký tự đặc biệt, nên mật khẩu có @ / : ? # % vẫn chạy đúng.
  DB_PASS="$DB_PASS" PROJECT_REF="$PROJECT_REF" REGION="$REGION" ENV_FILE="$ENV_FILE" \
  python3 <<'PY'
import os, re
from urllib.parse import quote

pw   = quote(os.environ['DB_PASS'], safe='')   # mã hoá @ / : ? # % ...
ref  = os.environ['PROJECT_REF']
reg  = os.environ['REGION']
path = os.environ['ENV_FILE']

host   = '%s.pooler.supabase.com' % reg
base   = 'postgresql://postgres.%s:%s@%s' % (ref, pw, host)
pooled = base + ':6543/postgres?pgbouncer=true&connection_limit=1'
direct = base + ':5432/postgres'

def put(text, key, value):
    line = '%s="%s"' % (key, value)
    if re.search(r'^%s=' % key, text, flags=re.M):
        return re.sub(r'^%s=.*$' % key, lambda _: line, text, count=1, flags=re.M)
    return text.rstrip('\n') + '\n' + line + '\n'

with open(path, encoding='utf-8') as f:
    s = f.read()
s = put(s, 'DATABASE_URL', pooled)
s = put(s, 'DIRECT_URL', direct)
with open(path, 'w', encoding='utf-8') as f:
    f.write(s)

mask = lambda u: re.sub(r'://[^@]+@', '://****:****@', u)
print("  DATABASE_URL  %s" % mask(pooled))
print("  DIRECT_URL    %s" % mask(direct))
PY

  unset DB_PASS
  ok "Đã dựng và lưu 2 chuỗi kết nối"

else
  say "Dán trọn 2 chuỗi lấy từ Supabase → nút ${C_BOLD}Connect${C_RESET} ở đầu trang."
  say "${C_DIM}Màn hình không hiện gì khi dán — bình thường.${C_RESET}"
  say ""

  read -r -s -p "1) Chuỗi Transaction pooler (cổng 6543): " POOLED; echo
  read -r -s -p "2) Chuỗi Session pooler (cổng 5432):     " DIRECT; echo

  kiem_tra() {
    local val="$1" nhan="$2" cong="$3"
    [ -n "$val" ] || die "$nhan: bạn chưa dán gì."
    case "$val" in
      postgres://*|postgresql://*) : ;;
      *) die "$nhan: phải bắt đầu bằng postgresql://" ;;
    esac
    case "$val" in
      *"[YOUR-PASSWORD]"*|*"[your-password]"*)
        die "$nhan: bạn chưa thay [YOUR-PASSWORD] bằng mật khẩu thật." ;;
    esac
    case "$val" in
      *":$cong"*) ok "$nhan: đúng cổng $cong" ;;
      *) warn "$nhan: không thấy cổng $cong — có thể copy nhầm tab" ;;
    esac
    local so_at
    so_at=$(printf '%s' "$val" | tr -cd '@' | wc -c | tr -d ' ')
    if [ "$so_at" -gt 1 ]; then
      warn "$nhan: có $so_at dấu @ — mật khẩu chứa ký tự đặc biệt chưa mã hoá"
      hint "Chạy lại KHÔNG kèm --full, script sẽ tự mã hoá giúp bạn."
    fi
  }

  kiem_tra "$POOLED" "Chuỗi Transaction" 6543
  kiem_tra "$DIRECT" "Chuỗi Session" 5432

  case "$POOLED" in
    *pgbouncer=true*) : ;;
    *"?"*) POOLED="${POOLED}&pgbouncer=true&connection_limit=1" ;;
    *)     POOLED="${POOLED}?pgbouncer=true&connection_limit=1" ;;
  esac

  POOLED="$POOLED" DIRECT="$DIRECT" ENV_FILE="$ENV_FILE" python3 <<'PY'
import os, re
path = os.environ['ENV_FILE']
def put(text, key, value):
    line = '%s="%s"' % (key, value)
    if re.search(r'^%s=' % key, text, flags=re.M):
        return re.sub(r'^%s=.*$' % key, lambda _: line, text, count=1, flags=re.M)
    return text.rstrip('\n') + '\n' + line + '\n'
with open(path, encoding='utf-8') as f:
    s = f.read()
s = put(s, 'DATABASE_URL', os.environ['POOLED'])
s = put(s, 'DIRECT_URL',  os.environ['DIRECT'])
with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
PY

  unset POOLED DIRECT
  ok "Đã lưu 2 chuỗi kết nối"
fi

# ── Thử kết nối và cập nhật cấu trúc ──────────────────────────
say ""
step "Thử kết nối database"
if (cd "$ROOT/backend" && npx prisma migrate deploy); then
  say ""
  ok "Kết nối được, database đã đúng cấu trúc mới nhất"
  say ""
  say "Giờ chạy:  ${C_BOLD}./scripts/start.sh${C_RESET}"
else
  say ""
  err "Không kết nối được"
  hint "Sai mật khẩu → chạy lại script này"
  hint "Lỗi 'Tenant or user not found' → sai khu vực; sửa REGION ở đầu script này"
  hint "Project Supabase đang tạm dừng → vào dashboard bấm Restore"
  exit 1
fi

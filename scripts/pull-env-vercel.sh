#!/usr/bin/env bash
#
# Kéo chuỗi kết nối database từ Vercel về backend/.env.
#
#   ./scripts/pull-env-vercel.sh
#
# Vì sao dùng cách này: Vercel không cho xem giá trị của biến môi trường trên
# giao diện web, nhưng CLI thì tải về được. Giá trị đi thẳng từ Vercel vào file
# .env trên máy bạn — không hiện ra màn hình, không qua chat, không ai đọc.
#
# Script chỉ in ra dạng đã che: mật khẩu luôn bị thay bằng ****.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ROOT="$(repo_root)"
ENV_FILE="$ROOT/backend/.env"
TMP_ENV="$ROOT/backend/.vercel-pull.env"

VERCEL_PROJECT="learning-ai-7i4c"
VERCEL_SCOPE="minkoi007cs-projects"

[ -f "$ENV_FILE" ] || die "Chưa có backend/.env — chạy ./scripts/setup-mac.sh trước."

cleanup() { rm -f "$TMP_ENV"; }
trap cleanup EXIT INT TERM

say ""
say "${C_BOLD}${C_CYAN}Lấy cấu hình database từ Vercel${C_RESET}"
say ""
hint "Lần đầu chạy, Vercel sẽ mở trình duyệt để bạn đăng nhập. Cứ làm theo."
say ""

cd "$ROOT/backend"

# ── Nối thư mục này với dự án trên Vercel ─────────────────────
if [ -f "$ROOT/backend/.vercel/project.json" ]; then
  ok "Đã nối sẵn với dự án Vercel"
else
  step "Nối với dự án $VERCEL_PROJECT"
  npx --yes vercel@latest link \
    --yes \
    --project "$VERCEL_PROJECT" \
    --scope "$VERCEL_SCOPE" \
    || die "Nối thất bại. Kiểm tra bạn đã đăng nhập đúng tài khoản Vercel chưa."
  ok "Đã nối"
fi

# ── Tải biến môi trường bản production ────────────────────────
step "Tải biến môi trường"
npx --yes vercel@latest env pull "$TMP_ENV" \
  --environment=production \
  --scope "$VERCEL_SCOPE" \
  --yes \
  || die "Tải thất bại. Có thể biến được đánh dấu Sensitive — xem phần cuối script."

[ -s "$TMP_ENV" ] || die "File tải về rỗng."
ok "Đã tải $(grep -cE '^[A-Z_]+=' "$TMP_ENV" || echo 0) biến"

# ── Chép 2 chuỗi cần thiết sang backend/.env ──────────────────
# Toàn bộ việc này làm trong Python: đọc file này, ghi file kia. Giá trị không
# bao giờ đi qua màn hình hay biến shell.
step "Chép chuỗi kết nối sang backend/.env"

copy_ok=1
if ! TMP_ENV="$TMP_ENV" ENV_FILE="$ENV_FILE" python3 <<'PY'
import os, re, sys

src_path = os.environ['TMP_ENV']
dst_path = os.environ['ENV_FILE']

def load(path):
    out = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
                v = v[1:-1]
            out[k.strip()] = v
    return out

src = load(src_path)

# Vercel đặt tên biến khác nhau tuỳ cách tạo database.
# Thứ tự trong mỗi danh sách = thứ tự ưu tiên.
POOLED_KEYS = ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL']
DIRECT_KEYS = ['DIRECT_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL']

def pick(keys):
    for k in keys:
        v = src.get(k)
        if v and v.startswith(('postgres://', 'postgresql://')):
            return k, v
    return None, None

pooled_key, pooled = pick(POOLED_KEYS)
direct_key, direct = pick(DIRECT_KEYS)

if not pooled:
    print("  ✗ Không tìm thấy chuỗi kết nối nào trong biến của Vercel.")
    print("    Các biến có sẵn:", ', '.join(sorted(src.keys())) or '(không có)')
    sys.exit(2)

# Nếu chỉ có một chuỗi, suy ra chuỗi kia bằng cách đổi cổng.
if not direct or direct == pooled:
    direct = pooled.replace(':6543', ':5432')
    direct = re.sub(r'[?&]pgbouncer=true', '', direct)
    direct = re.sub(r'[?&]connection_limit=\d+', '', direct)
    direct = direct.replace('?&', '?').rstrip('?&')
    direct_key = '(suy ra từ %s bằng cách đổi cổng)' % pooled_key

# Chuỗi pooled bắt buộc có 2 tham số này, nếu thiếu Prisma sẽ lỗi.
if 'pgbouncer=true' not in pooled:
    pooled += ('&' if '?' in pooled else '?') + 'pgbouncer=true&connection_limit=1'

def mask(url):
    """Che tên đăng nhập và mật khẩu, giữ lại máy chủ và cổng để còn kiểm tra."""
    return re.sub(r'://[^@]+@', '://****:****@', url)

def put(text, key, value):
    line = '%s="%s"' % (key, value)
    if re.search(r'^%s=' % key, text, flags=re.M):
        return re.sub(r'^%s=.*$' % key, lambda _: line, text, count=1, flags=re.M)
    return text.rstrip('\n') + '\n' + line + '\n'

with open(dst_path, encoding='utf-8') as f:
    dst = f.read()

dst = put(dst, 'DATABASE_URL', pooled)
dst = put(dst, 'DIRECT_URL', direct)

with open(dst_path, 'w', encoding='utf-8') as f:
    f.write(dst)

print("  DATABASE_URL  ← %s" % pooled_key)
print("                  %s" % mask(pooled))
print("  DIRECT_URL    ← %s" % direct_key)
print("                  %s" % mask(direct))
PY
then
  copy_ok=0
fi

if [ "$copy_ok" -ne 1 ]; then
  say ""
  err "Không lấy được chuỗi kết nối từ Vercel"
  hint "Biến có thể được đánh dấu Sensitive nên CLI cũng không đọc được."
  hint "Khi đó dùng cách nhập tay: ./scripts/set-db.sh"
  exit 1
fi

ok "Đã ghi vào backend/.env"

say ""
say "${C_BOLD}Kiểm tra kết nối và cập nhật cấu trúc database${C_RESET}"
say "Chỉ ${C_BOLD}THÊM${C_RESET} 2 cột vào bảng quizzes. Không xoá, không sửa dữ liệu."
say ""
printf "Chạy luôn? [y/N] "
read -r answer

case "$answer" in
  [yY]*)
    say ""
    if (cd "$ROOT/backend" && npx prisma migrate deploy); then
      say ""
      ok "Database đã sẵn sàng"
      say ""
      say "Giờ chạy:  ${C_BOLD}./scripts/start.sh${C_RESET}"
    else
      say ""
      err "Không kết nối được database"
      hint "Nếu lỗi nói về mật khẩu: mật khẩu trên Vercel có thể đã cũ."
      hint "Vào Supabase đặt lại mật khẩu (chỉ chữ và số), rồi: ./scripts/set-db.sh"
      exit 1
    fi
    ;;
  *)
    hint "Bỏ qua. Khi nào muốn: cd backend && npx prisma migrate deploy"
    ;;
esac

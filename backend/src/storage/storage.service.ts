import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Kho ảnh cho study guide — dùng Supabase Storage.
 *
 * VÌ SAO KHÔNG NHÉT ẢNH VÀO DATABASE: một bài giảng có thể kèm hơn hai chục
 * hình; nhét base64 vào Postgres thì mỗi bản tóm tắt nặng vài MB, truy vấn
 * chậm dần và gói miễn phí Supabase (500MB database) hết rất nhanh. Kho ảnh
 * riêng có 1GB miễn phí và trả ảnh qua CDN.
 *
 * VÌ SAO GỌI THẲNG REST THAY VÌ DÙNG SDK: chỉ cần đúng hai việc (tạo kho,
 * tải ảnh lên) nên thêm @supabase/supabase-js là phí ~200KB gói deploy và
 * thêm một thứ phải nâng cấp. `fetch` có sẵn trong Node 22.
 *
 * CHƯA CẤU HÌNH THÌ SAO: mọi hàm trả về null và ghi log cảnh báo — bài tóm
 * tắt vẫn chạy bình thường, chỉ là không có hình. Không bao giờ được để
 * thiếu cấu hình ảnh làm hỏng cả việc học.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly baseUrl: string | null;
  private readonly serviceKey: string;
  private readonly bucket: string;
  private bucketReady = false;

  constructor(private readonly configService: ConfigService) {
    this.serviceKey = (
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || ''
    ).trim();
    this.bucket =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET')?.trim() ||
      'slide-figures';
    this.baseUrl = this.resolveBaseUrl();

    if (this.isConfigured()) {
      this.logger.log(`Kho ảnh: ${this.baseUrl}/storage/v1 (bucket ${this.bucket})`);
    } else {
      this.logger.warn(
        'Chưa cấu hình kho ảnh (SUPABASE_SERVICE_ROLE_KEY) — study guide sẽ không kèm hình.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.serviceKey);
  }

  /**
   * Tải một hình lên kho và trả về URL công khai. Lỗi thì trả null (đã ghi
   * log) để phía gọi cứ tiếp tục phần chữ.
   */
  async uploadFigure(
    path: string,
    buffer: Buffer,
    mime: string,
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;

    try {
      await this.ensureBucket();

      const res = await this.request(
        `/storage/v1/object/${this.bucket}/${path}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': mime,
            'x-upsert': 'true',
            'cache-control': 'public, max-age=31536000, immutable',
          },
          body: new Uint8Array(buffer),
        },
      );

      if (!res.ok) {
        this.logger.warn(
          `Tải ảnh lên thất bại (${res.status}): ${(await res.text()).slice(0, 200)}`,
        );
        return null;
      }

      return `${this.baseUrl}/storage/v1/object/public/${this.bucket}/${path}`;
    } catch (error) {
      this.logger.warn(`Tải ảnh lên lỗi: ${(error as Error).message}`);
      return null;
    }
  }

  /** Xoá toàn bộ ảnh của một bản tóm tắt (khi người dùng xoá bản tóm tắt đó). */
  async removeFolder(prefix: string): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const list = await this.request(`/storage/v1/object/list/${this.bucket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, limit: 100 }),
      });
      if (!list.ok) return;

      const items = (await list.json()) as Array<{ name: string }>;
      if (!Array.isArray(items) || items.length === 0) return;

      await this.request(`/storage/v1/object/${this.bucket}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefixes: items.map((i) => `${prefix}/${i.name}`),
        }),
      });
    } catch (error) {
      // Ảnh mồ côi chỉ tốn dung lượng, không đáng để làm hỏng thao tác xoá.
      this.logger.warn(`Không dọn được ảnh cũ: ${(error as Error).message}`);
    }
  }

  /**
   * Tạo bucket nếu chưa có, đặt chế độ công khai để <img src> đọc thẳng được.
   * Chỉ chạy một lần cho mỗi tiến trình.
   */
  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;

    const check = await this.request(`/storage/v1/bucket/${this.bucket}`, {
      method: 'GET',
    });
    if (check.ok) {
      this.bucketReady = true;
      return;
    }

    const created = await this.request('/storage/v1/bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: this.bucket,
        name: this.bucket,
        public: true,
        file_size_limit: 5 * 1024 * 1024,
        allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'],
      }),
    });

    // 409 = đã có sẵn (hai lượt gọi song song cùng tạo) — vẫn coi là xong.
    if (created.ok || created.status === 409) {
      this.bucketReady = true;
      this.logger.log(`Kho ảnh "${this.bucket}" sẵn sàng`);
      return;
    }

    throw new Error(
      `Không tạo được kho ảnh (${created.status}): ${(await created.text()).slice(0, 200)}`,
    );
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
        ...(init.headers as Record<string, string>),
      },
      signal: AbortSignal.timeout(20000),
    });
  }

  /**
   * Địa chỉ dự án Supabase. Ưu tiên SUPABASE_URL nếu có; nếu không thì suy ra
   * từ DATABASE_URL — chuỗi kết nối Supabase luôn chứa mã dự án (dạng
   * `postgres.<ref>` ở tên đăng nhập, hoặc `db.<ref>.supabase.co` ở máy chủ).
   * Nhờ vậy người dùng chỉ phải dán thêm ĐÚNG MỘT biến môi trường là khoá.
   */
  private resolveBaseUrl(): string | null {
    const explicit = this.configService.get<string>('SUPABASE_URL')?.trim();
    if (explicit) return explicit.replace(/\/$/, '');

    const dbUrl =
      this.configService.get<string>('DATABASE_URL') ||
      this.configService.get<string>('DIRECT_URL') ||
      '';

    const fromUser = /postgres\.([a-z0-9]{16,})/i.exec(dbUrl);
    if (fromUser) return `https://${fromUser[1]}.supabase.co`;

    const fromHost = /@db\.([a-z0-9]{16,})\.supabase\.co/i.exec(dbUrl);
    if (fromHost) return `https://${fromHost[1]}.supabase.co`;

    return null;
  }
}

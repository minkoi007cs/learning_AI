import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';

/**
 * `getProviderInfo()` phục vụ endpoint CÔNG KHAI `/v1/health`.
 *
 * Hai điều phải luôn đúng:
 *  1. Nhận đúng "đang chạy Qwen trên máy" hay "đang chạy Gemini" — vì cùng
 *     một mã nguồn chạy ở hai nơi, nhìn nhầm là mất cả buổi gỡ lỗi.
 *  2. KHÔNG rò rỉ khoá API ra endpoint công khai.
 */
describe('AIService.getProviderInfo', () => {
  function make(env: Record<string, string>): AIService {
    const config = {
      get: (key: string, fallback?: string) => env[key] ?? fallback,
    } as unknown as ConfigService;
    const service = new AIService(config);
    service.onModuleInit();
    return service;
  }

  const KHOA_BI_MAT = 'AIzaSyKHOA-BI-MAT-KHONG-DUOC-LO-RA-NGOAI';

  it('nhận ra Ollama chạy trên máy (127.0.0.1)', () => {
    const info = make({
      OPENAI_BASE_URL: 'http://127.0.0.1:11434/v1',
      OPENAI_MODEL: 'qwen3:8b',
    }).getProviderInfo();

    expect(info.kind).toBe('local');
    expect(info.label).toContain('máy bạn');
    expect(info.model).toBe('qwen3:8b');
  });

  it('nhận ra cả dạng localhost và [::1]', () => {
    expect(
      make({ OPENAI_BASE_URL: 'http://localhost:11434/v1' }).getProviderInfo()
        .kind,
    ).toBe('local');
    expect(
      make({ OPENAI_BASE_URL: 'http://[::1]:11434/v1' }).getProviderInfo().kind,
    ).toBe('local');
  });

  it('nhận ra Gemini', () => {
    const info = make({
      OPENAI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      OPENAI_MODEL: 'gemini-2.5-flash',
    }).getProviderInfo();

    expect(info.kind).toBe('gemini');
    expect(info.label).toContain('Gemini');
    expect(info.model).toBe('gemini-2.5-flash');
  });

  it('nhà cung cấp lạ thì báo "other", không đoán bừa', () => {
    expect(
      make({ OPENAI_BASE_URL: 'https://api.groq.com/openai/v1' })
        .getProviderInfo().kind,
    ).toBe('other');
  });

  it('KHÔNG được coi tên miền có chữ "localhost" ở giữa là máy nhà', () => {
    // Bẫy: kẻ xấu đăng ký tên miền kiểu localhost.evil.com
    expect(
      make({ OPENAI_BASE_URL: 'https://localhost.evil.com/v1' })
        .getProviderInfo().kind,
    ).toBe('other');
    expect(
      make({ OPENAI_BASE_URL: 'https://not-127.0.0.1.evil.com/v1' })
        .getProviderInfo().kind,
    ).toBe('other');
  });

  it('KHÔNG rò rỉ khoá API ra ngoài', () => {
    const info = make({
      OPENAI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      OPENAI_API_KEY: KHOA_BI_MAT,
      OPENAI_MODEL: 'gemini-2.5-flash',
    }).getProviderInfo();

    const duoiDangChu = JSON.stringify(info);
    expect(duoiDangChu).not.toContain(KHOA_BI_MAT);
    // kể cả một mẩu của khoá cũng không được lọt ra
    expect(duoiDangChu).not.toContain('AIzaSy');
    expect(Object.keys(info).sort()).toEqual([
      'embeddingModel',
      'kind',
      'label',
      'model',
      'visionModel',
    ]);
  });
});

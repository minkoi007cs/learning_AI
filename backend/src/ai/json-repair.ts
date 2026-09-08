/**
 * Trích và sửa JSON từ đầu ra của model ngôn ngữ.
 *
 * Vì sao cần file này (xem tech.md §9.3): sản phẩm chạy model local qua Ollama
 * (Qwen). Khác với OpenAI, Ollama hỗ trợ `response_format: json_object` không
 * ổn định — model hay trả kèm lời dẫn, bọc trong khối markdown, thừa dấu phẩy,
 * hoặc mở khối suy nghĩ `<think>...</think>` (đặc trưng của Qwen3).
 *
 * Chiến lược 5 tầng, dừng ngay khi parse được:
 *   1. Bóc `<think>` và khối markdown  →  parse thẳng
 *   2. Trích khối JSON cân ngoặc đầu tiên (bỏ qua chuỗi và ký tự thoát)
 *   3. Sửa cú pháp nhẹ (chỉ đụng phần ngoài chuỗi)
 *   4. Sửa cú pháp mạnh tay (nháy thông minh, ký tự vô hình)
 *   5. (do AIService làm) gọi lại model với temperature 0, rồi mới báo lỗi
 */

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const SMART_DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F]/g;

/** Bỏ khối suy nghĩ của Qwen3 và các hàng rào markdown. */
export function stripModelNoise(raw: string): string {
  let text = raw ?? '';

  // Khối suy luận của Qwen3. Xử lý cả trường hợp thẻ mở hoặc đóng bị thiếu.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/^[\s\S]*?<\/think>/i, '');
  text = text.replace(/<think>[\s\S]*$/i, '');

  // Hàng rào markdown: ```json ... ``` hoặc ``` ... ```
  const fenced = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(text);
  if (fenced && fenced[1]?.trim()) {
    text = fenced[1];
  } else {
    text = text.replace(/```(?:json|JSON)?/g, '').replace(/```/g, '');
  }

  return text.trim();
}

/**
 * Trích khối `{...}` hoặc `[...]` cân ngoặc đầu tiên.
 * Tôn trọng chuỗi và ký tự thoát nên ngoặc nằm trong chuỗi không bị đếm nhầm.
 */
export function extractJsonBlock(text: string): string | null {
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  if (firstObj === -1 && firstArr === -1) return null;

  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
        ? firstObj
        : Math.min(firstObj, firstArr);

  const open = text[start];
  const close = open === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  // Ngoặc chưa đóng (model bị cắt giữa chừng) — đóng bù, để tầng sửa lo tiếp.
  if (depth > 0) return text.slice(start) + close.repeat(depth);
  return null;
}

/**
 * Chạy `fn` chỉ trên những đoạn NẰM NGOÀI chuỗi JSON.
 *
 * Quan trọng: sửa bằng regex mù trên toàn văn bản sẽ phá nội dung bên trong
 * chuỗi — ví dụ chú thích tiếng Việt "Ví dụ: a, b: c" sẽ bị biến dạng. Hàm này
 * giữ nguyên phần trong chuỗi và chỉ sửa phần cấu trúc.
 */
function mapOutsideStrings(
  text: string,
  fn: (chunk: string) => string,
): string {
  let out = '';
  let buffer = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      out += fn(buffer);
      buffer = '';
      out += ch;
      inString = true;
      continue;
    }
    buffer += ch;
  }
  out += fn(buffer);
  return out;
}

/**
 * Sửa các lỗi cú pháp JSON mà model hay mắc.
 *
 * @param aggressive Bật các phép sửa có thể đụng vào nội dung chuỗi
 *   (nháy thông minh, ký tự vô hình). Chỉ dùng khi cách nhẹ đã thất bại.
 */
export function repairJsonSyntax(input: string, aggressive = false): string {
  let text = input;

  if (aggressive) {
    text = text.replace(ZERO_WIDTH, '');
    text = text.replace(SMART_DOUBLE_QUOTES, '"');
  }

  // Bình luận `//` ở đầu dòng (URL trong chuỗi không nằm đầu dòng nên an toàn)
  text = text.replace(/^[ \t]*\/\/.*$/gm, '');

  text = mapOutsideStrings(text, (chunk) =>
    chunk
      // Bình luận khối
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Dấu phẩy thừa trước } hoặc ]
      .replace(/,(\s*[}\]])/g, '$1')
      // Khoá thiếu nháy kép:  { term: ...  →  { "term": ...
      .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
      // Giá trị không hợp lệ trong JSON
      .replace(/:\s*(?:NaN|Infinity|-Infinity|undefined)\s*(?=[,}\]]|$)/g, ': null'),
  );

  return text.trim();
}

/**
 * Thử mọi cách để lấy JSON ra từ đầu ra thô của model.
 * Trả về `null` nếu bó tay — người gọi quyết định thử lại hay báo lỗi.
 */
export function parseModelJson<T>(raw: string): T | null {
  const cleaned = stripModelNoise(raw);
  if (!cleaned) return null;

  const block = extractJsonBlock(cleaned);

  const attempts = [
    cleaned,
    block,
    repairJsonSyntax(cleaned),
    block ? repairJsonSyntax(block) : null,
    repairJsonSyntax(cleaned, true),
    block ? repairJsonSyntax(block, true) : null,
  ];

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // thử phương án tiếp theo
    }
  }
  return null;
}

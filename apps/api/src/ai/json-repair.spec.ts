import { parseModelJson, stripModelNoise } from './json-repair';

/**
 * Model local (Qwen qua Ollama) trả JSON kém ổn định hơn OpenAI rất nhiều.
 * Đây là chỗ dễ vỡ nhất của hệ thống — mọi tính năng dùng `completeJSON`
 * (tóm tắt slide, sinh quiz, giải thích, chấm bài luận) đều đi qua đây.
 */
describe('json-repair', () => {
  describe('stripModelNoise', () => {
    it('bỏ khối <think> của Qwen3', () => {
      expect(stripModelNoise('<think>suy nghĩ</think>{"a":1}')).toBe('{"a":1}');
    });

    it('bỏ được cả khi thẻ mở bị thiếu', () => {
      expect(stripModelNoise('nghĩ tiếp...</think>\n{"a":1}')).toBe('{"a":1}');
    });

    it('bóc khối markdown', () => {
      expect(stripModelNoise('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });
  });

  describe('parseModelJson', () => {
    it('đọc được JSON sạch', () => {
      expect(parseModelJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    });

    it('đọc được JSON bọc trong markdown kèm lời dẫn', () => {
      const raw = 'Đây là kết quả:\n```json\n{"a":2}\n```\nHy vọng giúp ích!';
      expect(parseModelJson<{ a: number }>(raw)).toEqual({ a: 2 });
    });

    it('bỏ qua JSON giả nằm trong khối <think>', () => {
      const raw = '<think>thử {"sai":1} xem</think>\n{"a":3}';
      expect(parseModelJson<{ a: number }>(raw)).toEqual({ a: 3 });
    });

    it('sửa dấu phẩy thừa', () => {
      expect(parseModelJson<any>('{"a":5,"b":[1,2,],}')).toEqual({
        a: 5,
        b: [1, 2],
      });
    });

    it('thêm nháy kép cho khoá bị thiếu', () => {
      expect(parseModelJson<any>('{term: "x", n: 6}')).toEqual({
        term: 'x',
        n: 6,
      });
    });

    it('đóng bù ngoặc khi model bị cắt giữa chừng', () => {
      expect(parseModelJson<any>('{"a": {"b": 8}')).toEqual({ a: { b: 8 } });
    });

    it('bỏ lời dẫn trước mảng JSON', () => {
      const raw = 'Sure! Here is the JSON:\n[{"q":7}]';
      expect(parseModelJson<any>(raw)).toEqual([{ q: 7 }]);
    });

    // Đây là ca quan trọng nhất với sản phẩm này: chú thích tiếng Việt đầy dấu
    // phẩy và dấu hai chấm. Phép sửa cú pháp KHÔNG được đụng vào nội dung chuỗi.
    it('giữ nguyên chuỗi tiếng Việt có dấu phẩy và dấu hai chấm', () => {
      const raw =
        '{"glossVi": "Ví dụ: a, b: c — dấu phẩy và hai chấm nằm trong chuỗi"}';
      expect(parseModelJson<any>(raw).glossVi).toBe(
        'Ví dụ: a, b: c — dấu phẩy và hai chấm nằm trong chuỗi',
      );
    });

    it('sửa được cú pháp mà vẫn không đụng nội dung chuỗi', () => {
      const raw =
        '{term: "Load-bearing wall", glossVi: "Tường chịu lực: đỡ sàn, mái",}';
      expect(parseModelJson<any>(raw)).toEqual({
        term: 'Load-bearing wall',
        glossVi: 'Tường chịu lực: đỡ sàn, mái',
      });
    });

    it('trả null khi hoàn toàn không có JSON', () => {
      expect(parseModelJson('xin lỗi, tôi không thể làm việc đó')).toBeNull();
    });

    it('trả null với chuỗi rỗng', () => {
      expect(parseModelJson('')).toBeNull();
    });
  });
});

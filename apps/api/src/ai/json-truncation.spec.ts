import { closeTruncatedJson, parseModelJson } from './json-repair';

/**
 * BUG-42: study guide bắt model viết đoạn văn dài, nên đầu ra hay chạm trần
 * token và bị cắt ngang. Trước đây cả lượt gọi (40 giây) mất trắng. Giờ phải
 * cứu được phần đã viết xong.
 */
describe('closeTruncatedJson', () => {
  it('giữ các phần tử hoàn chỉnh, bỏ phần tử dở dang', () => {
    const truncated =
      '{"sections":[{"heading":"A","explanationEn":"xong"},{"heading":"B","explanationEn":"đang viết dở';

    const parsed = parseModelJson<{ sections: Array<{ heading: string }> }>(
      truncated,
    );

    expect(parsed).not.toBeNull();
    expect(parsed!.sections).toHaveLength(1);
    expect(parsed!.sections[0].heading).toBe('A');
  });

  it('cắt đúng khi bị đứt giữa một chuỗi có dấu ngoặc bên trong', () => {
    const truncated =
      '{"a":[{"t":"dùng { và } trong câu"},{"t":"câu sau bị cắt {';

    const parsed = parseModelJson<{ a: Array<{ t: string }> }>(truncated);

    expect(parsed).not.toBeNull();
    expect(parsed!.a).toHaveLength(1);
    expect(parsed!.a[0].t).toBe('dùng { và } trong câu');
  });

  it('cứu được nhiều mục lồng nhau', () => {
    const truncated = `{
      "sections": [
        { "heading": "One", "checks": [{ "q": "q1", "a": "a1" }] },
        { "heading": "Two", "checks": [{ "q": "q2", "a": "a2" }] },
        { "heading": "Three", "chec`;

    const parsed = parseModelJson<{ sections: Array<{ heading: string }> }>(
      truncated,
    );

    expect(parsed!.sections.map((s) => s.heading)).toEqual(['One', 'Two']);
  });

  it('không đụng vào JSON vốn đã hợp lệ', () => {
    const valid = '{"ok":true,"list":[1,2,3]}';
    expect(parseModelJson(valid)).toEqual({ ok: true, list: [1, 2, 3] });
  });

  it('trả null khi không có phần tử nào hoàn chỉnh để cứu', () => {
    expect(closeTruncatedJson('{"sections":[{"heading":"chưa xong')).toBeNull();
  });

  it('vẫn parse được khi model bọc trong khối markdown rồi bị cắt', () => {
    const truncated =
      '```json\n{"keyTerms":[{"term":"Pilotis","definitionEn":"cột chống"},{"term":"Brise';

    const parsed = parseModelJson<{ keyTerms: Array<{ term: string }> }>(
      truncated,
    );

    expect(parsed!.keyTerms).toHaveLength(1);
    expect(parsed!.keyTerms[0].term).toBe('Pilotis');
  });
});

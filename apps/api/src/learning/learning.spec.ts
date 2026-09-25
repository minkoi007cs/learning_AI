import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { SubmitQuizDto } from './dto';
import { isAnswerCorrect } from './learning.service';

/**
 * BUG-01 — bài test hồi quy quan trọng nhất của repo này.
 *
 * `SubmitQuizDto.answers` từng chỉ có `@ApiProperty()` mà không có decorator
 * nào của class-validator. Với ValidationPipe bật `whitelist` +
 * `forbidNonWhitelisted`, trường đó bị coi là không hợp lệ → MỌI lần nộp bài
 * quiz đều trả 400 "property answers should not exist". Tính năng quiz vô dụng
 * hoàn toàn dù nhìn bề ngoài vẫn như đang chạy.
 *
 * Nếu ai đó lỡ xoá decorator lần nữa, test này phải đỏ ngay.
 */
describe('SubmitQuizDto qua ValidationPipe', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const meta = { type: 'body', metatype: SubmitQuizDto } as ArgumentMetadata;

  it('cho qua payload hợp lệ và GIỮ NGUYÊN mảng answers', async () => {
    const out = (await pipe.transform(
      {
        quizId: 'quiz-1',
        answers: [
          { questionIndex: 0, answer: 'B' },
          { questionIndex: 1, answer: 'Đạo hàm của hàm số' },
        ],
        timeSpent: 42,
      },
      meta,
    )) as SubmitQuizDto;

    expect(out.answers).toHaveLength(2);
    expect(out.answers[0].answer).toBe('B');
    expect(out.answers[1].answer).toBe('Đạo hàm của hàm số');
  });

  it('từ chối answers sai kiểu', async () => {
    await expect(
      pipe.transform(
        { quizId: 'q', answers: [{ questionIndex: 'x', answer: 1 }] },
        meta,
      ),
    ).rejects.toThrow();
  });

  it('vẫn từ chối trường lạ', async () => {
    await expect(
      pipe.transform({ quizId: 'q', answers: [], hacker: 'x' }, meta),
    ).rejects.toThrow();
  });
});

/**
 * BUG-16 — bản cũ so sánh chuỗi chính xác cho MỌI loại câu hỏi, nên câu tự luận
 * gần như luôn bị chấm sai chỉ vì thừa một dấu chấm hay thiếu một dấu thanh.
 */
describe('isAnswerCorrect', () => {
  describe('trắc nghiệm', () => {
    it('khớp chữ cái', () => {
      expect(isAnswerCorrect('mcq', 'B', 'B')).toBe(true);
    });

    it('chấp nhận cả dạng "B. Nội dung đáp án"', () => {
      expect(isAnswerCorrect('mcq', 'B', 'B. Nội dung đáp án')).toBe(true);
    });

    it('từ chối chữ cái khác', () => {
      expect(isAnswerCorrect('mcq', 'B', 'C')).toBe(false);
    });
  });

  describe('tự luận', () => {
    it('bỏ qua dấu tiếng Việt', () => {
      expect(isAnswerCorrect('short_answer', 'Đạo hàm', 'dao ham')).toBe(true);
    });

    it('bỏ qua dấu câu và chữ hoa/thường', () => {
      expect(isAnswerCorrect('short_answer', 'Pilotis', '  pilotis.  ')).toBe(
        true,
      );
    });

    it('chấp nhận câu trả lời dài hơn có chứa đáp án', () => {
      expect(
        isAnswerCorrect('short_answer', 'pilotis', 'Đó là hệ cột pilotis'),
      ).toBe(true);
    });

    it('từ chối đáp án sai', () => {
      expect(
        isAnswerCorrect('short_answer', 'Le Corbusier', 'Frank Lloyd Wright'),
      ).toBe(false);
    });

    it('từ chối chuỗi rỗng', () => {
      expect(isAnswerCorrect('short_answer', 'X', '')).toBe(false);
    });

    it('từ chối khi thiếu đáp án chuẩn', () => {
      expect(isAnswerCorrect('short_answer', undefined, 'gì đó')).toBe(false);
    });
  });
});

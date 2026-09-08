"use client";

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { apiSend } from '@/lib/api';

export interface QuizQuestion {
  type: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  title?: string | null;
  questions: QuizQuestion[];
  totalQuestions: number;
}

interface SubmitResult {
  questionIndex: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

interface GradedQuiz {
  score: number;
  correctAnswers: number;
  results: SubmitResult[];
}

function letterOf(option: string): string {
  return option.trim().charAt(0).toUpperCase();
}

/**
 * BUG-15: bản cũ chỉ vẽ được câu trắc nghiệm. Câu tự luận (`short_answer`)
 * không có `options` nên không hiện gì cả — mà điều kiện nộp bài lại đòi mọi
 * câu phải có đáp án, nên người dùng kẹt cứng: không trả lời được, không nộp
 * được. Giờ nhận diện theo loại câu hỏi và vẽ đúng dạng nhập liệu.
 */
function isMcq(q: QuizQuestion): boolean {
  const type = (q.type ?? '').toLowerCase();
  if (type.includes('short') || type.includes('essay')) return false;
  return Array.isArray(q.options) && q.options.length > 0;
}

export function QuizRunner({
  quiz,
  onClose,
}: {
  quiz: Quiz;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [graded, setGraded] = useState<GradedQuiz | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = quiz.questions.filter(
    (_, i) => (answers[i] ?? '').trim() !== '',
  ).length;
  const allAnswered = answeredCount === quiz.questions.length;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        quizId: quiz.id,
        answers: quiz.questions.map((_, i) => ({
          questionIndex: i,
          answer: answers[i] ?? '',
        })),
      };
      const res = await apiSend<GradedQuiz>('/quiz/submit', 'POST', payload);
      setGraded(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const resultFor = (i: number) =>
    graded?.results.find((r) => r.questionIndex === i);

  return (
    <div className="space-y-4">
      {graded && (
        <div className="bv-metrics grid-cols-2">
          <div className="bv-metric">
            <div className="bv-metric-k">Điểm</div>
            <div className="bv-metric-v text-ink">{graded.score}%</div>
            <div className="bv-metric-s flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-ochre" />
              {graded.score >= 80
                ? 'Xuất sắc!'
                : graded.score >= 50
                  ? 'Khá tốt, ôn thêm nhé.'
                  : 'Cần ôn lại phần này.'}
            </div>
          </div>
          <div className="bv-metric">
            <div className="bv-metric-k">Câu đúng</div>
            <div className="bv-metric-v text-verdigris">
              {graded.correctAnswers}/{quiz.questions.length}
            </div>
            <div className="bv-metric-s">Tổng {quiz.questions.length} câu</div>
          </div>
        </div>
      )}

      {!graded && (
        <p className="font-data text-[11px] tabular-nums text-graphite">
          Đã trả lời {answeredCount}/{quiz.questions.length} câu
        </p>
      )}

      {quiz.questions.map((q, i) => {
        const res = resultFor(i);
        const mcq = isMcq(q);

        return (
          <div key={i} className="bv-sheet-flat space-y-3 p-4">
            <p className="text-sm font-medium text-ink md:text-[15px]">
              {i + 1}. {q.question}
              {!mcq && (
                <span className="bv-chip bv-chip-info ml-2 align-middle">
                  Tự luận
                </span>
              )}
            </p>

            {mcq ? (
              <div className="space-y-2">
                {(q.options || []).map((opt) => {
                  const letter = letterOf(opt);
                  const selected = answers[i] === letter;
                  const isCorrectOpt =
                    graded && letter === q.correctAnswer.toUpperCase();
                  const isWrongPick = graded && selected && !res?.isCorrect;
                  return (
                    <button
                      key={letter}
                      disabled={!!graded}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: letter }))}
                      className={`flex w-full min-h-[44px] items-center rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isCorrectOpt
                          ? 'border-verdigris bg-verdigris-wash text-verdigris'
                          : isWrongPick
                            ? 'border-annotate bg-annotate-wash text-annotate'
                            : selected
                              ? 'border-blueprint bg-blueprint-wash text-blueprint'
                              : 'border-rule bg-sheet text-ink hover:bg-sheet-alt'
                      }`}
                    >
                      <span className="min-w-0">{opt}</span>
                      {isCorrectOpt && (
                        <CheckCircle2 className="ml-2 h-4 w-4 shrink-0 text-verdigris" />
                      )}
                      {isWrongPick && (
                        <XCircle className="ml-2 h-4 w-4 shrink-0 text-annotate" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={answers[i] ?? ''}
                  disabled={!!graded}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [i]: e.target.value }))
                  }
                  placeholder="Nhập câu trả lời của bạn..."
                  className={`bv-input min-h-[80px] resize-y text-sm ${
                    graded
                      ? res?.isCorrect
                        ? 'border-verdigris'
                        : 'border-annotate'
                      : ''
                  }`}
                />
                {graded && (
                  <div
                    className={`rounded-md border px-3 py-2 text-xs ${
                      res?.isCorrect
                        ? 'border-verdigris bg-verdigris-wash text-verdigris'
                        : 'border-annotate bg-annotate-wash text-annotate'
                    }`}
                  >
                    {res?.isCorrect ? (
                      <>
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                        Chính xác
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1 inline h-3.5 w-3.5" />
                        Đáp án đúng:{' '}
                        <span className="font-medium">{q.correctAnswer}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {graded && q.explanation && (
              <p className="border-t border-dashed border-rule pt-2.5 font-read text-[13.5px] leading-relaxed text-graphite">
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {error && (
        <p className="bv-callout" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {!graded ? (
          <button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="bv-btn bv-btn-primary"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Nộp bài
          </button>
        ) : null}
        <button onClick={onClose} className="bv-btn">
          Đóng
        </button>
      </div>
    </div>
  );
}

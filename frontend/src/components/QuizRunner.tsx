"use client";

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const allAnswered = quiz.questions.every((_, i) => answers[i] !== undefined);

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
        <div className="flex items-center gap-3 rounded-xl bg-violet-500/10 border border-violet-500/20 p-4">
          <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
          <div>
            <p className="text-lg font-bold text-white">
              {graded.score}% — {graded.correctAnswers}/{quiz.questions.length}{' '}
              câu đúng
            </p>
            <p className="text-xs text-slate-400">
              {graded.score >= 80
                ? 'Xuất sắc!'
                : graded.score >= 50
                  ? 'Khá tốt, ôn thêm nhé.'
                  : 'Cần ôn lại phần này.'}
            </p>
          </div>
        </div>
      )}

      {quiz.questions.map((q, i) => {
        const res = resultFor(i);
        return (
          <div
            key={i}
            className="rounded-xl glass-panel border border-white/10 p-4 space-y-3"
          >
            <p className="font-medium text-white text-sm md:text-base">
              {i + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {(q.options || []).map((opt) => {
                const letter = letterOf(opt);
                const selected = answers[i] === letter;
                const isCorrectOpt =
                  graded && letter === q.correctAnswer.toUpperCase();
                const isWrongPick =
                  graded && selected && !res?.isCorrect;
                return (
                  <button
                    key={letter}
                    disabled={!!graded}
                    onClick={() =>
                      setAnswers((a) => ({ ...a, [i]: letter }))
                    }
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isCorrectOpt
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                        : isWrongPick
                          ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                          : selected
                            ? 'border-violet-500/50 bg-violet-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {opt}
                    {isCorrectOpt && (
                      <CheckCircle2 className="w-4 h-4 inline ml-2 text-emerald-400" />
                    )}
                    {isWrongPick && (
                      <XCircle className="w-4 h-4 inline ml-2 text-rose-400" />
                    )}
                  </button>
                );
              })}
            </div>
            {graded && q.explanation && (
              <p className="text-xs text-slate-400 border-t border-white/10 pt-2">
                💡 {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {error && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {!graded ? (
          <Button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="bg-violet-600 hover:bg-violet-500 text-white"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Nộp bài
          </Button>
        ) : null}
        <Button
          onClick={onClose}
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Đóng
        </Button>
      </div>
    </div>
  );
}

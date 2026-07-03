import { useState } from "react";
import { visibleQuestions } from "../lib/personalize.js";

// Stepped questionnaire per the design-reference mockup: progress dots,
// one large question, a grid of answer buttons. Every question can be
// skipped; skipped dimensions fall back to generic weighting. Follow-up
// questions (kid ages, commute length) appear only when relevant.
export default function Questionnaire({ initial = {}, onComplete, onCancel }) {
  const [answers, setAnswers] = useState(initial);
  const [index, setIndex] = useState(0);

  const list = visibleQuestions(answers);
  const q = list[Math.min(index, list.length - 1)];

  function advance(next) {
    const nextList = visibleQuestions(next);
    if (index + 1 >= nextList.length) onComplete(next);
    else {
      setAnswers(next);
      setIndex(index + 1);
    }
  }

  const answer = (value) => advance({ ...answers, [q.key]: value });
  const skip = () => advance({ ...answers, [q.key]: null });

  return (
    <section
      aria-label="Personalization questions"
      className="rise-in mx-auto mt-6 flex min-h-[400px] w-full max-w-[560px] flex-col rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-10"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-[7px]" aria-hidden="true">
          {list.map((question, i) => (
            <span
              key={question.key}
              className="h-[7px] rounded-full transition-all duration-300"
              style={{
                width: i === index ? 24 : 7,
                background: i <= index ? "var(--color-accent)" : "#d2d2d7",
              }}
            />
          ))}
        </div>
        <span className="sr-only">
          Question {index + 1} of {list.length}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[14px] font-medium text-ink-3 hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <h2 className="mt-8 text-[26px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink sm:text-[30px]">
        {q.title}
      </h2>

      <div className="mt-auto grid grid-cols-1 gap-3 pt-8 sm:grid-cols-2">
        {q.options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => answer(opt.value)}
            className="rounded-[18px] border-[1.5px] border-transparent bg-field px-4 py-5 text-[16px] font-medium text-ink transition-all hover:border-accent hover:bg-accent-soft active:scale-[0.98]"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            className="text-[14px] font-medium text-ink-3 hover:text-ink"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={skip}
          className="text-[14px] font-semibold text-accent-strong hover:underline"
        >
          Skip this question
        </button>
      </div>
    </section>
  );
}

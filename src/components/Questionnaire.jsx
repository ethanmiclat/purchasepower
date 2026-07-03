import { useState } from "react";
import { QUESTIONS } from "../lib/personalize.js";

// Stepped questionnaire per the design-reference mockup: progress dots,
// one large question, a grid of answer buttons. Answers accumulate and
// onComplete fires after the last step.
export default function Questionnaire({ onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const q = QUESTIONS[step];

  function answer(value) {
    const next = { ...answers, [q.key]: value };
    if (step + 1 < QUESTIONS.length) {
      setAnswers(next);
      setStep(step + 1);
    } else {
      onComplete(next);
    }
  }

  return (
    <section
      aria-label="Personalization questions"
      className="rise-in mx-auto mt-8 flex min-h-[380px] w-full max-w-[560px] flex-col rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-10"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-[7px]" aria-hidden="true">
          {QUESTIONS.map((question, i) => (
            <span
              key={question.key}
              className="h-[7px] rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 7,
                background: i <= step ? "#1d1d1f" : "#d2d2d7",
              }}
            />
          ))}
        </div>
        <span className="sr-only">
          Question {step + 1} of {QUESTIONS.length}
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
            className="rounded-[18px] border-[1.5px] border-transparent bg-field px-4 py-5 text-[16px] font-medium text-ink transition-all hover:border-ink hover:bg-[#e8e8ec] active:scale-[0.98]"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className="mt-5 self-start text-[14px] font-medium text-ink-3 hover:text-ink"
        >
          Back
        </button>
      )}
    </section>
  );
}

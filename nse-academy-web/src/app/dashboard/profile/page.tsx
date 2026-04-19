'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InvestorCard from '@/components/InvestorCard';

const QUESTIONS = [
  {
    id: 1,
    question: 'How long do you plan to keep your money invested?',
    options: ['Less than 1 year', '1–3 years', '3–7 years', 'More than 7 years'],
  },
  {
    id: 2,
    question: 'If your portfolio dropped 20% in a month, what would you do?',
    options: [
      'Sell everything immediately',
      'Sell some to reduce risk',
      'Hold and wait for recovery',
      'Buy more — it is a discount',
    ],
  },
  {
    id: 3,
    question: 'What is your primary investment goal?',
    options: [
      'Preserve my capital — I cannot afford losses',
      'Generate regular income (dividends)',
      'Balanced growth and income',
      'Maximise long-term capital growth',
    ],
  },
  {
    id: 4,
    question: 'How much capital are you investing?',
    options: [
      'Under KSh 100,000',
      'KSh 100,000 – 500,000',
      'KSh 500,000 – 2,000,000',
      'Over KSh 2,000,000',
    ],
  },
  {
    id: 5,
    question: 'How much experience do you have investing in stocks?',
    options: [
      'None — I am just starting',
      'Less than 2 years',
      '2–5 years',
      'More than 5 years',
    ],
  },
  {
    id: 6,
    question: 'Do you need this money to generate monthly income?',
    options: [
      'Yes — I depend on it',
      'Somewhat — a supplement would help',
      'Not really — it would be nice',
      'No — this is purely for growth',
    ],
  },
  {
    id: 7,
    question: 'How do you feel about investing in smaller, less-known companies?',
    options: [
      'I only want large blue-chip companies',
      'Mostly blue-chips with a few others',
      'Mix of established and emerging companies',
      'I actively seek high-growth smaller companies',
    ],
  },
  {
    id: 8,
    question: 'Which best describes your preference?',
    options: [
      'High dividend yield, slow price growth',
      'Moderate dividends and steady growth',
      'Low dividends but strong price appreciation',
      'No dividends — maximum capital gain',
    ],
  },
  {
    id: 9,
    question: 'Do you have an emergency fund (6+ months expenses) separate from this investment?',
    options: [
      'No — this is my only savings',
      'Partial — about 1–3 months',
      'Yes — about 3–6 months',
      'Yes — fully funded 6+ months',
    ],
  },
  {
    id: 10,
    question: 'Which sector interests you most?',
    options: [
      'Banking and Telecoms — stable and liquid',
      'Consumer goods and utilities — defensive',
      'Energy and infrastructure — growth',
      'I want exposure across all sectors',
    ],
  },
];

interface InvestorProfile {
  type: string;
  riskScore: number;
  horizonYears: number;
  capitalRange: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: number; optionIndex: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InvestorProfile | null>(null);
  const [error, setError] = useState('');

  async function handleAnswer(optionIndex: number) {
    const newAnswers = [...answers, { questionId: QUESTIONS[step].id, optionIndex }];
    setAnswers(newAnswers);

    if (step < 9) {
      setStep(step + 1);
      return;
    }

    setStep(10);
    setSubmitting(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiler/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: newAnswers }),
      });

      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }

      if (!res.ok) {
        throw new Error('Submission failed');
      }

      setResult(await res.json());
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setStep(0);
    setAnswers([]);
    setResult(null);
    setError('');
    setSubmitting(false);
  }

  if (step === 10) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {submitting && (
            <div className="text-center py-20">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Calculating your investor profile…</p>
            </div>
          )}

          {!submitting && error && (
            <div className="text-center py-20">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={restart}
                className="text-sm text-emerald-700 underline"
              >
                Try again
              </button>
            </div>
          )}

          {!submitting && result && (
            <div>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Your profile is ready</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Based on your 10 answers, here&apos;s your investor type
                </p>
              </div>
              <InvestorCard
                type={result.type}
                riskScore={result.riskScore}
                horizonYears={result.horizonYears}
                capitalRange={result.capitalRange}
              />
              <button
                onClick={restart}
                className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600"
              >
                Retake quiz
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const question = QUESTIONS[step];
  const progressPct = (step / 10) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">
              Question {step + 1} of 10
            </span>
            <span className="text-sm text-gray-400">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{question.question}</h2>
          <div className="space-y-3">
            {question.options.map((label, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {step > 0 && (
          <button
            onClick={() => {
              setStep(step - 1);
              setAnswers(answers.slice(0, -1));
            }}
            className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

export const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "How long do you plan to keep your money invested?",
    options: [
      { label: "Less than 1 year", score: 0 },
      { label: "1–3 years", score: 3 },
      { label: "3–7 years", score: 6 },
      { label: "More than 7 years", score: 10 },
    ],
  },
  {
    id: 2,
    question: "If your portfolio dropped 20% in a month, what would you do?",
    options: [
      { label: "Sell everything immediately", score: 0 },
      { label: "Sell some to reduce risk", score: 3 },
      { label: "Hold and wait for recovery", score: 7 },
      { label: "Buy more — it is a discount", score: 10 },
    ],
  },
  {
    id: 3,
    question: "What is your primary investment goal?",
    options: [
      { label: "Preserve my capital — I cannot afford losses", score: 0 },
      { label: "Generate regular income (dividends)", score: 4 },
      { label: "Balanced growth and income", score: 6 },
      { label: "Maximise long-term capital growth", score: 10 },
    ],
  },
  {
    id: 4,
    question: "How much capital are you investing?",
    options: [
      { label: "Under KSh 100,000", score: 2 },
      { label: "KSh 100,000 – 500,000", score: 5 },
      { label: "KSh 500,000 – 2,000,000", score: 7 },
      { label: "Over KSh 2,000,000", score: 10 },
    ],
  },
  {
    id: 5,
    question: "How much experience do you have investing in stocks?",
    options: [
      { label: "None — I am just starting", score: 0 },
      { label: "Less than 2 years", score: 3 },
      { label: "2–5 years", score: 7 },
      { label: "More than 5 years", score: 10 },
    ],
  },
  {
    id: 6,
    question: "Do you need this money to generate monthly income?",
    options: [
      { label: "Yes — I depend on it", score: 0 },
      { label: "Somewhat — a supplement would help", score: 4 },
      { label: "Not really — it would be nice", score: 7 },
      { label: "No — this is purely for growth", score: 10 },
    ],
  },
  {
    id: 7,
    question: "How do you feel about investing in smaller, less-known companies?",
    options: [
      { label: "I only want large blue-chip companies", score: 0 },
      { label: "Mostly blue-chips with a few others", score: 4 },
      { label: "Mix of established and emerging companies", score: 7 },
      { label: "I actively seek high-growth smaller companies", score: 10 },
    ],
  },
  {
    id: 8,
    question: "Which best describes your preference?",
    options: [
      { label: "High dividend yield, slow price growth", score: 2 },
      { label: "Moderate dividends and steady growth", score: 5 },
      { label: "Low dividends but strong price appreciation", score: 8 },
      { label: "No dividends — maximum capital gain", score: 10 },
    ],
  },
  {
    id: 9,
    question: "Do you have an emergency fund (6+ months expenses) separate from this investment?",
    options: [
      { label: "No — this is my only savings", score: 0 },
      { label: "Partial — about 1–3 months", score: 4 },
      { label: "Yes — about 3–6 months", score: 7 },
      { label: "Yes — fully funded 6+ months", score: 10 },
    ],
  },
  {
    id: 10,
    question: "Which sector interests you most?",
    options: [
      { label: "Banking and Telecoms — stable and liquid", score: 3 },
      { label: "Consumer goods and utilities — defensive", score: 2 },
      { label: "Energy and infrastructure — growth", score: 7 },
      { label: "I want exposure across all sectors", score: 8 },
    ],
  },
];

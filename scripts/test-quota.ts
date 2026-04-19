import { GoogleGenerativeAI } from "@google/generative-ai";

if (typeof fetch === "undefined") {
  const fetch = require("node-fetch");
  (global as any).fetch = fetch;
  (global as any).Headers = fetch.Headers;
  (global as any).Request = fetch.Request;
  (global as any).Response = fetch.Response;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const modelsToTry = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

async function testQuota() {
  for (const m of modelsToTry) {
    process.stdout.write(`Testing model ${m}... `);
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("Hi");
      console.log("✅ SUCCESS");
      return m;
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
    }
  }
  return null;
}

testQuota();

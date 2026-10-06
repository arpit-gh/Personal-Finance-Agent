import Groq from "groq-sdk";

const KEY = process.env.GROQ_API_KEY;

const groq = new Groq({
  apiKey: KEY,
});

let messages = [
  { role: "system", content: "You are a personal finance assistant" },
  { role: "user", content: "what is my balance" },
];

const llm = async () => {
  const res = await groq.chat.completions.create({
    messages: messages,
    model: 'openai/gpt-oss-20b',
  });
  console.log(res.choices[0].message.content);
}

llm();

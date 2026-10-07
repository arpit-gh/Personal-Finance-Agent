import readline from "readline/promises";
import Groq from "groq-sdk";
import { client } from "./src/db.js";
import {
  getBalance,
  getTransactions,
  getSpendingSummary,
  setBudget,
  checkBudgetStatus,
} from "./src/tools.js";

const MAX_STEPS = 5;
const USER_ID = 1;
const ACCOUNT_ID = 1;
const TODAY = new Date().toISOString().slice(0, 10);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const toolMap = {
  getBalance,
  getTransactions,
  getSpendingSummary,
  setBudget,
  checkBudgetStatus,
};

const tools = [
  {
    type: "function",
    function: {
      name: "getBalance",
      description: "Get the current balance of an account",
      parameters: {
        type: "object",
        properties: { accountId: { type: "integer" } },
        required: ["accountId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTransactions",
      description:
        "Get a filtered list of transactions, latest first. Returns at most 10 rows and says how many matched in total",
      parameters: {
        type: "object",
        properties: {
          accountId: { type: "integer" },
          category: {
            type: "string",
            enum: ["food", "travel", "shopping", "bills"],
          },
          fromDate: { type: "string", description: "YYYY-MM-DD" },
          toDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["accountId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSpendingSummary",
      description: "Total spent per category in a month, biggest first",
      parameters: {
        type: "object",
        properties: {
          accountId: { type: "integer" },
          month: { type: "string", description: "YYYY-MM" },
        },
        required: ["accountId", "month"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "setBudget",
      description:
        "Save or update the monthly spending limit for a category in the current month",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "integer" },
          category: {
            type: "string",
            enum: ["food", "travel", "shopping", "bills"],
          },
          limit: { type: "number", description: "Monthly limit in rupees" },
        },
        required: ["userId", "category", "limit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkBudgetStatus",
      description:
        "Show spent versus the monthly limit for a category, and how much is left",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "integer" },
          category: {
            type: "string",
            enum: ["food", "travel", "shopping", "bills"],
          },
        },
        required: ["userId", "category"],
      },
    },
  },
];

const conversation = [
  {
    role: "system",
    content: `You are a friendly personal finance assistant. You help the user check their balance, see where their money went, and manage their budgets.

Today's date is ${TODAY}. The user is logged in with userId ${USER_ID} and accountId ${ACCOUNT_ID}. All amounts are in Indian rupees.

How to behave:
- You don't know about the user's details on your own. Always get data from the tools, and never guess.
- For "this month" or "last month", work out the month (YYYY-MM) from today's date.
- Don't add up amounts yourself. Use the spending summary or budget status tool for totals.
- The transactions tool only shows the latest 10. If the user asks for everything, show those 10 and tell them there may be more.
- If nothing is found, say so plainly.
- Only tell the user a budget is saved after the setBudget tool confirms it.
- If the question isn't about money, politely say you can only help with finances.
- Keep your answers short and simple.`,
  },
];

async function askLlm(history) {
  const response = await groq.chat.completions.create({
    messages: history,
    tools: tools,
    tool_choice: "auto",
    temperature: 0,
    model: "openai/gpt-oss-20b",
  });

  return response.choices[0].message;
}

async function runToolCall(toolName, rawArguments) {
  const tool = toolMap[toolName];
  if (!tool) return `Unknown tool: ${toolName}`;

  try {
    return await tool(rawArguments);
  } catch (error) {
    return `Tool error: ${error.message}`;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Personal Finance Agent (type "exit" to quit)\n');

while (true) {
  const userInput = (await rl.question("ENTER PROMPT: ")).trim();

  if (!userInput) continue;
  if (userInput.toLowerCase() === "exit") break;

  conversation.push({ role: "user", content: userInput });

  let reply = "Sorry, I could not finish that. Please try again.";

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const modelMessage = await askLlm(conversation);

      if (!modelMessage.tool_calls || modelMessage.tool_calls.length === 0) {
        reply = modelMessage.content || reply;
        conversation.push({
          role: "assistant",
          content: modelMessage.content || "",
        });
        break;
      }

      conversation.push({
        role: "assistant",
        content: modelMessage.content || "",
        tool_calls: modelMessage.tool_calls,
      });

      for (const toolCall of modelMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const rawArguments = toolCall.function.arguments;
        const toolResult = await runToolCall(toolName, rawArguments);

        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }
  } catch (error) {
    reply = `LLM error: ${error.message}`;
  }

  console.log(`RESPONSE: ${reply}\n`);
}

rl.close();
await client.close();

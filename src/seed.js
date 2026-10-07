import db, { client } from "./db.js";

const accounts = db.collection("accounts");
const transactions = db.collection("transactions");
const budgets = db.collection("budgets");

await accounts.deleteMany({});
await transactions.deleteMany({});
await budgets.deleteMany({});

await accounts.insertOne({
  accountId: 1,
  userId: 1,
  accountType: "savings",
  balance: 65000,
});

await budgets.insertMany([
  { userId: 1, category: "food", monthlyLimit: 7000, month: "2026-10" },
  { userId: 1, category: "travel", monthlyLimit: 5000, month: "2026-10" },
  { userId: 1, category: "shopping", monthlyLimit: 8000, month: "2026-10" },
  { userId: 1, category: "bills", monthlyLimit: 3500, month: "2026-10" },

  { userId: 1, category: "food", monthlyLimit: 6500, month: "2026-09" },
  { userId: 1, category: "travel", monthlyLimit: 4000, month: "2026-09" },
  { userId: 1, category: "shopping", monthlyLimit: 2000, month: "2026-09" },
  { userId: 1, category: "bills", monthlyLimit: 4500, month: "2026-09" },
]);

const categories = ["food", "travel", "shopping", "bills"];

const merchants = {
  food: ["Swiggy", "KFC", "Starbucks", "Dominos"],
  travel: ["Uber", "Rapido", "Train", "Roadways"],
  shopping: ["Amazon", "Flipkart", "Instamart", "Blinkit"],
  bills: ["Electricity", "Broadband", "LPG", "Waterbill"],
};

const rows = [];

for (let i = 1; i <= 210; i++) {
  const category = categories[Math.floor(Math.random() * categories.length)];
  const merchantList = merchants[category];
  const merchant =
    merchantList[Math.floor(Math.random() * merchantList.length)];

  const amount = Math.floor(Math.random() * 2000) + 100;

  const month = i % 2 === 0 ? "10" : "09";
  const day = String((i % 28) + 1).padStart(2, "0");

  const date = "2026-" + month + "-" + day;

  rows.push({
    txnId: i,
    accountId: 1,
    amount,
    type: "debit",
    category,
    merchant,
    date,
  });
}

await transactions.insertMany(rows);

console.log(
  "DB seeded successfully: demo fields inserted in accounts, transactions, and budgets collections",
);

await client.close();

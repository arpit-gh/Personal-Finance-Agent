import db from "./db.js";

const MAX_TRANSACTIONS_TO_SHOW = 10;
const CATEGORIES = ["food", "travel", "shopping", "bills"];

const parseArgs = (rawArgs) =>
  typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const getMonthDateRange = (month) => ({
  $gte: `${month}-01`,
  $lte: `${month}-31`,
});

export const getBalance = async (args) => {
  const { accountId } = parseArgs(args);

  const account = await db
    .collection("accounts")
    .findOne(
      { accountId: Number(accountId) },
      { projection: { _id: 0, accountId: 1, accountType: 1, balance: 1 } },
    );

  if (!account) return `No account found for accountId ${accountId}`;
  return JSON.stringify(account);
};

export const getTransactions = async (args) => {
  const { accountId, category, fromDate, toDate } = parseArgs(args);

  const filter = { accountId: Number(accountId) };
  if (category) filter.category = category;

  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = fromDate;
    if (toDate) filter.date.$lte = toDate;
  }

  const totalMatching = await db
    .collection("transactions")
    .countDocuments(filter);
  if (totalMatching === 0) return "No transactions found";

  const rows = await db
    .collection("transactions")
    .find(filter, {
      projection: {
        _id: 0,
        txnId: 1,
        amount: 1,
        type: 1,
        category: 1,
        merchant: 1,
        date: 1,
      },
    })
    .sort({ date: -1 })
    .limit(MAX_TRANSACTIONS_TO_SHOW)
    .toArray();

  return JSON.stringify({
    totalMatching,
    shown: rows.length,
    note:
      totalMatching > MAX_TRANSACTIONS_TO_SHOW
        ? `Only the latest ${MAX_TRANSACTIONS_TO_SHOW} of ${totalMatching} are shown`
        : "All shown",
    transactions: rows,
  });
};

export const getSpendingSummary = async (args) => {
  const { accountId, month } = parseArgs(args);

  const result = await db
    .collection("transactions")
    .aggregate([
      {
        $match: {
          accountId: Number(accountId),
          type: "debit",
          date: getMonthDateRange(month),
        },
      },
      { $group: { _id: "$category", totalSpent: { $sum: "$amount" } } },
      { $sort: { totalSpent: -1 } },
    ])
    .toArray();

  if (result.length === 0) return `No spending found in ${month}`;

  const summary = result.map((entry) => ({
    category: entry._id,
    totalSpent: entry.totalSpent,
  }));

  return JSON.stringify({ month, summary });
};

export const setBudget = async (args) => {
  const { userId, category, limit } = parseArgs(args);

  if (!CATEGORIES.includes(category)) {
    return `Invalid category. Use one of: ${CATEGORIES.join(", ")}`;
  }

  if (!(Number(limit) > 0)) return "Limit must be a grater than 0";

  const month = getCurrentMonth();
  const numericLimit = Number(limit);

  await db
    .collection("budgets")
    .updateOne(
      { userId: Number(userId), category, month },
      { $set: { monthlyLimit: numericLimit } },
      { upsert: true },
    );

  return JSON.stringify({
    saved: true,
    userId: Number(userId),
    category,
    monthlyLimit: numericLimit,
    month,
  });
};

export const checkBudgetStatus = async (args) => {
  const { userId, category } = parseArgs(args);

  const month = getCurrentMonth();

  const budget = await db
    .collection("budgets")
    .findOne({ userId: Number(userId), category, month });

  if (!budget) return `No budget set for ${category} in ${month}`;

  const userAccounts = await db
    .collection("accounts")
    .find({ userId: Number(userId) })
    .toArray();
  const accountIds = userAccounts.map((account) => account.accountId);

  const result = await db
    .collection("transactions")
    .aggregate([
      {
        $match: {
          accountId: { $in: accountIds },
          type: "debit",
          category,
          date: getMonthDateRange(month),
        },
      },
      { $group: { _id: null, spent: { $sum: "$amount" } } },
    ])
    .toArray();

  const spent = result.length ? result[0].spent : 0;
  const remaining = budget.monthlyLimit - spent;

  return JSON.stringify({
    category,
    month,
    monthlyLimit: budget.monthlyLimit,
    spent,
    left: remaining > 0 ? remaining : 0,
    overBy: remaining < 0 ? -remaining : 0,
    status: remaining < 0 ? "OVER BUDGET" : "within budget",
  });
};

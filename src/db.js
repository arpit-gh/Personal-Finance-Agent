import { MongoClient } from "mongodb";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const URI = process.env.MONGODB_URI;

const client = new MongoClient(URI);
await client.connect();

const db = client.db("personal-finance-agent");

export { client };
export default db;

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");

const DATABASE_NAME = process.env.MONGODB_DATABASE || "biblioteca_alameda";
const URI = process.env.MONGODB_URI;
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!URI) throw new Error("MONGODB_URI no esta configurada");
if (!username || !password) {
  throw new Error("Configure ADMIN_USERNAME y ADMIN_PASSWORD");
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DATABASE_NAME);
  const passwordHash = await bcrypt.hash(password, 12);

  await db.collection("accounts").updateOne(
    { username },
    { $set: { username, passwordHash, role: "admin", updatedAt: new Date() } },
    { upsert: true }
  );

  await db.collection("accounts").createIndex({ username: 1 }, { unique: true });
  console.log(`Administrador configurado en ${DATABASE_NAME}`);
  await client.close();
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

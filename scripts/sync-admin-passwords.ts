import fs from "node:fs";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const contentFile = "data/content.json";
const store = JSON.parse(fs.readFileSync(contentFile, "utf8")) as {
  admins: Array<{ id: number; login: string; passwordHash: string; role?: string; createdAt?: string }>;
};

function upsertAdmin(login: string, password: string, role: "admin" | "user"): string {
  if (!login || !password) {
    return `skip ${role}: missing login/password in .env`;
  }

  const existing = store.admins.find((row) => row.login === login);
  const passwordHash = bcrypt.hashSync(password, 10);

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = role;
    return `updated ${role} login=${login}`;
  }

  const nextId = Math.max(0, ...store.admins.map((row) => row.id)) + 1;
  store.admins.push({
    id: nextId,
    login,
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  });
  return `created ${role} login=${login}`;
}

const results = [
  upsertAdmin(process.env.ADMIN_LOGIN || "admin", process.env.ADMIN_PASSWORD || "", "admin"),
  upsertAdmin(process.env.ADMIN_USER_LOGIN || "user", process.env.ADMIN_USER_PASSWORD || "", "user")
];

fs.writeFileSync(contentFile, JSON.stringify(store, null, 2), "utf8");
console.log(results.join("\n"));
console.log("Passwords synced from .env into data/content.json. Restart the app if it is already running.");

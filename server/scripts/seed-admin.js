import dotenv from "dotenv";
import { query } from "../src/db.js";
import { hashPassword } from "../src/utils/password.js";

dotenv.config();

const DEFAULT_ADMIN = {
  name: "Admin",
  email: "admin@wheelsnationke.co.ke",
  phone: "254712345678",
  password: "123456",
  role: "admin",
};

const run = async () => {
  try {
    const passwordHash = await hashPassword(DEFAULT_ADMIN.password);

    await query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role`,
      [
        DEFAULT_ADMIN.name,
        DEFAULT_ADMIN.email,
        DEFAULT_ADMIN.phone,
        passwordHash,
        DEFAULT_ADMIN.role,
      ]
    );

    console.log("Admin account seeded.");
    console.log(`Email: ${DEFAULT_ADMIN.email}`);
    console.log(`Password: ${DEFAULT_ADMIN.password}`);
  } catch (error) {
    console.error("Admin seed failed:", error);
    process.exitCode = 1;
  }
};

run();

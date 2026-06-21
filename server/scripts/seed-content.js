import dotenv from "dotenv";
import pool, { query } from "../src/db.js";

dotenv.config();

// Demo content so a fresh database isn't blank in the admin/content pages.
// Each table is only seeded when it is currently empty, so this is safe to
// re-run and never clobbers data added through the admin UI.

const services = [
  {
    title: "Premium Detailing",
    description: "Full interior and exterior detailing that restores showroom shine.",
    features: ["Interior deep clean", "Exterior polish", "Engine bay clean"],
    price_cents: 1500000,
  },
  {
    title: "Performance Tuning",
    description: "ECU remapping and dyno tuning for more power and efficiency.",
    features: ["ECU remap", "Dyno test", "Road tuning"],
    price_cents: 5000000,
  },
  {
    title: "Pre-Purchase Inspection",
    description: "Independent 150-point inspection before you buy any vehicle.",
    features: ["150-point check", "Diagnostics scan", "Written report"],
    price_cents: 800000,
  },
];

const events = [
  {
    title: "Nairobi Supercar Meet",
    description: "A morning gathering of the finest performance cars in the city.",
    location: "Nairobi, Kenya",
    start_date: "2026-08-15",
    end_date: "2026-08-15",
    price_cents: 0,
    status: "upcoming",
  },
  {
    title: "Whistling Morans Track Day",
    description: "Open-pit track day for enthusiasts and their machines.",
    location: "Athi River, Kenya",
    start_date: "2026-09-05",
    end_date: "2026-09-05",
    price_cents: 500000,
    status: "upcoming",
  },
  {
    title: "Classic Car Concours",
    description: "A celebration of restored classics and vintage icons.",
    location: "Karen, Nairobi",
    start_date: "2026-03-12",
    end_date: "2026-03-12",
    price_cents: 200000,
    status: "past",
  },
];

const products = [
  {
    name: "Wheelsnation Tee",
    description: "Soft cotton tee with the Wheelsnation crest.",
    price_cents: 250000,
    category: "Apparel",
    sizes: ["S", "M", "L", "XL"],
    stock: 50,
  },
  {
    name: "Racing Cap",
    description: "Adjustable cap with embroidered logo.",
    price_cents: 150000,
    category: "Apparel",
    sizes: ["One Size"],
    stock: 100,
  },
  {
    name: "Microfiber Wash Kit",
    description: "Everything you need for a swirl-free hand wash.",
    price_cents: 350000,
    category: "Accessories",
    sizes: [],
    stock: 30,
  },
];

const posts = [
  {
    title: "Top 5 Performance SUVs of 2026",
    excerpt: "The high-riding rockets that blur the line between SUV and supercar.",
    content:
      "From twin-turbo V8s to electric torque monsters, these SUVs prove practicality and performance can coexist...",
    status: "published",
    published_at: new Date().toISOString(),
  },
  {
    title: "How to Inspect a Used Car Like a Pro",
    excerpt: "A simple checklist to avoid costly surprises before you buy.",
    content:
      "Start with the paperwork, then walk the body panels, check the tyres, and always insist on a cold start...",
    status: "draft",
    published_at: null,
  },
];

const seedIfEmpty = async (table, rows, insertOne) => {
  const result = await query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  const count = Number(result.rows[0]?.count || 0);
  if (count > 0) {
    console.log(`${table}: already has ${count} row(s), skipping.`);
    return;
  }
  for (const row of rows) {
    await insertOne(row);
  }
  console.log(`${table}: seeded ${rows.length} row(s).`);
};

const run = async () => {
  try {
    await seedIfEmpty("services", services, (s) =>
      query(
        `INSERT INTO services (title, description, features, price_cents, active)
         VALUES ($1, $2, $3, $4, true)`,
        [s.title, s.description, s.features, s.price_cents]
      )
    );

    await seedIfEmpty("events", events, (e) =>
      query(
        `INSERT INTO events (title, description, location, start_date, end_date, price_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [e.title, e.description, e.location, e.start_date, e.end_date, e.price_cents, e.status]
      )
    );

    await seedIfEmpty("products", products, (p) =>
      query(
        `INSERT INTO products (name, description, price_cents, category, sizes, stock, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [p.name, p.description, p.price_cents, p.category, p.sizes, p.stock]
      )
    );

    await seedIfEmpty("posts", posts, (p) =>
      query(
        `INSERT INTO posts (title, excerpt, content, status, published_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.title, p.excerpt, p.content, p.status, p.published_at]
      )
    );

    console.log("Content seed complete.");
  } catch (error) {
    console.error("Content seed failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();

import dotenv from "dotenv";
import { query } from "../src/db.js";
import { hashPassword } from "../src/utils/password.js";

dotenv.config();

const demoListings = [
  {
    title: "Porsche 911 GT3",
    priceCents: 18500000,
    year: 2023,
    mileage: 5200,
    fuel: "Petrol",
    powerHp: 502,
    imageUrl: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=600",
    listingType: "buy",
    featured: true,
  },
  {
    title: "BMW M4 Competition",
    priceCents: 9200000,
    year: 2024,
    mileage: 1200,
    fuel: "Petrol",
    powerHp: 503,
    imageUrl: "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=600",
    listingType: "buy",
    featured: false,
  },
  {
    title: "Mercedes AMG GT",
    priceCents: 45000,
    year: 2023,
    mileage: null,
    fuel: "Petrol",
    powerHp: 577,
    imageUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600",
    listingType: "rent",
    featured: true,
  },
  {
    title: "Audi RS7 Sportback",
    priceCents: 12500000,
    year: 2023,
    mileage: 8500,
    fuel: "Petrol",
    powerHp: 591,
    imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600",
    listingType: "sell",
    featured: false,
  },
  {
    title: "Lamborghini Huracan",
    priceCents: 75000,
    year: 2024,
    mileage: null,
    fuel: "Petrol",
    powerHp: 631,
    imageUrl: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600",
    listingType: "rent",
    featured: true,
  },
  {
    title: "McLaren 720S",
    priceCents: 29500000,
    year: 2022,
    mileage: 12000,
    fuel: "Petrol",
    powerHp: 710,
    imageUrl: "https://images.unsplash.com/photo-1621135802920-133df287f89c?w=600",
    listingType: "buy",
    featured: false,
  },
];

const run = async () => {
  try {
    const email = "admin@wheelsnationke.local";
    const password = "admin123";
    const name = "Admin";

    const passwordHash = await hashPassword(password);

    const userResult = await query(
      `INSERT INTO users (email, name, role, password_hash)
       VALUES ($1, $2, 'admin', $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [email, name, passwordHash]
    );

    const adminId = userResult.rows[0].id;

    for (const listing of demoListings) {
      await query(
        `INSERT INTO listings
        (user_id, title, price_cents, year, mileage, fuel, power_hp, image_url, listing_type, featured, status, description, location)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',NULL,NULL)`,
        [
          adminId,
          listing.title,
          listing.priceCents,
          listing.year,
          listing.mileage,
          listing.fuel,
          listing.powerHp,
          listing.imageUrl,
          listing.listingType,
          listing.featured,
        ]
      );
    }

    console.log("Seed complete.");
    console.log(`Admin login: ${email} / ${password}`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  }
};

run();

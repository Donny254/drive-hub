import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  companyName: row.company_name || null,
  supportEmail: row.support_email || null,
  supportPhone: row.support_phone || null,
  address: row.address || null,
  socialFacebook: row.social_facebook || null,
  socialInstagram: row.social_instagram || null,
  socialTwitter: row.social_twitter || null,
  socialYoutube: row.social_youtube || null,
  bankName: row.bank_name || null,
  bankAccountName: row.bank_account_name || null,
  bankAccountNumber: row.bank_account_number || null,
  bankBranch: row.bank_branch || null,
  bankSwift: row.bank_swift || null,
  bankInstructions: row.bank_instructions || null,
  sellerCommissionRate: row.seller_commission_rate ?? 0,
  cryptoCurrency: row.crypto_currency || null,
  cryptoNetwork: row.crypto_network || null,
  cryptoWalletAddress: row.crypto_wallet_address || null,
  cryptoInstructions: row.crypto_instructions || null,
  updatedAt: row.updated_at || null,
});

const loadSettings = async () => {
  const result = await query("SELECT * FROM site_settings WHERE id = true");
  if (result.rowCount > 0) return result.rows[0];
  const inserted = await query("INSERT INTO site_settings (id) VALUES (true) RETURNING *");
  return inserted.rows[0];
};

router.get("/public", async (req, res, next) => {
  try {
    const row = await loadSettings();
    res.json(toApi(row));
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const row = await loadSettings();
    res.json(toApi(row));
  } catch (error) {
    next(error);
  }
});

router.put("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const updates = [];
    const values = [];

    const fields = {
      company_name: req.body.companyName,
      support_email: req.body.supportEmail,
      support_phone: req.body.supportPhone,
      address: req.body.address,
      social_facebook: req.body.socialFacebook,
      social_instagram: req.body.socialInstagram,
      social_twitter: req.body.socialTwitter,
      social_youtube: req.body.socialYoutube,
      bank_name: req.body.bankName,
      bank_account_name: req.body.bankAccountName,
      bank_account_number: req.body.bankAccountNumber,
      bank_branch: req.body.bankBranch,
      bank_swift: req.body.bankSwift,
      bank_instructions: req.body.bankInstructions,
      seller_commission_rate:
        req.body.sellerCommissionRate !== undefined
          ? Number.parseInt(req.body.sellerCommissionRate, 10)
          : undefined,
      crypto_currency: req.body.cryptoCurrency,
      crypto_network: req.body.cryptoNetwork,
      crypto_wallet_address: req.body.cryptoWalletAddress,
      crypto_instructions: req.body.cryptoInstructions,
    };

    Object.entries(fields).forEach(([column, value]) => {
      if (value !== undefined) {
        values.push(column === "seller_commission_rate" ? (Number.isFinite(value) ? value : 0) : value || null);
        updates.push(`${column} = $${values.length}`);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const result = await query(
      `UPDATE site_settings
       SET ${updates.join(", ")}
       WHERE id = true
       RETURNING *`,
      values
    );

    const row = result.rowCount > 0 ? result.rows[0] : await loadSettings();
    res.json(toApi(row));
  } catch (error) {
    next(error);
  }
});

export default router;

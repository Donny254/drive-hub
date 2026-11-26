import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { encryptSecret } from "../utils/secrets.js";

const router = Router();
const allowedTransactionTypes = new Set([
  "CustomerPayBillOnline",
  "CustomerBuyGoodsOnline",
]);

const toApi = (row) => ({
  companyName: row.company_name || null,
  supportEmail: row.support_email || null,
  supportPhone: row.support_phone || null,
  address: row.address || null,
  socialFacebook: row.social_facebook || null,
  socialInstagram: row.social_instagram || null,
  socialPinterest: row.social_pinterest || null,
  socialTwitter: row.social_twitter || null,
  socialTikTok: row.social_tiktok || null,
  socialYoutube: row.social_youtube || null,
  bankName: row.bank_name || null,
  bankAccountName: row.bank_account_name || null,
  bankAccountNumber: row.bank_account_number || null,
  bankBranch: row.bank_branch || null,
  bankSwift: row.bank_swift || null,
  bankInstructions: row.bank_instructions || null,
  sellerCommissionRate: row.seller_commission_rate ?? 0,
  trustedDealers: row.trusted_dealers ?? 10,
  countriesEstablished: row.countries_established ?? 5,
  carsSold: row.cars_sold ?? 500,
  happyClients: row.happy_clients ?? 10000,
  eventsHosted: row.events_hosted ?? 50,
  yearsExperience: row.years_experience ?? 15,
  cryptoCurrency: row.crypto_currency || null,
  cryptoNetwork: row.crypto_network || null,
  cryptoWalletAddress: row.crypto_wallet_address || null,
  cryptoInstructions: row.crypto_instructions || null,
  cryptoNetworkEvm: row.crypto_network_evm || null,
  cryptoWalletAddressEvm: row.crypto_wallet_address_evm || null,
  updatedAt: row.updated_at || null,
});

const toAdminApi = (row) => ({
  ...toApi(row),

  // null means the server's MPESA_ENV setting is used.
  mpesaEnvironment: row.mpesa_environment || null,

  mpesaAccountReference: row.mpesa_account_reference || null,
  mpesaTransactionDesc: row.mpesa_transaction_desc || null,
  mpesaSandboxTransactionType:
    row.mpesa_sandbox_transaction_type || "CustomerPayBillOnline",
  mpesaProductionTransactionType:
    row.mpesa_production_transaction_type || "CustomerPayBillOnline",

  mpesaSandboxShortcode: row.mpesa_sandbox_shortcode || null,
  mpesaSandboxPartyb: row.mpesa_sandbox_partyb || null,
  mpesaSandboxConsumerKeySet: Boolean(row.mpesa_sandbox_consumer_key_enc),
  mpesaSandboxConsumerSecretSet: Boolean(row.mpesa_sandbox_consumer_secret_enc),
  mpesaSandboxPasskeySet: Boolean(row.mpesa_sandbox_passkey_enc),

  mpesaProductionShortcode: row.mpesa_production_shortcode || null,
  mpesaProductionPartyb: row.mpesa_production_partyb || null,
  mpesaProductionConsumerKeySet: Boolean(row.mpesa_production_consumer_key_enc),
  mpesaProductionConsumerSecretSet: Boolean(
    row.mpesa_production_consumer_secret_enc,
  ),
  mpesaProductionPasskeySet: Boolean(row.mpesa_production_passkey_enc),
});

const MPESA_SECRET_FIELDS = {
  mpesa_sandbox_consumer_key_enc: "mpesaSandboxConsumerKey",
  mpesa_sandbox_consumer_secret_enc: "mpesaSandboxConsumerSecret",
  mpesa_sandbox_passkey_enc: "mpesaSandboxPasskey",
  mpesa_production_consumer_key_enc: "mpesaProductionConsumerKey",
  mpesa_production_consumer_secret_enc: "mpesaProductionConsumerSecret",
  mpesa_production_passkey_enc: "mpesaProductionPasskey",
};

const loadSettings = async () => {
  const result = await query("SELECT * FROM site_settings WHERE id = true");
  if (result.rowCount > 0) return result.rows[0];

  const inserted = await query(
    "INSERT INTO site_settings (id) VALUES (true) RETURNING *",
  );
  return inserted.rows[0];
};

router.get("/public", async (req, res, next) => {
  try {
    const row = await loadSettings();

    const countResult = await query(
      `SELECT COUNT(*)::int AS total_cars
       FROM listings
       WHERE deleted_at IS NULL`
    );

    const counts = countResult.rows[0];

    res.json({
      ...toApi(row),
      totalCars: counts.total_cars,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    res.json(toAdminApi(await loadSettings()));
  } catch (error) {
    next(error);
  }
});

router.put("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    for (const key of [
      "mpesaSandboxTransactionType",
      "mpesaProductionTransactionType",
    ]) {
      const value = req.body[key];

      if (value !== undefined && !allowedTransactionTypes.has(value)) {
        return res.status(400).json({
          error: `Invalid ${key}.`,
        });
      }
    }

    const statisticFields = {
      trusted_dealers: "trustedDealers",
      countries_established: "countriesEstablished",
      cars_sold: "carsSold",
      happy_clients: "happyClients",
      events_hosted: "eventsHosted",
      years_experience: "yearsExperience",
    };
    const statisticValues = {};

    for (const [column, bodyKey] of Object.entries(statisticFields)) {
      const value = req.body[bodyKey];
      if (value === undefined) continue;
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 0) {
        return res.status(400).json({ error: `${bodyKey} must be a non-negative whole number` });
      }
      statisticValues[column] = parsed;
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "mpesaEnvironment")) {
      const environment = req.body.mpesaEnvironment;

      if (
        environment !== null &&
        environment !== "sandbox" &&
        environment !== "production"
      ) {
        return res.status(400).json({
          error: "mpesaEnvironment must be sandbox, production, or null",
        });
      }

      values.push(environment);
      updates.push(`mpesa_environment = $${values.length}`);
    }

    const fields = {
      company_name: req.body.companyName,
      support_email: req.body.supportEmail,
      support_phone: req.body.supportPhone,
      address: req.body.address,
      social_facebook: req.body.socialFacebook,
      social_instagram: req.body.socialInstagram,
      social_pinterest: req.body.socialPinterest,
      social_twitter: req.body.socialTwitter,
      social_tiktok: req.body.socialTikTok,
      social_youtube: req.body.socialYoutube,
      bank_name: req.body.bankName,
      bank_account_name: req.body.bankAccountName,
      bank_account_number: req.body.bankAccountNumber,
      bank_branch: req.body.bankBranch,
      bank_swift: req.body.bankSwift,
      bank_instructions: req.body.bankInstructions,
      ...statisticValues,
      seller_commission_rate:
        req.body.sellerCommissionRate !== undefined
          ? Number.parseInt(req.body.sellerCommissionRate, 10)
          : undefined,
      crypto_currency: req.body.cryptoCurrency,
      crypto_network: req.body.cryptoNetwork,
      crypto_wallet_address: req.body.cryptoWalletAddress,
      crypto_instructions: req.body.cryptoInstructions,
      crypto_network_evm: req.body.cryptoNetworkEvm,
      crypto_wallet_address_evm: req.body.cryptoWalletAddressEvm,

      // Shared by both Daraja environments.
      mpesa_account_reference: req.body.mpesaAccountReference,
      mpesa_transaction_desc: req.body.mpesaTransactionDesc,

      // Sandbox configuration.
      mpesa_sandbox_shortcode: req.body.mpesaSandboxShortcode,
      mpesa_sandbox_partyb: req.body.mpesaSandboxPartyb,
      mpesa_sandbox_transaction_type:
        req.body.mpesaSandboxTransactionType,

      // Production configuration.
      mpesa_production_shortcode: req.body.mpesaProductionShortcode,
      mpesa_production_partyb: req.body.mpesaProductionPartyb,
      mpesa_production_transaction_type:
        req.body.mpesaProductionTransactionType,
    };

    for (const [column, value] of Object.entries(fields)) {
      if (value === undefined) continue;

      const normalized =
        column === "seller_commission_rate"
          ? Number.isFinite(value)
            ? value
            : 0
          : value || null;

      values.push(normalized);
      updates.push(`${column} = $${values.length}`);
    }

    for (const [column, bodyKey] of Object.entries(MPESA_SECRET_FIELDS)) {
      const value = req.body[bodyKey];

      // Empty means retain the existing encrypted credential.
      if (typeof value !== "string" || !value.trim()) continue;

      const encrypted = encryptSecret(value.trim());
      if (!encrypted) {
        return res.status(400).json({
          error:
            "Server is missing SETTINGS_ENCRYPTION_KEY — cannot store credentials securely",
        });
      }

      values.push(encrypted);
      updates.push(`${column} = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Ensure the singleton exists before applying updates.
    await loadSettings();

    values.push(true);
    const result = await query(
      `UPDATE site_settings
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING *`,
      values,
    );

    res.json(toAdminApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

export default router;

import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Server persistence is limited to what billing and abuse prevention require.
 * There is deliberately no table for conversations, prompts or completions.
 * Accounts are pseudonymous: a random id plus the hash of a bearer secret.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  secretHash: text("secret_hash").notNull().unique(),
  /** Token-gate tier from a signed wallet proof. The wallet address itself is not stored. */
  tokenTier: text("token_tier"),
  tokenTierExpiresAt: timestamp("token_tier_expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** First characters of the key, shown in the dashboard so users can tell keys apart. */
    displayPrefix: text("display_prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("api_keys_account_idx").on(t.accountId)],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Positive = credit, negative = debit. */
    delta: integer("delta").notNull(),
    reason: text("reason", {
      enum: ["purchase", "plan_grant", "usage", "refund", "admin_adjustment"],
    }).notNull(),
    refType: text("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("credit_ledger_account_idx").on(t.accountId),
    // A given payment / usage record / refund can only ever produce one ledger row.
    uniqueIndex("credit_ledger_ref_unique").on(t.refType, t.refId),
  ],
);

export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["credits", "plan"] }).notNull(),
    productId: text("product_id").notNull(),
    currency: text("currency", { enum: ["SOL", "USDC", "TOKEN"] }).notNull(),
    mint: text("mint"),
    tokenProgram: text("token_program"),
    payer: text("payer").notNull(),
    treasury: text("treasury").notNull(),
    /** SOL: the treasury wallet. SPL: the treasury's associated token account. */
    destination: text("destination").notNull(),
    amountBaseUnits: numeric("amount_base_units", { precision: 40, scale: 0 }).notNull(),
    usdAmount: numeric("usd_amount", { precision: 14, scale: 4 }).notNull(),
    unitPriceUsd: numeric("unit_price_usd", { precision: 30, scale: 12 }).notNull(),
    credits: integer("credits").notNull(),
    /** Random public key included in the transfer instruction; binds the on-chain tx to this intent. */
    reference: text("reference").notNull().unique(),
    status: text("status", { enum: ["pending", "completed", "expired", "failed"] })
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("payment_intents_account_idx").on(t.accountId)],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  intentId: uuid("intent_id")
    .notNull()
    .unique()
    .references(() => paymentIntents.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  /** Unique: a transaction can be redeemed exactly once. */
  signature: text("signature").notNull().unique(),
  payer: text("payer").notNull(),
  currency: text("currency").notNull(),
  mint: text("mint"),
  amountBaseUnits: numeric("amount_base_units", { precision: 40, scale: 0 }).notNull(),
  usdAmount: numeric("usd_amount", { precision: 14, scale: 4 }).notNull(),
  slot: bigint("slot", { mode: "number" }),
  commitment: text("commitment").notNull(),
  createdAt: createdAt(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    plan: text("plan", { enum: ["pro", "max"] }).notNull(),
    paymentId: uuid("payment_id")
      .notNull()
      .unique()
      .references(() => payments.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("subscriptions_account_idx").on(t.accountId)],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    source: text("source", { enum: ["app", "api"] }).notNull(),
    kind: text("kind", { enum: ["chat", "image", "video", "code"] }).notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    units: integer("units").notNull().default(0),
    credits: integer("credits").notNull().default(0),
    providerCostUsd: numeric("provider_cost_usd", { precision: 14, scale: 6 }).notNull().default("0"),
    createdAt: createdAt(),
  },
  (t) => [
    index("usage_records_account_idx").on(t.accountId),
    index("usage_records_api_key_idx").on(t.apiKeyId),
    index("usage_records_created_idx").on(t.createdAt),
  ],
);

export const tokenPurchases = pgTable("token_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  signature: text("signature").notNull().unique(),
  venue: text("venue", { enum: ["bonding_curve", "pumpswap"] }).notNull(),
  quoteAmountBaseUnits: numeric("quote_amount_base_units", { precision: 40, scale: 0 }).notNull(),
  tokenAmountBaseUnits: numeric("token_amount_base_units", { precision: 40, scale: 0 }),
  verified: boolean("verified").notNull().default(false),
  createdAt: createdAt(),
});

export const buybackProposals = pgTable("buyback_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  grossRevenueUsd: numeric("gross_revenue_usd", { precision: 14, scale: 4 }).notNull(),
  providerCostUsd: numeric("provider_cost_usd", { precision: 14, scale: 4 }).notNull(),
  netRevenueUsd: numeric("net_revenue_usd", { precision: 14, scale: 4 }).notNull(),
  allocationBps: integer("allocation_bps").notNull(),
  proposedUsd: numeric("proposed_usd", { precision: 14, scale: 4 }).notNull(),
  status: text("status", { enum: ["proposed", "approved", "rejected", "executed"] })
    .notNull()
    .default("proposed"),
  createdBy: text("created_by").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const buybackExecutions = pgTable("buyback_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => buybackProposals.id),
  kind: text("kind", { enum: ["buy", "burn"] }).notNull(),
  signature: text("signature").notNull().unique(),
  treasury: text("treasury").notNull(),
  quoteSpentBaseUnits: numeric("quote_spent_base_units", { precision: 40, scale: 0 }),
  tokenAmountBaseUnits: numeric("token_amount_base_units", { precision: 40, scale: 0 }),
  venue: text("venue"),
  status: text("status", { enum: ["submitted", "verified", "failed"] }).notNull(),
  error: text("error"),
  executedBy: text("executed_by").notNull(),
  createdAt: createdAt(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

/** Single-use nonces for wallet sign-in messages (admin and token-gate proofs). */
export const authNonces = pgTable("auth_nonces", {
  nonce: text("nonce").primaryKey(),
  purpose: text("purpose", { enum: ["admin", "token_gate"] }).notNull(),
  createdAt: createdAt(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

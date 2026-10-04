# Veil

A privacy-first AI platform, settled on Solana. Chat, image, video and a small coding agent behind one interface; personal details are replaced with placeholders **in the browser** before a request leaves it, conversation history lives in IndexedDB, and credits are bought with a wallet transaction that the server verifies on-chain.

> Name, logo, copy and visuals are original. The token is configured, not hard-coded: `PROJECT_TOKEN_*` env vars.

## Quick start

```bash
npm install
cp .env.example .env.local      # add at least one provider key, e.g. ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

With no `DATABASE_URL`, development uses an embedded PGlite database in `.data/` (migrations apply automatically). With no provider keys, the UI lists every model as *not configured* — nothing is mocked.

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript, ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright (starts its own dev server + a local OpenAI-compatible fixture) |
| `RUN_INTEGRATION=1 SOLANA_NETWORK=mainnet-beta npx vitest run` | Read-only live check of the Pump integration against a real pump.fun coin (quotes + unsigned tx; never signs) |
| `npm run db:generate` / `db:migrate` | Drizzle SQL migrations / apply to `DATABASE_URL` |

## What works

| Area | Status |
|---|---|
| Landing page (desktop + mobile) | ✅ All sections; live privacy demo uses the real sanitizer; model availability and token data are read live |
| Chat | ✅ Streaming, stop, regenerate, Markdown/tables/highlighted code, copy, model + reasoning selectors, privacy modes, receipts, image & text attachments, local history |
| Privacy layer | ✅ `sanitizePrompt` / `createPlaceholderMap` / `sendSanitizedPrompt` / `restoreResponse` (`lib/privacy`) |
| Providers | ✅ Anthropic (official SDK, adaptive thinking, server-side refusal fallbacks), OpenAI, OpenRouter, Together, Fireworks, any OpenAI-compatible endpoint, Google Gemini; Replicate for image/video |
| Image / Video | ✅ Generation with credits; results stored in IndexedDB; video jobs poll with progress and auto-refund on failure |
| Code agent | ✅ Files streamed as fenced blocks → project tree, log, sandboxed live preview. Remote runtimes: interface only (`lib/code/sandbox.ts`), shown as *not configured* |
| Solana wallet | ✅ Wallet-standard detection (Phantom, Solflare, Backpack…), optional WalletConnect, balances, disconnect |
| Solana connector | ✅ Reads run in the browser; transfers become previews the user approves in their wallet |
| Credits & plans | ✅ SOL / USDC / project-token payments, server-side on-chain verification, replay protection, fixed-duration plans (no recurring charges) |
| Token | ✅ Pump bonding curve + PumpSwap quotes and unsigned buy transactions via the official SDKs; buy modal; token info module |
| API | ✅ `POST /api/v1/chat/completions` (OpenAI-compatible, streaming), `GET /api/v1/models`, hashed keys shown once, revocation, rate limits, usage dashboard |
| Admin | ✅ Wallet-signed sign-in; token launch (`create_v2`); revenue ledger → buyback proposal → review → treasury-signed execution → on-chain-verified log; SPL burn |

## Architecture

```
app/                     routes (landing, /app/*, /admin/*, /privacy, /sandbox) and API handlers
components/              landing, chat, wallet, token, privacy, credits, media, code, admin, ui
lib/privacy/             detectors, sanitizer, placeholder maps, restoration, client pipeline
lib/ai/                  model registry, provider adapters, media adapters, Solana tool schemas
lib/solana/              address/links helpers, server connection (genesis-checked), price feed,
                         token metadata, client tool executor, pump.ts facade
lib/pump/                Pump / PumpSwap integration (quotes, unsigned txs, launch)
lib/payments/            payment tx construction + pure on-chain validation
lib/credits/             credit / bonus / discount / quote math (pure)
lib/storage/             IndexedDB (conversations, maps, media, projects, settings)
server/                  env validation, DB (Drizzle), auth (accounts, API keys, admin, wallet proofs),
                         services (chat, ledger, payments, buyback, token info)
types/                   shared wire types
tests/unit, tests/e2e    Vitest, Playwright (+ fixtures/mock-provider.mjs)
```

### Privacy request path

1. **Browser** — `sanitizePrompt(text, mode, map)` replaces detected values with stable placeholders (`[PERSON_1]`, `[CITY_1]`, `[WALLET_1]` …). The map is stored with the conversation in IndexedDB and never sent.
2. **Server** (`/api/chat`) — receives only sanitized text, chooses the model, streams NDJSON events, records token counts. No prompt or completion text is stored or logged.
3. **Provider** — sees sanitized text and the server's IP.
4. **Browser** — `restoreResponse` / `restorePartial` swap placeholders back while streaming. Each user message keeps a receipt (*You sent* / *Model received*).

Modes: **Smart** (names via cues + dictionary, places, contact details, IDs, cards (Luhn), IBANs (mod-97), wallets, tx signatures, addresses, postcodes, birth dates, handles, orgs), **Strict** (adds every remaining proper noun, 3+ digit numbers, all dates/URLs, countries), **Off** (as written). Secrets — BIP-39 recovery phrases, keypair arrays, private-key-looking values, API tokens, PEM keys — are removed in every mode.

**Limitations** (also on `/privacy`): detection is heuristic and English-centric; context can still identify people; images are sent unmodified; providers apply their own data policies; this is data minimisation, not cryptographic anonymity. The API's optional `privacy` field filters server-side, so raw text reaches the server in that mode.

### Accounts

Pseudonymous: a random id and the SHA-256 of a 256-bit recovery key (httpOnly cookie + a downloadable recovery file shown once). No email, password or wallet on file. Free chat needs no account.

### Payments

```
POST /api/payments/intents  → quote (Pyth SOL/USD, USDC = $1, token from curve/pool price),
                              unsigned transfer to the treasury with a unique read-only reference key
wallet signs & sends        → client polls confirmation
POST /api/payments/verify   → server fetches the tx at PAYMENT_COMMITMENT and checks:
                              success · payer signed · reference present · destination (treasury / treasury ATA)
                              · mint · amount ≥ quote (instruction + balance delta) · within quote window
                              → one DB transaction: intent pending→completed, payment row (UNIQUE signature),
                              ledger credit (UNIQUE ref), optional fixed-duration subscription
```

Replays fail on the unique signature; double-fulfilment fails on the intent status guard and the ledger's unique `(ref_type, ref_id)`. A browser "success" callback never issues credits.

### Pump.fun / PumpSwap

`lib/solana/pump.ts` exposes `getPumpCoin`, `getBondingCurveState`, `getTokenQuote`, `prepareBuyTransaction`, `prepareSellTransaction`, `getGraduationStatus`, `getPumpSwapPool`, built on `@pump-fun/pump-sdk` and `@pump-fun/pump-swap-sdk`. All transactions are returned unsigned; the browser checks the fee payer and that every instruction targets an allow-listed program before asking the wallet.

### Token utility

- **Burn for credits** — users burn $VEIL (an SPL `burnChecked` from their own wallet, tagged with the intent reference) and get credits at `TOKEN_BURN_DISCOUNT_BPS` off the USDC price. Verified on-chain like any payment; excluded from revenue. Enabled once `PROJECT_TOKEN_MINT` is set.
- **Credit bonus** for token payments (`TOKEN_CREDIT_BONUS_BPS`) and **plan discount** (`TOKEN_PLAN_DISCOUNT_BPS`) — active.
- **Token-gated benefit** — holders (≥ `TOKEN_GATE_HOLDER_MIN`) prove ownership with a signed message (no transaction) for 3× free messages for 24 h. Only "holder until …" is stored.
- **Buyback & burn** — admin-only and manual: revenue ledger → proposal (`BUYBACK_ALLOCATION_BPS` of net) → approve/reject → unsigned Pump/PumpSwap buy with the treasury as payer → treasury wallet signs → server verifies on-chain and logs. Burns are SPL `burnChecked` from the treasury ATA. Nothing is scheduled or automatic. The landing page labels this **Planned** unless `TOKEN_BUYBACK_STATUS=active`.

### Token launch (admin)

`/admin/launch`: name, ticker, description, image, links, optional initial buy. Image + metadata upload to IPFS needs `PINATA_JWT` (or paste your own metadata URI). The mint keypair is generated in the admin's browser, co-signs, and is discarded; the server never sees it. Devnet by default; mainnet needs `ALLOW_MAINNET_TOKEN_CREATION=true` **and** a typed confirmation, and the wallet still asks. After launch, set `PROJECT_TOKEN_MINT`.

## Security

- Provider keys, RPC secrets, DB credentials and admin secrets are read only in `server/` modules guarded by `server-only` (a client import fails the build). `server/env.ts` validates everything with Zod and refuses to start production without `SERVER_SECRET`.
- Per-request nonce CSP (`proxy.ts`): no inline/eval scripts in production; connect-src limited to self, the configured public RPC and used provider/wallet hosts. HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies (`next.config.ts`).
- Model output is rendered with `rehype-sanitize`; remote images in model output are never loaded.
- Uploads: size/count limits and magic-byte MIME validation on both client and server; remote image URLs are rejected by the API (no SSRF); provider assets are fetched only from allow-listed hosts.
- Rate limits on every mutating route (memory, or Upstash when configured). Same-origin checks on state-changing requests; `SameSite=Strict` httpOnly cookies.
- RPC: the server verifies the RPC's genesis hash matches `SOLANA_NETWORK`; the browser proxy allows only read methods plus `sendTransaction`/`simulateTransaction` of already-signed payloads.
- No private keys or seed phrases are ever requested, stored or handled; the AI cannot sign. Admin access is a wallet-signed message checked against `ADMIN_WALLETS` on every request.
- Code previews run at `/sandbox` inside `sandbox="allow-scripts"` (opaque origin) with a CSP that blocks all network access.

## Deployment checklist

1. `DATABASE_URL` (Postgres) → `npm run db:migrate`
2. `SERVER_SECRET`, `NEXT_PUBLIC_APP_URL`, `SOLANA_NETWORK`, `SOLANA_RPC_URL` (a dedicated RPC; public ones rate-limit)
3. At least one provider key; review model prices in `lib/ai/registry.ts` (or override with `CUSTOM_MODELS`)
4. `TREASURY_WALLET` (create its USDC / token ATAs in advance), plan & package prices
5. `UPSTASH_REDIS_REST_*` if running more than one instance
6. After launch: `PROJECT_TOKEN_MINT`

## Known gaps

- Gemini models don't use tools yet (marked in the UI); PDFs aren't accepted as attachments yet.
- Video/image model input schemas on Replicate change over time — see `VIDEO_MODELS` in `lib/ai/registry.ts`.
- Remote code runtimes (Node/Python containers) are an interface without an implementation.
- Free-tier quota and rate limits are per instance unless Upstash is configured.
- End-to-end tests cover payment and token UIs up to the wallet; signing paths are covered by unit tests of the verifier and ledger, not by a live wallet.

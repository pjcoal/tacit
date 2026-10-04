import type { Metadata } from "next";
import { Footer } from "@/components/landing/sections";
import { Nav } from "@/components/landing/nav";
import { getPublicConfig } from "@/server/public-config";

export const metadata: Metadata = { title: "Privacy model", description: "What the privacy filter does, what is stored where, and its limitations." };

const DETECTS: Array<[string, string, string]> = [
  ["Names", "PERSON · NAME", "Cue phrases (“my sister Aoife”, “email Tom”), honorifics, a dictionary of common given names; Strict adds every remaining proper noun"],
  ["Places", "CITY · PLACE · COUNTRY", "Major cities, “I live in …” style cues; countries in Strict"],
  ["Addresses", "ADDRESS · POSTCODE", "Street addresses, apartment numbers, Irish Eircodes, UK postcodes, US ZIP codes with context"],
  ["Contact", "EMAIL · PHONE · HANDLE · URL", "Emails, phone numbers, @handles, URLs with query strings or profile paths (all URLs in Strict)"],
  ["Identifiers", "ID · CARD · IBAN · IP", "US SSN, Irish PPSN, UK NI numbers, passport numbers with context, Luhn-valid cards, checksum-valid IBANs, IP addresses"],
  ["Crypto", "WALLET · TX", "Solana, EVM and Bitcoin addresses; transaction signatures"],
  ["Secrets", "SECRET", "Recovery phrases (BIP-39), Solana keypair arrays, private-key-looking values, API tokens and PEM keys — removed in every mode, including Off"],
  ["Organisations", "ORG", "“I work at …” cues and suffixes like Ltd, Inc, Bank, University"],
  ["Dates & numbers", "DATE · NUM", "Birth dates always; every date and number of 3+ digits in Strict"],
];

export default function PrivacyPage() {
  const cfg = getPublicConfig();
  return (
    <>
      <Nav />
      <main className="container-x pt-32 pb-24">
        <p className="eyebrow">Privacy model</p>
        <h1 className="display mt-5 max-w-4xl text-[clamp(44px,7vw,88px)]">What happens to what you type.</h1>
        <p className="lead mt-6">
          {cfg.appName} minimises what leaves your device. It is not an anonymity network and it does not make cryptographic guarantees. This page says precisely what it does.
        </p>

        <section className="mt-16 grid gap-10 lg:grid-cols-[260px_1fr]">
          <h2 className="font-serif text-[30px] leading-tight">The request path</h2>
          <ol className="space-y-4 text-[15px] leading-relaxed text-ink-2">
            <li><strong className="text-ink">1. In your browser</strong>, the composer scans your message and attachments’ text and replaces detected values with placeholders like [PERSON_1]. The mapping is stored in IndexedDB with that conversation.</li>
            <li><strong className="text-ink">2. Our server</strong> receives the sanitized conversation, picks the model, forwards it to the provider and streams the answer back. It records token counts for billing — never the text.</li>
            <li><strong className="text-ink">3. The model provider</strong> sees the sanitized conversation and our server’s IP address. We don’t send user identifiers. Each provider’s own API data policy applies.</li>
            <li><strong className="text-ink">4. Back in your browser</strong>, placeholders in the answer are swapped for the real values. Each message has a receipt showing what was sent.</li>
            <li><strong className="text-ink">Solana connector:</strong> wallet reads run in your browser; results pass through the same filter before the model sees them. Transfers are previews you approve in your wallet.</li>
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-[30px]">What the filter looks for</h2>
          <div className="card mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead className="border-b border-line bg-sunken font-mono text-[10.5px] uppercase tracking-wider text-dim">
                <tr>
                  <th className="px-4 py-3 font-normal">Category</th>
                  <th className="px-4 py-3 font-normal">Placeholders</th>
                  <th className="px-4 py-3 font-normal">How</th>
                </tr>
              </thead>
              <tbody>
                {DETECTS.map(([c, p, h]) => (
                  <tr key={c} className="border-b border-line-2 last:border-0 align-top">
                    <td className="px-4 py-3 font-medium">{c}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-ink-2">{p}</td>
                    <td className="px-4 py-3 text-ink-2">{h}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h2 className="text-[17px] font-semibold">Stored on our servers</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[14px] text-ink-2">
              <li>Accounts: a random id and the SHA-256 hash of your recovery key. No email, name or password.</li>
              <li>Credit ledger and usage counts: model, tokens, credits, time. No prompts or replies.</li>
              <li>Payments: the paying wallet address, amount, and transaction signature (needed to verify and to prevent replay). Payments are public on Solana anyway.</li>
              <li>API keys: SHA-256 hashes, names, and last-used time.</li>
              <li>Token-holder status: “holder until &lt;time&gt;” — not your wallet address.</li>
            </ul>
          </div>
          <div className="card p-6">
            <h2 className="text-[17px] font-semibold">Not stored</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[14px] text-ink-2">
              <li>Conversations, prompts, replies, attachments, generated images or code.</li>
              <li>Placeholder maps (they never leave your browser).</li>
              <li>IP addresses. They’re used transiently, as a keyed hash that rotates daily, for rate limits and the free quota.</li>
              <li>Analytics or advertising identifiers. There are no third-party scripts on this site.</li>
            </ul>
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-amber/30 bg-amber-soft p-6 sm:p-8">
          <h2 className="text-[17px] font-semibold">Limitations</h2>
          <ul className="mt-4 grid gap-3 text-[14px] text-ink-2 md:grid-cols-2">
            <li>Detection is heuristic and English-centric. Unusual names, nicknames and non-Latin scripts are often missed. Check the receipt.</li>
            <li>Context can still identify you (“the only vet in my village”). Strict mode removes more at the cost of answer quality.</li>
            <li>Images are sent unmodified, including any faces, documents or metadata they contain.</li>
            <li>Off mode sends your text as written (secrets are still removed).</li>
            <li>The API’s server-side privacy option means your raw text reaches our server; it isn’t stored, but it isn’t filtered on your device either.</li>
            <li>Model providers process the sanitized text under their own terms, and may retain it for abuse monitoring.</li>
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}

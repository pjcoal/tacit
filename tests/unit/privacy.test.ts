import { describe, expect, it } from "vitest";
import { createPlaceholderMap, restoreDeep, restorePartial, restoreResponse, sanitizePrompt } from "@/lib/privacy";

describe("sanitizePrompt", () => {
  it("anonymizes the reference example", () => {
    const r = sanitizePrompt("Find restaurants near my home in Dublin and send the result to Alice.", "smart");
    expect(r.sanitized).toBe("Find restaurants near my home in [CITY_1] and send the result to [PERSON_1].");
    expect(r.replacements.map((x) => x.value)).toEqual(["Dublin", "Alice"]);
  });

  it("replaces structured identifiers", () => {
    const r = sanitizePrompt(
      "Email siobhan.kelly@gmail.com or call +353 87 123 4567. Card 4111 1111 1111 1111, IBAN IE29 AIBK 9311 5212 3456 78, IP 10.0.0.12.",
      "smart",
    );
    expect(r.sanitized).not.toMatch(/siobhan|4111|IE29|353 87|10\.0\.0\.12/);
    expect(r.sanitized).toContain("[EMAIL_1]");
    expect(r.sanitized).toContain("[PHONE_1]");
    expect(r.sanitized).toContain("[CARD_1]");
    expect(r.sanitized).toContain("[IBAN_1]");
    expect(r.sanitized).toContain("[IP_1]");
  });

  it("does not treat an invalid card number as a card", () => {
    const r = sanitizePrompt("Order number 4111 1111 1111 1112 shipped.", "smart");
    expect(r.sanitized).not.toContain("[CARD_");
  });

  it("replaces Solana addresses and keeps amounts", () => {
    const r = sanitizePrompt("Send 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", "smart");
    expect(r.sanitized).toBe("Send 0.1 SOL to [WALLET_1]");
  });

  it("uses stable placeholders across messages in a conversation", () => {
    const a = sanitizePrompt("Tell Alice I'm in Paris.", "smart");
    const b = sanitizePrompt("Did Alice like Paris?", "smart", a.map);
    expect(b.sanitized).toBe("Did [PERSON_1] like [CITY_1]?");
    expect(Object.keys(b.map.byPlaceholder)).toHaveLength(2);
  });

  it("captures surnames, honorifics and relationship cues", () => {
    const r = sanitizePrompt("My sister Aoife and Dr. Byrne met Maya Okafor.", "smart");
    expect(r.sanitized).toBe("My sister [PERSON_1] and Dr. [PERSON_2] met [PERSON_3].");
  });

  it("removes secrets in every mode, including off", () => {
    const phrase = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    for (const mode of ["smart", "strict", "off"] as const) {
      const r = sanitizePrompt(`my seed is ${phrase} please help`, mode);
      expect(r.sanitized).not.toContain("abandon");
      expect(r.sanitized).toContain("[SECRET_1]");
      expect(r.sanitized.endsWith("please help")).toBe(true);
      expect(r.warnings.some((w) => /private key|recovery phrase/i.test(w))).toBe(true);
    }
    expect(sanitizePrompt("key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123", "off").sanitized).toBe("key [SECRET_1]");
  });

  it("off mode leaves ordinary personal data untouched", () => {
    const r = sanitizePrompt("Find restaurants near my home in Dublin and send the result to Alice.", "off");
    expect(r.sanitized).toBe("Find restaurants near my home in Dublin and send the result to Alice.");
    expect(r.warnings[0]).toMatch(/off/i);
  });

  it("strict mode removes more context", () => {
    const smart = sanitizePrompt("We met at Kilbeggan Distillery on 3 March 2021 with 2500 guests from France.", "smart");
    const strict = sanitizePrompt("We met at Kilbeggan Distillery on 3 March 2021 with 2500 guests from France.", "strict");
    expect(smart.sanitized).toContain("France");
    expect(strict.sanitized).not.toMatch(/Kilbeggan|2021|2500|France/);
  });

  it("does not rewrite identifiers inside code blocks with name heuristics", () => {
    const r = sanitizePrompt("```js\nconst Alice = new Foo();\n```\nExplain this", "smart");
    expect(r.sanitized).toContain("const Alice = new Foo();");
  });

  it("leaves existing placeholders alone", () => {
    const r = sanitizePrompt("Remind [PERSON_1] about it", "strict");
    expect(r.sanitized).toBe("Remind [PERSON_1] about it");
  });

  it("does not flag ordinary sentences", () => {
    expect(sanitizePrompt("What is the capital of France? Explain photosynthesis.", "smart").replacements).toHaveLength(0);
  });
});

describe("restoration", () => {
  const { map } = sanitizePrompt("Send the lease to Maya at maya@example.com", "smart");

  it("restores placeholders in model output", () => {
    expect(restoreResponse("Hi [PERSON_1], I emailed [EMAIL_1].", map)).toBe("Hi Maya, I emailed maya@example.com.");
  });

  it("restores bare tokens the model wrote without brackets, but only known ones", () => {
    expect(restoreResponse("PERSON_1 and PERSON_9", map)).toBe("Maya and PERSON_9");
  });

  it("round-trips sanitize → restore", () => {
    const text = "My name is Siobhan Kelly, I live at 14 Grafton Street, D02 X285. Text me on 087 123 4567.";
    const r = sanitizePrompt(text, "smart");
    expect(restoreResponse(r.sanitized, r.map)).toBe(text);
  });

  it("hides an incomplete placeholder while streaming", () => {
    expect(restorePartial("Hello [PERS", map)).toBe("Hello ");
    expect(restorePartial("Hello [PERSON_1", map)).toBe("Hello ");
    expect(restorePartial("Hello [PERSON_1]", map)).toBe("Hello Maya");
  });

  it("restores nested tool arguments", () => {
    expect(restoreDeep({ to: "[EMAIL_1]", list: ["[PERSON_1]"] }, map)).toEqual({ to: "maya@example.com", list: ["Maya"] });
  });

  it("never invents values for unknown placeholders", () => {
    expect(restoreResponse("[CITY_4]", createPlaceholderMap())).toBe("[CITY_4]");
  });
});

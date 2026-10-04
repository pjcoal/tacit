import bs58 from "bs58";
import { describe, expect, it } from "vitest";
import { bundleStaticProject, parseAgentFiles } from "@/lib/code/sandbox";
import { sniffImageMime, validateImageBase64 } from "@/lib/security/uploads";
import { isBase58PublicKey, isBase58Signature64 } from "@/lib/solana/address";
import { tokenLinks } from "@/lib/solana/links";

describe("coding agent file parsing", () => {
  it("extracts complete and in-progress files", () => {
    const out = "Plan\n```html file=index.html\n<h1>Hi</h1>\n```\nThen\n```css file=style.css\nbody{";
    const r = parseAgentFiles(out);
    expect(r.files).toEqual({ "index.html": "<h1>Hi</h1>" });
    expect(r.writing).toBe("style.css");
  });

  it("inlines local css/js into the preview document", () => {
    const html = bundleStaticProject({
      "index.html": '<link rel="stylesheet" href="./style.css"><script src="app.js"></script>',
      "style.css": "body{color:red}",
      "app.js": "console.log('</script>')",
    });
    expect(html).toContain("<style>\nbody{color:red}\n</style>");
    expect(html).toContain("<\\/script");
    expect(html).not.toContain('src="app.js"');
  });
});

describe("upload validation", () => {
  const png = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0));
  it("sniffs magic bytes", () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageMime(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
  it("rejects mismatched declared types", () => {
    expect(validateImageBase64("image/png", png)).toBe("image/png");
    expect(() => validateImageBase64("image/jpeg", png)).toThrow(/does not match/);
    expect(() => validateImageBase64("image/png", "not base64!!")).toThrow();
  });
});

describe("solana helpers", () => {
  it("validates keys and signatures", () => {
    expect(isBase58PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe(true);
    expect(isBase58PublicKey("not-a-key")).toBe(false);
    const sig = bs58.encode(crypto.getRandomValues(new Uint8Array(64)));
    expect(isBase58Signature64(sig)).toBe(true);
    expect(isBase58Signature64(bs58.encode(crypto.getRandomValues(new Uint8Array(32))))).toBe(false);
  });
  it("derives token links from the mint", () => {
    const l = tokenLinks("Mint111", "devnet");
    expect(l.pump).toBe("https://pump.fun/coin/Mint111");
    expect(l.explorer).toContain("cluster=devnet");
    expect(l.chart).toBeNull();
    expect(tokenLinks("Mint111", "mainnet-beta").chart).toContain("dexscreener");
  });
});

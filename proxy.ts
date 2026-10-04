import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy with a script nonce.
 * - Scripts: only our own (nonce + strict-dynamic); no inline/eval in production.
 * - Styles: 'unsafe-inline' is required for server-rendered style attributes (animation library).
 * - Network: our origin, the configured public RPC, and wallet/provider hosts that are actually used.
 */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, isDev: boolean): string {
  const rpc = originOf(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
  const rpcWs = rpc ? rpc.replace(/^http/, "ws") : null;
  const walletConnect = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    ? ["https://*.walletconnect.com", "https://*.walletconnect.org", "wss://*.walletconnect.com", "wss://*.walletconnect.org", "https://*.reown.com", "wss://*.reown.com"]
    : [];
  const connect = ["'self'", rpc, rpcWs, "https://replicate.delivery", "https://*.replicate.delivery", ...walletConnect, isDev ? "ws:" : null].filter(Boolean);
  const frames = ["'self'", ...(walletConnect.length ? ["https://verify.walletconnect.com", "https://verify.walletconnect.org"] : [])];

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "media-src 'self' blob: https://replicate.delivery https://*.replicate.delivery",
    `frame-src ${frames.join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|sandbox|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

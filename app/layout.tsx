import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import { ConfigProvider } from "@/components/providers/config-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { getPublicConfig } from "@/server/public-config";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
// Faces needed for the first viewport are preloaded; the mono face swaps in later.
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal"], variable: "--font-instrument", display: "swap" });
const instrumentItalic = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic"], variable: "--font-instrument-italic", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const cfg = getPublicConfig();
  return {
    metadataBase: new URL(cfg.appUrl),
    title: { default: `${cfg.appName} — Private AI on Solana`, template: `%s · ${cfg.appName}` },
    description:
      "Chat, image, video and code with leading AI models. Personal details are replaced on your device before a request leaves it, history stays in your browser, and you can pay with a Solana wallet.",
    openGraph: { type: "website", siteName: cfg.appName },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e10" },
  ],
};

// Applies the saved theme before first paint to avoid a flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("tacit:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const config = getPublicConfig();
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable} ${instrumentItalic.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ConfigProvider config={config}>
          <MotionProvider>{children}</MotionProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}

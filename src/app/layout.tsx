import type { Metadata } from "next";
import { Albert_Sans, Noto_Sans_SC } from "next/font/google";
import { cnCopy } from "@/lib/i18n/cn";
import { buildThemeInitScript } from "@/lib/theme-init";
import "./globals.css";

const headingFont = Albert_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Noto_Sans_SC({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: cnCopy.metadataTitle,
    description: cnCopy.metadataDescription,
  };
}

const themeScript = buildThemeInitScript();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
      data-locale="cn"
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}

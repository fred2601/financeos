import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "FinanceOS", template: "%s · FinanceOS" },
  description:
    "FP&A platform: executive KPIs, budget vs actual, driver-based forecasting, scenarios and a grounded AI analyst. Demo uses fictional data.",
  applicationName: "FinanceOS",
  openGraph: {
    title: "FinanceOS — financial planning & analysis",
    description: "Executive dashboard, budget vs actual, forecasting, scenarios and an AI analyst. Fictional demo data.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileNav />
            <main id="main" className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

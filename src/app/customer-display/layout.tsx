import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Prompt } from "next/font/google";

// A rounder, more modern Thai + Latin face for the customer-facing screen only.
const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = { title: "MADD — Customer Display" };

export default function CustomerDisplayLayout({ children }: { children: ReactNode }) {
  return <div className={`${prompt.className} flex min-h-screen flex-col`}>{children}</div>;
}

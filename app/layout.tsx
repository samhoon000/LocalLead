import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalLead — Find businesses worth contacting",
  description: "Discover local businesses, identify website gaps, and build qualified prospect lists."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

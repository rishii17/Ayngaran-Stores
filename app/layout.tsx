import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "@fontsource/noto-sans-tamil/400.css";
import "./globals.css";
import Script from "next/script";
import { metadataExtensionCleanup } from "../lib/extension-hydration.mjs";
export const metadata = {
  title: "Ayngaran Stores · Point of Sale",
  description: "Billing, inventory and customer accounts for Ayngaran Stores.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Extensions can add body attributes before React loads. */}
      <body suppressHydrationWarning>
        <Script
          id="metadata-extension-cleanup"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: metadataExtensionCleanup }}
        />
        {children}
      </body>
    </html>
  );
}

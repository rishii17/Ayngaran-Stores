import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "@fontsource/noto-sans-tamil/400.css";
import "./globals.css";
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

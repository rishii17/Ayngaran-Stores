import MobileScanner from "../../components/mobile-scanner";
export const metadata = {
  title: "Ayngaran Mobile Scanner",
  manifest: "/mobile-scanner.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ayngaran Scan",
    statusBarStyle: "default",
  },
  icons: { apple: "/scanner-192.png" },
};
export default function Page() {
  return <MobileScanner />;
}

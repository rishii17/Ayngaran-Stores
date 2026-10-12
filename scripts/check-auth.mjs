// Read-only authentication check: creates no account and sends no email.
import "./check-env.mjs";
if (!process.exitCode) {
  try {
    const response = await fetch(
      new URL("/auth/v1/settings", process.env.NEXT_PUBLIC_SUPABASE_URL),
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw Error(
          "Supabase rejected the public API key. Copy the active publishable key from the same project's Settings > API Keys into .env.local, then rebuild/restart Next.js.",
        );
      throw Error(
        `Supabase Auth returned HTTP ${response.status}. Check the project's status and retry.`,
      );
    }
    console.log(
      "PASS: Supabase Auth accepts this URL and public key. No account was created. Restart npm run dev, or rebuild with npm run build before npm start, to update the browser's key.",
    );
  } catch (error) {
    console.error(
      error.message === "fetch failed"
        ? "Unable to reach Supabase Auth. Check internet, DNS and NEXT_PUBLIC_SUPABASE_URL; this does not prove the API key is invalid."
        : error.name === "TimeoutError"
          ? "Supabase Auth timed out. Check your connection and retry."
          : error.message,
    );
    process.exitCode = 1;
  }
}

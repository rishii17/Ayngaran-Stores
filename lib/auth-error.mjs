export function authErrorMessage(error) {
  const message =
    typeof error?.message === "string"
      ? error.message
      : "Unable to sign in. Please retry.";
  if (/invalid api key|invalid_api_key/i.test(message))
    return "Supabase rejected this app’s API key. In .env.local, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the same Supabase project (Settings → API Keys). Run npm run check:auth, then restart npm run dev; for production, run npm run build before npm start. Never use a secret or service-role key.";
  return message;
}

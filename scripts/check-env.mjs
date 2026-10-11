const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url && !key && process.argv.includes("--allow-missing")) {
  console.log("No Supabase environment configured: building sample mode only.");
  process.exit(0);
}
const issues = [];
if (!url) issues.push("NEXT_PUBLIC_SUPABASE_URL is missing");
else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:")
      issues.push("Supabase URL must use HTTPS");
  } catch {
    issues.push("Supabase URL is invalid");
  }
}
if (!key || key === "your_publishable_key")
  issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");
else if (!key.startsWith("sb_publishable_")) {
  try {
    const claims = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    );
    if (claims.role !== "anon")
      issues.push("The browser must only use a publishable or legacy anon key");
  } catch {
    issues.push(
      "Use a valid publishable key; never use a secret/service-role key",
    );
  }
}
if (issues.length) {
  for (const issue of issues) console.error(issue);
  process.exitCode = 1;
} else
  console.log(
    "PASS: Supabase URL and public client key are configured. Values were not printed. Live sign-in is still required to verify database access.",
  );

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
export const supabasePublishableKey = process.env
  .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY env vars"
  );
}

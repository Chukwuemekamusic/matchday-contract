import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase session cookie on navigation so server components see a valid,
 * unexpired session (they can read cookies but not write them).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Validates the JWT and refreshes it when it's close to expiry
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Skip static assets, generated images and machine-to-machine routes
  matcher: [
    "/((?!_next/static|_next/image|icon|apple-icon|opengraph-image|manifest.webmanifest|api/keeper|api/health|.*\\.(?:png|jpg|svg|ico)$).*)",
  ],
};

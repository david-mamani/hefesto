import { NextResponse, userAgent } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/*
 * Dynamic serving: one URL, two real route trees.
 * App pages are internally rewritten to /m (mobile) or /d (desktop) —
 * the browser URL never shows the tree prefix.
 */
const TREE_PREFIXES = { mobile: "/m", desktop: "/d" } as const;

type DeviceMode = keyof typeof TREE_PREFIXES;

function resolveDeviceMode(request: NextRequest): DeviceMode {
  const override = request.cookies.get("device-mode")?.value;
  if (override === "mobile" || override === "desktop") return override;

  const hint = request.headers.get("sec-ch-ua-mobile");
  if (hint === "?1") return "mobile";
  if (hint === "?0") return "desktop";

  // Tablets deliberately resolve to desktop
  return userAgent(request).device.type === "mobile" ? "mobile" : "desktop";
}

function isSharedPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dev/") // device-agnostic dev tools (mascot playground), no auth
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The internal trees are not addressable directly — canonical URLs only
  for (const prefix of Object.values(TREE_PREFIXES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(prefix.length) || "/";
      return NextResponse.redirect(url);
    }
  }

  const shared = isSharedPath(pathname);
  const mode = resolveDeviceMode(request);

  const makeResponse = () => {
    let res: NextResponse;
    if (shared) {
      res = NextResponse.next({ request });
    } else {
      const url = request.nextUrl.clone();
      url.pathname = `${TREE_PREFIXES[mode]}${pathname === "/" ? "" : pathname}`;
      res = NextResponse.rewrite(url, { request });
    }
    res.headers.append("Vary", "Sec-CH-UA-Mobile");
    res.headers.set("Accept-CH", "Sec-CH-UA-Mobile, Sec-CH-UA-Platform");
    return res;
  };

  let response = makeResponse();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = makeResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectWithCookies = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
    return redirect;
  };

  if (!user && !shared) return redirectWithCookies("/login");
  if (user && pathname === "/login") return redirectWithCookies("/");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons/|mascot/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml|json)$).*)",
  ],
};

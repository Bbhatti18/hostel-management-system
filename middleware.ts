import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "dummy-key";

const adminRoutes = [
  "/dashboard",
  "/residents",
  "/rooms",
  "/beds",
  "/admissions",
  "/contracts",
  "/contract-template",
  "/billing",
  "/payments",
  "/payment-verification",
  "/inspection",
  "/maintenance",
  "/notices",
  "/reports",
  "/settings",
  "/users",
  "/profile",
];

const residentPortalPath = "/resident-portal";
const loginPath = "/login";

function isAdminRoute(pathname: string) {
  return adminRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isResidentPortalRoute(pathname: string) {
  return pathname === residentPortalPath || pathname.startsWith(`${residentPortalPath}/`);
}

function createCookieStorage(request: NextRequest, response: NextResponse) {
  return {
    getItem(key: string) {
      return request.cookies.get(key)?.value ?? null;
    },
    setItem(key: string, value: string) {
      response.cookies.set(key, value, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    },
    removeItem(key: string) {
      response.cookies.delete(key);
    },
  };
}

function createServerClient(request: NextRequest, response: NextResponse) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: createCookieStorage(request, response),
      storageKey: "sb-auth-token",
    },
  });
}

async function getUserRole(supabase: any, email: string | undefined) {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase();

  const { data: staffUser } = await supabase
    .from("staff_users")
    .select("email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (staffUser?.email) {
    return "staff" as const;
  }

  const { data: residentUser } = await supabase
    .from("residents")
    .select("email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  return residentUser?.email ? ("resident" as const) : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  if (pathname === loginPath) {
    return response;
  }

  const supabase = createServerClient(request, response);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  const role = await getUserRole(supabase, session.user.email);

  if (isAdminRoute(pathname)) {
    if (role === "staff") {
      return response;
    }

    if (role === "resident") {
      return NextResponse.redirect(new URL(residentPortalPath, request.url));
    }

    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (isResidentPortalRoute(pathname)) {
    if (role === "resident" || role === "staff") {
      return response;
    }

    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|json|xml)$).*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_STAFF_ROLES = new Set([
  "super admin",
  "admin",
  "manager",
  "reception",
]);

function createTemporaryPassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = new Uint32Array(14);
  crypto.getRandomValues(random);
  const body = Array.from(random, (value) => alphabet[value % alphabet.length]).join(
    "",
  );
  return `Hms@${body}`;
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Your admin session could not be verified." },
        { status: 401 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is incomplete." },
        { status: 500 },
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);
    const staffEmail = authData.user?.email?.trim().toLowerCase();

    if (authError || !staffEmail) {
      return NextResponse.json(
        { error: "Your admin session could not be verified." },
        { status: 401 },
      );
    }

    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff_users")
      .select("id, email, role, status")
      .ilike("email", staffEmail)
      .maybeSingle();

    const staffRole = String(staff?.role ?? "").trim().toLowerCase();
    const staffStatus = String(staff?.status ?? "").trim().toLowerCase();

    if (
      staffError ||
      !staff ||
      staffStatus !== "active" ||
      !ALLOWED_STAFF_ROLES.has(staffRole)
    ) {
      return NextResponse.json(
        { error: "You do not have permission to create resident logins." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { residentId?: unknown }
      | null;
    const residentId =
      typeof body?.residentId === "string" ? body.residentId.trim() : "";

    if (!residentId) {
      return NextResponse.json(
        { error: "A valid resident is required." },
        { status: 400 },
      );
    }

    const { data: resident, error: residentError } = await supabaseAdmin
      .from("residents")
      .select("id, full_name, email, status")
      .eq("id", residentId)
      .maybeSingle();

    if (residentError || !resident) {
      return NextResponse.json(
        { error: "The resident profile could not be verified." },
        { status: 404 },
      );
    }

    if (String(resident.status ?? "").trim().toLowerCase() === "archived") {
      return NextResponse.json(
        { error: "Archived residents cannot receive a new portal login." },
        { status: 400 },
      );
    }

    const email = String(resident.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "The resident must have an email address before a login can be created." },
        { status: 400 },
      );
    }

    let page = 1;
    let existingUser = null as { id: string; email?: string } | null;

    while (page <= 20 && !existingUser) {
      const { data: usersData, error: usersError } =
        await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });

      if (usersError) {
        return NextResponse.json(
          { error: "Existing portal accounts could not be checked." },
          { status: 500 },
        );
      }

      existingUser =
        usersData.users.find(
          (user) => user.email?.trim().toLowerCase() === email,
        ) ?? null;

      if (usersData.users.length < 1000) break;
      page += 1;
    }

    if (existingUser) {
      return NextResponse.json({
        created: false,
        email,
        temporaryPassword: null,
      });
    }

    const temporaryPassword = createTemporaryPassword();
    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          resident_id: resident.id,
          full_name: resident.full_name,
          account_type: "resident",
          must_change_password: true,
        },
      });

    if (createError || !createdUser.user) {
      const message = createError?.message?.toLowerCase() ?? "";
      if (message.includes("already") || message.includes("registered")) {
        return NextResponse.json({
          created: false,
          email,
          temporaryPassword: null,
        });
      }

      return NextResponse.json(
        { error: "The resident was saved, but the portal login could not be created." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      created: true,
      email,
      temporaryPassword,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to create the resident portal login." },
      { status: 500 },
    );
  }
}

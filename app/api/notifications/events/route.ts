import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyResidentEvent } from "@/lib/notifications/server";
import { isNotificationEventType } from "@/lib/notifications/types";

const STAFF_EVENT_ROLES: Record<string, Set<string>> = {
  admission_created: new Set(["super admin", "admin", "manager", "reception"]),
  bill_generated: new Set(["super admin", "admin", "accountant"]),
  contract_approved: new Set(["super admin", "admin", "manager", "reception"]),
};

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
}

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !supabaseUrl || !anonKey) {
      return json({ error: "Your session could not be verified." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);
    const email = authData.user?.email?.trim().toLowerCase() ?? "";
    if (authError || !email) {
      return json({ error: "Your session could not be verified." }, 401);
    }

    const body = (await request.json().catch(() => null)) as
      | { eventType?: unknown; entityId?: unknown }
      | null;
    const entityId =
      typeof body?.entityId === "string" ? body.entityId.trim() : "";
    if (!isNotificationEventType(body?.eventType) || !entityId) {
      return json({ error: "A valid notification event is required." }, 400);
    }
    const eventType = body.eventType;

    const allowedRoles = STAFF_EVENT_ROLES[eventType];
    if (allowedRoles) {
      const { data: staff } = await supabaseAdmin
        .from("staff_users")
        .select("role, status")
        .ilike("email", email)
        .maybeSingle();
      if (
        !staff ||
        String(staff.status).toLowerCase() !== "active" ||
        !allowedRoles.has(String(staff.role).toLowerCase())
      ) {
        return json(
          { error: "You do not have permission to request this notification." },
          403,
        );
      }
    } else if (eventType === "receipt_submitted") {
      const [{ data: resident }, { data: receipt }] = await Promise.all([
        supabaseAdmin
          .from("residents")
          .select("id, status")
          .ilike("email", email)
          .maybeSingle(),
        supabaseAdmin
          .from("payment_receipts")
          .select("resident_id")
          .eq("id", entityId)
          .maybeSingle(),
      ]);
      if (
        !resident ||
        !receipt ||
        resident.id !== receipt.resident_id ||
        String(resident.status).toLowerCase() === "archived"
      ) {
        return json(
          { error: "You do not have permission to request this notification." },
          403,
        );
      }
    } else {
      return json(
        { error: "This event can only be sent by its server-side verification workflow." },
        403,
      );
    }

    return json(await notifyResidentEvent(eventType, entityId));
  } catch {
    return json({
      delivered: false,
      configurationRequired: false,
      warning: true,
    });
  }
}

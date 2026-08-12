import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { securityDepositAdmissionId } from "@/lib/paymentReceiptPurpose";
import type { NotificationEventType, NotificationRequestResult } from "@/lib/notifications/types";

type Row = Record<string, unknown>;
type ChannelStatus = "sent" | "skipped" | "configuration_required" | "failed";
type EventMessage = {
  eventKey: string;
  residentId: string;
  email: string;
  phone: string;
  subject: string;
  body: string;
  parameters: string[];
};

const EVENT_MAX_AGE_MS = 15 * 60 * 1000;
const templateEnv: Record<NotificationEventType, string> = {
  admission_created: "WHATSAPP_TEMPLATE_ADMISSION_CREATED",
  bill_generated: "WHATSAPP_TEMPLATE_BILL_GENERATED",
  receipt_submitted: "WHATSAPP_TEMPLATE_RECEIPT_SUBMITTED",
  payment_verified: "WHATSAPP_TEMPLATE_PAYMENT_VERIFIED",
  payment_rejected: "WHATSAPP_TEMPLATE_PAYMENT_REJECTED",
  contract_approved: "WHATSAPP_TEMPLATE_CONTRACT_APPROVED",
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return text(value).toLowerCase();
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `Rs ${Number.isFinite(amount) ? amount.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : "0"}`;
}

function displayDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "Not recorded";
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return Number.isNaN(parsed.getTime())
    ? raw
    : parsed.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function recent(value: unknown) {
  const timestamp = new Date(text(value)).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= EVENT_MAX_AGE_MS;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function normalizePhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) {
    const digits = compact.slice(1);
    return /^\d{8,15}$/.test(digits) ? digits : "";
  }
  if (compact.startsWith("00")) {
    const digits = compact.slice(2);
    return /^\d{8,15}$/.test(digits) ? digits : "";
  }
  const country = text(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE).replace(/^\+/, "");
  if (!/^\d{1,3}$/.test(country)) return "";
  const digits = `${country}${compact.replace(/^0+/, "")}`;
  return /^\d{8,15}$/.test(digits) ? digits : "";
}

async function loadResident(residentId: string) {
  const { data, error } = await supabaseAdmin
    .from("residents")
    .select("id, full_name, email, phone, status")
    .eq("id", residentId)
    .maybeSingle();
  if (error || !data || normalized(data.status) === "archived") throw new Error("recipient_unavailable");
  return data as Row;
}

function message(
  eventType: NotificationEventType,
  entityId: string,
  resident: Row,
  subject: string,
  lines: string[],
  parameters: string[],
): EventMessage {
  const name = text(resident.full_name) || "Resident";
  return {
    eventKey: `${eventType}:${entityId}`,
    residentId: text(resident.id),
    email: text(resident.email),
    phone: text(resident.phone),
    subject,
    body: [`Hello ${name},`, "", ...lines, "", "Open the StayHub Resident Portal to review the latest details.", "", "StayHub / Hostel Management System"].join("\n"),
    parameters,
  };
}

async function resolveAdmission(entityId: string) {
  const { data: admission, error } = await supabaseAdmin.from("admissions")
    .select("id, resident_id, room_id, bed_id, admission_date, monthly_rent, security_deposit, status, created_at")
    .eq("id", entityId).maybeSingle();
  if (error || !admission || !recent(admission.created_at)) throw new Error("event_unavailable");
  const [{ data: room }, { data: bed }, { data: contract }, resident] = await Promise.all([
    supabaseAdmin.from("rooms").select("room_number").eq("id", admission.room_id).maybeSingle(),
    supabaseAdmin.from("beds").select("bed_number").eq("id", admission.bed_id).maybeSingle(),
    supabaseAdmin.from("contracts").select("status, contract_status").eq("admission_id", admission.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadResident(text(admission.resident_id)),
  ]);
  if (!contract) throw new Error("event_unavailable");
  const values = [text(resident.full_name) || "Resident", text(room?.room_number) || "—", text(bed?.bed_number) || "—", displayDate(admission.admission_date), money(admission.monthly_rent), money(admission.security_deposit), text(admission.status) || "Pending", text(contract.status || contract.contract_status) || "Pending Signature"];
  return message("admission_created", entityId, resident, "Your StayHub admission and contract are ready", [
    `Admission created for: ${values[0]}`,
    `Room / Bed: ${values[1]} / ${values[2]}`,
    `Admission date: ${values[3]}`,
    `Monthly rent: ${values[4]}`,
    `Security deposit: ${values[5]}`,
    `Admission status: ${values[6]}`,
    `Contract status: ${values[7]}. Your contract is ready for review and signature.`,
  ], values);
}

async function resolveBill(entityId: string) {
  const { data: bill, error } = await supabaseAdmin.from("bills")
    .select("id, resident_id, bill_number, billing_month, total_amount, rent_amount, electricity_amount, ac_amount, other_amount, due_date, balance_amount, bill_status, created_at")
    .eq("id", entityId).maybeSingle();
  if (error || !bill || !recent(bill.created_at) || ["cancelled", "archived"].includes(normalized(bill.bill_status))) throw new Error("event_unavailable");
  const resident = await loadResident(text(bill.resident_id));
  const components = [Number(bill.rent_amount) > 0 ? "Rent" : "", Number(bill.electricity_amount) > 0 ? "Electricity" : "", Number(bill.ac_amount) > 0 ? "AC" : "", Number(bill.other_amount) > 0 ? "Other" : ""].filter(Boolean).join(", ") || "Monthly bill";
  const values = [text(resident.full_name) || "Resident", text(bill.bill_number) || entityId, displayDate(bill.billing_month), money(bill.total_amount), components, displayDate(bill.due_date), money(bill.balance_amount)];
  return message("bill_generated", entityId, resident, `New StayHub bill ${values[1]}`, [`Bill: ${values[1]}`, `Billing month: ${values[2]}`, `Amount: ${values[3]}`, `Type: ${values[4]}`, `Due date: ${values[5]}`, `Outstanding: ${values[6]}`], values);
}

async function resolveReceipt(eventType: "receipt_submitted" | "payment_verified" | "payment_rejected", entityId: string) {
  const { data: receipt, error } = await supabaseAdmin.from("payment_receipts")
    .select("id, resident_id, bill_id, amount, status, notes, remarks, created_at, updated_at")
    .eq("id", entityId).maybeSingle();
  const expected = eventType === "receipt_submitted" ? "pending verification" : eventType === "payment_verified" ? "verified" : "rejected";
  const eventTime = eventType === "receipt_submitted" ? receipt?.created_at : receipt?.updated_at;
  if (error || !receipt || !recent(eventTime) || normalized(receipt.status) !== expected) throw new Error("event_unavailable");
  const depositAdmissionId = receipt.bill_id
    ? null
    : securityDepositAdmissionId(receipt.notes);
  const [{ data: bill }, { data: depositAdmission }, resident] = await Promise.all([
    receipt.bill_id ? supabaseAdmin.from("bills").select("bill_number, paid_amount, balance_amount, bill_status").eq("id", receipt.bill_id).maybeSingle() : Promise.resolve({ data: null }),
    depositAdmissionId ? supabaseAdmin.from("admissions").select("id, resident_id, deposit_status, status").eq("id", depositAdmissionId).maybeSingle() : Promise.resolve({ data: null }),
    loadResident(text(receipt.resident_id)),
  ]);
  const isDeposit = Boolean(
    depositAdmission &&
    depositAdmission.resident_id === receipt.resident_id &&
    !receipt.bill_id,
  );
  if (!bill && !isDeposit) throw new Error("event_unavailable");
  const name = text(resident.full_name) || "Resident";
  const billNumber = isDeposit ? "Security Deposit" : text(bill?.bill_number) || "Bill";
  const amount = money(receipt.amount);
  if (eventType === "receipt_submitted") {
    return message(eventType, entityId, resident, `Receipt received for ${billNumber}`, [`Receipt received for: ${billNumber}`, `Amount: ${amount}`, "Status: Pending Verification", "Your balance or deposit status will change only after admin verification."], [name, billNumber, amount, "Pending Verification"]);
  }
  if (eventType === "payment_verified") {
    if (isDeposit) {
      const status = text(depositAdmission?.deposit_status) || "Received";
      const admissionStatus = text(depositAdmission?.status) || "Pending";
      const state = admissionStatus === "Active"
        ? "Your admission is Active."
        : "Your admission remains Pending until an admin explicitly activates it.";
      const values = [name, billNumber, amount, amount, money(0), status, state];
      return message(eventType, entityId, resident, "Security Deposit verified", [`Verified deposit: ${amount}`, `Deposit status: ${status}`, `Admission status: ${admissionStatus}`, state], values);
    }
    const balance = money(bill?.balance_amount);
    const status = text(bill?.bill_status) || "Updated";
    const fullyPaid = Number(bill?.balance_amount ?? 0) <= 0 ? "This bill is fully paid." : "A balance remains outstanding.";
    const values = [name, billNumber, amount, money(bill?.paid_amount), balance, status, fullyPaid];
    return message(eventType, entityId, resident, `Payment verified for ${billNumber}`, [`Verified amount: ${amount}`, `Updated paid total: ${values[3]}`, `Outstanding: ${balance}`, `Bill status: ${status}`, fullyPaid], values);
  }
  const reason = text(receipt.remarks) || "Please contact hostel administration for details.";
  return message(eventType, entityId, resident, `Payment receipt rejected for ${billNumber}`, [`Rejected amount: ${amount}`, `Reason: ${reason}`, "Please review the reason and submit a corrected receipt through the Resident Portal."], [name, billNumber, amount, reason]);
}

async function resolveContract(entityId: string) {
  const { data: contract, error } = await supabaseAdmin.from("contracts")
    .select("id, resident_id, admission_id, resident_signature_status, status, contract_status, updated_at")
    .eq("id", entityId).maybeSingle();
  if (error || !contract || !recent(contract.updated_at) || normalized(contract.resident_signature_status) !== "approved") throw new Error("event_unavailable");
  const [{ data: admission }, resident] = await Promise.all([
    supabaseAdmin.from("admissions").select("status, deposit_status").eq("id", contract.admission_id).maybeSingle(),
    loadResident(text(contract.resident_id)),
  ]);
  if (!admission) throw new Error("event_unavailable");
  const active = normalized(admission.status) === "active";
  const state = active ? "Your admission is Active." : normalized(admission.deposit_status) !== "received" ? "Your admission remains Pending until the security deposit is received." : "Your admission remains Pending while activation is finalized.";
  const values = [text(resident.full_name) || "Resident", text(contract.status || contract.contract_status) || "Approved", text(admission.deposit_status) || "Pending", text(admission.status) || "Pending", state];
  return message("contract_approved", entityId, resident, "Your StayHub contract signature was approved", ["Your resident contract signature has been approved by hostel administration.", `Deposit status: ${values[2]}`, `Admission status: ${values[3]}`, state], values);
}

async function resolveEvent(eventType: NotificationEventType, entityId: string) {
  if (eventType === "admission_created") return resolveAdmission(entityId);
  if (eventType === "bill_generated") return resolveBill(entityId);
  if (eventType === "contract_approved") return resolveContract(entityId);
  return resolveReceipt(eventType, entityId);
}

async function sendEmail(event: EventMessage): Promise<ChannelStatus> {
  if (!event.email) return "skipped";
  const apiKey = text(process.env.RESEND_API_KEY);
  const fromAddress = text(process.env.NOTIFICATION_EMAIL_FROM);
  if (!apiKey || !fromAddress) return "configuration_required";
  const fromName = text(process.env.NOTIFICATION_EMAIL_FROM_NAME) || "StayHub";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${event.eventKey}:email` },
      body: JSON.stringify({ from: `${fromName} <${fromAddress}>`, to: [event.email], subject: event.subject, text: event.body, html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(event.body)}</div>` }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function sendWhatsApp(eventType: NotificationEventType, event: EventMessage): Promise<ChannelStatus> {
  const recipient = normalizePhone(event.phone);
  if (!recipient) return "skipped";
  const token = text(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneId = text(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const template = text(process.env[templateEnv[eventType]]);
  if (!token || !phoneId || !template) return "configuration_required";
  const version = text(process.env.WHATSAPP_API_VERSION) || "v23.0";
  const language = text(process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE) || "en_US";
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [{ type: "body", parameters: event.parameters.map((parameter) => ({ type: "text", text: parameter })) }],
        },
      }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

function publicResult(emailStatus: ChannelStatus, whatsappStatus: ChannelStatus): NotificationRequestResult {
  const statuses = [emailStatus, whatsappStatus];
  return {
    delivered: statuses.includes("sent"),
    configurationRequired: statuses.includes("configuration_required"),
    warning:
      statuses.includes("failed") ||
      statuses.includes("configuration_required") ||
      statuses.every((status) => status === "skipped"),
  };
}

export async function notifyResidentEvent(
  eventType: NotificationEventType,
  entityId: string,
): Promise<NotificationRequestResult> {
  try {
    const event = await resolveEvent(eventType, entityId);
    const insert = await supabaseAdmin.from("notification_deliveries").insert({
      event_key: event.eventKey,
      event_type: eventType,
      entity_id: entityId,
      resident_id: event.residentId,
      status: "processing",
    }).select("id, email_status, whatsapp_status, status, attempt_count").single();

    let delivery = insert.data;
    if (insert.error?.code === "23505") {
      const existing = await supabaseAdmin.from("notification_deliveries")
        .select("id, email_status, whatsapp_status, status, attempt_count")
        .eq("event_key", event.eventKey)
        .maybeSingle();
      if (existing.error || !existing.data) throw new Error("ledger_unavailable");
      delivery = existing.data;
      if (delivery.status === "processing" || delivery.status === "complete") {
        return publicResult(delivery.email_status as ChannelStatus, delivery.whatsapp_status as ChannelStatus);
      }
      const { data: reclaimed } = await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: "processing",
          attempt_count: Number(delivery.attempt_count ?? 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
        .eq("status", delivery.status)
        .select("id")
        .maybeSingle();
      if (!reclaimed) {
        return publicResult(
          delivery.email_status as ChannelStatus,
          delivery.whatsapp_status as ChannelStatus,
        );
      }
    } else if (insert.error || !delivery) {
      throw new Error("ledger_unavailable");
    }

    const priorEmail = delivery.email_status as ChannelStatus | null;
    const priorWhatsApp = delivery.whatsapp_status as ChannelStatus | null;
    const emailStatus = priorEmail === "sent" || priorEmail === "skipped" ? priorEmail : await sendEmail(event);
    const whatsappStatus = priorWhatsApp === "sent" || priorWhatsApp === "skipped" ? priorWhatsApp : await sendWhatsApp(eventType, event);
    const result = publicResult(emailStatus, whatsappStatus);
    const complete = [emailStatus, whatsappStatus].every((status) => status === "sent" || status === "skipped");

    await supabaseAdmin.from("notification_deliveries").update({
      email_status: emailStatus,
      whatsapp_status: whatsappStatus,
      status: complete ? "complete" : result.delivered ? "partial" : result.configurationRequired ? "configuration_required" : "failed",
      last_error_code: result.warning ? "notification_delivery_incomplete" : null,
      completed_at: complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", delivery.id);

    if (result.warning) {
      console.warn("[notifications] Delivery incomplete.", { eventType, entityId, emailStatus, whatsappStatus });
    }
    return result;
  } catch {
    console.warn("[notifications] Event notification could not be completed.", { eventType, entityId });
    return { delivered: false, configurationRequired: false, warning: true };
  }
}

"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type GenericRow = Record<string, unknown>;

type PortalTab =
  | "Overview"
  | "Profile"
  | "Room"
  | "Contract"
  | "Bills"
  | "Payments"
  | "Notices"
  | "Inspections"
  | "Maintenance";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function firstText(row: GenericRow | null, keys: string[]) {
  if (!row) return "";

  for (const key of keys) {
    const value = row[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return "";
}

function residentName(row: GenericRow | null) {
  const direct = firstText(row, ["full_name", "resident_name", "name"]);
  if (direct) return direct;

  const combined = `${firstText(row, ["first_name"])} ${firstText(row, [
    "last_name",
    "surname",
  ])}`.trim();

  return (
    combined ||
    firstText(row, ["phone", "email", "cnic"]) ||
    "Resident"
  );
}

function roomName(row: GenericRow | null) {
  return firstText(row, ["room_number", "number", "name"]) || "—";
}

function bedName(row: GenericRow | null) {
  return firstText(row, ["bed_number", "bed_code", "number", "name"]) || "—";
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ResidentPortalPage() {
  const router = useRouter();
  const [resident, setResident] = useState<GenericRow | null>(null);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [portalRole, setPortalRole] = useState<"resident" | "staff" | null>(null);
  const [residentOptions, setResidentOptions] = useState<GenericRow[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState<string>("");
  const [admission, setAdmission] = useState<GenericRow | null>(null);
  const [room, setRoom] = useState<GenericRow | null>(null);
  const [bed, setBed] = useState<GenericRow | null>(null);
  const [contract, setContract] = useState<GenericRow | null>(null);
  const [bills, setBills] = useState<GenericRow[]>([]);
  const [payments, setPayments] = useState<GenericRow[]>([]);
  const [notices, setNotices] = useState<GenericRow[]>([]);
  const [inspections, setInspections] = useState<GenericRow[]>([]);
  const [maintenance, setMaintenance] = useState<GenericRow[]>([]);
  const [activeTab, setActiveTab] = useState<PortalTab>("Overview");
  const [receiptBillId, setReceiptBillId] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPortalData = useCallback(async (residentId: string, residentRow?: GenericRow) => {
    setLoading(true);
    setError("");

    const residentResult = residentRow
      ? { data: residentRow, error: null }
      : await supabase
          .from("residents")
          .select("*")
          .eq("id", residentId)
          .maybeSingle();

    if (residentResult.error || !residentResult.data) {
      setError(residentResult.error?.message || "Resident record not found.");
      setLoading(false);
      return;
    }

    const residentPayload = residentResult.data as GenericRow;

    const [
      admissionResult,
      contractResult,
      billsResult,
      paymentsResult,
      noticesResult,
      inspectionsResult,
      maintenanceResult,
    ] = await Promise.all([
      supabase
        .from("admissions")
        .select("*")
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("contracts")
        .select("*")
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("bills")
        .select("*")
        .eq("resident_id", residentId)
        .order("billing_month", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("notices")
        .select("*")
        .in("audience", ["All Residents", "Everyone", "Specific Resident"])
        .order("pinned", { ascending: false })
        .order("publish_date", { ascending: false }),
      supabase
        .from("room_inspections")
        .select("*")
        .eq("resident_id", residentId)
        .order("inspection_date", { ascending: false }),
      supabase
        .from("maintenance_requests")
        .select("*")
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false }),
    ]);

    const activeAdmission = (admissionResult.data ?? null) as GenericRow | null;

    let roomRow: GenericRow | null = null;
    let bedRow: GenericRow | null = null;

    const roomId = firstText(activeAdmission, ["room_id"]);
    const bedId = firstText(activeAdmission, ["bed_id"]);

    if (roomId) {
      const roomResult = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      roomRow = (roomResult.data ?? null) as GenericRow | null;
    }

    if (bedId) {
      const bedResult = await supabase
        .from("beds")
        .select("*")
        .eq("id", bedId)
        .maybeSingle();

      bedRow = (bedResult.data ?? null) as GenericRow | null;
    }

    const filteredNotices = ((noticesResult.data ?? []) as GenericRow[])
      .filter((notice) => {
        const audience = firstText(notice, ["audience"]);

        if (audience !== "Specific Resident") return true;

        return firstText(notice, ["resident_id"]) === residentId;
      })
      .filter((notice) => {
        const status = firstText(notice, ["status"]);

        return status === "Published" || status === "";
      });

    setResident(residentPayload);
    setAdmission(activeAdmission);
    setRoom(roomRow);
    setBed(bedRow);
    setContract((contractResult.data ?? null) as GenericRow | null);
    setBills((billsResult.data ?? []) as GenericRow[]);
    setPayments((paymentsResult.data ?? []) as GenericRow[]);
    setNotices(filteredNotices);
    setInspections((inspectionsResult.data ?? []) as GenericRow[]);
    setMaintenance((maintenanceResult.data ?? []) as GenericRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function initializePortal() {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user?.email) {
          setAuthenticatedEmail(null);
          setResident(null);
          setLoading(false);
          setError("Please sign in to access the resident portal.");
          return;
        }

        const email = user.email.toLowerCase();
        setAuthenticatedEmail(email);

        const { data: residentRow, error: residentError } = await supabase
          .from("residents")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

        if (!active) return;

        if (!residentError && residentRow) {
          setPortalRole("resident");
          setResidentOptions([]);
          setSelectedResidentId(text(residentRow.id));
          await loadPortalData(text(residentRow.id), residentRow as GenericRow);
          return;
        }

        const { data: staffUser, error: staffError } = await supabase
          .from("staff_users")
          .select("id, email")
          .ilike("email", email)
          .maybeSingle();

        if (!active) return;

        if (!staffError && staffUser) {
          const { data: residentsData, error: residentsError } = await supabase
            .from("residents")
            .select("*")
            .order("created_at", { ascending: true });

          if (!active) return;

          if (!residentsError && residentsData && residentsData.length > 0) {
            const firstResident = residentsData[0] as GenericRow;
            setPortalRole("staff");
            setResidentOptions(residentsData as GenericRow[]);
            setSelectedResidentId(text(firstResident.id));
            await loadPortalData(text(firstResident.id), firstResident as GenericRow);
            return;
          }
        }

        setPortalRole(null);
        setResident(null);
        setLoading(false);
        setError("No resident record exists for your account. Please contact the hostel administrator.");
      } catch {
        if (active) {
          setError("Unable to load your resident portal right now. Please try again.");
          setLoading(false);
        }
      }
    }

    initializePortal();

    return () => {
      active = false;
    };
  }, [loadPortalData]);

  async function logout() {
    setLoading(true);
    setMessage("");
    setError("");
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function selectResident(residentId: string) {
    if (!residentId) {
      return;
    }

    const selectedResident = residentOptions.find((option) => text(option.id) === residentId);

    setSelectedResidentId(residentId);
    setReceiptBillId("");
    setReceiptUrl("");
    setReceiptReference("");
    setMaintenanceTitle("");
    setMaintenanceDescription("");
    setMessage("");
    setError("");
    await loadPortalData(residentId, selectedResident as GenericRow | undefined);
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (portalRole === "staff") {
      return;
    }

    if (!resident?.id) {
      setError("Your resident profile could not be loaded.");
      return;
    }

    setSavingReceipt(true);
    setMessage("");
    setError("");

    if (!receiptBillId || !receiptUrl.trim()) {
      setError("Bill and receipt URL are required.");
      setSavingReceipt(false);
      return;
    }

    const selectedBill = bills.find((bill) => text(bill.id) === receiptBillId);

    const { error: receiptError } = await supabase.from("payment_receipts").insert({
      resident_id: resident.id,
      bill_id: receiptBillId,
      receipt_url: receiptUrl.trim(),
      reference_number: receiptReference.trim() || null,
      amount: Number(selectedBill?.balance_amount ?? selectedBill?.due_amount ?? 0),
      status: "Pending Verification",
    });

    if (receiptError) {
      setError(receiptError.message);
    } else {
      setMessage("Payment receipt uploaded successfully for verification.");
      setReceiptBillId("");
      setReceiptUrl("");
      setReceiptReference("");
      await loadPortalData(text(resident.id), resident);
    }

    setSavingReceipt(false);
  }

  async function submitMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (portalRole === "staff") {
      return;
    }

    if (!resident?.id) {
      setError("Your resident profile could not be loaded.");
      return;
    }

    setSavingMaintenance(true);
    setMessage("");
    setError("");

    if (!maintenanceTitle.trim() || !maintenanceDescription.trim()) {
      setError("Maintenance title and description are required.");
      setSavingMaintenance(false);
      return;
    }

    const { error: maintenanceError } = await supabase.from("maintenance_requests").insert({
      request_number: `MNT-${new Date().getFullYear()}-${Date.now()
        .toString()
        .slice(-8)}`,
      resident_id: resident.id,
      room_id: firstText(admission, ["room_id"]) || null,
      building_name: firstText(room, ["building_name"]) || "Main Building",
      area_type: "Room",
      category: "Other",
      priority: "Medium",
      status: "Pending",
      complaint_date: new Date().toISOString().slice(0, 10),
      complaint_description: `${maintenanceTitle.trim()}: ${maintenanceDescription.trim()}`,
    });

    if (maintenanceError) {
      setError(maintenanceError.message);
    } else {
      setMessage("Maintenance request submitted successfully.");
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      await loadPortalData(text(resident.id), resident);
    }

    setSavingMaintenance(false);
  }

  const isReadOnlyView = portalRole === "staff";

  const pendingBalance = useMemo(
    () =>
      bills.reduce(
        (sum, bill) =>
          sum + Number(bill.balance_amount ?? bill.due_amount ?? 0),
        0
      ),
    [bills]
  );

  const verifiedPayments = useMemo(
    () =>
      payments
        .filter((payment) =>
          ["Verified", "Paid"].includes(
            firstText(payment, ["payment_status", "status"])
          )
        )
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto flex min-h-[90vh] max-w-md items-center">
          <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Hostel Management System
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              Resident Portal
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Loading your profile and account details...
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (!authenticatedEmail || !resident) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto flex min-h-[90vh] max-w-md items-center">
          <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Hostel Management System
            </p>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              Resident Portal
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {error || "Sign in with your Supabase account to access your resident portal."}
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Go to Login
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Logout
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Hostel Management System
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Resident Portal
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Welcome, {residentName(resident)}
            </p>

            {portalRole === "staff" && residentOptions.length > 0 && (
              <label className="mt-3 block max-w-xs">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Select Resident
                </span>
                <select
                  value={selectedResidentId}
                  onChange={(event) => void selectResident(event.target.value)}
                  className={inputClass}
                >
                  {residentOptions.map((option) => (
                    <option key={text(option.id)} value={text(option.id)}>
                      {residentName(option)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {(
              [
                "Overview",
                "Profile",
                "Room",
                "Contract",
                "Bills",
                "Payments",
                "Notices",
                "Inspections",
                "Maintenance",
              ] as PortalTab[]
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                  activeTab === tab
                    ? "bg-indigo-600 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          {(message || error) && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                error
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {error || message}
            </div>
          )}

          {activeTab === "Overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Pending Bill Balance" value={money(pendingBalance)} />
                <StatCard label="Verified Payments" value={money(verifiedPayments)} />
                <StatCard label="Room" value={roomName(room)} />
                <StatCard
                  label="Deposit Status"
                  value={firstText(admission, ["deposit_status"]) || "Not recorded"}
                />
              </div>

              <Card title="Current Admission">
                <InfoGrid
                  items={[
                    [
                      "Admission Date",
                      firstText(admission, ["admission_date"]).slice(0, 10) || "—",
                    ],
                    [
                      "Expected Leaving",
                      firstText(admission, ["expected_leaving_date", "leaving_date"]).slice(0, 10) || "—",
                    ],
                    ["Room", roomName(room)],
                    ["Bed", bedName(bed)],
                    [
                      "Monthly Rent",
                      money(
                        admission?.monthly_rent ??
                          room?.monthly_rent ??
                          bed?.monthly_rent ??
                          0
                      ),
                    ],
                    [
                      "Security Deposit",
                      money(admission?.security_deposit ?? admission?.deposit_amount ?? 0),
                    ],
                  ]}
                />
              </Card>
            </>
          )}

          {activeTab === "Profile" && (
            <Card title="My Profile">
              <InfoGrid
                items={[
                  ["Name", residentName(resident)],
                  ["Phone", firstText(resident, ["phone", "mobile"]) || "—"],
                  ["Email", firstText(resident, ["email"]) || "—"],
                  ["CNIC", firstText(resident, ["cnic", "national_id"]) || "—"],
                  ["Status", firstText(resident, ["status"]) || "Active"],
                  ["Address", firstText(resident, ["address"]) || "—"],
                ]}
              />
            </Card>
          )}

          {activeTab === "Room" && (
            <Card title="My Room">
              <InfoGrid
                items={[
                  ["Room", roomName(room)],
                  ["Bed", bedName(bed)],
                  ["Room Type", firstText(room, ["room_type", "type"]) || "—"],
                  ["Bed Type", firstText(bed, ["bed_type", "type"]) || "—"],
                  [
                    "Monthly Rent",
                    money(
                      admission?.monthly_rent ??
                        room?.monthly_rent ??
                        bed?.monthly_rent ??
                        0
                    ),
                  ],
                  [
                    "Admission Status",
                    firstText(admission, ["status", "admission_status"]) || "Active",
                  ],
                ]}
              />
            </Card>
          )}

          {activeTab === "Contract" && (
            <Card title="My Contract">
              <InfoGrid
                items={[
                  ["Contract Number", firstText(contract, ["contract_number"]) || "—"],
                  ["Start Date", firstText(contract, ["start_date"]).slice(0, 10) || "—"],
                  ["End Date", firstText(contract, ["end_date"]).slice(0, 10) || "—"],
                  ["Monthly Rent", money(contract?.monthly_rent ?? 0)],
                  ["Security Deposit", money(contract?.security_deposit ?? 0)],
                  ["Status", firstText(contract, ["status"]) || "—"],
                  [
                    "Resident Signature",
                    firstText(contract, ["resident_signature"]) ? "Signed" : "Pending",
                  ],
                ]}
              />

              {firstText(contract, ["terms_and_conditions"]) && (
                <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  {firstText(contract, ["terms_and_conditions"])}
                </div>
              )}
            </Card>
          )}

          {activeTab === "Bills" && (
            <Card title="My Bills">
              <DataTable
                headers={["Bill No.", "Month", "Total", "Paid", "Balance", "Due Date", "Status"]}
                rows={bills.map((bill) => [
                  firstText(bill, ["bill_number"]) || "—",
                  firstText(bill, ["billing_month"]).slice(0, 7) || "—",
                  money(bill.total_amount),
                  money(bill.paid_amount),
                  money(bill.balance_amount ?? bill.due_amount),
                  firstText(bill, ["due_date"]).slice(0, 10) || "—",
                  firstText(bill, ["bill_status", "status"]) || "Pending",
                ])}
              />

              <form
                onSubmit={submitReceipt}
                className="mt-6 grid gap-4 rounded-2xl border border-slate-200 p-5 md:grid-cols-2"
              >
                <Field label="Select Bill">
                  <select
                    required
                    value={receiptBillId}
                    onChange={(event) => setReceiptBillId(event.target.value)}
                    className={inputClass}
                    disabled={isReadOnlyView}
                  >
                    <option value="">Select bill</option>
                    {bills.map((bill) => (
                      <option key={text(bill.id)} value={text(bill.id)}>
                        {firstText(bill, ["bill_number"]) || "Bill"} — {money(bill.balance_amount ?? bill.due_amount ?? 0)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Receipt URL">
                  <input
                    required
                    type="url"
                    value={receiptUrl}
                    onChange={(event) => setReceiptUrl(event.target.value)}
                    className={inputClass}
                    placeholder="https://..."
                    disabled={isReadOnlyView}
                  />
                </Field>

                <Field label="Transaction Reference">
                  <input
                    value={receiptReference}
                    onChange={(event) => setReceiptReference(event.target.value)}
                    className={inputClass}
                    placeholder="Optional reference"
                    disabled={isReadOnlyView}
                  />
                </Field>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={savingReceipt || isReadOnlyView}
                    className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {savingReceipt ? "Submitting..." : "Upload Payment Receipt"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === "Payments" && (
            <Card title="Payment History">
              <DataTable
                headers={["Payment No.", "Date", "Method", "Reference", "Amount", "Status"]}
                rows={payments.map((payment) => [
                  firstText(payment, ["payment_number"]) || "—",
                  firstText(payment, ["payment_date", "created_at"]).slice(0, 10) || "—",
                  firstText(payment, ["payment_method"]) || "Payment Method",
                  firstText(payment, ["reference_number"]) || "—",
                  money(payment.amount),
                  firstText(payment, ["payment_status", "status"]) || "Pending",
                ])}
              />
            </Card>
          )}

          {activeTab === "Notices" && (
            <Card title="Notices">
              <div className="space-y-4">
                {notices.length === 0 ? (
                  <EmptyState text="No notices available." />
                ) : (
                  notices.map((notice) => (
                    <article key={text(notice.id)} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {Boolean(notice.pinned) && <span>📌</span>}

                        <h3 className="text-lg font-bold text-slate-900">
                          {firstText(notice, ["title"]) || "Notice"}
                        </h3>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {firstText(notice, ["description"])}
                      </p>

                      <p className="mt-3 text-xs text-slate-500">
                        Published: {firstText(notice, ["publish_date"]).slice(0, 10) || "—"}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </Card>
          )}

          {activeTab === "Inspections" && (
            <Card title="Inspection History">
              <DataTable
                headers={["Inspection No.", "Date", "Type", "Area", "Condition", "Status"]}
                rows={inspections.map((inspection) => [
                  firstText(inspection, ["inspection_number"]) || "—",
                  firstText(inspection, ["inspection_date"]).slice(0, 10) || "—",
                  firstText(inspection, ["inspection_type"]) || "Routine",
                  firstText(inspection, ["area_type"]) || "Room",
                  firstText(inspection, ["overall_status"]) || "—",
                  firstText(inspection, ["status"]) || "Pending",
                ])}
              />
            </Card>
          )}

          {activeTab === "Maintenance" && (
            <Card title="Maintenance Requests">
              <DataTable
                headers={["Request No.", "Date", "Category", "Priority", "Status"]}
                rows={maintenance.map((request) => [
                  firstText(request, ["request_number"]) || "—",
                  firstText(request, ["complaint_date", "created_at"]).slice(0, 10) || "—",
                  firstText(request, ["category"]) || "Other",
                  firstText(request, ["priority"]) || "Medium",
                  firstText(request, ["status"]) || "Pending",
                ])}
              />

              <form
                onSubmit={submitMaintenance}
                className="mt-6 space-y-4 rounded-2xl border border-slate-200 p-5"
              >
                <Field label="Request Title">
                  <input
                    required
                    value={maintenanceTitle}
                    onChange={(event) => setMaintenanceTitle(event.target.value)}
                    className={inputClass}
                    placeholder="e.g. Fan not working"
                    disabled={isReadOnlyView}
                  />
                </Field>

                <Field label="Description">
                  <textarea
                    required
                    value={maintenanceDescription}
                    onChange={(event) => setMaintenanceDescription(event.target.value)}
                    className={`${inputClass} min-h-28`}
                    placeholder="Describe the issue..."
                    disabled={isReadOnlyView}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={savingMaintenance || isReadOnlyView}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingMaintenance ? "Submitting..." : "Submit Request"}
                </button>
              </form>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-xl font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <article key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 font-semibold text-slate-900">{value}</p>
        </article>
      ))}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((heading) => (
              <th key={heading} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-slate-500">
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((column, columnIndex) => (
                  <td key={`${rowIndex}-${columnIndex}`} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {column}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text: label }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}
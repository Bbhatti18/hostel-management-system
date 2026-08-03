"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type GenericRow = Record<string, unknown>;

type BillStatus =
  | "Pending"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

type Bill = {
  id: string;
  bill_number: string;
  resident_id: string;
  admission_id: string | null;
  billing_month: string;
  rent_amount: number;
  electricity_amount: number;
  ac_amount: number;
  other_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  due_date: string;
  bill_status: BillStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BillForm = {
  resident_id: string;
  admission_id: string;
  billing_month: string;
  rent_amount: string;
  electricity_amount: string;
  ac_amount: string;
  other_amount: string;
  discount_amount: string;
  paid_amount: string;
  due_date: string;
  bill_status: BillStatus;
  notes: string;
};

const currentMonth = new Date().toISOString().slice(0, 7);

const emptyForm: BillForm = {
  resident_id: "",
  admission_id: "",
  billing_month: currentMonth,
  rent_amount: "",
  electricity_amount: "",
  ac_amount: "",
  other_amount: "",
  discount_amount: "",
  paid_amount: "0",
  due_date: "",
  bill_status: "Pending",
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstText(row: GenericRow | undefined, keys: string[]) {
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

function residentName(row: GenericRow | undefined) {
  return (
    firstText(row, ["full_name", "resident_name", "name"]) ||
    "Unknown resident"
  );
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function statusClass(status: BillStatus) {
  if (status === "Paid") return "bg-emerald-100 text-emerald-700";
  if (status === "Partially Paid") return "bg-blue-100 text-blue-700";
  if (status === "Overdue") return "bg-red-100 text-red-700";
  if (status === "Cancelled") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function makeBillNumber() {
  return `BILL-${new Date().getFullYear()}-${Date.now()
    .toString()
    .slice(-7)}`;
}

function monthLabel(value: string) {
  if (!value) return "No month";

  const parsed = new Date(`${value}-01T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
  });
}

export default function BillingPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [residents, setResidents] = useState<GenericRow[]>([]);
  const [admissions, setAdmissions] = useState<GenericRow[]>([]);
  const [form, setForm] = useState<BillForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [billsResult, residentsResult, admissionsResult] =
      await Promise.all([
        supabase
          .from("bills")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("residents")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("admissions")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

    const firstError =
      billsResult.error ||
      residentsResult.error ||
      admissionsResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setBills((billsResult.data ?? []) as Bill[]);
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setAdmissions((admissionsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const computed = useMemo(() => {
    const subtotal =
      numberValue(form.rent_amount) +
      numberValue(form.electricity_amount) +
      numberValue(form.ac_amount) +
      numberValue(form.other_amount);

    const total = Math.max(
      subtotal - numberValue(form.discount_amount),
      0
    );

    const paid = Math.min(numberValue(form.paid_amount), total);
    const balance = Math.max(total - paid, 0);

    return { subtotal, total, paid, balance };
  }, [form]);

  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase();

    return bills.filter((bill) => {
      const resident = residents.find(
        (item) => text(item.id) === bill.resident_id
      );

      const searchable = [
        bill.bill_number,
        residentName(resident),
        bill.billing_month,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        bill.bill_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bills, residents, search, statusFilter]);

  const summary = useMemo(() => {
    const pendingBalance = bills
      .filter((bill) => bill.bill_status !== "Paid")
      .reduce(
        (sum, bill) => sum + numberValue(bill.balance_amount),
        0
      );

    const collected = bills.reduce(
      (sum, bill) => sum + numberValue(bill.paid_amount),
      0
    );

    return {
      total: bills.length,
      pending: bills.filter(
        (bill) => bill.bill_status === "Pending"
      ).length,
      overdue: bills.filter(
        (bill) => bill.bill_status === "Overdue"
      ).length,
      pendingBalance,
      collected,
    };
  }, [bills]);

  function updateField<K extends keyof BillForm>(
    key: K,
    value: BillForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEditForm(bill: Bill) {
    setEditingId(bill.id);
    setForm({
      resident_id: bill.resident_id,
      admission_id: bill.admission_id ?? "",
      billing_month: bill.billing_month,
      rent_amount: String(bill.rent_amount ?? 0),
      electricity_amount: String(bill.electricity_amount ?? 0),
      ac_amount: String(bill.ac_amount ?? 0),
      other_amount: String(bill.other_amount ?? 0),
      discount_amount: String(bill.discount_amount ?? 0),
      paid_amount: String(bill.paid_amount ?? 0),
      due_date: bill.due_date ?? "",
      bill_status: bill.bill_status,
      notes: bill.notes ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyAdmission(admissionId: string) {
    const admission = admissions.find(
      (item) => text(item.id) === admissionId
    );

    if (!admission) {
      updateField("admission_id", "");
      return;
    }

    setForm((current) => ({
      ...current,
      admission_id: admissionId,
      resident_id: firstText(admission, ["resident_id"]),
      rent_amount: firstText(admission, [
        "monthly_rent",
        "rent_amount",
      ]),
    }));
  }

  async function saveBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    if (
      !form.resident_id ||
      !form.billing_month ||
      !form.due_date
    ) {
      setError(
        "Resident, billing month and due date are required."
      );
      setSaving(false);
      return;
    }

    let finalStatus = form.bill_status;

    if (computed.balance <= 0 && computed.total > 0) {
      finalStatus = "Paid";
    } else if (computed.paid > 0) {
      finalStatus = "Partially Paid";
    } else if (
      form.due_date &&
      new Date(form.due_date) < new Date() &&
      finalStatus !== "Cancelled"
    ) {
      finalStatus = "Overdue";
    }

    const payload = {
      resident_id: form.resident_id,
      admission_id: form.admission_id || null,
      billing_month: form.billing_month,
      rent_amount: numberValue(form.rent_amount),
      electricity_amount: numberValue(
        form.electricity_amount
      ),
      ac_amount: numberValue(form.ac_amount),
      other_amount: numberValue(form.other_amount),
      discount_amount: numberValue(form.discount_amount),
      total_amount: computed.total,
      paid_amount: computed.paid,
      balance_amount: computed.balance,
      due_date: form.due_date,
      bill_status: finalStatus,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase
          .from("bills")
          .update(payload)
          .eq("id", editingId)
      : await supabase.from("bills").insert({
          ...payload,
          bill_number: makeBillNumber(),
        });

    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage(
        editingId
          ? "Bill updated successfully."
          : "Bill generated successfully."
      );
      setEditingId(null);
      setForm(emptyForm);
      setShowForm(false);
      await refresh();
    }

    setSaving(false);
  }

  async function deleteBill(bill: Bill) {
    if (!window.confirm(`Delete bill ${bill.bill_number}?`)) {
      return;
    }

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("bills")
      .delete()
      .eq("id", bill.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Bill deleted successfully.");
      await refresh();
    }
  }

  function printBill(bill: Bill) {
    const resident = residents.find(
      (item) => text(item.id) === bill.resident_id
    );

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=700"
    );

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${bill.bill_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { margin-bottom: 6px; }
            .meta { color: #475569; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
            th { background: #f8fafc; }
            .totals { margin-top: 24px; margin-left: auto; width: 320px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; }
            .strong { font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Hostel Management System</h1>
          <div class="meta">Monthly Bill</div>
          <p><strong>Bill Number:</strong> ${bill.bill_number}</p>
          <p><strong>Resident:</strong> ${residentName(resident)}</p>
          <p><strong>Month:</strong> ${monthLabel(bill.billing_month)}</p>
          <p><strong>Due Date:</strong> ${bill.due_date}</p>

          <table>
            <thead>
              <tr><th>Charge</th><th>Amount</th></tr>
            </thead>
            <tbody>
              <tr><td>Monthly Rent</td><td>${money(bill.rent_amount)}</td></tr>
              <tr><td>Electricity</td><td>${money(bill.electricity_amount)}</td></tr>
              <tr><td>AC Charges</td><td>${money(bill.ac_amount)}</td></tr>
              <tr><td>Other Charges</td><td>${money(bill.other_amount)}</td></tr>
              <tr><td>Discount</td><td>- ${money(bill.discount_amount)}</td></tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="row strong"><span>Total</span><span>${money(bill.total_amount)}</span></div>
            <div class="row"><span>Paid</span><span>${money(bill.paid_amount)}</span></div>
            <div class="row strong"><span>Balance</span><span>${money(bill.balance_amount)}</span></div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Hostel Management System
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Billing
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Generate monthly bills and manage outstanding balances.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Generate Bill
          </button>
        </section>

        {(message || error) && (
          <section
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </section>
        )}

        {showForm && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? "Edit Bill" : "Generate Bill"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add rent, electricity, AC and other monthly charges.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveBill} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Admission">
                  <select
                    value={form.admission_id}
                    onChange={(event) =>
                      applyAdmission(event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select admission</option>

                    {admissions.map((admission) => {
                      const resident = residents.find(
                        (item) =>
                          text(item.id) ===
                          firstText(admission, ["resident_id"])
                      );

                      return (
                        <option
                          key={text(admission.id)}
                          value={text(admission.id)}
                        >
                          {residentName(resident)} â{" "}
                          {firstText(admission, [
                            "admission_date",
                          ])}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <Field label="Resident *">
                  <select
                    required
                    value={form.resident_id}
                    onChange={(event) =>
                      updateField(
                        "resident_id",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">Select resident</option>

                    {residents.map((resident) => (
                      <option
                        key={text(resident.id)}
                        value={text(resident.id)}
                      >
                        {residentName(resident)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Billing Month *">
                  <input
                    required
                    type="month"
                    value={form.billing_month}
                    onChange={(event) =>
                      updateField(
                        "billing_month",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Monthly Rent">
                  <input
                    type="number"
                    min="0"
                    value={form.rent_amount}
                    onChange={(event) =>
                      updateField(
                        "rent_amount",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="15000"
                  />
                </Field>

                <Field label="Electricity Charges">
                  <input
                    type="number"
                    min="0"
                    value={form.electricity_amount}
                    onChange={(event) =>
                      updateField(
                        "electricity_amount",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="1200"
                  />
                </Field>

                <Field label="AC Charges">
                  <input
                    type="number"
                    min="0"
                    value={form.ac_amount}
                    onChange={(event) =>
                      updateField(
                        "ac_amount",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="800"
                  />
                </Field>

                <Field label="Other Charges">
                  <input
                    type="number"
                    min="0"
                    value={form.other_amount}
                    onChange={(event) =>
                      updateField(
                        "other_amount",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Discount">
                  <input
                    type="number"
                    min="0"
                    value={form.discount_amount}
                    onChange={(event) =>
                      updateField(
                        "discount_amount",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Paid Amount">
                  <input
                    type="number"
                    min="0"
                    value={form.paid_amount}
                    onChange={(event) =>
                      updateField(
                        "paid_amount",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Due Date *">
                  <input
                    required
                    type="date"
                    value={form.due_date}
                    onChange={(event) =>
                      updateField(
                        "due_date",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Bill Status">
                  <select
                    value={form.bill_status}
                    onChange={(event) =>
                      updateField(
                        "bill_status",
                        event.target.value as BillStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partially Paid">
                      Partially Paid
                    </option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </Field>

                <Field label="Notes" wide>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      updateField("notes", event.target.value)
                    }
                    className={`${inputClass} min-h-24`}
                    placeholder="Bill notes"
                  />
                </Field>
              </div>

              <section className="grid gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <TotalCard
                  label="Subtotal"
                  value={money(computed.subtotal)}
                />
                <TotalCard
                  label="Final Total"
                  value={money(computed.total)}
                />
                <TotalCard
                  label="Paid"
                  value={money(computed.paid)}
                />
                <TotalCard
                  label="Balance"
                  value={money(computed.balance)}
                />
              </section>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Bill"
                    : "Generate Bill"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Bills"
            value={String(summary.total)}
          />
          <StatCard
            label="Pending Bills"
            value={String(summary.pending)}
          />
          <StatCard
            label="Overdue"
            value={String(summary.overdue)}
          />
          <StatCard
            label="Pending Balance"
            value={money(summary.pendingBalance)}
          />
          <StatCard
            label="Collected"
            value={money(summary.collected)}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className={inputClass}
              placeholder="Search bill number, resident or month"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">
                Partially Paid
              </option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Bill",
                    "Resident",
                    "Month",
                    "Charges",
                    "Total",
                    "Balance",
                    "Due Date",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      Loading bills...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No bills found.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((bill) => {
                    const resident = residents.find(
                      (item) =>
                        text(item.id) === bill.resident_id
                    );

                    return (
                      <tr
                        key={bill.id}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {bill.bill_number}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {residentName(resident)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {monthLabel(bill.billing_month)}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-600">
                          <p>Rent: {money(bill.rent_amount)}</p>
                          <p>
                            Electricity:{" "}
                            {money(bill.electricity_amount)}
                          </p>
                          <p>AC: {money(bill.ac_amount)}</p>
                          <p>Other: {money(bill.other_amount)}</p>
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {money(bill.total_amount)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-red-700">
                          {money(bill.balance_amount)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {bill.due_date}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                              bill.bill_status
                            )}`}
                          >
                            {bill.bill_status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => printBill(bill)}
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"
                            >
                              Print
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(bill)}
                              className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => void deleteBill(bill)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? "md:col-span-2 xl:col-span-3" : ""}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </article>
  );
}

function TotalCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-slate-900">
        {value}
      </p>
    </article>
  );
}
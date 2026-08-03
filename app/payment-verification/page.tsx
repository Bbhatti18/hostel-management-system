"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type GenericRow = Record<string, unknown>;

type ReceiptStatus =
  | "Pending Verification"
  | "Verified"
  | "Rejected";

type PaymentReceipt = {
  id: string;
  resident_id: string;
  bill_id: string | null;
  receipt_url: string;
  reference_number: string | null;
  amount: number;
  status: ReceiptStatus;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function text(value: unknown) {
  return value == null ? "" : String(value);
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
  const direct = firstText(row, [
    "full_name",
    "resident_name",
    "name",
  ]);

  if (direct) return direct;

  const combined = `${firstText(row, ["first_name"])} ${firstText(row, [
    "last_name",
    "surname",
  ])}`.trim();

  return combined || "Resident";
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function statusClass(status: ReceiptStatus) {
  if (status === "Verified") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function PaymentVerificationPage() {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [residents, setResidents] = useState<GenericRow[]>([]);
  const [bills, setBills] = useState<GenericRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      receiptsResult,
      residentsResult,
      billsResult,
    ] = await Promise.all([
      supabase
        .from("payment_receipts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("residents").select("*"),
      supabase.from("bills").select("*"),
    ]);

    const firstError =
      receiptsResult.error ||
      residentsResult.error ||
      billsResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setReceipts((receiptsResult.data ?? []) as PaymentReceipt[]);
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setBills((billsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return receipts.filter((receipt) => {
      const resident = residents.find(
        (item) => text(item.id) === receipt.resident_id
      );

      const bill = bills.find(
        (item) => text(item.id) === receipt.bill_id
      );

      const searchable = [
        residentName(resident),
        receipt.reference_number ?? "",
        firstText(bill, ["bill_number"]),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        receipt.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bills, receipts, residents, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: receipts.length,
      pending: receipts.filter(
        (item) => item.status === "Pending Verification"
      ).length,
      verified: receipts.filter(
        (item) => item.status === "Verified"
      ).length,
      rejected: receipts.filter(
        (item) => item.status === "Rejected"
      ).length,
    }),
    [receipts]
  );

  async function updateReceiptStatus(
    receipt: PaymentReceipt,
    nextStatus: ReceiptStatus
  ) {
    setUpdatingId(receipt.id);
    setMessage("");
    setError("");

    const verifiedAt =
      nextStatus === "Verified"
        ? new Date().toISOString()
        : null;

    const { error: updateError } = await supabase
      .from("payment_receipts")
      .update({
        status: nextStatus,
        verified_by: nextStatus === "Verified" ? "Admin" : null,
        verified_at: verifiedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receipt.id);

    if (updateError) {
      setError(updateError.message);
      setUpdatingId(null);
      return;
    }

    if (nextStatus === "Verified") {
      const existingPayment = await supabase
        .from("payments")
        .select("id")
        .eq("receipt_id", receipt.id)
        .maybeSingle();

      if (!existingPayment.data) {
        const bill = bills.find(
          (item) => text(item.id) === receipt.bill_id
        );

        const paymentNumber = `PAY-${new Date()
          .getFullYear()
          .toString()}-${Date.now().toString().slice(-8)}`;

        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            payment_number: paymentNumber,
            resident_id: receipt.resident_id,
            bill_id: receipt.bill_id,
            receipt_id: receipt.id,
            payment_date: new Date().toISOString().slice(0, 10),
            payment_method: "Payment Method",
            reference_number: receipt.reference_number,
            amount: receipt.amount,
            payment_status: "Verified",
            notes: "Created from verified resident receipt.",
          });

        if (paymentError) {
          setError(paymentError.message);
          setUpdatingId(null);
          return;
        }

        if (receipt.bill_id && bill) {
          const currentPaid = Number(bill.paid_amount || 0);
          const total = Number(bill.total_amount || 0);
          const newPaid = currentPaid + Number(receipt.amount || 0);
          const balance = Math.max(total - newPaid, 0);

          await supabase
            .from("bills")
            .update({
              paid_amount: newPaid,
              balance_amount: balance,
              bill_status: balance <= 0 ? "Paid" : "Partially Paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", receipt.bill_id);
        }
      }
    }

    setMessage(
      nextStatus === "Verified"
        ? "Receipt verified and payment recorded."
        : `Receipt marked ${nextStatus}.`
    );

    await refresh();
    setUpdatingId(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Payment Verification
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Verify or reject resident payment receipts.
          </p>
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Receipts" value={String(summary.total)} />
          <StatCard label="Pending" value={String(summary.pending)} />
          <StatCard label="Verified" value={String(summary.verified)} />
          <StatCard label="Rejected" value={String(summary.rejected)} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search resident, bill or reference"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="All">All Statuses</option>
              <option value="Pending Verification">
                Pending Verification
              </option>
              <option value="Verified">Verified</option>
              <option value="Rejected">Rejected</option>
            </select>

            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Resident",
                    "Bill",
                    "Amount",
                    "Reference",
                    "Receipt",
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
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      Loading receipts...
                    </td>
                  </tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No payment receipts found.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((receipt) => {
                    const resident = residents.find(
                      (item) =>
                        text(item.id) === receipt.resident_id
                    );

                    const bill = bills.find(
                      (item) => text(item.id) === receipt.bill_id
                    );

                    return (
                      <tr
                        key={receipt.id}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {residentName(resident)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {receipt.created_at.slice(0, 10)}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {firstText(bill, ["bill_number"]) || "No bill"}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {money(receipt.amount)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {receipt.reference_number || "â"}
                        </td>

                        <td className="px-5 py-4">
                          <a
                            href={receipt.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Open Receipt
                          </a>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                              receipt.status
                            )}`}
                          >
                            {receipt.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={updatingId === receipt.id}
                              onClick={() =>
                                void updateReceiptStatus(
                                  receipt,
                                  "Verified"
                                )
                              }
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                            >
                              Verify
                            </button>

                            <button
                              type="button"
                              disabled={updatingId === receipt.id}
                              onClick={() =>
                                void updateReceiptStatus(
                                  receipt,
                                  "Rejected"
                                )
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                            >
                              Reject
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </article>
  );
}
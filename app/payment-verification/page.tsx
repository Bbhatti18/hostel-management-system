"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import {
  getVerifiedPaymentTotal,
  refreshBillFinancials,
  roundMoney,
} from "@/lib/financials";
import { getSupabaseErrorMessage } from "@/lib/supabaseErrors";

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
  payment_id?: string | null;
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

function createPaymentNumber() {
  return `PAY-${new Date().getFullYear()}-${Date.now()
    .toString()
    .slice(-8)}`;
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
      setError(getSupabaseErrorMessage(firstError, "Payment receipts could not be loaded."));
    } else {
      setReceipts((receiptsResult.data ?? []) as PaymentReceipt[]);
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setBills((billsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeoutId);
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
    const rejectionReason =
      nextStatus === "Rejected"
        ? window.prompt("Enter the reason for rejecting this receipt:")?.trim()
        : "";
    if (nextStatus === "Rejected" && !rejectionReason) return;

    setUpdatingId(receipt.id);
    setMessage("");
    setError("");

    const { data: currentReceipt, error: receiptError } = await supabase
      .from("payment_receipts")
      .select("*")
      .eq("id", receipt.id)
      .single();

    if (receiptError || !currentReceipt) {
      setError("The receipt could not be re-checked. Refresh and try again.");
      setUpdatingId(null);
      return;
    }

    if (currentReceipt.status !== "Pending Verification") {
      setError(`This receipt is already ${currentReceipt.status}. No second action was applied.`);
      setUpdatingId(null);
      await refresh();
      return;
    }

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("receipt_id", receipt.id)
      .maybeSingle();
    if (existingPaymentError) {
      setError("The linked payment could not be checked. Please try again.");
      setUpdatingId(null);
      return;
    }

    if (nextStatus === "Rejected") {
      if (existingPayment?.payment_status === "Verified") {
        setError("This receipt already has a verified payment. It cannot be rejected without first resolving that financial record.");
        setUpdatingId(null);
        return;
      }

      const { data: rejectedReceipt, error: rejectionError } = await supabase
        .from("payment_receipts")
        .update({
          status: "Rejected",
          verified: false,
          verified_by: null,
          verified_at: null,
          notes: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receipt.id)
        .eq("status", "Pending Verification")
        .select("id")
        .maybeSingle();

      if (rejectionError || !rejectedReceipt) {
        setError("The receipt changed before it could be rejected. Refresh and review its current status.");
      } else if (existingPayment && existingPayment.payment_status === "Pending") {
        const { error: paymentRejectError } = await supabase
          .from("payments")
          .update({ payment_status: "Rejected", verified: false, notes: rejectionReason, updated_at: new Date().toISOString() })
          .eq("id", existingPayment.id)
          .eq("payment_status", "Pending");
        if (paymentRejectError) {
          setError("The receipt was rejected, but its pending payment record could not be updated. The payment remains unverified and does not reduce the bill balance.");
        } else {
          setMessage("Receipt rejected. No amount was applied to the bill.");
        }
      } else {
        setMessage("Receipt rejected. No amount was applied to the bill.");
      }

      await refresh();
      setUpdatingId(null);
      return;
    }

    if (!currentReceipt.bill_id) {
      setError("This receipt is not linked to a bill and cannot be verified.");
      setUpdatingId(null);
      return;
    }

    const { data: currentBill, error: billError } = await supabase
      .from("bills")
      .select("id, resident_id, total_amount, bill_status")
      .eq("id", currentReceipt.bill_id)
      .single();
    if (
      billError ||
      !currentBill ||
      text(currentBill.resident_id) !== text(currentReceipt.resident_id) ||
      currentBill.bill_status === "Cancelled"
    ) {
      setError("The receipt is not linked to a valid, non-cancelled bill for this resident.");
      setUpdatingId(null);
      return;
    }

    const verifiedTotal = await getVerifiedPaymentTotal(currentReceipt.bill_id).catch(() => null);
    const receiptAmount = roundMoney(Number(currentReceipt.amount ?? 0));
    const outstanding =
      verifiedTotal === null
        ? null
        : Math.max(roundMoney(Number(currentBill.total_amount ?? 0) - verifiedTotal), 0);
    if (outstanding === null) {
      setError("The current bill balance could not be confirmed. Please try again.");
      setUpdatingId(null);
      return;
    }
    if (receiptAmount <= 0 || receiptAmount > outstanding) {
      setError(`The receipt amount must be positive and cannot exceed the outstanding balance of ${money(outstanding)}.`);
      setUpdatingId(null);
      return;
    }

    if (currentReceipt.reference_number) {
      let referenceQuery = supabase
        .from("payments")
        .select("id")
        .eq("reference_number", currentReceipt.reference_number)
        .limit(1);
      if (existingPayment?.id) {
        referenceQuery = referenceQuery.neq("id", existingPayment.id);
      }
      const { data: duplicateReference, error: referenceError } = await referenceQuery;
      if (referenceError) {
        setError("The receipt reference could not be checked. Please try again.");
        setUpdatingId(null);
        return;
      }
      if ((duplicateReference ?? []).length > 0) {
        setError("This reference number is already linked to another payment.");
        setUpdatingId(null);
        return;
      }
    }

    let paymentId = text(existingPayment?.id);
    if (!existingPayment) {
      const { data: newPayment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          payment_number: createPaymentNumber(),
          resident_id: currentReceipt.resident_id,
          bill_id: currentReceipt.bill_id,
          receipt_id: currentReceipt.id,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_method: "Receipt submission",
          reference_number: currentReceipt.reference_number,
          amount: receiptAmount,
          payment_status: "Pending",
          verified: false,
          notes: "Created from a resident receipt awaiting final verification.",
        })
        .select("id")
        .single();
      if (paymentError || !newPayment) {
        setError(getSupabaseErrorMessage(paymentError, "The receipt was not changed because its payment record could not be prepared."));
        setUpdatingId(null);
        return;
      }
      paymentId = text(newPayment.id);
    } else {
      const paymentMatchesReceipt =
        existingPayment.payment_status === "Pending" &&
        text(existingPayment.bill_id) === text(currentReceipt.bill_id) &&
        text(existingPayment.resident_id) === text(currentReceipt.resident_id) &&
        roundMoney(Number(existingPayment.amount ?? 0)) === receiptAmount;
      if (!paymentMatchesReceipt) {
        setError("The linked payment no longer matches this receipt. Review the payment history before verifying.");
        setUpdatingId(null);
        return;
      }
    }

    const { data: userData } = await supabase.auth.getUser();
    const verifier = userData.user?.email ?? "Admin";
    const verifiedAt = new Date().toISOString();
    const { data: verifiedReceipt, error: verifyError } = await supabase
      .from("payment_receipts")
      .update({
        status: "Verified",
        verified: true,
        verified_by: verifier,
        verified_at: verifiedAt,
        payment_id: paymentId,
        updated_at: verifiedAt,
      })
      .eq("id", receipt.id)
      .eq("status", "Pending Verification")
      .select("id")
      .maybeSingle();
    if (verifyError || !verifiedReceipt) {
      setError("The receipt changed before verification completed. Its prepared payment remains pending and does not affect the bill.");
      setUpdatingId(null);
      await refresh();
      return;
    }

    const { data: verifiedPayment, error: paymentVerifyError } = await supabase
      .from("payments")
      .update({
        payment_status: "Verified",
        verified: true,
        verified_by: verifier,
        verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
      .eq("id", paymentId)
      .eq("payment_status", "Pending")
      .select("id")
      .maybeSingle();
    if (paymentVerifyError || !verifiedPayment) {
      setError("The receipt was verified, but its payment could not be finalized. The pending payment does not reduce the bill balance; an administrator must retry or review it.");
      setUpdatingId(null);
      await refresh();
      return;
    }

    try {
      await refreshBillFinancials(currentReceipt.bill_id);
      setMessage("Receipt verified, payment recorded, and bill balance refreshed.");
    } catch {
      setError("The receipt and payment were verified, but the stored bill summary could not be refreshed. Verified-payment totals remain the source of truth.");
    }

    await refresh();
    setUpdatingId(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            StayHub
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
                          {receipt.reference_number || "—"}
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
                            {receipt.status === "Pending Verification" && <button
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
                            </button>}

                            {receipt.status === "Pending Verification" && <button
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
                            </button>}
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

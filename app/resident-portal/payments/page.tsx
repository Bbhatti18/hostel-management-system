"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { getResidentPortalSession } from "@/lib/residentPortalSession";

type GenericRow = Record<string, unknown>;

type PortalSession = {
  linkId: string;
  residentId: string;
  portalEmail: string;
};

type ReceiptRow = {
  id: string;
  resident_id: string;
  bill_id: string | null;
  receipt_url: string;
  reference_number: string | null;
  amount: number;
  status: string;
  created_at: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function firstValue(row: GenericRow | undefined, keys: string[]) {
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

function money(value: unknown) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function billTotal(row: GenericRow) {
  const direct = Number(
    firstValue(row, [
      "total_amount",
      "bill_total",
      "total",
      "amount",
      "grand_total",
    ]) || 0
  );

  if (direct > 0) return direct;

  return (
    Number(firstValue(row, ["rent_amount", "rent"]) || 0) +
    Number(firstValue(row, ["electricity_amount", "electricity"]) || 0) +
    Number(firstValue(row, ["ac_amount", "ac_charges", "ac"]) || 0) +
    Number(firstValue(row, ["other_amount", "other_charges", "other"]) || 0)
  );
}

function monthLabel(row: GenericRow) {
  const direct = firstValue(row, [
    "month",
    "billing_month",
    "bill_month",
  ]);

  if (direct) return direct;

  const date = firstValue(row, [
    "due_date",
    "created_at",
    "bill_date",
  ]);

  if (!date) return "Current Bill";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
  });
}

export default function ResidentPaymentsPage() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [bills, setBills] = useState<GenericRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async (portalSession: PortalSession) => {
    setLoading(true);
    setError("");

    const [billsResult, receiptsResult] = await Promise.all([
      supabase
        .from("bills")
        .select("*")
        .eq("resident_id", portalSession.residentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_receipts")
        .select("*")
        .eq("resident_id", portalSession.residentId)
        .order("created_at", { ascending: false }),
    ]);

    if (billsResult.error) {
      setError(billsResult.error.message);
    } else {
      setBills((billsResult.data ?? []) as GenericRow[]);
    }

    if (receiptsResult.error) {
      setError((current) =>
        current
          ? `${current} | ${receiptsResult.error?.message}`
          : receiptsResult.error?.message || ""
      );
    } else {
      setReceipts((receiptsResult.data ?? []) as ReceiptRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const portalSession =
      getResidentPortalSession() as PortalSession | null;

    if (!portalSession) {
      setError("Please login to the Resident Portal first.");
      setLoading(false);
      return;
    }

    setSession(portalSession);
    void loadData(portalSession);
  }, [loadData]);

  const selectedBill = useMemo(
    () =>
      bills.find((bill) => text(bill.id) === selectedBillId),
    [bills, selectedBillId]
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setMessage("");
    setError("");
  }

  async function uploadReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      setError("Resident Portal session not found. Please login again.");
      return;
    }

    if (!selectedFile) {
      setError("Please choose a receipt image or PDF.");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${session.residentId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-receipts")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("payment-receipts")
      .getPublicUrl(filePath);

    const amount = selectedBill
      ? billTotal(selectedBill)
      : Number(manualAmount) || 0;

    if (amount <= 0) {
      await supabase.storage
        .from("payment-receipts")
        .remove([filePath]);

      setError("Please enter a valid payment amount.");
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("payment_receipts")
      .insert({
        resident_id: session.residentId,
        bill_id: selectedBillId || null,
        receipt_url: publicUrlData.publicUrl,
        reference_number: referenceNumber.trim() || null,
        amount,
        status: "Pending Verification",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      await supabase.storage
        .from("payment-receipts")
        .remove([filePath]);

      setError(insertError.message);
      setUploading(false);
      return;
    }

    setMessage("Payment receipt uploaded successfully.");
    setSelectedFile(null);
    setReferenceNumber("");
    setManualAmount("");
    setSelectedBillId("");
    await loadData(session);
    setUploading(false);

    const fileInput = document.getElementById(
      "payment-receipt-file"
    ) as HTMLInputElement | null;

    if (fileInput) fileInput.value = "";
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Resident Payments
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View bills and upload payment receipts for admin verification.
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

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Upload Payment Receipt
          </h2>

          <form
            onSubmit={uploadReceipt}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Select Bill *
              </span>

              <select
                value={selectedBillId}
                onChange={(event) =>
                  setSelectedBillId(event.target.value)
                }
                className={inputClass}
                disabled={loading}
              >
                <option value="">No bill / Manual payment</option>

                {bills.map((bill) => (
                  <option key={text(bill.id)} value={text(bill.id)}>
                    {monthLabel(bill)} â {money(billTotal(bill))}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Payment Reference
              </span>

              <input
                value={referenceNumber}
                onChange={(event) =>
                  setReferenceNumber(event.target.value)
                }
                className={inputClass}
                placeholder="Bank reference or transaction ID"
              />
            </label>

            {!selectedBillId && (
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Amount *
                </span>

                <input
                  type="number"
                  min="1"
                  value={manualAmount}
                  onChange={(event) =>
                    setManualAmount(event.target.value)
                  }
                  className={inputClass}
                  placeholder="17500"
                />
              </label>
            )}

            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Receipt File *
              </span>

              <input
                id="payment-receipt-file"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className={inputClass}
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={uploading}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload Receipt"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-900">
              Receipt History
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Date",
                    "Bill",
                    "Amount",
                    "Reference",
                    "Status",
                    "Receipt",
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
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      Loading payment information...
                    </td>
                  </tr>
                ) : receipts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No payment receipts uploaded yet.
                    </td>
                  </tr>
                ) : (
                  receipts.map((receipt) => {
                    const bill = bills.find(
                      (item) => text(item.id) === receipt.bill_id
                    );

                    return (
                      <tr key={receipt.id}>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {receipt.created_at.slice(0, 10)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {bill ? monthLabel(bill) : "Bill"}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {money(receipt.amount)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {receipt.reference_number || "â"}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                            {receipt.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <a
                            href={receipt.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Open
                          </a>
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
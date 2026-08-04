"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import {
  deriveBillStatus,
  getVerifiedPaymentTotal,
  roundMoney,
} from "@/lib/financials";
import { getSupabaseErrorMessage } from "@/lib/supabaseErrors";

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
  room_id: string;
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
  previous_reading: string;
  current_reading: string;
  rate_per_unit: string;
};

type AcBill = {
  id: string;
  bill_id: string | null;
  resident_id: string;
  admission_id: string | null;
  billing_month: string;
  previous_reading: number;
  current_reading: number;
  units_consumed: number;
  rate_per_unit: number;
  total_amount: number;
  remarks: string | null;
};

const currentMonth = new Date().toISOString().slice(0, 7);

function monthInputValue(value: string) {
  return value ? value.slice(0, 7) : "";
}

function monthStartDate(value: string) {
  const month = monthInputValue(value);
  return month ? `${month}-01` : "";
}

function monthEndDate(value: string) {
  const month = monthInputValue(value);
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) return "";

  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

const emptyForm: BillForm = {
  resident_id: "",
  admission_id: "",
  room_id: "",
  billing_month: currentMonth,
  rent_amount: "",
  electricity_amount: "",
  ac_amount: "",
  other_amount: "",
  discount_amount: "",
  paid_amount: "0",
  due_date: monthEndDate(currentMonth),
  bill_status: "Pending",
  notes: "",
  previous_reading: "",
  current_reading: "",
  rate_per_unit: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";

const acBillColumns =
  "id, bill_id, resident_id, admission_id, billing_month, previous_reading, current_reading, units_consumed, rate_per_unit, total_amount, remarks";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedStatus(value: unknown) {
  return text(value).trim().toLowerCase();
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

  const parsed = new Date(`${monthStartDate(value)}T00:00:00`);

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
  const [rooms, setRooms] = useState<GenericRow[]>([]);
  const [acBills, setAcBills] = useState<AcBill[]>([]);
  const [payments, setPayments] = useState<GenericRow[]>([]);
  const [form, setForm] = useState<BillForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAcBillId, setEditingAcBillId] = useState<string | null>(null);
  const [editingWithoutMeterRecord, setEditingWithoutMeterRecord] =
    useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [ledgerResidentId, setLedgerResidentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previousReadingEdited, setPreviousReadingEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editRequestId = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [billsResult, residentsResult, admissionsResult, roomsResult, acBillsResult, paymentsResult] =
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
        supabase.from("rooms").select("id, room_number, status"),
        supabase
          .from("ac_bills")
          .select("*")
          .order("billing_month", { ascending: false }),
        supabase
          .from("payments")
          .select("id, bill_id, resident_id, payment_number, payment_date, amount, payment_status, reference_number")
          .order("payment_date", { ascending: false }),
      ]);

    const firstError =
      billsResult.error ||
      residentsResult.error ||
      admissionsResult.error ||
      roomsResult.error ||
      acBillsResult.error ||
      paymentsResult.error;

    if (firstError) {
      setError(getSupabaseErrorMessage(firstError, "Billing records could not be loaded."));
    } else {
      const verifiedByBill = new Map<string, number>();
      for (const payment of paymentsResult.data ?? []) {
        if (payment.payment_status !== "Verified") continue;
        const billId = text(payment.bill_id);
        verifiedByBill.set(
          billId,
          roundMoney((verifiedByBill.get(billId) ?? 0) + numberValue(payment.amount)),
        );
      }
      setBills(
        ((billsResult.data ?? []) as Bill[]).map((bill) => {
          const paid = verifiedByBill.get(bill.id) ?? 0;
          const balance = Math.max(roundMoney(numberValue(bill.total_amount) - paid), 0);
          const currentStatus =
            normalizedStatus(bill.bill_status) === "cancelled"
              ? "Cancelled"
              : bill.bill_status;
          return {
            ...bill,
            paid_amount: paid,
            balance_amount: balance,
            bill_status: deriveBillStatus(
              numberValue(bill.total_amount),
              paid,
              bill.due_date,
              currentStatus,
            ),
          };
        }),
      );
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setAdmissions((admissionsResult.data ?? []) as GenericRow[]);
      setRooms((roomsResult.data ?? []) as GenericRow[]);
      setAcBills((acBillsResult.data ?? []) as AcBill[]);
      setPayments((paymentsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const computed = useMemo(() => {
    const units = Math.max(
      roundMoney(numberValue(form.current_reading) - numberValue(form.previous_reading)),
      0,
    );
    const meterAmount = roundMoney(units * numberValue(form.rate_per_unit));
    const acAmount = form.current_reading || form.previous_reading || form.rate_per_unit
      ? meterAmount
      : numberValue(form.ac_amount);
    const subtotal =
      numberValue(form.rent_amount) +
      numberValue(form.electricity_amount) +
      acAmount +
      numberValue(form.other_amount);

    const total = Math.max(
      subtotal - numberValue(form.discount_amount),
      0
    );

    const paid = Math.min(numberValue(form.paid_amount), total);
    const balance = Math.max(total - paid, 0);

    return { subtotal, total, paid, balance, units, acAmount };
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

      const matchesMonth =
        monthFilter === "All" || bill.billing_month === monthFilter;

      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [bills, residents, search, statusFilter, monthFilter]);

  const availableMonths = useMemo(
    () => [...new Set(bills.map((bill) => bill.billing_month))].sort().reverse(),
    [bills],
  );

  const ledgerBills = useMemo(
    () => bills.filter((bill) => bill.resident_id === ledgerResidentId),
    [bills, ledgerResidentId],
  );

  const summary = useMemo(() => {
    const operationalBills = bills.filter(
      (bill) => normalizedStatus(bill.bill_status) !== "cancelled",
    );

    const pendingBalance = operationalBills.reduce(
      (sum, bill) => sum + numberValue(bill.balance_amount),
      0,
    );

    const collected = operationalBills.reduce(
      (sum, bill) => sum + numberValue(bill.paid_amount),
      0
    );

    return {
      total: bills.length,
      pending: operationalBills.filter(
        (bill) => normalizedStatus(bill.bill_status) === "pending"
      ).length,
      overdue: operationalBills.filter(
        (bill) => normalizedStatus(bill.bill_status) === "overdue"
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

  function latestPreviousReading(admissionId: string, billingMonth: string) {
    const selectedMonthStart = monthStartDate(billingMonth);
    const previousMeterBill = acBills.find(
      (item) =>
        item.admission_id === admissionId &&
        item.billing_month < selectedMonthStart,
    );
    return previousMeterBill ? String(previousMeterBill.current_reading) : "";
  }

  function openAddForm() {
    editRequestId.current += 1;
    setEditingId(null);
    setEditingAcBillId(null);
    setEditingWithoutMeterRecord(false);
    setForm(emptyForm);
    setPreviousReadingEdited(false);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  async function openEditForm(bill: Bill) {
    const requestId = editRequestId.current + 1;
    editRequestId.current = requestId;
    setShowForm(false);
    setMessage("");
    setError("");

    const baseForm: BillForm = {
      resident_id: bill.resident_id,
      admission_id: bill.admission_id ?? "",
      room_id: firstText(
        admissions.find((item) => text(item.id) === bill.admission_id),
        ["room_id"],
      ),
      billing_month: monthInputValue(bill.billing_month),
      rent_amount: String(bill.rent_amount ?? 0),
      electricity_amount: String(bill.electricity_amount ?? 0),
      ac_amount: String(bill.ac_amount ?? 0),
      other_amount: String(bill.other_amount ?? 0),
      discount_amount: String(bill.discount_amount ?? 0),
      paid_amount: String(bill.paid_amount ?? 0),
      due_date: bill.due_date ?? "",
      bill_status: bill.bill_status,
      notes: bill.notes ?? "",
      previous_reading: "",
      current_reading: "",
      rate_per_unit: "",
    };

    const { data: linkedMeterRows, error: linkedMeterError } = await supabase
      .from("ac_bills")
      .select(acBillColumns)
      .eq("bill_id", bill.id);

    if (requestId !== editRequestId.current) return;

    if (linkedMeterError) {
      setEditingId(bill.id);
      setEditingAcBillId(null);
      setEditingWithoutMeterRecord(false);
      setForm(baseForm);
      setPreviousReadingEdited(true);
      setShowForm(true);
      setError("Bill loaded, but its AC meter details could not be retrieved. Please refresh and try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const expectedMonth = monthStartDate(bill.billing_month);
    const exactLinkedRows = (linkedMeterRows ?? []) as AcBill[];
    let meterBill: AcBill | null = exactLinkedRows[0] ?? null;

    if (exactLinkedRows.length > 1) {
      setEditingId(bill.id);
      setEditingAcBillId(null);
      setEditingWithoutMeterRecord(false);
      setForm(baseForm);
      setPreviousReadingEdited(true);
      setShowForm(true);
      setError("Multiple AC meter records were found for this bill. Please review the AC records.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!meterBill && bill.admission_id) {
      const { data: admissionRows, error: admissionLookupError } = await supabase
        .from("ac_bills")
        .select(acBillColumns)
        .eq("admission_id", bill.admission_id)
        .eq("resident_id", bill.resident_id)
        .eq("billing_month", expectedMonth);

      if (requestId !== editRequestId.current) return;

      if (admissionLookupError) {
        setEditingId(bill.id);
        setEditingAcBillId(null);
        setEditingWithoutMeterRecord(false);
        setForm(baseForm);
        setPreviousReadingEdited(true);
        setShowForm(true);
        setError("Bill loaded, but its AC meter details could not be retrieved. Please refresh and try again.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const exactAdmissionRows = (admissionRows ?? []) as AcBill[];
      if (exactAdmissionRows.length > 1) {
        setEditingId(bill.id);
        setEditingAcBillId(null);
        setEditingWithoutMeterRecord(false);
        setForm(baseForm);
        setPreviousReadingEdited(true);
        setShowForm(true);
        setError("Multiple AC meter records were found for this bill. Please review the AC records.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      meterBill = exactAdmissionRows[0] ?? null;
    }

    if (!meterBill) {
      const { data: residentRows, error: residentLookupError } = await supabase
        .from("ac_bills")
        .select(acBillColumns)
        .eq("resident_id", bill.resident_id)
        .eq("billing_month", expectedMonth);

      if (requestId !== editRequestId.current) return;

      if (residentLookupError) {
        setEditingId(bill.id);
        setEditingAcBillId(null);
        setEditingWithoutMeterRecord(false);
        setForm(baseForm);
        setPreviousReadingEdited(true);
        setShowForm(true);
        setError("Bill loaded, but its AC meter details could not be retrieved. Please refresh and try again.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const exactResidentRows = (residentRows ?? []) as AcBill[];
      if (exactResidentRows.length > 1) {
        setEditingId(bill.id);
        setEditingAcBillId(null);
        setEditingWithoutMeterRecord(false);
        setForm(baseForm);
        setPreviousReadingEdited(true);
        setShowForm(true);
        setError("Multiple AC meter records were found for this bill. Please review the AC records.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      meterBill = exactResidentRows.length === 1 ? exactResidentRows[0] : null;
    }

    if (requestId !== editRequestId.current) return;

    setEditingId(bill.id);
    setEditingAcBillId(meterBill?.id ?? null);
    setEditingWithoutMeterRecord(!meterBill);
    setForm({
      ...baseForm,
      ac_amount: meterBill
        ? String(meterBill.total_amount ?? bill.ac_amount ?? 0)
        : baseForm.ac_amount,
      previous_reading: meterBill ? String(meterBill.previous_reading) : "",
      current_reading: meterBill ? String(meterBill.current_reading) : "",
      rate_per_unit: meterBill ? String(meterBill.rate_per_unit) : "",
    });
    setPreviousReadingEdited(true);
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

    setPreviousReadingEdited(false);

    setForm((current) => ({
      ...current,
      admission_id: admissionId,
      resident_id: firstText(admission, ["resident_id"]),
      room_id: firstText(admission, ["room_id"]),
      rent_amount: firstText(admission, [
        "monthly_rent",
        "rent_amount",
      ]),
      previous_reading: latestPreviousReading(admissionId, current.billing_month),
    }));

  }

  async function saveBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    if (
      !form.resident_id ||
      !form.admission_id ||
      !form.billing_month ||
      !form.due_date
    ) {
      setError(
        "Resident, current admission, billing month and due date are required."
      );
      setSaving(false);
      return;
    }

    const meterSupplied = Boolean(
      form.previous_reading || form.current_reading || form.rate_per_unit,
    );
    const acBillingMonth = monthStartDate(form.billing_month);
    const currentMeterBillId = editingId
      ? editingAcBillId ?? acBills.find((item) => item.bill_id === editingId)?.id
      : undefined;
    if (
      meterSupplied &&
      (numberValue(form.previous_reading) < 0 ||
        numberValue(form.current_reading) < numberValue(form.previous_reading) ||
        numberValue(form.rate_per_unit) <= 0)
    ) {
      setError("Current reading must be at least the previous reading, and the rate must be greater than zero.");
      setSaving(false);
      return;
    }

    const { data: currentAdmission, error: admissionError } = await supabase
      .from("admissions")
      .select("id, resident_id, room_id, status")
      .eq("id", form.admission_id)
      .single();

    if (
      admissionError ||
      !currentAdmission ||
      text(currentAdmission.resident_id) !== form.resident_id ||
      (!editingId && currentAdmission.status !== "Active")
    ) {
      setError("The selected resident no longer has this active admission. Refresh and select a current admission.");
      setSaving(false);
      return;
    }

    {
      let duplicateQuery = supabase
        .from("bills")
        .select("id")
        .eq("admission_id", form.admission_id)
        .eq("billing_month", form.billing_month)
        .neq("bill_status", "Cancelled")
        .limit(1);
      if (editingId) duplicateQuery = duplicateQuery.neq("id", editingId);
      const { data: duplicate, error: duplicateError } = await duplicateQuery;
      if (duplicateError) {
        setError(getSupabaseErrorMessage(duplicateError, "Unable to check for an existing monthly bill."));
        setSaving(false);
        return;
      }

      if (meterSupplied) {
        let duplicateMeterQuery = supabase
          .from("ac_bills")
          .select("id")
          .eq("admission_id", form.admission_id)
          .eq("billing_month", acBillingMonth)
          .limit(1);
        if (currentMeterBillId) {
          duplicateMeterQuery = duplicateMeterQuery.neq("id", currentMeterBillId);
        }
        const { data: duplicateMeter, error: meterDuplicateError } =
          await duplicateMeterQuery;
        if (meterDuplicateError) {
          setError("Unable to check for an existing AC bill for this month.");
          setSaving(false);
          return;
        }
        if ((duplicateMeter ?? []).length > 0) {
          setError("An AC bill already exists for this admission and billing month.");
          setSaving(false);
          return;
        }
      }
      if ((duplicate ?? []).length > 0) {
        setError("A non-cancelled bill already exists for this admission and billing month.");
        setSaving(false);
        return;
      }
    }

    const verifiedPaid = editingId
      ? await getVerifiedPaymentTotal(editingId).catch(() => null)
      : 0;
    if (verifiedPaid === null) {
      setError("Unable to confirm the verified payments for this bill.");
      setSaving(false);
      return;
    }
    if (verifiedPaid > computed.total) {
      setError("The revised bill total cannot be lower than its verified payments.");
      setSaving(false);
      return;
    }

    let finalStatus = deriveBillStatus(
      computed.total,
      verifiedPaid,
      form.due_date,
      form.bill_status,
    );

    if (form.bill_status === "Cancelled") finalStatus = "Cancelled";

    const payload = {
      resident_id: form.resident_id,
      admission_id: form.admission_id || null,
      billing_month: form.billing_month,
      rent_amount: numberValue(form.rent_amount),
      electricity_amount: numberValue(
        form.electricity_amount
      ),
      ac_amount: computed.acAmount,
      other_amount: numberValue(form.other_amount),
      discount_amount: numberValue(form.discount_amount),
      total_amount: computed.total,
      paid_amount: verifiedPaid,
      balance_amount: Math.max(roundMoney(computed.total - verifiedPaid), 0),
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
          .select("id")
          .single()
      : await supabase.from("bills").insert({
          ...payload,
          bill_number: makeBillNumber(),
        }).select("id").single();

    if (result.error) {
      setError(getSupabaseErrorMessage(result.error, "The bill could not be saved. Please verify the details and try again.", "A bill with these details already exists."));
    } else {
      const savedBillId = text(result.data?.id);
      const existingMeterBillId =
        currentMeterBillId ??
        acBills.find((item) => item.bill_id === savedBillId)?.id;
      if (meterSupplied) {
        const meterPayload = {
          resident_id: form.resident_id,
          admission_id: form.admission_id,
          bill_id: savedBillId,
          billing_month: acBillingMonth,
          previous_reading: numberValue(form.previous_reading),
          current_reading: numberValue(form.current_reading),
          units_consumed: computed.units,
          rate_per_unit: numberValue(form.rate_per_unit),
          total_amount: computed.acAmount,
          remarks: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        };
        const meterOperation = existingMeterBillId ? "update" : "insert";

        console.info(`[Billing] ac_bills ${meterOperation} payload`, meterPayload);

        const meterResult = existingMeterBillId
          ? await supabase
              .from("ac_bills")
              .update(meterPayload)
              .eq("id", existingMeterBillId)
              .select("id, bill_id")
              .single()
          : await supabase
              .from("ac_bills")
              .insert(meterPayload)
              .select("id, bill_id")
              .single();
        if (meterResult.error || !meterResult.data) {
          console.error(`[Billing] ac_bills ${meterOperation} failed`, {
            payload: meterPayload,
            error: meterResult.error
              ? {
                  code: meterResult.error.code,
                  message: meterResult.error.message,
                  details: meterResult.error.details,
                  hint: meterResult.error.hint,
                }
              : {
                  code: "NO_INSERTED_ROW",
                  message: "Supabase returned no AC meter row after saving.",
                  details: null,
                  hint: null,
                },
          });
          setError(
            editingId
              ? "The monthly bill was saved, but its meter-reading record could not be saved. Please edit the bill and try again."
              : "The bill was saved, but its AC meter details were not linked. Please review this bill.",
          );
          setSaving(false);
          await refresh();
          return;
        }

        if (text(meterResult.data.bill_id) !== savedBillId) {
          const { data: linkedMeterBill, error: linkError } = await supabase
            .from("ac_bills")
            .update({ bill_id: savedBillId, updated_at: new Date().toISOString() })
            .eq("id", meterResult.data.id)
            .select("id, bill_id")
            .single();

          if (linkError || text(linkedMeterBill?.bill_id) !== savedBillId) {
            setError("The bill was saved, but its AC meter details were not linked. Please review this bill.");
            setSaving(false);
            await refresh();
            return;
          }
        }

        const { data: verifiedMeterBill, error: meterVerificationError } =
          await supabase
            .from("ac_bills")
            .select(acBillColumns)
            .eq("id", meterResult.data.id)
            .maybeSingle();

        if (meterVerificationError || !verifiedMeterBill) {
          console.error("[Billing] ac_bills read-back failed", {
            inserted_id: meterResult.data.id,
            expected_bill_id: savedBillId,
            error: meterVerificationError
              ? {
                  code: meterVerificationError.code,
                  message: meterVerificationError.message,
                  details: meterVerificationError.details,
                  hint: meterVerificationError.hint,
                }
              : {
                  code: "INSERTED_ROW_NOT_FOUND",
                  message: "The inserted AC meter row was not found by its id.",
                  details: null,
                  hint: null,
                },
          });
          setError("The bill was saved, but its AC meter details were not linked. Please review this bill.");
          setSaving(false);
          await refresh();
          return;
        }

        const persistedMeterValuesMatch =
          text(verifiedMeterBill.bill_id) === savedBillId &&
          numberValue(verifiedMeterBill.previous_reading) ===
            numberValue(meterPayload.previous_reading) &&
          numberValue(verifiedMeterBill.current_reading) ===
            numberValue(meterPayload.current_reading) &&
          numberValue(verifiedMeterBill.units_consumed) ===
            numberValue(meterPayload.units_consumed) &&
          numberValue(verifiedMeterBill.rate_per_unit) ===
            numberValue(meterPayload.rate_per_unit) &&
          numberValue(verifiedMeterBill.total_amount) ===
            numberValue(meterPayload.total_amount) &&
          monthStartDate(verifiedMeterBill.billing_month) === acBillingMonth;

        if (!persistedMeterValuesMatch) {
          console.error("[Billing] ac_bills read-back did not match the insert payload", {
            payload: meterPayload,
            persisted: verifiedMeterBill,
          });
          setError("The bill was saved, but its AC meter details were not linked. Please review this bill.");
          setSaving(false);
          await refresh();
          return;
        }
      }
      setMessage(
        editingId
          ? "Bill updated successfully."
          : "Bill generated successfully."
      );
      setEditingId(null);
      setEditingAcBillId(null);
      setEditingWithoutMeterRecord(false);
      setForm(emptyForm);
      setShowForm(false);
      await refresh();
    }

    setSaving(false);
  }

  async function cancelBill(bill: Bill) {
    if (bill.bill_status === "Cancelled") return;
    if (!window.confirm(`Cancel bill ${bill.bill_number}? Its financial history will be preserved.`)) {
      return;
    }

    setMessage("");
    setError("");

    const { error: cancelError } = await supabase
      .from("bills")
      .update({ bill_status: "Cancelled", updated_at: new Date().toISOString() })
      .eq("id", bill.id);

    if (cancelError) {
      setError(getSupabaseErrorMessage(cancelError, "The bill could not be cancelled."));
    } else {
      setMessage("Bill cancelled. Its payment and billing history has been preserved.");
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
          <h1>StayHub</h1>
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
              StayHub
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

                    {admissions
                      .filter(
                        (admission) =>
                          admission.status === "Active" ||
                          text(admission.id) === form.admission_id,
                      )
                      .map((admission) => {
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
                          {residentName(resident)} —{" "}
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

                    {residents
                      .filter(
                        (resident) =>
                          resident.status !== "Archived" ||
                          text(resident.id) === form.resident_id,
                      )
                      .map((resident) => (
                      <option
                        key={text(resident.id)}
                        value={text(resident.id)}
                      >
                        {residentName(resident)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Room *">
                  <select value={form.room_id} disabled className={inputClass}>
                    <option value="">Selected from current admission</option>
                    {rooms.map((room) => (
                      <option key={text(room.id)} value={text(room.id)}>
                        {firstText(room, ["room_number"]) || text(room.id)}
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
                      setForm((current) => ({
                        ...current,
                        billing_month: event.target.value,
                        due_date: monthEndDate(event.target.value),
                        previous_reading: previousReadingEdited
                          ? current.previous_reading
                          : latestPreviousReading(
                              current.admission_id,
                              event.target.value,
                            ),
                      }))
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

                <Field
                  label={
                    editingId && editingWithoutMeterRecord
                      ? "Manual AC Charge"
                      : "AC Charges (Meter Based)"
                  }
                >
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

                {editingId && editingWithoutMeterRecord && (
                  <Field label="AC Meter Details" wide>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      No meter-reading record is linked to this historical bill.
                    </div>
                  </Field>
                )}

                <Field label="Previous Meter Reading">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.previous_reading}
                    onChange={(event) => {
                      setPreviousReadingEdited(true);
                      updateField("previous_reading", event.target.value);
                    }}
                    className={inputClass}
                    placeholder="Previous reading"
                  />
                </Field>

                <Field label="Current Meter Reading">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.current_reading}
                    onChange={(event) => updateField("current_reading", event.target.value)}
                    className={inputClass}
                    placeholder="Current reading"
                  />
                </Field>

                <Field label="Rate per Unit">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.rate_per_unit}
                    onChange={(event) => updateField("rate_per_unit", event.target.value)}
                    className={inputClass}
                    placeholder="Rate per unit"
                  />
                </Field>

                <Field label="Units / Calculated AC Amount">
                  <input
                    readOnly
                    value={`${computed.units.toFixed(2)} units — ${money(computed.acAmount)}`}
                    className={inputClass}
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

                <Field label="Verified Payments">
                  <input
                    type="number"
                    min="0"
                    value={form.paid_amount}
                    readOnly
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

                <Field label="Bill Status (calculated)">
                  <select
                    value={deriveBillStatus(
                      computed.total,
                      computed.paid,
                      form.due_date,
                      form.bill_status,
                    )}
                    disabled
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
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_200px_180px_auto]">
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

            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className={inputClass}
            >
              <option value="All">All Months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
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
                              onClick={() => void openEditForm(bill)}
                              className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => void cancelBill(bill)}
                              disabled={bill.bill_status === "Cancelled"}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                            >
                              {bill.bill_status === "Cancelled" ? "Cancelled" : "Cancel"}
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

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-900">Resident Financial Ledger</h2>
            <p className="mt-1 text-sm text-slate-500">
              Bills and complete payment history, with only verified payments applied to balances.
            </p>
            <select
              value={ledgerResidentId}
              onChange={(event) => setLedgerResidentId(event.target.value)}
              className={`${inputClass} mt-4 max-w-md`}
            >
              <option value="">Select resident</option>
              {residents.map((resident) => (
                <option key={text(resident.id)} value={text(resident.id)}>
                  {residentName(resident)}
                  {resident.status === "Archived" ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {["Month / Due", "Rent", "AC", "Total", "Verified", "Outstanding", "Status", "Payment History"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!ledgerResidentId || ledgerBills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                      {ledgerResidentId ? "No bills found for this resident." : "Select a resident to view the ledger."}
                    </td>
                  </tr>
                ) : (
                  ledgerBills.map((bill) => {
                    const billPayments = payments.filter(
                      (payment) => text(payment.bill_id) === bill.id,
                    );
                    return (
                      <tr key={bill.id} className="align-top">
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">{monthLabel(bill.billing_month)}</p>
                          <p className="mt-1 text-xs">Due {bill.due_date}</p>
                        </td>
                        <td className="px-4 py-4 text-sm">{money(bill.rent_amount)}</td>
                        <td className="px-4 py-4 text-sm">{money(bill.ac_amount)}</td>
                        <td className="px-4 py-4 text-sm font-semibold">{money(bill.total_amount)}</td>
                        <td className="px-4 py-4 text-sm text-emerald-700">{money(bill.paid_amount)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-red-700">{money(bill.balance_amount)}</td>
                        <td className="px-4 py-4 text-sm">{bill.bill_status}</td>
                        <td className="px-4 py-4 text-xs text-slate-600">
                          {billPayments.length === 0
                            ? "No payments"
                            : billPayments.map((payment) => (
                                <p key={text(payment.id)} className="mb-1">
                                  {firstText(payment, ["payment_date"])} · {money(payment.amount)} · {firstText(payment, ["payment_status"])}
                                </p>
                              ))}
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

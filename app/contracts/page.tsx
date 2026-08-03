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

type ContractStatus = "Draft" | "Pending Signature" | "Active" | "Expired" | "Cancelled";
type SignatureStatus = "Pending" | "Signed";

type Resident = {
  id: string;
  full_name: string;
};

type Admission = {
  id: string;
  resident_id: string;
  room_id: string | null;
  bed_id: string | null;
  admission_date: string;
  expected_leaving_date: string | null;
  monthly_rent: number;
  security_deposit: number;
  status: string;
};

type Room = {
  id: string;
  room_number: string;
};

type Bed = {
  id: string;
  bed_number: string;
};

type Contract = {
  id: string;
  contract_number: string;
  resident_id: string;
  admission_id: string | null;
  room_id: string | null;
  bed_id: string | null;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  security_deposit: number;
  notice_period_days: number;
  resident_signature_status: SignatureStatus;
  owner_signature_status: SignatureStatus;
  resident_signature_name: string | null;
  owner_signature_name: string | null;
  signed_at: string | null;
  status: ContractStatus;
  terms: string | null;
  created_at: string;
  updated_at: string;
};

type ContractForm = {
  contract_number: string;
  resident_id: string;
  admission_id: string;
  room_id: string;
  bed_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  security_deposit: string;
  notice_period_days: string;
  resident_signature_status: SignatureStatus;
  owner_signature_status: SignatureStatus;
  resident_signature_name: string;
  owner_signature_name: string;
  status: ContractStatus;
  terms: string;
};

const today = new Date().toISOString().slice(0, 10);

const defaultTerms =
  "1. Monthly rent must be paid by the due date.\n2. Security deposit is refundable only when the resident serves at least 30 days notice before leaving.\n3. Room and bed allocation is decided manually by the owner.\n4. Damage charges may be deducted from the security deposit.\n5. The resident must follow hostel rules and inspection procedures.";

const emptyForm: ContractForm = {
  contract_number: "",
  resident_id: "",
  admission_id: "",
  room_id: "",
  bed_id: "",
  start_date: today,
  end_date: "",
  monthly_rent: "",
  security_deposit: "",
  notice_period_days: "30",
  resident_signature_status: "Pending",
  owner_signature_status: "Pending",
  resident_signature_name: "",
  owner_signature_name: "",
  status: "Draft",
  terms: defaultTerms,
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function statusClass(status: ContractStatus) {
  if (status === "Active") return "bg-emerald-100 text-emerald-700";
  if (status === "Pending Signature") return "bg-amber-100 text-amber-700";
  if (status === "Expired") return "bg-red-100 text-red-700";
  if (status === "Cancelled") return "bg-slate-200 text-slate-700";
  return "bg-blue-100 text-blue-700";
}

function signatureClass(status: SignatureStatus) {
  return status === "Signed"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function makeContractNumber() {
  return `CNT-${new Date().getFullYear()}-${Date.now()
    .toString()
    .slice(-6)}`;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [form, setForm] = useState<ContractForm>(emptyForm);
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

    const [
      { data: contractsData, error: contractsError },
      { data: residentsData, error: residentsError },
      { data: admissionsData, error: admissionsError },
      { data: roomsData, error: roomsError },
      { data: bedsData, error: bedsError },
    ] = await Promise.all([
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("residents").select("id, full_name").order("full_name"),
      supabase.from("admissions").select("*").order("created_at", { ascending: false }),
      supabase.from("rooms").select("id, room_number").order("room_number"),
      supabase.from("beds").select("id, bed_number").order("bed_number"),
    ]);

    const firstError =
      contractsError ||
      residentsError ||
      admissionsError ||
      roomsError ||
      bedsError;

    if (firstError) setError(firstError.message);

    setContracts((contractsData ?? []) as Contract[]);
    setResidents((residentsData ?? []) as Resident[]);
    setAdmissions((admissionsData ?? []) as Admission[]);
    setRooms((roomsData ?? []) as Room[]);
    setBeds((bedsData ?? []) as Bed[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredContracts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return contracts.filter((contract) => {
      const residentName =
        residents.find((resident) => resident.id === contract.resident_id)
          ?.full_name ?? "";

      const matchesSearch =
        !query ||
        contract.contract_number.toLowerCase().includes(query) ||
        residentName.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || contract.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [contracts, residents, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: contracts.length,
      active: contracts.filter((item) => item.status === "Active").length,
      pending: contracts.filter((item) => item.status === "Pending Signature")
        .length,
      expired: contracts.filter((item) => item.status === "Expired").length,
    }),
    [contracts]
  );

  function updateField<K extends keyof ContractForm>(
    key: K,
    value: ContractForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      contract_number: makeContractNumber(),
    });
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEditForm(contract: Contract) {
    setEditingId(contract.id);
    setForm({
      contract_number: contract.contract_number,
      resident_id: contract.resident_id,
      admission_id: contract.admission_id ?? "",
      room_id: contract.room_id ?? "",
      bed_id: contract.bed_id ?? "",
      start_date: contract.start_date,
      end_date: contract.end_date ?? "",
      monthly_rent: String(contract.monthly_rent ?? 0),
      security_deposit: String(contract.security_deposit ?? 0),
      notice_period_days: String(contract.notice_period_days ?? 30),
      resident_signature_status: contract.resident_signature_status,
      owner_signature_status: contract.owner_signature_status,
      resident_signature_name: contract.resident_signature_name ?? "",
      owner_signature_name: contract.owner_signature_name ?? "",
      status: contract.status,
      terms: contract.terms ?? defaultTerms,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyAdmission(admissionId: string) {
    const admission = admissions.find((item) => item.id === admissionId);

    if (!admission) {
      updateField("admission_id", "");
      return;
    }

    setForm((current) => ({
      ...current,
      admission_id: admission.id,
      resident_id: admission.resident_id,
      room_id: admission.room_id ?? "",
      bed_id: admission.bed_id ?? "",
      start_date: admission.admission_date || today,
      end_date: admission.expected_leaving_date ?? "",
      monthly_rent: String(admission.monthly_rent ?? 0),
      security_deposit: String(admission.security_deposit ?? 0),
    }));
  }

  async function saveContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    if (!form.contract_number.trim() || !form.resident_id || !form.start_date) {
      setError("Contract number, resident and start date are required.");
      setSaving(false);
      return;
    }

    const bothSigned =
      form.resident_signature_status === "Signed" &&
      form.owner_signature_status === "Signed";

    const payload = {
      contract_number: form.contract_number.trim(),
      resident_id: form.resident_id,
      admission_id: form.admission_id || null,
      room_id: form.room_id || null,
      bed_id: form.bed_id || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      monthly_rent: Number(form.monthly_rent) || 0,
      security_deposit: Number(form.security_deposit) || 0,
      notice_period_days: Number(form.notice_period_days) || 30,
      resident_signature_status: form.resident_signature_status,
      owner_signature_status: form.owner_signature_status,
      resident_signature_name: form.resident_signature_name.trim() || null,
      owner_signature_name: form.owner_signature_name.trim() || null,
      signed_at: bothSigned ? new Date().toISOString() : null,
      status: form.status,
      terms: form.terms.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("contracts").update(payload).eq("id", editingId)
      : await supabase.from("contracts").insert(payload);

    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage(
        editingId
          ? "Contract updated successfully."
          : "Contract created successfully."
      );
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await refresh();
    }

    setSaving(false);
  }

  async function deleteContract(contract: Contract) {
    if (!window.confirm(`Delete contract ${contract.contract_number}?`)) return;

    const { error: deleteError } = await supabase
      .from("contracts")
      .delete()
      .eq("id", contract.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Contract deleted successfully.");
      await refresh();
    }
  }

  function printContract(contract: Contract) {
    const resident = residents.find(
      (item) => item.id === contract.resident_id
    );
    const room = rooms.find((item) => item.id === contract.room_id);
    const bed = beds.find((item) => item.id === contract.bed_id);

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${contract.contract_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { margin-bottom: 8px; }
            .meta { margin-bottom: 24px; color: #475569; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
            .card { border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px; }
            .label { font-size: 12px; color: #64748b; text-transform: uppercase; }
            .value { margin-top: 6px; font-weight: 700; }
            .terms { white-space: pre-wrap; line-height: 1.7; }
          </style>
        </head>
        <body>
          <h1>Hostel Management System</h1>
          <div class="meta">Resident Contract</div>
          <div class="grid">
            <div class="card"><div class="label">Contract Number</div><div class="value">${contract.contract_number}</div></div>
            <div class="card"><div class="label">Resident</div><div class="value">${resident?.full_name ?? "Unknown"}</div></div>
            <div class="card"><div class="label">Room</div><div class="value">${room?.room_number ?? "Not allocated"}</div></div>
            <div class="card"><div class="label">Bed</div><div class="value">${bed?.bed_number ?? "Not allocated"}</div></div>
            <div class="card"><div class="label">Start Date</div><div class="value">${contract.start_date}</div></div>
            <div class="card"><div class="label">End Date</div><div class="value">${contract.end_date ?? "Not set"}</div></div>
            <div class="card"><div class="label">Monthly Rent</div><div class="value">${money(contract.monthly_rent)}</div></div>
            <div class="card"><div class="label">Security Deposit</div><div class="value">${money(contract.security_deposit)}</div></div>
          </div>
          <h2>Terms and Conditions</h2>
          <div class="terms">${contract.terms ?? ""}</div>
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
              Contracts
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create, sign, print and manage resident contracts.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Add Contract
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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? "Edit Contract" : "Add Contract"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select an admission to fill resident, room, bed, rent and deposit automatically.
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

            <form onSubmit={saveContract} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Contract Number *">
                  <input
                    required
                    value={form.contract_number}
                    onChange={(event) =>
                      updateField("contract_number", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Admission">
                  <select
                    value={form.admission_id}
                    onChange={(event) => applyAdmission(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select admission</option>
                    {admissions.map((admission) => {
                      const resident = residents.find(
                        (item) => item.id === admission.resident_id
                      );

                      return (
                        <option key={admission.id} value={admission.id}>
                          {resident?.full_name ?? "Unknown"} â{" "}
                          {admission.admission_date}
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
                      updateField("resident_id", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select resident</option>
                    {residents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {resident.full_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Room">
                  <select
                    value={form.room_id}
                    onChange={(event) =>
                      updateField("room_id", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select room</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_number}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Bed">
                  <select
                    value={form.bed_id}
                    onChange={(event) =>
                      updateField("bed_id", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select bed</option>
                    {beds.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.bed_number}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Start Date *">
                  <input
                    required
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      updateField("start_date", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="End Date">
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(event) =>
                      updateField("end_date", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Monthly Rent">
                  <input
                    type="number"
                    min="0"
                    value={form.monthly_rent}
                    onChange={(event) =>
                      updateField("monthly_rent", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Security Deposit">
                  <input
                    type="number"
                    min="0"
                    value={form.security_deposit}
                    onChange={(event) =>
                      updateField("security_deposit", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Notice Period (Days)">
                  <input
                    type="number"
                    min="0"
                    value={form.notice_period_days}
                    onChange={(event) =>
                      updateField("notice_period_days", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Resident Signature">
                  <select
                    value={form.resident_signature_status}
                    onChange={(event) =>
                      updateField(
                        "resident_signature_status",
                        event.target.value as SignatureStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Signed">Signed</option>
                  </select>
                </Field>

                <Field label="Resident Signature Name">
                  <input
                    value={form.resident_signature_name}
                    onChange={(event) =>
                      updateField(
                        "resident_signature_name",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="Resident full name"
                  />
                </Field>

                <Field label="Owner Signature">
                  <select
                    value={form.owner_signature_status}
                    onChange={(event) =>
                      updateField(
                        "owner_signature_status",
                        event.target.value as SignatureStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Signed">Signed</option>
                  </select>
                </Field>

                <Field label="Owner Signature Name">
                  <input
                    value={form.owner_signature_name}
                    onChange={(event) =>
                      updateField(
                        "owner_signature_name",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="Owner or manager name"
                  />
                </Field>

                <Field label="Contract Status">
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value as ContractStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Pending Signature">
                      Pending Signature
                    </option>
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </Field>

                <Field label="Terms and Conditions" wide>
                  <textarea
                    value={form.terms}
                    onChange={(event) =>
                      updateField("terms", event.target.value)
                    }
                    className={`${inputClass} min-h-52`}
                  />
                </Field>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Security deposit is refundable only when notice is served at least 30 days before leaving.
              </div>

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
                    ? "Update Contract"
                    : "Save Contract"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Contracts" value={String(summary.total)} />
          <StatCard label="Active" value={String(summary.active)} />
          <StatCard label="Pending Signature" value={String(summary.pending)} />
          <StatCard label="Expired" value={String(summary.expired)} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search contract number or resident"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending Signature">Pending Signature</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
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
                    "Contract",
                    "Resident",
                    "Room / Bed",
                    "Dates",
                    "Rent / Deposit",
                    "Signatures",
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
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      Loading contracts...
                    </td>
                  </tr>
                ) : filteredContracts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No contracts found.
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map((contract) => {
                    const resident = residents.find(
                      (item) => item.id === contract.resident_id
                    );
                    const room = rooms.find(
                      (item) => item.id === contract.room_id
                    );
                    const bed = beds.find(
                      (item) => item.id === contract.bed_id
                    );

                    return (
                      <tr key={contract.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {contract.contract_number}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {resident?.full_name || "Unknown resident"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>Room: {room?.room_number || "Not allocated"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Bed: {bed?.bed_number || "Not allocated"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>{contract.start_date}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            To: {contract.end_date || "Not set"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>Rent: {money(contract.monthly_rent)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Deposit: {money(contract.security_deposit)}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${signatureClass(
                                contract.resident_signature_status
                              )}`}
                            >
                              Resident: {contract.resident_signature_status}
                            </span>

                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${signatureClass(
                                contract.owner_signature_status
                              )}`}
                            >
                              Owner: {contract.owner_signature_status}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                              contract.status
                            )}`}
                          >
                            {contract.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => printContract(contract)}
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"
                            >
                              Print
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(contract)}
                              className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => void deleteContract(contract)}
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
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}
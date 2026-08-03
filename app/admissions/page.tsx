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

type AdmissionStatus = "Active" | "Pending" | "Completed" | "Cancelled";
type DepositStatus = "Pending" | "Received" | "Refunded" | "Forfeited";

type Resident = {
  id: string;
  full_name: string;
};

type Room = {
  id: string;
  room_number: string;
};

type Bed = {
  id: string;
  room_id: string;
  bed_number: string;
  status: string;
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
  deposit_status: DepositStatus;
  notice_period_days: number;
  status: AdmissionStatus;
  notes: string | null;
  created_at: string;
};

type AdmissionForm = {
  resident_id: string;
  room_id: string;
  bed_id: string;
  admission_date: string;
  expected_leaving_date: string;
  monthly_rent: string;
  security_deposit: string;
  deposit_status: DepositStatus;
  notice_period_days: string;
  status: AdmissionStatus;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyForm: AdmissionForm = {
  resident_id: "",
  room_id: "",
  bed_id: "",
  admission_date: today,
  expected_leaving_date: "",
  monthly_rent: "",
  security_deposit: "",
  deposit_status: "Pending",
  notice_period_days: "30",
  status: "Active",
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function admissionStatusClass(status: AdmissionStatus) {
  if (status === "Active") return "bg-emerald-100 text-emerald-700";
  if (status === "Pending") return "bg-amber-100 text-amber-700";
  if (status === "Completed") return "bg-blue-100 text-blue-700";
  return "bg-red-100 text-red-700";
}

function depositStatusClass(status: DepositStatus) {
  if (status === "Received") return "bg-emerald-100 text-emerald-700";
  if (status === "Refunded") return "bg-blue-100 text-blue-700";
  if (status === "Forfeited") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [form, setForm] = useState<AdmissionForm>(emptyForm);
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
      { data: admissionsData, error: admissionsError },
      { data: residentsData, error: residentsError },
      { data: roomsData, error: roomsError },
      { data: bedsData, error: bedsError },
    ] = await Promise.all([
      supabase.from("admissions").select("*").order("created_at", { ascending: false }),
      supabase.from("residents").select("id, full_name").order("full_name"),
      supabase.from("rooms").select("id, room_number").order("room_number"),
      supabase.from("beds").select("id, room_id, bed_number, status").order("bed_number"),
    ]);

    const firstError =
      admissionsError || residentsError || roomsError || bedsError;

    if (firstError) {
      setError(firstError.message);
    }

    setAdmissions((admissionsData ?? []) as Admission[]);
    setResidents((residentsData ?? []) as Resident[]);
    setRooms((roomsData ?? []) as Room[]);
    setBeds((bedsData ?? []) as Bed[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredBeds = useMemo(
    () =>
      beds.filter(
        (bed) =>
          bed.room_id === form.room_id &&
          (editingId ? true : bed.status !== "Occupied")
      ),
    [beds, form.room_id, editingId]
  );

  const filteredAdmissions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return admissions.filter((admission) => {
      const residentName =
        residents.find((resident) => resident.id === admission.resident_id)
          ?.full_name ?? "";

      const roomNumber =
        rooms.find((room) => room.id === admission.room_id)?.room_number ?? "";

      const matchesSearch =
        !query ||
        residentName.toLowerCase().includes(query) ||
        roomNumber.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || admission.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [admissions, residents, rooms, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: admissions.length,
      active: admissions.filter((item) => item.status === "Active").length,
      pending: admissions.filter((item) => item.status === "Pending").length,
      depositsReceived: admissions.filter(
        (item) => item.deposit_status === "Received"
      ).length,
    }),
    [admissions]
  );

  function updateField<K extends keyof AdmissionForm>(
    key: K,
    value: AdmissionForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "room_id" ? { bed_id: "" } : {}),
    }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEditForm(admission: Admission) {
    setEditingId(admission.id);
    setForm({
      resident_id: admission.resident_id,
      room_id: admission.room_id ?? "",
      bed_id: admission.bed_id ?? "",
      admission_date: admission.admission_date,
      expected_leaving_date: admission.expected_leaving_date ?? "",
      monthly_rent: String(admission.monthly_rent ?? 0),
      security_deposit: String(admission.security_deposit ?? 0),
      deposit_status: admission.deposit_status,
      notice_period_days: String(admission.notice_period_days ?? 30),
      status: admission.status,
      notes: admission.notes ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAdmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    if (!form.resident_id || !form.admission_date) {
      setError("Resident and admission date are required.");
      setSaving(false);
      return;
    }

    const payload = {
      resident_id: form.resident_id,
      room_id: form.room_id || null,
      bed_id: form.bed_id || null,
      admission_date: form.admission_date,
      expected_leaving_date: form.expected_leaving_date || null,
      monthly_rent: Number(form.monthly_rent) || 0,
      security_deposit: Number(form.security_deposit) || 0,
      deposit_status: form.deposit_status,
      notice_period_days: Number(form.notice_period_days) || 30,
      status: form.status,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const previousAdmission = editingId
      ? admissions.find((item) => item.id === editingId)
      : null;

    const result = editingId
      ? await supabase.from("admissions").update(payload).eq("id", editingId)
      : await supabase.from("admissions").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (previousAdmission?.bed_id && previousAdmission.bed_id !== form.bed_id) {
      await supabase
        .from("beds")
        .update({ status: "Vacant" })
        .eq("id", previousAdmission.bed_id);
    }

    if (form.bed_id && form.status === "Active") {
      await supabase
        .from("beds")
        .update({ status: "Occupied" })
        .eq("id", form.bed_id);
    }

    setMessage(
      editingId
        ? "Admission updated successfully."
        : "Admission added successfully."
    );
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    await refresh();
    setSaving(false);
  }

  async function deleteAdmission(admission: Admission) {
    if (!window.confirm("Delete this admission record?")) return;

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("admissions")
      .delete()
      .eq("id", admission.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (admission.bed_id) {
      await supabase
        .from("beds")
        .update({ status: "Vacant" })
        .eq("id", admission.bed_id);
    }

    setMessage("Admission deleted successfully.");
    await refresh();
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
              Admissions
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage admissions, manual room allocation and security deposits.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Add Admission
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
                  {editingId ? "Edit Admission" : "Add Admission"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Room and bed allocation is selected manually by the owner.
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

            <form onSubmit={saveAdmission} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    disabled={!form.room_id}
                  >
                    <option value="">Select bed</option>
                    {filteredBeds.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.bed_number} ({bed.status})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Admission Date *">
                  <input
                    required
                    type="date"
                    value={form.admission_date}
                    onChange={(event) =>
                      updateField("admission_date", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Expected Leaving Date">
                  <input
                    type="date"
                    value={form.expected_leaving_date}
                    onChange={(event) =>
                      updateField(
                        "expected_leaving_date",
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
                    value={form.monthly_rent}
                    onChange={(event) =>
                      updateField("monthly_rent", event.target.value)
                    }
                    className={inputClass}
                    placeholder="15000"
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
                    placeholder="15000"
                  />
                </Field>

                <Field label="Deposit Status">
                  <select
                    value={form.deposit_status}
                    onChange={(event) =>
                      updateField(
                        "deposit_status",
                        event.target.value as DepositStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Received">Received</option>
                    <option value="Refunded">Refunded</option>
                    <option value="Forfeited">Forfeited</option>
                  </select>
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

                <Field label="Admission Status">
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value as AdmissionStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
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
                    placeholder="Admission notes"
                  />
                </Field>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Security deposit is refundable only when the resident serves
                notice at least 30 days before leaving. Otherwise, the deposit
                may be forfeited.
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
                    ? "Update Admission"
                    : "Save Admission"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Admissions" value={String(summary.total)} />
          <StatCard label="Active" value={String(summary.active)} />
          <StatCard label="Pending" value={String(summary.pending)} />
          <StatCard
            label="Deposits Received"
            value={String(summary.depositsReceived)}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search resident or room"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
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
                    "Resident",
                    "Room / Bed",
                    "Dates",
                    "Rent / Deposit",
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
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      Loading admissions...
                    </td>
                  </tr>
                ) : filteredAdmissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No admissions found.
                    </td>
                  </tr>
                ) : (
                  filteredAdmissions.map((admission) => {
                    const resident = residents.find(
                      (item) => item.id === admission.resident_id
                    );
                    const room = rooms.find(
                      (item) => item.id === admission.room_id
                    );
                    const bed = beds.find(
                      (item) => item.id === admission.bed_id
                    );

                    return (
                      <tr key={admission.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {resident?.full_name || "Unknown resident"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>Room: {room?.room_number || "Not allocated"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Bed: {bed?.bed_number || "Not allocated"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>Admission: {admission.admission_date}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Leaving:{" "}
                            {admission.expected_leaving_date || "Not set"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>Rent: {money(admission.monthly_rent)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Deposit: {money(admission.security_deposit)}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${depositStatusClass(
                              admission.deposit_status
                            )}`}
                          >
                            {admission.deposit_status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${admissionStatusClass(
                              admission.status
                            )}`}
                          >
                            {admission.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditForm(admission)}
                              className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => void deleteAdmission(admission)}
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
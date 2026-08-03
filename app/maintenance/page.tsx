"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type GenericRow = Record<string, unknown>;

type Priority = "Low" | "Medium" | "High" | "Emergency";
type RequestStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";

type MaintenanceRequest = {
  id: string;
  request_number: string;
  resident_id: string | null;
  room_id: string | null;
  title: string;
  category: string;
  description: string | null;
  priority: Priority;
  status: RequestStatus;
  assigned_to: string | null;
  estimated_cost: number;
  actual_cost: number;
  photo_url: string | null;
  completion_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MaintenanceForm = {
  resident_id: string;
  room_id: string;
  title: string;
  category: string;
  description: string;
  priority: Priority;
  status: RequestStatus;
  assigned_to: string;
  estimated_cost: string;
  actual_cost: string;
  completion_date: string;
  notes: string;
};

const emptyForm: MaintenanceForm = {
  resident_id: "",
  room_id: "",
  title: "",
  category: "Other",
  description: "",
  priority: "Medium",
  status: "Pending",
  assigned_to: "",
  estimated_cost: "0",
  actual_cost: "0",
  completion_date: "",
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";

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
  return (
    firstText(row, ["full_name", "resident_name", "name"]) ||
    "No resident"
  );
}

function roomNumber(row: GenericRow | undefined) {
  return (
    firstText(row, ["room_number", "room_no", "number", "name"]) ||
    "No room"
  );
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function priorityClass(priority: Priority) {
  if (priority === "Emergency") return "bg-red-100 text-red-700";
  if (priority === "High") return "bg-orange-100 text-orange-700";
  if (priority === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function statusClass(status: RequestStatus) {
  if (status === "Completed") return "bg-emerald-100 text-emerald-700";
  if (status === "In Progress") return "bg-blue-100 text-blue-700";
  if (status === "Cancelled") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function requestNumber() {
  return `MNT-${new Date().getFullYear()}-${Date.now()
    .toString()
    .slice(-7)}`;
}

function safeFileName(file: File) {
  return file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [residents, setResidents] = useState<GenericRow[]>([]);
  const [rooms, setRooms] = useState<GenericRow[]>([]);
  const [form, setForm] = useState<MaintenanceForm>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [requestsResult, residentsResult, roomsResult] = await Promise.all([
      supabase
        .from("maintenance_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("residents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const firstError =
      requestsResult.error ||
      residentsResult.error ||
      roomsResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setRequests(
        (requestsResult.data ?? []) as MaintenanceRequest[]
      );
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setRooms((roomsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const resident = residents.find(
        (item) => text(item.id) === request.resident_id
      );

      const room = rooms.find(
        (item) => text(item.id) === request.room_id
      );

      const searchable = [
        request.request_number,
        request.title,
        request.category,
        request.assigned_to ?? "",
        residentName(resident),
        roomNumber(room),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesPriority =
        priorityFilter === "All" ||
        request.priority === priorityFilter;

      const matchesStatus =
        statusFilter === "All" ||
        request.status === statusFilter;

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [
    priorityFilter,
    requests,
    residents,
    rooms,
    search,
    statusFilter,
  ]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((item) => item.status === "Pending")
        .length,
      inProgress: requests.filter(
        (item) => item.status === "In Progress"
      ).length,
      completed: requests.filter(
        (item) => item.status === "Completed"
      ).length,
      highPriority: requests.filter(
        (item) =>
          item.priority === "High" ||
          item.priority === "Emergency"
      ).length,
    }),
    [requests]
  );

  function updateField<K extends keyof MaintenanceForm>(
    key: K,
    value: MaintenanceForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setPhotoFile(null);
    setExistingPhoto(null);
    setEditingId(null);

    const input = document.getElementById(
      "maintenance-photo-input"
    ) as HTMLInputElement | null;

    if (input) input.value = "";
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEditForm(request: MaintenanceRequest) {
    setEditingId(request.id);
    setForm({
      resident_id: request.resident_id ?? "",
      room_id: request.room_id ?? "",
      title: request.title,
      category: request.category,
      description: request.description ?? "",
      priority: request.priority,
      status: request.status,
      assigned_to: request.assigned_to ?? "",
      estimated_cost: String(request.estimated_cost ?? 0),
      actual_cost: String(request.actual_cost ?? 0),
      completion_date: request.completion_date ?? "",
      notes: request.notes ?? "",
    });
    setExistingPhoto(request.photo_url);
    setPhotoFile(null);
    setShowForm(true);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadPhoto(file: File) {
    const path = `requests/${Date.now()}-${safeFileName(file)}`;

    const { error: uploadError } = await supabase.storage
      .from("maintenance-photos")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("maintenance-photos")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function saveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    if (!form.title.trim()) {
      setError("Request title is required.");
      setSaving(false);
      return;
    }

    try {
      let photoUrl = existingPhoto;

      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      const finalCompletionDate =
        form.status === "Completed"
          ? form.completion_date ||
            new Date().toISOString().slice(0, 10)
          : form.completion_date || null;

      const payload = {
        resident_id: form.resident_id || null,
        room_id: form.room_id || null,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        assigned_to: form.assigned_to.trim() || null,
        estimated_cost: Number(form.estimated_cost) || 0,
        actual_cost: Number(form.actual_cost) || 0,
        photo_url: photoUrl,
        completion_date: finalCompletionDate,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const result = editingId
        ? await supabase
            .from("maintenance_requests")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("maintenance_requests").insert({
            ...payload,
            request_number: requestNumber(),
          });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setMessage(
        editingId
          ? "Maintenance request updated successfully."
          : "Maintenance request added successfully."
      );

      resetForm();
      setShowForm(false);
      await refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Maintenance request could not be saved."
      );
    }

    setSaving(false);
  }

  async function deleteRequest(request: MaintenanceRequest) {
    if (
      !window.confirm(
        `Delete maintenance request ${request.request_number}?`
      )
    ) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("maintenance_requests")
      .delete()
      .eq("id", request.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Maintenance request deleted successfully.");
      await refresh();
    }
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    setPhotoFile(event.target.files?.[0] ?? null);
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
              Maintenance
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage maintenance requests, staff assignments, costs and completion.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Add Request
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
                  {editingId
                    ? "Edit Maintenance Request"
                    : "Add Maintenance Request"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Record the issue, assignment, photo and cost.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveRequest} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Resident">
                  <select
                    value={form.resident_id}
                    onChange={(event) =>
                      updateField("resident_id", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">No resident selected</option>

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

                <Field label="Room">
                  <select
                    value={form.room_id}
                    onChange={(event) =>
                      updateField("room_id", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">No room selected</option>

                    {rooms.map((room) => (
                      <option key={text(room.id)} value={text(room.id)}>
                        {roomNumber(room)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Request Title *">
                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Fan not working"
                  />
                </Field>

                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(event) =>
                      updateField("category", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Appliance">Appliance</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Internet">Internet</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>

                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      updateField(
                        "priority",
                        event.target.value as Priority
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value as RequestStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </Field>

                <Field label="Assigned Staff / Technician">
                  <input
                    value={form.assigned_to}
                    onChange={(event) =>
                      updateField("assigned_to", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Technician name"
                  />
                </Field>

                <Field label="Estimated Cost">
                  <input
                    type="number"
                    min="0"
                    value={form.estimated_cost}
                    onChange={(event) =>
                      updateField(
                        "estimated_cost",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Actual Cost">
                  <input
                    type="number"
                    min="0"
                    value={form.actual_cost}
                    onChange={(event) =>
                      updateField("actual_cost", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Completion Date">
                  <input
                    type="date"
                    value={form.completion_date}
                    onChange={(event) =>
                      updateField(
                        "completion_date",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Issue Photo">
                  <input
                    id="maintenance-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhoto}
                    className={inputClass}
                  />

                  {existingPhoto && !photoFile && (
                    <a
                      href={existingPhoto}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-indigo-700"
                    >
                      Open current photo
                    </a>
                  )}
                </Field>

                <Field label="Description" wide>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    className={`${inputClass} min-h-28`}
                    placeholder="Describe the maintenance issue."
                  />
                </Field>

                <Field label="Admin Notes" wide>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      updateField("notes", event.target.value)
                    }
                    className={`${inputClass} min-h-24`}
                    placeholder="Work details, parts used or completion notes."
                  />
                </Field>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
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
                    ? "Update Request"
                    : "Save Request"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Requests" value={String(summary.total)} />
          <StatCard label="Pending" value={String(summary.pending)} />
          <StatCard
            label="In Progress"
            value={String(summary.inProgress)}
          />
          <StatCard
            label="Completed"
            value={String(summary.completed)}
          />
          <StatCard
            label="High Priority"
            value={String(summary.highPriority)}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_200px_200px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search request, resident, room, category or technician"
            />

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="All">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Emergency">Emergency</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
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
                    "Request",
                    "Resident / Room",
                    "Issue",
                    "Assignment",
                    "Cost",
                    "Photo",
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
                      Loading maintenance requests...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No maintenance requests found.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request) => {
                    const resident = residents.find(
                      (item) =>
                        text(item.id) === request.resident_id
                    );

                    const room = rooms.find(
                      (item) => text(item.id) === request.room_id
                    );

                    return (
                      <tr
                        key={request.id}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {request.request_number}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {request.created_at.slice(0, 10)}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <p>{residentName(resident)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Room: {roomNumber(room)}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {request.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {request.category}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${priorityClass(
                              request.priority
                            )}`}
                          >
                            {request.priority}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {request.assigned_to || "Not assigned"}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-600">
                          <p>
                            Estimated: {money(request.estimated_cost)}
                          </p>
                          <p className="mt-1">
                            Actual: {money(request.actual_cost)}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {request.photo_url ? (
                            <a
                              href={request.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                            >
                              Open Photo
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">
                              No photo
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditForm(request)}
                              className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void deleteRequest(request)
                              }
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
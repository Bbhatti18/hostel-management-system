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

type Inspection = {
  id: string;
  resident_id: string | null;
  room_id: string | null;
  inspection_date: string | null;
  before_photo: string | null;
  after_photo: string | null;
  damage_notes: string | null;
  created_at: string;
};

type InspectionForm = {
  resident_id: string;
  room_id: string;
  inspection_date: string;
  damage_notes: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyForm: InspectionForm = {
  resident_id: "",
  room_id: "",
  inspection_date: today,
  damage_notes: "",
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
    "Unknown resident"
  );
}

function roomNumber(row: GenericRow | undefined) {
  return (
    firstText(row, ["room_number", "room_no", "number", "name"]) ||
    "Unknown room"
  );
}

function makeSafeFileName(file: File) {
  return file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function InspectionPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [residents, setResidents] = useState<GenericRow[]>([]);
  const [rooms, setRooms] = useState<GenericRow[]>([]);
  const [admissions, setAdmissions] = useState<GenericRow[]>([]);
  const [form, setForm] = useState<InspectionForm>(emptyForm);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingBeforePhoto, setExistingBeforePhoto] = useState<string | null>(
    null
  );
  const [existingAfterPhoto, setExistingAfterPhoto] = useState<string | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      inspectionResult,
      residentsResult,
      roomsResult,
      admissionsResult,
    ] = await Promise.all([
      supabase
        .from("inspections")
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
      supabase
        .from("admissions")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const firstError =
      inspectionResult.error ||
      residentsResult.error ||
      roomsResult.error ||
      admissionsResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setInspections((inspectionResult.data ?? []) as Inspection[]);
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setRooms((roomsResult.data ?? []) as GenericRow[]);
      setAdmissions((admissionsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const availableRooms = useMemo(() => {
    if (!form.resident_id) return [];

    const activeAdmission = admissions.find((admission) => {
      const residentId = firstText(admission, ["resident_id"]);
      const status = firstText(admission, ["status", "admission_status"])
        .toLowerCase();

      return (
        residentId === form.resident_id &&
        (!status || status === "active")
      );
    });

    const assignedRoomId = firstText(activeAdmission, ["room_id"]);

    if (!assignedRoomId) return [];

    return rooms.filter((room) => text(room.id) === assignedRoomId);
  }, [admissions, form.resident_id, rooms]);

  const filteredInspections = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inspections.filter((inspection) => {
      const resident = residents.find(
        (item) => text(item.id) === inspection.resident_id
      );

      const room = rooms.find(
        (item) => text(item.id) === inspection.room_id
      );

      const searchable = [
        residentName(resident),
        roomNumber(room),
        inspection.inspection_date ?? "",
        inspection.damage_notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return !query || searchable.includes(query);
    });
  }, [inspections, residents, rooms, search]);

  const summary = useMemo(
    () => ({
      total: inspections.length,
      withBefore: inspections.filter((item) => item.before_photo).length,
      withAfter: inspections.filter((item) => item.after_photo).length,
      damageFound: inspections.filter(
        (item) => (item.damage_notes ?? "").trim() !== ""
      ).length,
    }),
    [inspections]
  );

  function updateField<K extends keyof InspectionForm>(
    key: K,
    value: InspectionForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleResidentChange(residentId: string) {
    const activeAdmission = admissions.find((admission) => {
      const admissionResidentId = firstText(admission, ["resident_id"]);
      const status = firstText(admission, ["status", "admission_status"])
        .toLowerCase();

      return (
        admissionResidentId === residentId &&
        (!status || status === "active")
      );
    });

    setForm((current) => ({
      ...current,
      resident_id: residentId,
      room_id: firstText(activeAdmission, ["room_id"]),
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setBeforeFile(null);
    setAfterFile(null);
    setEditingId(null);
    setExistingBeforePhoto(null);
    setExistingAfterPhoto(null);

    const beforeInput = document.getElementById(
      "before-photo-input"
    ) as HTMLInputElement | null;

    const afterInput = document.getElementById(
      "after-photo-input"
    ) as HTMLInputElement | null;

    if (beforeInput) beforeInput.value = "";
    if (afterInput) afterInput.value = "";
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEditForm(inspection: Inspection) {
    setEditingId(inspection.id);
    setForm({
      resident_id: inspection.resident_id ?? "",
      room_id: inspection.room_id ?? "",
      inspection_date: inspection.inspection_date ?? today,
      damage_notes: inspection.damage_notes ?? "",
    });
    setExistingBeforePhoto(inspection.before_photo);
    setExistingAfterPhoto(inspection.after_photo);
    setBeforeFile(null);
    setAfterFile(null);
    setShowForm(true);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadImage(
    file: File,
    folder: "before" | "after"
  ): Promise<string> {
    const filePath = `${folder}/${Date.now()}-${makeSafeFileName(file)}`;

    const { error: uploadError } = await supabase.storage
      .from("room-inspection-photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("room-inspection-photos")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    if (!form.resident_id) {
      setError("Please select a resident.");
      setSaving(false);
      return;
    }

    if (!form.room_id) {
      setError("No active room allocation found for this resident.");
      setSaving(false);
      return;
    }

    if (!form.inspection_date) {
      setError("Inspection date is required.");
      setSaving(false);
      return;
    }

    try {
      let beforePhoto = existingBeforePhoto;
      let afterPhoto = existingAfterPhoto;

      if (beforeFile) {
        beforePhoto = await uploadImage(beforeFile, "before");
      }

      if (afterFile) {
        afterPhoto = await uploadImage(afterFile, "after");
      }

      const payload = {
        resident_id: form.resident_id,
        room_id: form.room_id,
        inspection_date: form.inspection_date,
        before_photo: beforePhoto,
        after_photo: afterPhoto,
        damage_notes: form.damage_notes.trim() || null,
      };

      const result = editingId
        ? await supabase
            .from("inspections")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("inspections").insert(payload);

      if (result.error) {
        throw new Error(result.error.message);
      }

      setMessage(
        editingId
          ? "Inspection updated successfully."
          : "Inspection saved successfully."
      );

      resetForm();
      setShowForm(false);
      await refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Inspection could not be saved."
      );
    }

    setSaving(false);
  }

  async function deleteInspection(inspection: Inspection) {
    const confirmed = window.confirm(
      "Delete this inspection record?"
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("inspections")
      .delete()
      .eq("id", inspection.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Inspection deleted successfully.");
      await refresh();
    }
  }

  function handleBeforeFile(event: ChangeEvent<HTMLInputElement>) {
    setBeforeFile(event.target.files?.[0] ?? null);
  }

  function handleAfterFile(event: ChangeEvent<HTMLInputElement>) {
    setAfterFile(event.target.files?.[0] ?? null);
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
              Inspections
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Record room condition, before photos, after photos and damage notes.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Add Inspection
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
                  {editingId ? "Edit Inspection" : "Add Inspection"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Resident select karte hi active admission ka room automatically load hoga.
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

            <form onSubmit={saveInspection} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Resident *">
                  <select
                    required
                    value={form.resident_id}
                    onChange={(event) =>
                      handleResidentChange(event.target.value)
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

                <Field label="Allocated Room *">
                  <select
                    required
                    value={form.room_id}
                    onChange={(event) =>
                      updateField("room_id", event.target.value)
                    }
                    className={inputClass}
                    disabled={!form.resident_id || availableRooms.length === 0}
                  >
                    <option value="">
                      {!form.resident_id
                        ? "Select resident first"
                        : availableRooms.length === 0
                        ? "No active room allocation"
                        : "Select room"}
                    </option>

                    {availableRooms.map((room) => (
                      <option key={text(room.id)} value={text(room.id)}>
                        {roomNumber(room)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Inspection Date *">
                  <input
                    required
                    type="date"
                    value={form.inspection_date}
                    onChange={(event) =>
                      updateField(
                        "inspection_date",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Before Photo">
                  <input
                    id="before-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleBeforeFile}
                    className={inputClass}
                  />

                  {existingBeforePhoto && !beforeFile && (
                    <a
                      href={existingBeforePhoto}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-indigo-700"
                    >
                      Open current before photo
                    </a>
                  )}
                </Field>

                <Field label="After Photo">
                  <input
                    id="after-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleAfterFile}
                    className={inputClass}
                  />

                  {existingAfterPhoto && !afterFile && (
                    <a
                      href={existingAfterPhoto}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-indigo-700"
                    >
                      Open current after photo
                    </a>
                  )}
                </Field>

                <Field label="Damage Notes" wide>
                  <textarea
                    value={form.damage_notes}
                    onChange={(event) =>
                      updateField("damage_notes", event.target.value)
                    }
                    className={`${inputClass} min-h-32`}
                    placeholder="Describe damage, condition and recommendations."
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
                    ? "Update Inspection"
                    : "Save Inspection"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Inspections"
            value={String(summary.total)}
          />
          <StatCard
            label="Before Photos"
            value={String(summary.withBefore)}
          />
          <StatCard
            label="After Photos"
            value={String(summary.withAfter)}
          />
          <StatCard
            label="Damage Records"
            value={String(summary.damageFound)}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search resident, room, date or damage notes"
            />

            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-5 p-5">
            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Loading inspections...
              </p>
            ) : filteredInspections.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No inspections found.
              </p>
            ) : (
              filteredInspections.map((inspection) => {
                const resident = residents.find(
                  (item) => text(item.id) === inspection.resident_id
                );

                const room = rooms.find(
                  (item) => text(item.id) === inspection.room_id
                );

                return (
                  <article
                    key={inspection.id}
                    className="rounded-3xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                          {inspection.inspection_date || "No date"}
                        </p>

                        <h2 className="mt-2 text-2xl font-bold text-slate-900">
                          Room {roomNumber(room)}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Resident: {residentName(resident)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(inspection)}
                          className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteInspection(inspection)
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <PhotoCard
                        title="Before Photo"
                        url={inspection.before_photo}
                      />

                      <PhotoCard
                        title="After Photo"
                        url={inspection.after_photo}
                      />
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Damage Notes
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {inspection.damage_notes || "No damage notes recorded."}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
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

function PhotoCard({
  title,
  url,
}: {
  title: string;
  url: string | null;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>

      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={title}
            className="mt-3 h-56 w-full rounded-xl object-cover"
          />
        </a>
      ) : (
        <div className="mt-3 flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
          No photo uploaded
        </div>
      )}
    </article>
  );
}
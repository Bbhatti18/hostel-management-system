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

type RoomStatus = "Available" | "Occupied" | "Maintenance" | "Inactive";

type Room = {
  id: string;
  room_number: string;
  building_name: string | null;
  floor: string | null;
  room_type: string | null;
  capacity: number;
  occupied_beds: number;
  status: RoomStatus;
  monthly_rent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Bed = {
  id: string;
  room_id: string;
  bed_number: string;
  status: "Vacant" | "Occupied" | "Maintenance" | "Inactive";
  mattress_condition: string | null;
  mattress_cover: string | null;
  created_at: string;
};

type RoomForm = {
  room_number: string;
  building_name: string;
  floor: string;
  room_type: string;
  capacity: string;
  status: RoomStatus;
  monthly_rent: string;
  notes: string;
};

type BedForm = {
  room_id: string;
  bed_number: string;
  status: Bed["status"];
  mattress_condition: string;
  mattress_cover: string;
};

const emptyRoomForm: RoomForm = {
  room_number: "",
  building_name: "",
  floor: "",
  room_type: "Shared",
  capacity: "1",
  status: "Available",
  monthly_rent: "",
  notes: "",
};

const emptyBedForm: BedForm = {
  room_id: "",
  bed_number: "",
  status: "Vacant",
  mattress_condition: "Good",
  mattress_cover: "Available",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function roomStatusClass(status: RoomStatus) {
  if (status === "Available") return "bg-emerald-100 text-emerald-700";
  if (status === "Occupied") return "bg-blue-100 text-blue-700";
  if (status === "Maintenance") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function bedStatusClass(status: Bed["status"]) {
  if (status === "Vacant") return "bg-emerald-100 text-emerald-700";
  if (status === "Occupied") return "bg-blue-100 text-blue-700";
  if (status === "Maintenance") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function money(value: number | null) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm);
  const [bedForm, setBedForm] = useState<BedForm>(emptyBedForm);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showBedForm, setShowBedForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);
  const [savingBed, setSavingBed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [{ data: roomsData, error: roomsError }, { data: bedsData, error: bedsError }] =
      await Promise.all([
        supabase.from("rooms").select("*").order("room_number"),
        supabase.from("beds").select("*").order("bed_number"),
      ]);

    if (roomsError) {
      setError(roomsError.message);
      setRooms([]);
    } else {
      setRooms((roomsData ?? []) as Room[]);
    }

    if (bedsError) {
      setError((current) =>
        current ? `${current} | ${bedsError.message}` : bedsError.message
      );
      setBeds([]);
    } else {
      setBeds((bedsData ?? []) as Bed[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesSearch =
        !query ||
        room.room_number.toLowerCase().includes(query) ||
        (room.building_name ?? "").toLowerCase().includes(query) ||
        (room.floor ?? "").toLowerCase().includes(query) ||
        (room.room_type ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || room.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rooms, search, statusFilter]);

  const summary = useMemo(() => {
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((bed) => bed.status === "Occupied").length;
    const vacantBeds = beds.filter((bed) => bed.status === "Vacant").length;

    return {
      totalRooms: rooms.length,
      availableRooms: rooms.filter((room) => room.status === "Available").length,
      totalBeds,
      occupiedBeds,
      vacantBeds,
    };
  }, [rooms, beds]);

  function updateRoomField<K extends keyof RoomForm>(
    key: K,
    value: RoomForm[K]
  ) {
    setRoomForm((current) => ({ ...current, [key]: value }));
  }

  function updateBedField<K extends keyof BedForm>(
    key: K,
    value: BedForm[K]
  ) {
    setBedForm((current) => ({ ...current, [key]: value }));
  }

  function openAddRoom() {
    setEditingRoomId(null);
    setRoomForm(emptyRoomForm);
    setShowRoomForm(true);
    setShowBedForm(false);
    setMessage("");
    setError("");
  }

  function openEditRoom(room: Room) {
    setEditingRoomId(room.id);
    setRoomForm({
      room_number: room.room_number,
      building_name: room.building_name ?? "",
      floor: room.floor ?? "",
      room_type: room.room_type ?? "Shared",
      capacity: String(room.capacity ?? 1),
      status: room.status,
      monthly_rent: room.monthly_rent ? String(room.monthly_rent) : "",
      notes: room.notes ?? "",
    });
    setShowRoomForm(true);
    setShowBedForm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAddBed(roomId = "") {
    setBedForm({
      ...emptyBedForm,
      room_id: roomId || rooms[0]?.id || "",
    });
    setShowBedForm(true);
    setShowRoomForm(false);
    setMessage("");
    setError("");
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingRoom(true);
    setMessage("");
    setError("");

    if (!roomForm.room_number.trim()) {
      setError("Room number is required.");
      setSavingRoom(false);
      return;
    }

    const payload = {
      room_number: roomForm.room_number.trim(),
      building_name: roomForm.building_name.trim() || null,
      floor: roomForm.floor.trim() || null,
      room_type: roomForm.room_type.trim() || null,
      capacity: Math.max(1, Number(roomForm.capacity) || 1),
      status: roomForm.status,
      monthly_rent: roomForm.monthly_rent
        ? Number(roomForm.monthly_rent)
        : null,
      notes: roomForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingRoomId
      ? await supabase.from("rooms").update(payload).eq("id", editingRoomId)
      : await supabase.from("rooms").insert(payload);

    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage(
        editingRoomId ? "Room updated successfully." : "Room added successfully."
      );
      setShowRoomForm(false);
      setRoomForm(emptyRoomForm);
      setEditingRoomId(null);
      await refresh();
    }

    setSavingRoom(false);
  }

  async function saveBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBed(true);
    setMessage("");
    setError("");

    if (!bedForm.room_id || !bedForm.bed_number.trim()) {
      setError("Room and bed number are required.");
      setSavingBed(false);
      return;
    }

    const { error: bedError } = await supabase.from("beds").insert({
      room_id: bedForm.room_id,
      bed_number: bedForm.bed_number.trim(),
      status: bedForm.status,
      mattress_condition: bedForm.mattress_condition.trim() || null,
      mattress_cover: bedForm.mattress_cover.trim() || null,
    });

    if (bedError) {
      setError(bedError.message);
    } else {
      setMessage("Bed added successfully.");
      setShowBedForm(false);
      setBedForm(emptyBedForm);
      await refresh();
    }

    setSavingBed(false);
  }

  async function deleteRoom(room: Room) {
    if (!window.confirm(`Delete room ${room.room_number}?`)) return;

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", room.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Room deleted successfully.");
      await refresh();
    }
  }

  async function deleteBed(bed: Bed) {
    if (!window.confirm(`Delete bed ${bed.bed_number}?`)) return;

    const { error: deleteError } = await supabase
      .from("beds")
      .delete()
      .eq("id", bed.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Bed deleted successfully.");
      await refresh();
    }
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
              Rooms & Beds
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage rooms, beds, capacity, rent and occupancy status.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openAddRoom}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              + Add Room
            </button>
            <button
              type="button"
              onClick={() => openAddBed()}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              + Add Bed
            </button>
          </div>
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

        {showRoomForm && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editingRoomId ? "Edit Room" : "Add Room"}
              </h2>
              <button
                type="button"
                onClick={() => setShowRoomForm(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveRoom} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Room Number *">
                  <input
                    required
                    value={roomForm.room_number}
                    onChange={(event) =>
                      updateRoomField("room_number", event.target.value)
                    }
                    className={inputClass}
                    placeholder="101"
                  />
                </Field>

                <Field label="Building">
                  <input
                    value={roomForm.building_name}
                    onChange={(event) =>
                      updateRoomField("building_name", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Main Building"
                  />
                </Field>

                <Field label="Floor">
                  <input
                    value={roomForm.floor}
                    onChange={(event) =>
                      updateRoomField("floor", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Ground Floor"
                  />
                </Field>

                <Field label="Room Type">
                  <select
                    value={roomForm.room_type}
                    onChange={(event) =>
                      updateRoomField("room_type", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="Single">Single</option>
                    <option value="Shared">Shared</option>
                    <option value="Dormitory">Dormitory</option>
                    <option value="Private">Private</option>
                  </select>
                </Field>

                <Field label="Capacity">
                  <input
                    type="number"
                    min="1"
                    value={roomForm.capacity}
                    onChange={(event) =>
                      updateRoomField("capacity", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Status">
                  <select
                    value={roomForm.status}
                    onChange={(event) =>
                      updateRoomField(
                        "status",
                        event.target.value as RoomStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Available">Available</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </Field>

                <Field label="Monthly Rent">
                  <input
                    type="number"
                    min="0"
                    value={roomForm.monthly_rent}
                    onChange={(event) =>
                      updateRoomField("monthly_rent", event.target.value)
                    }
                    className={inputClass}
                    placeholder="15000"
                  />
                </Field>

                <Field label="Notes" wide>
                  <textarea
                    value={roomForm.notes}
                    onChange={(event) =>
                      updateRoomField("notes", event.target.value)
                    }
                    className={`${inputClass} min-h-24`}
                    placeholder="Room notes"
                  />
                </Field>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRoomForm(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRoom}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingRoom
                    ? "Saving..."
                    : editingRoomId
                    ? "Update Room"
                    : "Save Room"}
                </button>
              </div>
            </form>
          </section>
        )}

        {showBedForm && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">
                Add Bed
              </h2>
              <button
                type="button"
                onClick={() => setShowBedForm(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveBed} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Room *">
                  <select
                    required
                    value={bedForm.room_id}
                    onChange={(event) =>
                      updateBedField("room_id", event.target.value)
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

                <Field label="Bed Number *">
                  <input
                    required
                    value={bedForm.bed_number}
                    onChange={(event) =>
                      updateBedField("bed_number", event.target.value)
                    }
                    className={inputClass}
                    placeholder="B1"
                  />
                </Field>

                <Field label="Status">
                  <select
                    value={bedForm.status}
                    onChange={(event) =>
                      updateBedField(
                        "status",
                        event.target.value as Bed["status"]
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Vacant">Vacant</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </Field>

                <Field label="Mattress Condition">
                  <select
                    value={bedForm.mattress_condition}
                    onChange={(event) =>
                      updateBedField(
                        "mattress_condition",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Not Available">Not Available</option>
                  </select>
                </Field>

                <Field label="Mattress Cover">
                  <select
                    value={bedForm.mattress_cover}
                    onChange={(event) =>
                      updateBedField("mattress_cover", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="Available">Available</option>
                    <option value="Not Available">Not Available</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </Field>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBedForm(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBed}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingBed ? "Saving..." : "Save Bed"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Rooms" value={String(summary.totalRooms)} />
          <StatCard
            label="Available Rooms"
            value={String(summary.availableRooms)}
          />
          <StatCard label="Total Beds" value={String(summary.totalBeds)} />
          <StatCard
            label="Occupied Beds"
            value={String(summary.occupiedBeds)}
          />
          <StatCard label="Vacant Beds" value={String(summary.vacantBeds)} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search room, building, floor or type"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>

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
                Loading rooms...
              </p>
            ) : filteredRooms.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No rooms found.
              </p>
            ) : (
              filteredRooms.map((room) => {
                const roomBeds = beds.filter((bed) => bed.room_id === room.id);
                const occupied = roomBeds.filter(
                  (bed) => bed.status === "Occupied"
                ).length;

                return (
                  <article
                    key={room.id}
                    className="rounded-3xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-2xl font-bold text-slate-900">
                            Room {room.room_number}
                          </h2>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${roomStatusClass(
                              room.status
                            )}`}
                          >
                            {room.status}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          {room.building_name || "No building"} Â·{" "}
                          {room.floor || "No floor"} Â·{" "}
                          {room.room_type || "No type"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openAddBed(room.id)}
                          className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"
                        >
                          Add Bed
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditRoom(room)}
                          className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteRoom(room)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoCard label="Capacity" value={String(room.capacity)} />
                      <InfoCard
                        label="Beds Added"
                        value={String(roomBeds.length)}
                      />
                      <InfoCard
                        label="Occupied Beds"
                        value={String(occupied)}
                      />
                      <InfoCard
                        label="Monthly Rent"
                        value={money(room.monthly_rent)}
                      />
                    </div>

                    <div className="mt-5">
                      <h3 className="text-sm font-bold text-slate-900">
                        Beds
                      </h3>

                      {roomBeds.length === 0 ? (
                        <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                          No beds added yet.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {roomBeds.map((bed) => (
                            <div
                              key={bed.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-slate-900">
                                  Bed {bed.bed_number}
                                </p>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-bold ${bedStatusClass(
                                    bed.status
                                  )}`}
                                >
                                  {bed.status}
                                </span>
                              </div>

                              <p className="mt-3 text-xs text-slate-600">
                                Mattress:{" "}
                                {bed.mattress_condition || "Not recorded"}
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                Cover: {bed.mattress_cover || "Not recorded"}
                              </p>

                              <button
                                type="button"
                                onClick={() => void deleteBed(bed)}
                                className="mt-3 text-xs font-semibold text-red-700"
                              >
                                Delete Bed
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
    </article>
  );
}
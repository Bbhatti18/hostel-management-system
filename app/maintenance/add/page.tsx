"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Resident = {
  id: number;
  name: string;
  room_id: number | null;
  room_number?: string;
};

export default function AddMaintenancePage() {
  const router = useRouter();

  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentId, setResidentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");

  const [complaintType, setComplaintType] = useState("");
  const [priority, setPriority] = useState("Low");
  const [status, setStatus] = useState("Pending");
  const [assignedTo, setAssignedTo] = useState("");
  const [description, setDescription] = useState("");
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [completionDate, setCompletionDate] = useState("");
  const [maintenanceCost, setMaintenanceCost] = useState("");

  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchResidents();
  }, []);

  async function fetchResidents() {
  const { data, error } = await supabase
    .from("admissions")
    .select(`
      resident_id,
      room_id,
      bed_id,
      created_at,
      residents (
        id,
        full_name
      ),
      rooms (
        id,
        room_number
      ),
      beds!inner (
        id,
        status
      )
    `)
    .eq("beds.status", "Occupied")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Supabase Error:", error);
    setMessage(error.message || "Failed to load residents.");
    return;
  }

  const uniqueResidents = new Map();

  data?.forEach((item: any) => {
    const resident = item.residents;
    const room = item.rooms;

    if (resident?.id && !uniqueResidents.has(resident.id)) {
      uniqueResidents.set(resident.id, {
        id: resident.id,
        name: resident.full_name,
        room_id: room?.id || item.room_id,
        room_number: room?.room_number || "",
      });
    }
  });

  setResidents(Array.from(uniqueResidents.values()));
}

  

  function handleResidentChange(value: string) {
    setResidentId(value);

    const selectedResident = residents.find(
      (resident) => resident.id === Number(value)
    );

    if (selectedResident) {
      setRoomId(String(selectedResident.room_id || ""));
      setRoomNumber(selectedResident.room_number || "");
    } else {
      setRoomId("");
      setRoomNumber("");
    }
  }async function uploadPhotos(
  files: File[],
  maintenanceId: number,
  photoType: "Before" | "After"
) {
  for (const file of files) {
    const filePath = `${maintenanceId}/${photoType.toLowerCase()}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("maintenance-photos")
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("maintenance-photos")
      .getPublicUrl(filePath);

    const { error: photoError } = await supabase
      .from("maintenance_photos")
      .insert({
        maintenance_id: maintenanceId,
        photo_type: photoType,
        photo_url: publicUrlData.publicUrl,
        file_path: filePath,
      });

    if (photoError) {
      throw photoError;
    }
  }
}

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!residentId || !roomId || !complaintType || !priority || !requestDate) {
      setMessage("Please required fields complete karein.");
      return;
    }

    if (status === "Completed" && !completionDate) {
      setMessage("Completed status ke liye completion date zaroori hai.");
      return;
    }

    setLoading(true);

    const { data: savedRequest, error } = await supabase
  .from("maintenance_requests")
  .insert({
    resident_id: Number(residentId),
    room_id: Number(roomId),
    complaint_type: complaintType,
    priority,
    status,
    assigned_to: assignedTo || null,
    description: description || null,
    request_date: requestDate,
    completion_date: completionDate || null,
    maintenance_cost: maintenanceCost
      ? Number(maintenanceCost)
      : 0,
  })
  .select("id")
  .single();

    if (error || !savedRequest) {
  console.error(error);
  setLoading(false);
  setMessage("Failed to save maintenance request.");
  return;
}

try {
  await uploadPhotos(beforePhotos, savedRequest.id, "Before");
  await uploadPhotos(afterPhotos, savedRequest.id, "After");
} catch (photoError) {
  console.error("Photo upload error:", photoError);
  setLoading(false);
  setMessage("Request saved, but photos could not be uploaded.");
  return;
}

setLoading(false);

    router.push("/maintenance");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Add Maintenance Request
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Resident ki maintenance complaint record karein.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Resident *
              </label>

              <select
                value={residentId}
                onChange={(e) => handleResidentChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
                required
              >
                <option value="">Select Resident</option>

                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Room *
              </label>

              <input
                type="text"
                value={roomNumber}
                readOnly
                placeholder="Resident select karein"
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Complaint Type *
              </label>

              <select
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
                required
              >
                <option value="">Select Complaint Type</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Furniture">Furniture</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Internet">Internet</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Priority *
              </label>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
                required
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status *
              </label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
                required
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Assigned To
              </label>

              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Staff name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Request Date *
              </label>

              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Completion Date
              </label>

              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Maintenance Cost
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={maintenanceCost}
                onChange={(e) => setMaintenanceCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Complaint ki details likhein"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500"
            />
          </div>
<div>
  <label className="mb-2 block text-sm font-medium text-gray-700">
    Before Repair Photos
  </label>

  <input
    type="file"
    multiple
    accept="image/*"
    onChange={(e) => {
      if (e.target.files) {
        setBeforePhotos(Array.from(e.target.files));
      }
    }}
    className="w-full rounded-lg border border-gray-300 p-2"
  />
</div>
<div>
  <label className="mb-2 block text-sm font-medium text-gray-700">
    After Repair Photos
  </label>

  <input
    type="file"
    multiple
    accept="image/*"
    onChange={(e) => {
      if (e.target.files) {
        setAfterPhotos(Array.from(e.target.files));
      }
    }}
    className="w-full rounded-lg border border-gray-300 p-2"
  />
</div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Request"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/maintenance")}
              className="rounded-lg bg-gray-200 px-5 py-2 font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
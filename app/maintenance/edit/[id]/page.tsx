"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MaintenancePhoto = {
  id: number;
  photo_type: "Before" | "After";
  photo_url: string;
  file_path: string;
};

export default function EditMaintenancePage() {
  const params = useParams();
  const router = useRouter();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [residentName, setResidentName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");

  const [complaintType, setComplaintType] = useState("");
  const [priority, setPriority] = useState("Low");
  const [status, setStatus] = useState("Pending");
  const [assignedTo, setAssignedTo] = useState("");
  const [description, setDescription] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [maintenanceCost, setMaintenanceCost] = useState("");

  const [photos, setPhotos] = useState<MaintenancePhoto[]>([]);
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (id) {
      fetchMaintenance();
    }
  }, [id]);

  async function fetchMaintenance() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("maintenance_requests")
      .select(`
        *,
        residents (
          full_name
        ),
        rooms (
          room_number
        )
      `)
      .eq("id", Number(id))
      .single();

    if (error || !data) {
      console.error(error);
      setMessage("Failed to load maintenance request.");
      setLoading(false);
      return;
    }

    const requestData = data as any;

    setResidentName(requestData.residents?.full_name || "");
    setRoomNumber(requestData.rooms?.room_number || "");
    setComplaintType(requestData.complaint_type || "");
    setPriority(requestData.priority || "Low");
    setStatus(requestData.status || "Pending");
    setAssignedTo(requestData.assigned_to || "");
    setDescription(requestData.description || "");
    setRequestDate(requestData.request_date || "");
    setCompletionDate(requestData.completion_date || "");
    setMaintenanceCost(
      requestData.maintenance_cost !== null
        ? String(requestData.maintenance_cost)
        : ""
    );

    await fetchPhotos();
    setLoading(false);
  }

  async function fetchPhotos() {
    const { data, error } = await supabase
      .from("maintenance_photos")
      .select("id, photo_type, photo_url, file_path")
      .eq("maintenance_id", Number(id))
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setMessage("Request loaded, but photos could not be loaded.");
      return;
    }

    setPhotos((data || []) as MaintenancePhoto[]);
  }

  async function uploadPhotos(
    files: File[],
    photoType: "Before" | "After"
  ) {
    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, "-");

      const filePath =
        `${id}/${photoType.toLowerCase()}/` +
        `${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("maintenance-photos")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("maintenance-photos")
        .getPublicUrl(filePath);

      const { error: databaseError } = await supabase
        .from("maintenance_photos")
        .insert({
          maintenance_id: Number(id),
          photo_type: photoType,
          photo_url: publicUrlData.publicUrl,
          file_path: filePath,
        });

      if (databaseError) {
        throw databaseError;
      }
    }
  }

  async function deletePhoto(photo: MaintenancePhoto) {
    const confirmed = confirm("Delete this photo?");

    if (!confirmed) return;

    const { error: storageError } = await supabase.storage
      .from("maintenance-photos")
      .remove([photo.file_path]);

    if (storageError) {
      console.error(storageError);
      setMessage("Photo could not be deleted from storage.");
      return;
    }

    const { error: databaseError } = await supabase
      .from("maintenance_photos")
      .delete()
      .eq("id", photo.id);

    if (databaseError) {
      console.error(databaseError);
      setMessage("Photo record could not be deleted.");
      return;
    }

    setPhotos((currentPhotos) =>
      currentPhotos.filter((item) => item.id !== photo.id)
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!complaintType || !priority || !status || !requestDate) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (status === "Completed" && !completionDate) {
      setMessage(
        "Completion date is required when status is Completed."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("maintenance_requests")
      .update({
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
      .eq("id", Number(id));

    if (error) {
      console.error(error);
      setSaving(false);
      setMessage("Failed to update maintenance request.");
      return;
    }

    setSaving(false);
    router.push(`/maintenance/${id}`);
    router.refresh();
  }
  

  const existingBeforePhotos = photos.filter(
    (photo) => photo.photo_type === "Before"
  );

  const existingAfterPhotos = photos.filter(
    (photo) => photo.photo_type === "After"
  );

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">
          Loading maintenance request...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Edit Maintenance Request
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Request ID: {id}
            </p>
          </div>

          <Link
            href={`/maintenance/${id}`}
            className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700"
          >
            Back
          </Link>
        </div>

        {message && (
          <div className="mb-5 rounded-lg bg-red-50 p-3 text-red-700">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Resident
              </label>

              <input
                value={residentName}
                readOnly
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Room
              </label>

              <input
                value={roomNumber}
                readOnly
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Complaint Type *
              </label>

              <select
                value={complaintType}
                onChange={(event) =>
                  setComplaintType(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                onChange={(event) =>
                  setPriority(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                value={assignedTo}
                onChange={(event) =>
                  setAssignedTo(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Request Date *
              </label>

              <input
                type="date"
                value={requestDate}
                onChange={(event) =>
                  setRequestDate(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Completion Date
              </label>

              <input
                type="date"
                value={completionDate}
                onChange={(event) =>
                  setCompletionDate(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                onChange={(event) =>
                  setMaintenanceCost(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Description
            </label>

            <textarea
              rows={4}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <PhotoList
            title="Existing Before Repair Photos"
            photos={existingBeforePhotos}
            deletePhoto={deletePhoto}
          />

          <PhotoList
            title="Existing After Repair Photos"
            photos={existingAfterPhotos}
            deletePhoto={deletePhoto}
          />

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Upload More Before Photos
              </label>

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => {
                  if (event.target.files) {
                    setBeforePhotos(
                      Array.from(event.target.files)
                    );
                  }
                }}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Upload More After Photos
              </label>

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => {
                  if (event.target.files) {
                    setAfterPhotos(
                      Array.from(event.target.files)
                    );
                  }
                }}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update Request"}
            </button>

            <Link
             href={`/maintenance/${id}`}
              className="rounded-lg bg-gray-200 px-5 py-2 font-medium text-gray-700"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function PhotoList({
  title,
  photos,
  deletePhoto,
}: {
  title: string;
  photos: MaintenancePhoto[];
  deletePhoto: (photo: MaintenancePhoto) => void;
}) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-gray-800">
        {title}
      </h2>

      {photos.length === 0 ? (
        <p className="text-sm text-gray-500">
          No photos available.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="rounded-lg border p-2">
              <img
                src={photo.photo_url}
                alt={photo.photo_type}
                className="h-40 w-full rounded object-cover"
              />

              <button
                type="button"
                onClick={() => deletePhoto(photo)}
                className="mt-2 w-full rounded bg-red-600 px-3 py-1 text-sm text-white"
              >
                Delete Photo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
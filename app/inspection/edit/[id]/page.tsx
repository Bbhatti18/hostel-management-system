"use client";

import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";

type Room = {
  id: number | string;
  room_number: string;
};

type ExistingPhoto = {
  name: string;
  path: string;
  url: string;
};

export default function EditRoomInspectionPage() {
  const params = useParams();
  const router = useRouter();

  const inspectionId = Array.isArray(params.id)
    ? params.id[0]
    : String(params.id || "");

  const [rooms, setRooms] = useState<Room[]>([]);

  const [roomId, setRoomId] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectorName, setInspectorName] = useState("");

  const [cleanliness, setCleanliness] = useState("Clean");
  const [furnitureCondition, setFurnitureCondition] = useState("Good");
  const [electricalStatus, setElectricalStatus] = useState("Working");
  const [plumbingStatus, setPlumbingStatus] = useState("Working");
  const [wallFloorStatus, setWallFloorStatus] = useState("Good");
  const [overallStatus, setOverallStatus] = useState("OK");
  const [notes, setNotes] = useState("");

  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deletingPhotoPath, setDeletingPhotoPath] = useState<string | null>(
    null
  );

  const loadExistingPhotos = async () => {
    if (!inspectionId) {
      return;
    }

    const folderName = String(inspectionId);

    const { data: files, error: listError } = await supabase.storage
      .from("room-inspection-photos")
      .list(folderName);

    if (listError) {
      alert(listError.message);
      return;
    }

    const validFiles = (files || []).filter(
      (file) => file.name !== ".emptyFolderPlaceholder"
    );

    if (validFiles.length === 0) {
      setExistingPhotos([]);
      return;
    }

    const filePaths = validFiles.map(
      (file) => `${folderName}/${file.name}`
    );

    const { data: signedFiles, error: signedError } = await supabase.storage
      .from("room-inspection-photos")
      .createSignedUrls(filePaths, 3600);

    if (signedError) {
      alert(signedError.message);
      return;
    }

    const photos: ExistingPhoto[] = [];

    validFiles.forEach((file, index) => {
      const signedUrl = signedFiles?.[index]?.signedUrl;

      if (signedUrl) {
        photos.push({
          name: file.name,
          path: `${folderName}/${file.name}`,
          url: signedUrl,
        });
      }
    });

    setExistingPhotos(photos);
  };

  useEffect(() => {
    if (!inspectionId) {
      return;
    }

    const loadPageData = async () => {
      setLoading(true);

      try {
        const { data: roomsData, error: roomsError } = await supabase
          .from("rooms")
          .select("id, room_number")
          .order("room_number", { ascending: true });

        if (roomsError) {
          alert(roomsError.message);
          return;
        }

        setRooms(roomsData || []);

        const { data: inspectionData, error: inspectionError } =
          await supabase
            .from("room_inspections")
            .select("*")
            .eq("id", inspectionId)
            .single();

        if (inspectionError) {
          alert(inspectionError.message);
          return;
        }

        if (!inspectionData) {
          alert("Inspection record nahi mila.");
          return;
        }

        setRoomId(String(inspectionData.room_id || ""));
        setInspectionDate(inspectionData.inspection_date || "");
        setInspectorName(inspectionData.inspector_name || "");
        setCleanliness(inspectionData.cleanliness || "Clean");

        setFurnitureCondition(
          inspectionData.furniture_condition || "Good"
        );

        setElectricalStatus(
          inspectionData.electrical_status || "Working"
        );

        setPlumbingStatus(
          inspectionData.plumbing_status || "Working"
        );

        setWallFloorStatus(
          inspectionData.wall_floor_status || "Good"
        );

        setOverallStatus(inspectionData.overall_status || "OK");
        setNotes(inspectionData.notes || "");

        await loadExistingPhotos();
      } catch (error) {
        console.error(error);
        alert("Inspection details load nahi ho saken.");
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [inspectionId]);

  const handleNewPhotoChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(event.target.files || []);

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    setNewPhotos(imageFiles);
  };

  const handleDeletePhoto = async (photo: ExistingPhoto) => {
    const confirmed = window.confirm(
      "Kya aap ye photo delete karna chahte hain?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingPhotoPath(photo.path);

    try {
      const { error } = await supabase.storage
        .from("room-inspection-photos")
        .remove([photo.path]);

      if (error) {
        alert(error.message);
        return;
      }

      setExistingPhotos((currentPhotos) =>
        currentPhotos.filter(
          (currentPhoto) => currentPhoto.path !== photo.path
        )
      );

      alert("Photo deleted successfully!");
    } catch (error) {
      console.error(error);
      alert("Photo delete karte waqt error aa gaya.");
    } finally {
      setDeletingPhotoPath(null);
    }
  };

  const handleUpdate = async () => {
    if (!roomId) {
      alert("Please select a room.");
      return;
    }

    if (!inspectionDate) {
      alert("Please select inspection date.");
      return;
    }

    if (!inspectorName.trim()) {
      alert("Please enter inspector name.");
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from("room_inspections")
        .update({
          room_id: Number(roomId),
          inspection_date: inspectionDate,
          inspector_name: inspectorName.trim(),
          cleanliness,
          furniture_condition: furnitureCondition,
          electrical_status: electricalStatus,
          plumbing_status: plumbingStatus,
          wall_floor_status: wallFloorStatus,
          overall_status: overallStatus,
          notes: notes.trim() || null,
        })
        .eq("id", inspectionId);

      if (updateError) {
        alert(updateError.message);
        return;
      }

      for (const photo of newPhotos) {
        const extension = photo.name.split(".").pop() || "jpg";

        const filePath =
          `${inspectionId}/` +
          `${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("room-inspection-photos")
          .upload(filePath, photo, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          alert(
            `Inspection update ho gayi lekin photo upload nahi hui: ${uploadError.message}`
          );
          return;
        }
      }

      alert("Room Inspection Updated Successfully!");

      router.push("/room-inspection");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Inspection update karte waqt error aa gaya.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="flex">
          <Sidebar />

          <section className="flex-1 p-10">
            <div className="rounded-2xl bg-white p-10 text-center shadow-lg">
              Loading inspection...
            </div>
          </section>
        </div>
      </main>
    );
}
return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex">
        <Sidebar />

        <section className="min-w-0 flex-1 p-6 md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold md:text-4xl">
              Edit Room Inspection
            </h1>

            <p className="mt-2 text-gray-600">
              Update inspection details and manage photos
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg md:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-medium">
                  Room
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                >
                  <option value="">Select Room</option>

                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Inspection Date
                </label>

                <input
                  type="date"
                  className="w-full rounded-xl border p-3"
                  value={inspectionDate}
                  onChange={(event) =>
                    setInspectionDate(event.target.value)
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block font-medium">
                  Inspector Name
                </label>

                <input
                  type="text"
                  className="w-full rounded-xl border p-3"
                  placeholder="Enter inspector name"
                  value={inspectorName}
                  onChange={(event) =>
                    setInspectorName(event.target.value)
                  }
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Cleanliness
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={cleanliness}
                  onChange={(event) =>
                    setCleanliness(event.target.value)
                  }
                >
                  <option value="Clean">Clean</option>
                  <option value="Needs Cleaning">
                    Needs Cleaning
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Furniture Condition
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={furnitureCondition}
                  onChange={(event) =>
                    setFurnitureCondition(event.target.value)
                  }
                >
                  <option value="Good">Good</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Electrical Items
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={electricalStatus}
                  onChange={(event) =>
                    setElectricalStatus(event.target.value)
                  }
                >
                  <option value="Working">Working</option>
                  <option value="Faulty">Faulty</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Plumbing
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={plumbingStatus}
                  onChange={(event) =>
                    setPlumbingStatus(event.target.value)
                  }
                >
                  <option value="Working">Working</option>
                  <option value="Faulty">Faulty</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Walls and Floor
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={wallFloorStatus}
                  onChange={(event) =>
                    setWallFloorStatus(event.target.value)
                  }
                >
                  <option value="Good">Good</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Overall Status
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={overallStatus}
                  onChange={(event) =>
                    setOverallStatus(event.target.value)
                  }
                >
                  <option value="OK">OK</option>
                  <option value="Damages Present">
                    Damages Present
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block font-medium">
                  Notes
                </label>

                <textarea
                  className="min-h-32 w-full rounded-xl border p-3"
                  placeholder="Write inspection notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-3 block font-medium">
                  Existing Photos
                </label>

                {existingPhotos.length === 0 ? (
                  <div className="rounded-xl bg-gray-100 p-6 text-center text-gray-600">
                    Is inspection ke saath koi existing photo nahi hai.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {existingPhotos.map((photo, index) => (
                      <div
                        key={photo.path}
                        className="overflow-hidden rounded-xl border bg-gray-50"
                      >
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={photo.url}
                            alt={`Inspection photo ${index + 1}`}
                            className="h-56 w-full object-cover"
                          />
                        </a>

                        <div className="p-3">
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo)}
                            disabled={
                              deletingPhotoPath === photo.path
                            }
                            className="w-full rounded-lg bg-red-100 px-4 py-2 font-medium text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingPhotoPath === photo.path
                              ? "Deleting..."
                              : "Delete Photo"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block font-medium">
                  Add New Photos
                </label>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full rounded-xl border p-3"
                  onChange={handleNewPhotoChange}
                />

                <p className="mt-2 text-sm text-gray-500">
                  Multiple new photos select kar sakte hain.
                </p>

                {newPhotos.length > 0 && (
                  <div className="mt-4 rounded-xl bg-gray-100 p-4">
                    <p className="font-medium">
                      New Photos Selected: {newPhotos.length}
                    </p>

                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      {newPhotos.map((photo, index) => (
                        <p key={`${photo.name}-${index}`}>
                          {index + 1}. {photo.name}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving ? "Updating..." : "Update Inspection"}
              </button>

              <Link
                href="/room-inspection"
                className="rounded-xl border px-8 py-3 font-medium hover:bg-gray-100"
              >
                Cancel
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Room = {
  id: number;
  room_number: string;
};

export default function AddRoomInspectionPage() {
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

  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, room_number")
        .order("room_number", { ascending: true });

      if (error) {
        alert(error.message);
        return;
      }

      setRooms(data || []);
    };

    fetchRooms();
  }, []);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    setPhotos(imageFiles);
  };

  const resetForm = () => {
    setRoomId("");
    setInspectionDate("");
    setInspectorName("");
    setCleanliness("Clean");
    setFurnitureCondition("Good");
    setElectricalStatus("Working");
    setPlumbingStatus("Working");
    setWallFloorStatus("Good");
    setOverallStatus("OK");
    setNotes("");
    setPhotos([]);

    const photoInput = document.getElementById(
      "inspectionPhotos"
    ) as HTMLInputElement | null;

    if (photoInput) {
      photoInput.value = "";
    }
  };

  const handleSubmit = async () => {
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
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("room_inspections")
        .insert([
          {
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
          },
        ])
        .select("id")
        .single();

      if (inspectionError) {
        alert(inspectionError.message);
        return;
      }

      if (!inspectionData) {
        alert("Inspection could not be saved.");
        return;
      }

      for (const photo of photos) {
        const extension = photo.name.split(".").pop() || "jpg";

        const fileName =
          `${inspectionData.id}/` +
          `${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("room-inspection-photos")
          .upload(fileName, photo, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          alert(
            `Inspection saved, but photo upload failed: ${uploadError.message}`
          );
          return;
        }
      }

      alert("Room Inspection Saved Successfully!");

      resetForm();
    } catch (error) {
      console.error(error);
      alert("Something went wrong while saving inspection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex">
        <Sidebar />

        <section className="flex-1 p-10">
          <div className="mb-8">
            <h1 className="text-4xl font-bold">Add Room Inspection</h1>

            <p className="mt-2 text-gray-600">
              Record room condition, damages and inspection photos
            </p>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-medium">Room</label>

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
                  onChange={(event) => setCleanliness(event.target.value)}
                >
                  <option value="Clean">Clean</option>
                  <option value="Needs Cleaning">Needs Cleaning</option>
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
                <label className="mb-2 block font-medium">Plumbing</label>

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
                  <option value="Damages Present">Damages Present</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block font-medium">Notes</label>

                <textarea
                  className="min-h-32 w-full rounded-xl border p-3"
                  placeholder="Write inspection notes or damage details"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block font-medium">
                  Inspection Photos
                </label>

                <input
                  id="inspectionPhotos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full rounded-xl border p-3"
                  onChange={handlePhotoChange}
                />

                <p className="mt-2 text-sm text-gray-500">
                  You can select multiple photos.
                </p>

                {photos.length > 0 && (
                  <div className="mt-4 rounded-xl bg-gray-100 p-4">
                    <p className="font-medium">
                      Selected Photos: {photos.length}
                    </p>

                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      {photos.map((photo, index) => (
                        <p key={`${photo.name}-${index}`}>
                          {index + 1}. {photo.name}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-10 flex gap-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-8 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving ? "Saving..." : "Save Inspection"}
              </button>

              <Link
                href="/room-inspection"
                className="rounded-xl border px-8 py-3 hover:bg-gray-100"
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
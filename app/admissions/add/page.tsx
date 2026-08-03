"use client";

import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddAdmissionPage() {
  const [residentId, setResidentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [bedId, setBedId] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");

  const [residents, setResidents] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: residentData } = await supabase
        .from("residents")
        .select("id, full_name");

      const { data: roomData, error: roomError } = await supabase
  .from("rooms")
  .select("*");

if (roomError) {
  alert(roomError.message);
}



      const { data: bedData, error: bedError } = await supabase
  .from("beds")
  .select("*")
  .eq("status", "Available");
  

      setResidents(residentData || []);
      setRooms(roomData || []);
      setBeds(bedData || []);
     
    };

    fetchData();
  }, []);

  const handleSubmit = async () => {
    const { data, error } = await supabase
      .from("admissions")
      .insert([
        {
          resident_id: Number(residentId),
          room_id: Number(roomId),
          bed_id: Number(bedId),
          admission_date: admissionDate,
        },
      ])
      .select();

    if (error) {
      alert(error.message);
      console.log(error);
    } else {
        console.log(data);
       const { error: updateError } = await supabase
  .from("beds")
  .update({ status: "Occupied" })
  .eq("id", Number(bedId));

if (updateError) {
  alert(updateError.message);
  return;
}

alert("Admission Saved Successfully!");
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-10">

          <div className="mb-8">
            <h1 className="text-4xl font-bold">
              Add Admission
            </h1>

            <p className="mt-2 text-gray-600">
              Admit a resident to a room
            </p>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-lg">

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                <label className="mb-2 block font-medium">
                  Resident
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={residentId}
                  onChange={(e) => setResidentId(e.target.value)}
                >
                  <option value="">Select Resident</option>

                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Room
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={roomId}
                  onChange={(e) => {
  setRoomId(e.target.value);
  setBedId("");
}}
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
                  Bed
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={bedId}
                  onChange={(e) => setBedId(e.target.value)}
                >
                  <option value="">Select Bed</option>

                  {beds
  .filter(
  (bed) =>
    String(bed.room_id) === roomId &&
    bed.status === "Available"
)
  .map((bed) => (
    <option key={bed.id} value={bed.id}>
      {bed.bed_number}
    </option>
  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Admission Date
                </label>

                <input
                  type="date"
                  className="w-full rounded-xl border p-3"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                />
              </div>

            </div>

            <div className="mt-10 flex gap-4">

              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-xl bg-blue-600 px-8 py-3 text-white hover:bg-blue-700"
              >
                Save Admission
              </button>

              <Link
                href="/admissions"
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
"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

export default function AddRoomPage() {
  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [roomType, setRoomType] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
 const handleSubmit = async () => {
  const { data, error } = await supabase
    .from("rooms")
    .insert([
      {
        room_number: roomNumber,
        floor: floor,
        capacity: parseInt(capacity),
        monthly_rent: parseInt(monthlyRent),
        status: status || "Available",
      },
    ]);

  if (error) {
    alert(error.message);
    console.log(error);
  } else {
    alert("Room Saved Successfully!");
    console.log("Room added successfully:", data);
  }
};

return (
  <main className="min-h-screen bg-gray-100">
     
      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-10">

          {/* Header */}

          <div className="mb-8">

            <h1 className="text-4xl font-bold">
              Add Room
            </h1>

            <p className="mt-2 text-gray-600">
              Create a new hostel room
            </p>

          </div>

          {/* Form */}

          <div className="rounded-2xl bg-white p-8 shadow-lg">

            <h2 className="mb-6 text-2xl font-bold">
              Room Information
            </h2>

            <div className="grid gap-6 md:grid-cols-2">

              <div>

                <label className="mb-2 block font-medium">
                  Room Number
                </label>

               <input
               type="text"
               placeholder="Room 101"
               className="w-full rounded-xl border p-3"
               value={roomNumber}
               onChange={(e) => setRoomNumber(e.target.value)}
             />

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Floor
                </label>

                <select
                  className="w-full rounded-xl border p-3"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                >
                  <option>Ground Floor</option>
                  <option>First Floor</option>
                  <option>Second Floor</option>
                  <option>Third Floor</option>
                </select>

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Capacity
                </label>

                <input
                  type="number"
                  placeholder="4"
                  className="w-full rounded-xl border p-3"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Monthly Rent
                </label>

                <input
                  type="number"
                  placeholder="15000"
                  className="w-full rounded-xl border p-3"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                />

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Room Type
                </label>

                <select className="w-full rounded-xl border p-3">
                  <option>Single</option>
                  <option>Double</option>
                  <option>Triple</option>
                  <option>Shared</option>
                </select>

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Status
                </label>

                <select className="w-full rounded-xl border p-3">
                  <option>Available</option>
                  <option>Occupied</option>
                  <option>Maintenance</option>
                </select>

              </div>

              <div className="md:col-span-2">

                <label className="mb-2 block font-medium">
                  Notes
                </label>

                <textarea
                  rows={4}
                  placeholder="Room notes..."
                  className="w-full rounded-xl border p-3"
                ></textarea>

              </div>

            </div>

            <div className="mt-10 flex gap-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-xl bg-blue-600 px-8 py-3 text-white hover:bg-blue-700"
              >
                Save Room
              </button>

              <Link
                href="/rooms"
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
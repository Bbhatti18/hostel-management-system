"use client";

import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddBillPage() {
    const handleSubmit = async () => {
  alert("handleSubmit Working");

  const totalAmount =
    Number(rentAmount) +
    Number(electricityAmount) +
    Number(otherCharges);

  const { data, error } = await supabase
    .from("bills")
    .insert([
      {
        resident_id: Number(residentId),
        bill_month: billMonth,
        rent_amount: Number(rentAmount),
        electricity_amount: Number(electricityAmount),
        other_charges: Number(otherCharges),
        total_amount: totalAmount,
      },
    ])
    .select();

  if (error) {
    console.log(error);
    alert(error.message);
  } else {
    console.log(data);
    alert("Bill Saved Successfully!");
  }
};
    const [residentId, setResidentId] = useState("");
const [billMonth, setBillMonth] = useState("");
const [rentAmount, setRentAmount] = useState("");
const [electricityAmount, setElectricityAmount] = useState("");
const [otherCharges, setOtherCharges] = useState("");
    const [residents, setResidents] = useState<any[]>([]);

useEffect(() => {
  const fetchResidents = async () => {
    const { data, error } = await supabase
      .from("residents")
      .select("id, full_name");

    if (!error) {
      setResidents(data || []);
    }
  };

  fetchResidents();
}, []);
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex">
        <Sidebar />

        <section className="flex-1 p-10">
          <div className="mb-8">
            <h1 className="text-4xl font-bold">Generate Bill</h1>

            <p className="mt-2 text-gray-600">
              Create a monthly bill for a resident
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
                  <option>Select Resident</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Bill Month
                </label>

                <input
                  type="month"
                  className="w-full rounded-xl border p-3"
                  value={billMonth}
                  onChange={(e) => setBillMonth(e.target.value)}
                />
              </div>
              <div>
  <label className="mb-2 block font-medium">
    Rent Amount
  </label>

  <input
    type="number"
    className="w-full rounded-xl border p-3"
    placeholder="15000"
    value={rentAmount}
    onChange={(e) => setRentAmount(e.target.value)}
  />
</div>
<div>
  <label className="mb-2 block font-medium">
    Electricity Amount
  </label>

  <input
    type="number"
    className="w-full rounded-xl border p-3"
    placeholder="0"
    value={electricityAmount}
    onChange={(e) => setElectricityAmount(e.target.value)}
  />
</div>
<div>
  <label className="mb-2 block font-medium">
    Other Charges
  </label>

  <input
    type="number"
    className="w-full rounded-xl border p-3"
    placeholder="0"
    value={otherCharges}
    onChange={(e) => setOtherCharges(e.target.value)}
  />
</div>

            </div>

            <div className="mt-10 flex gap-4">

              <button
  type="button"
  onClick={handleSubmit}
  className="rounded-xl bg-blue-600 px-8 py-3 text-white hover:bg-blue-700"
>
  Generate Bill
</button>

              <Link
                href="/billing"
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
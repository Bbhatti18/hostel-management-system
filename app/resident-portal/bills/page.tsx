"use client";

type Bill = {
  id: string;
  month: string;
  rent: number;
  electricity: number;
  ac: number;
  other: number;
  total: number;
  dueDate: string;
  status: "Pending" | "Paid" | "Overdue";
};

const bills: Bill[] = [
  {
    id: "1",
    month: "August 2026",
    rent: 15000,
    electricity: 1200,
    ac: 800,
    other: 500,
    total: 17500,
    dueDate: "2026-08-10",
    status: "Pending",
  },
];

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusClass(status: Bill["status"]) {
  if (status === "Paid") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Overdue") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function ResidentBillsPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Resident Bills
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View rent, electricity, AC charges and other monthly charges.
          </p>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Month",
                    "Rent",
                    "Electricity",
                    "AC",
                    "Other",
                    "Total",
                    "Due Date",
                    "Status",
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
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {bill.month}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {money(bill.rent)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {money(bill.electricity)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {money(bill.ac)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {money(bill.other)}
                    </td>

                    <td className="px-5 py-4 text-sm font-bold text-slate-900">
                      {money(bill.total)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {bill.dueDate}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                          bill.status
                        )}`}
                      >
                        {bill.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Upload Receipt
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Print / Save PDF
          </button>
        </section>
      </div>
    </main>
  );
}
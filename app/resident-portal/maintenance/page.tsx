"use client";

import { FormEvent, useState } from "react";

type RequestStatus = "Pending" | "In Progress" | "Completed";
type RequestPriority = "Low" | "Medium" | "High";

type MaintenanceRequest = {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: RequestPriority;
  status: RequestStatus;
  room: string;
};

const initialRequests: MaintenanceRequest[] = [
  {
    id: 1,
    title: "Washroom tap leakage",
    description: "Water is leaking from the washroom tap.",
    category: "Plumbing",
    priority: "High",
    status: "In Progress",
    room: "101",
  },
  {
    id: 2,
    title: "Ceiling fan noise",
    description: "The ceiling fan is making unusual noise.",
    category: "Electrical",
    priority: "Medium",
    status: "Completed",
    room: "101",
  },
];

export default function ResidentMaintenancePage() {
  const [requests, setRequests] =
    useState<MaintenanceRequest[]>(initialRequests);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [priority, setPriority] =
    useState<RequestPriority>("Medium");
  const [message, setMessage] = useState("");

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !description.trim()) {
      setMessage("Title and description are required.");
      return;
    }

    const newRequest: MaintenanceRequest = {
      id: Date.now(),
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status: "Pending",
      room: "101",
    };

    setRequests((current) => [newRequest, ...current]);
    setTitle("");
    setDescription("");
    setCategory("Other");
    setPriority("Medium");
    setMessage("Maintenance request submitted successfully.");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Resident Maintenance
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Submit maintenance requests and track their status.
          </p>
        </section>

        {message && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            New Maintenance Request
          </h2>

          <form
            onSubmit={submitRequest}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Request Title
              </span>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                placeholder="e.g. Fan not working"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Category
              </span>

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Furniture">Furniture</option>
                <option value="Cleaning">Cleaning</option>
                <option value="AC">AC</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Priority
              </span>

              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as RequestPriority)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>

            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                placeholder="Describe the issue..."
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Submit Request
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {request.title}
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    {request.description}
                  </p>
                </div>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  {request.status}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Info label="Room" value={request.room} />
                <Info label="Category" value={request.category} />
                <Info label="Priority" value={request.priority} />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}
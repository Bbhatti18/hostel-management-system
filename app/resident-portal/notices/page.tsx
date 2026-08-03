"use client";

type NoticePriority = "Low" | "Medium" | "High" | "Emergency";
type ReadStatus = "Read" | "Unread";

type ResidentNotice = {
  id: string;
  title: string;
  description: string;
  publishDate: string;
  expiryDate: string;
  priority: NoticePriority;
  readStatus: ReadStatus;
  pinned: boolean;
};

const notices: ResidentNotice[] = [
  {
    id: "1",
    title: "Monthly Rent Reminder",
    description:
      "Please pay your monthly rent before the due date shown on your bill.",
    publishDate: "2026-08-01",
    expiryDate: "2026-08-10",
    priority: "High",
    readStatus: "Unread",
    pinned: true,
  },
  {
    id: "2",
    title: "Room Inspection Schedule",
    description:
      "Routine room inspections will be conducted this week. Please keep your room accessible.",
    publishDate: "2026-08-02",
    expiryDate: "2026-08-08",
    priority: "Medium",
    readStatus: "Read",
    pinned: false,
  },
  {
    id: "3",
    title: "Water Supply Maintenance",
    description:
      "Water supply may remain temporarily unavailable due to maintenance work.",
    publishDate: "2026-08-03",
    expiryDate: "2026-08-03",
    priority: "Emergency",
    readStatus: "Unread",
    pinned: false,
  },
];

function priorityClass(priority: NoticePriority) {
  if (priority === "Emergency") {
    return "bg-red-100 text-red-700";
  }

  if (priority === "High") {
    return "bg-orange-100 text-orange-700";
  }

  if (priority === "Medium") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

function readClass(status: ReadStatus) {
  return status === "Read"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-blue-100 text-blue-700";
}

export default function ResidentNoticesPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Resident Notices
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View hostel announcements, reminders and emergency updates.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Notices"
            value={String(notices.length)}
          />

          <StatCard
            label="Unread"
            value={String(
              notices.filter((notice) => notice.readStatus === "Unread").length
            )}
          />

          <StatCard
            label="Emergency"
            value={String(
              notices.filter((notice) => notice.priority === "Emergency").length
            )}
          />
        </section>

        <section className="space-y-4">
          {notices.map((notice) => (
            <article
              key={notice.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {notice.pinned && (
                      <span title="Pinned" className="text-lg">
                        ð
                      </span>
                    )}

                    <h2 className="text-xl font-bold text-slate-900">
                      {notice.title}
                    </h2>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {notice.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${priorityClass(
                      notice.priority
                    )}`}
                  >
                    {notice.priority}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${readClass(
                      notice.readStatus
                    )}`}
                  >
                    {notice.readStatus}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-800">
                    Publish Date:
                  </span>{" "}
                  {notice.publishDate}
                </p>

                <p>
                  <span className="font-semibold text-slate-800">
                    Expiry Date:
                  </span>{" "}
                  {notice.expiryDate}
                </p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
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
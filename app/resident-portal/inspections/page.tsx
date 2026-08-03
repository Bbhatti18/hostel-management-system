"use client";

type InspectionStatus = "Pending" | "Completed" | "Follow-up Required";
type InspectionCondition = "Good" | "Fair" | "Damaged";

type ResidentInspection = {
  id: string;
  inspectionNumber: string;
  inspectionDate: string;
  inspectionType: string;
  area: string;
  inspectorName: string;
  cleanliness: string;
  electricalStatus: string;
  plumbingStatus: string;
  furnitureCondition: string;
  overallCondition: InspectionCondition;
  damageFound: boolean;
  damageDescription: string;
  recommendations: string;
  status: InspectionStatus;
};

const inspections: ResidentInspection[] = [
  {
    id: "1",
    inspectionNumber: "INS-2026-0001",
    inspectionDate: "2026-08-01",
    inspectionType: "Routine",
    area: "Room 101",
    inspectorName: "Hostel Manager",
    cleanliness: "Clean",
    electricalStatus: "Working",
    plumbingStatus: "Working",
    furnitureCondition: "Good",
    overallCondition: "Good",
    damageFound: false,
    damageDescription: "No damage found.",
    recommendations: "Maintain current cleanliness and room condition.",
    status: "Completed",
  },
  {
    id: "2",
    inspectionNumber: "INS-2026-0002",
    inspectionDate: "2026-08-15",
    inspectionType: "Follow-up",
    area: "Room 101",
    inspectorName: "Maintenance Officer",
    cleanliness: "Fair",
    electricalStatus: "Working",
    plumbingStatus: "Needs attention",
    furnitureCondition: "Good",
    overallCondition: "Fair",
    damageFound: true,
    damageDescription: "Minor leakage found near washroom tap.",
    recommendations: "Plumbing repair required.",
    status: "Follow-up Required",
  },
];

function statusClass(status: InspectionStatus) {
  if (status === "Completed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Follow-up Required") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-amber-100 text-amber-700";
}

function conditionClass(condition: InspectionCondition) {
  if (condition === "Good") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (condition === "Damaged") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function ResidentInspectionsPage() {
  const completed = inspections.filter(
    (inspection) => inspection.status === "Completed"
  ).length;

  const followUp = inspections.filter(
    (inspection) => inspection.status === "Follow-up Required"
  ).length;

  const damageFound = inspections.filter(
    (inspection) => inspection.damageFound
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Resident Inspections
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View inspection history, room condition, damage findings and recommendations.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Inspections" value={String(inspections.length)} />
          <StatCard label="Completed" value={String(completed)} />
          <StatCard label="Follow-up Required" value={String(followUp)} />
          <StatCard label="Damage Found" value={String(damageFound)} />
        </section>

        <section className="space-y-5">
          {inspections.map((inspection) => (
            <article
              key={inspection.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    {inspection.inspectionNumber}
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-slate-900">
                    {inspection.inspectionType} Inspection
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {inspection.area} Â· {inspection.inspectionDate}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${conditionClass(
                      inspection.overallCondition
                    )}`}
                  >
                    {inspection.overallCondition}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                      inspection.status
                    )}`}
                  >
                    {inspection.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InfoCard label="Inspector" value={inspection.inspectorName} />
                <InfoCard label="Cleanliness" value={inspection.cleanliness} />
                <InfoCard label="Electrical" value={inspection.electricalStatus} />
                <InfoCard label="Plumbing" value={inspection.plumbingStatus} />
                <InfoCard
                  label="Furniture"
                  value={inspection.furnitureCondition}
                />
                <InfoCard
                  label="Damage Found"
                  value={inspection.damageFound ? "Yes" : "No"}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Damage Description
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {inspection.damageDescription}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Recommendations
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {inspection.recommendations}
                  </p>
                </div>
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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-semibold text-slate-900">{value}</p>
    </article>
  );
}
"use client";

type ContractStatus = "Active" | "Pending Signature" | "Expired";
type SignatureStatus = "Signed" | "Pending";

type Contract = {
  contractNumber: string;
  residentName: string;
  roomNumber: string;
  bedNumber: string;
  admissionDate: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  noticePeriodDays: number;
  residentSignatureStatus: SignatureStatus;
  ownerSignatureStatus: SignatureStatus;
  status: ContractStatus;
};

const contract: Contract = {
  contractNumber: "CNT-2026-0001",
  residentName: "Bilal",
  roomNumber: "101",
  bedNumber: "B1",
  admissionDate: "2026-07-31",
  startDate: "2026-07-31",
  endDate: "2027-07-30",
  monthlyRent: 15000,
  securityDeposit: 15000,
  noticePeriodDays: 30,
  residentSignatureStatus: "Signed",
  ownerSignatureStatus: "Signed",
  status: "Active",
};

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function badgeClass(value: string) {
  if (value === "Active" || value === "Signed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (value === "Expired") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function ResidentContractPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Hostel Management System
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Resident Contract
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              View your contract, rent, security deposit and signature status.
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-bold ${badgeClass(
              contract.status
            )}`}
          >
            {contract.status}
          </span>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="Contract Number" value={contract.contractNumber} />
            <InfoCard label="Resident" value={contract.residentName} />
            <InfoCard label="Room" value={contract.roomNumber} />
            <InfoCard label="Bed" value={contract.bedNumber} />
            <InfoCard label="Admission Date" value={contract.admissionDate} />
            <InfoCard label="Start Date" value={contract.startDate} />
            <InfoCard label="End Date" value={contract.endDate} />
            <InfoCard label="Monthly Rent" value={money(contract.monthlyRent)} />
            <InfoCard
              label="Security Deposit"
              value={money(contract.securityDeposit)}
            />
            <InfoCard
              label="Notice Period"
              value={`${contract.noticePeriodDays} days`}
            />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Signature Status
            </h2>

            <div className="mt-5 space-y-4">
              <SignatureRow
                label="Resident Signature"
                status={contract.residentSignatureStatus}
              />

              <SignatureRow
                label="Owner Signature"
                status={contract.ownerSignatureStatus}
              />
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Security Deposit Rule
            </h2>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              Security deposit is refundable only when notice is served at
              least {contract.noticePeriodDays} days before leaving.
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Contract Terms
          </h2>

          <ol className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
            <li className="rounded-2xl bg-slate-50 p-4">
              1. Monthly rent must be paid by the due date.
            </li>
            <li className="rounded-2xl bg-slate-50 p-4">
              2. Room and bed allocation is decided by the owner.
            </li>
            <li className="rounded-2xl bg-slate-50 p-4">
              3. Damage charges may be deducted from the security deposit.
            </li>
            <li className="rounded-2xl bg-slate-50 p-4">
              4. Residents must follow hostel rules and inspection procedures.
            </li>
          </ol>
        </section>

        <section className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Print / Save PDF
          </button>
        </section>
      </div>
    </main>
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

function SignatureRow({
  label,
  status,
}: {
  label: string;
  status: SignatureStatus;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
      <span className="text-sm font-semibold text-slate-700">{label}</span>

      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass(
          status
        )}`}
      >
        {status}
      </span>
    </div>
  );
}
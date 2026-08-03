"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type GenericRow = Record<string, unknown>;

type ReportType =
  | "Residents"
  | "Payments"
  | "Billing"
  | "Inspections"
  | "Maintenance"
  | "Security Deposits"
  | "Occupancy";

type ReportRow = {
  id: string;
  columns: string[];
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function firstText(row: GenericRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return "";
}

function residentName(row: GenericRow) {
  const direct = firstText(row, ["full_name", "resident_name", "name"]);

  if (direct) return direct;

  const combined = `${firstText(row, ["first_name"])} ${firstText(row, [
    "last_name",
    "surname",
  ])}`.trim();

  return (
    combined ||
    firstText(row, ["phone", "email", "cnic"]) ||
    "Resident"
  );
}

function roomName(row: GenericRow) {
  return firstText(row, ["room_number", "number", "name"]) || "Room";
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("Residents");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [residentId, setResidentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [search, setSearch] = useState("");

  const [residents, setResidents] = useState<GenericRow[]>([]);
  const [rooms, setRooms] = useState<GenericRow[]>([]);
  const [payments, setPayments] = useState<GenericRow[]>([]);
  const [bills, setBills] = useState<GenericRow[]>([]);
  const [inspections, setInspections] = useState<GenericRow[]>([]);
  const [maintenance, setMaintenance] = useState<GenericRow[]>([]);
  const [admissions, setAdmissions] = useState<GenericRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      residentsResult,
      roomsResult,
      paymentsResult,
      billsResult,
      inspectionsResult,
      maintenanceResult,
      admissionsResult,
    ] = await Promise.all([
      supabase.from("residents").select("*"),
      supabase.from("rooms").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("bills").select("*"),
      supabase.from("room_inspections").select("*"),
      supabase.from("maintenance_requests").select("*"),
      supabase.from("admissions").select("*"),
    ]);

    const firstError =
      residentsResult.error ||
      roomsResult.error ||
      paymentsResult.error ||
      billsResult.error ||
      inspectionsResult.error ||
      maintenanceResult.error ||
      admissionsResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setRooms((roomsResult.data ?? []) as GenericRow[]);
      setPayments((paymentsResult.data ?? []) as GenericRow[]);
      setBills((billsResult.data ?? []) as GenericRow[]);
      setInspections((inspectionsResult.data ?? []) as GenericRow[]);
      setMaintenance((maintenanceResult.data ?? []) as GenericRow[]);
      setAdmissions((admissionsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const residentMap = useMemo(
    () =>
      new Map(
        residents.map((resident) => [
          text(resident.id),
          residentName(resident),
        ])
      ),
    [residents]
  );

  const roomMap = useMemo(
    () =>
      new Map(
        rooms.map((room) => [
          text(room.id),
          roomName(room),
        ])
      ),
    [rooms]
  );

  const filteredAdmissions = useMemo(() => {
    return admissions.filter((admission) => {
      if (
        residentId &&
        firstText(admission, ["resident_id"]) !== residentId
      ) {
        return false;
      }

      if (roomId && firstText(admission, ["room_id"]) !== roomId) {
        return false;
      }

      return true;
    });
  }, [admissions, residentId, roomId]);

  const report = useMemo(() => {
    let headers: string[] = [];
    let rows: ReportRow[] = [];

    const query = search.trim().toLowerCase();

    const dateMatches = (value: string) => {
      if (!value) return true;
      const date = value.slice(0, 10);

      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;

      return true;
    };

    if (reportType === "Residents") {
      headers = [
        "Resident",
        "Phone",
        "Email",
        "CNIC",
        "Status",
        "Admission Date",
      ];

      rows = residents
        .filter((resident) => {
          if (residentId && text(resident.id) !== residentId) return false;

          const name = residentName(resident).toLowerCase();
          const phone = firstText(resident, ["phone", "mobile"]).toLowerCase();
          const email = firstText(resident, ["email"]).toLowerCase();

          return (
            !query ||
            name.includes(query) ||
            phone.includes(query) ||
            email.includes(query)
          );
        })
        .map((resident) => ({
          id: text(resident.id),
          columns: [
            residentName(resident),
            firstText(resident, ["phone", "mobile"]) || "â",
            firstText(resident, ["email"]) || "â",
            firstText(resident, ["cnic", "national_id"]) || "â",
            firstText(resident, ["status"]) || "Active",
            firstText(resident, ["admission_date", "created_at"]).slice(0, 10) ||
              "â",
          ],
        }));
    }

    if (reportType === "Payments") {
      headers = [
        "Payment No.",
        "Resident",
        "Date",
        "Method",
        "Reference",
        "Amount",
        "Status",
      ];

      rows = payments
        .filter((payment) => {
          if (
            residentId &&
            firstText(payment, ["resident_id"]) !== residentId
          ) {
            return false;
          }

          const date = firstText(payment, [
            "payment_date",
            "created_at",
          ]);

          if (!dateMatches(date)) return false;

          const resident =
            residentMap.get(firstText(payment, ["resident_id"])) ?? "";
          const number = firstText(payment, ["payment_number"]);
          const reference = firstText(payment, ["reference_number"]);

          return (
            !query ||
            resident.toLowerCase().includes(query) ||
            number.toLowerCase().includes(query) ||
            reference.toLowerCase().includes(query)
          );
        })
        .map((payment) => ({
          id: text(payment.id),
          columns: [
            firstText(payment, ["payment_number"]) || "â",
            residentMap.get(firstText(payment, ["resident_id"])) ??
              "Unknown resident",
            firstText(payment, ["payment_date", "created_at"]).slice(0, 10) ||
              "â",
            firstText(payment, ["payment_method"]) || "â",
            firstText(payment, ["reference_number"]) || "â",
            money(payment.amount),
            firstText(payment, ["payment_status", "status"]) || "Pending",
          ],
        }));
    }

    if (reportType === "Billing") {
      headers = [
        "Bill No.",
        "Resident",
        "Billing Month",
        "Total",
        "Paid",
        "Balance",
        "Status",
      ];

      rows = bills
        .filter((bill) => {
          if (residentId && firstText(bill, ["resident_id"]) !== residentId) {
            return false;
          }

          const date = firstText(bill, ["billing_month", "created_at"]);

          if (!dateMatches(date)) return false;

          const resident =
            residentMap.get(firstText(bill, ["resident_id"])) ?? "";
          const billNumber = firstText(bill, ["bill_number"]);

          return (
            !query ||
            resident.toLowerCase().includes(query) ||
            billNumber.toLowerCase().includes(query)
          );
        })
        .map((bill) => ({
          id: text(bill.id),
          columns: [
            firstText(bill, ["bill_number"]) || "â",
            residentMap.get(firstText(bill, ["resident_id"])) ??
              "Unknown resident",
            firstText(bill, ["billing_month"]).slice(0, 7) || "â",
            money(bill.total_amount),
            money(bill.paid_amount),
            money(bill.balance_amount ?? bill.due_amount),
            firstText(bill, ["bill_status", "status"]) || "Pending",
          ],
        }));
    }

    if (reportType === "Inspections") {
      headers = [
        "Inspection No.",
        "Area",
        "Building",
        "Room",
        "Date",
        "Inspector",
        "Condition",
        "Status",
      ];

      rows = inspections
        .filter((inspection) => {
          if (roomId && firstText(inspection, ["room_id"]) !== roomId) {
            return false;
          }

          const date = firstText(inspection, [
            "inspection_date",
            "created_at",
          ]);

          if (!dateMatches(date)) return false;

          const location = [
            firstText(inspection, ["area_type"]),
            firstText(inspection, ["building_name"]),
            firstText(inspection, ["block_name"]),
            firstText(inspection, ["floor_number"]),
          ]
            .join(" ")
            .toLowerCase();

          return !query || location.includes(query);
        })
        .map((inspection) => ({
          id: text(inspection.id),
          columns: [
            firstText(inspection, ["inspection_number"]) || "â",
            firstText(inspection, ["area_type"]) || "Room",
            [
              firstText(inspection, ["building_name"]),
              firstText(inspection, ["block_name"]),
              firstText(inspection, ["floor_number"]),
            ]
              .filter(Boolean)
              .join(" Â· ") || "â",
            roomMap.get(firstText(inspection, ["room_id"])) || "â",
            firstText(inspection, [
              "inspection_date",
              "created_at",
            ]).slice(0, 10) || "â",
            firstText(inspection, ["inspector_name"]) || "â",
            firstText(inspection, ["overall_status"]) || "â",
            firstText(inspection, ["status"]) || "Pending",
          ],
        }));
    }

    if (reportType === "Maintenance") {
      headers = [
        "Request No.",
        "Category",
        "Location",
        "Priority",
        "Assigned To",
        "Estimated Cost",
        "Actual Cost",
        "Status",
      ];

      rows = maintenance
        .filter((request) => {
          if (roomId && firstText(request, ["room_id"]) !== roomId) {
            return false;
          }

          const date = firstText(request, [
            "complaint_date",
            "created_at",
          ]);

          if (!dateMatches(date)) return false;

          const searchable = [
            firstText(request, ["request_number"]),
            firstText(request, ["category"]),
            firstText(request, ["assigned_to"]),
            firstText(request, ["building_name"]),
          ]
            .join(" ")
            .toLowerCase();

          return !query || searchable.includes(query);
        })
        .map((request) => ({
          id: text(request.id),
          columns: [
            firstText(request, ["request_number"]) || "â",
            firstText(request, ["category"]) || "â",
            [
              firstText(request, ["building_name"]),
              firstText(request, ["block_name"]),
              firstText(request, ["floor_number"]),
              firstText(request, ["area_type"]),
              roomMap.get(firstText(request, ["room_id"])),
            ]
              .filter(Boolean)
              .join(" Â· ") || "â",
            firstText(request, ["priority"]) || "Medium",
            firstText(request, ["assigned_to"]) || "Not assigned",
            money(request.estimated_cost),
            money(request.actual_cost),
            firstText(request, ["status"]) || "Pending",
          ],
        }));
    }

    if (reportType === "Security Deposits") {
      headers = [
        "Resident",
        "Room",
        "Admission Date",
        "Deposit Amount",
        "Deposit Status",
        "Notice Served",
        "Refund Eligible",
      ];

      rows = filteredAdmissions
        .filter((admission) => {
          const date = firstText(admission, [
            "admission_date",
            "created_at",
          ]);

          if (!dateMatches(date)) return false;

          const resident =
            residentMap.get(firstText(admission, ["resident_id"])) ?? "";

          return !query || resident.toLowerCase().includes(query);
        })
        .map((admission) => {
          const noticeDays = Number(
            admission.notice_days ??
              admission.notice_period_days ??
              admission.notice_served_days ??
              0
          );

          const eligible =
            noticeDays >= 30 ||
            admission.deposit_refundable === true ||
            admission.refund_eligible === true;

          return {
            id: text(admission.id),
            columns: [
              residentMap.get(firstText(admission, ["resident_id"])) ??
                "Unknown resident",
              roomMap.get(firstText(admission, ["room_id"])) || "â",
              firstText(admission, [
                "admission_date",
                "created_at",
              ]).slice(0, 10) || "â",
              money(
                admission.security_deposit ??
                  admission.deposit_amount ??
                  0
              ),
              firstText(admission, ["deposit_status"]) || "Pending",
              noticeDays > 0 ? `${noticeDays} days` : "Not recorded",
              eligible ? "Yes" : "No",
            ],
          };
        });
    }

    if (reportType === "Occupancy") {
      headers = [
        "Room",
        "Resident",
        "Admission Status",
        "Admission Date",
        "Expected Leaving",
      ];

      rows = filteredAdmissions
        .filter((admission) => {
          const date = firstText(admission, [
            "admission_date",
            "created_at",
          ]);

          if (!dateMatches(date)) return false;

          const resident =
            residentMap.get(firstText(admission, ["resident_id"])) ?? "";
          const room =
            roomMap.get(firstText(admission, ["room_id"])) ?? "";

          return (
            !query ||
            resident.toLowerCase().includes(query) ||
            room.toLowerCase().includes(query)
          );
        })
        .map((admission) => ({
          id: text(admission.id),
          columns: [
            roomMap.get(firstText(admission, ["room_id"])) || "â",
            residentMap.get(firstText(admission, ["resident_id"])) ??
              "Unknown resident",
            firstText(admission, ["status", "admission_status"]) || "Active",
            firstText(admission, [
              "admission_date",
              "created_at",
            ]).slice(0, 10) || "â",
            firstText(admission, [
              "expected_leaving_date",
              "leaving_date",
            ]).slice(0, 10) || "â",
          ],
        }));
    }

    return { headers, rows };
  }, [
    admissions,
    bills,
    filteredAdmissions,
    fromDate,
    inspections,
    maintenance,
    payments,
    reportType,
    residentId,
    residentMap,
    residents,
    roomId,
    roomMap,
    search,
    toDate,
  ]);

  const summary = useMemo(() => {
    const verifiedPayments = payments
      .filter((payment) =>
        ["Verified", "Paid"].includes(
          firstText(payment, ["payment_status", "status"])
        )
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const pendingBills = bills.reduce(
      (sum, bill) =>
        sum +
        Number(
          bill.balance_amount ??
            bill.due_amount ??
            0
        ),
      0
    );

    return {
      residents: residents.length,
      occupied: admissions.filter((admission) =>
        ["Active", "Occupied"].includes(
          firstText(admission, ["status", "admission_status"])
        )
      ).length,
      verifiedPayments,
      pendingBills,
    };
  }, [admissions, bills, payments, residents.length]);

  function exportCsv() {
    const lines = [
      report.headers.map(csvEscape).join(","),
      ...report.rows.map((row) =>
        row.columns.map(csvEscape).join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${reportType.toLowerCase().replace(/\s+/g, "-")}-report.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Reports
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Generate operational reports with date, resident and room filters.
          </p>
        </section>

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
          <StatCard label="Residents" value={String(summary.residents)} />
          <StatCard label="Active Admissions" value={String(summary.occupied)} />
          <StatCard
            label="Verified Payments"
            value={money(summary.verifiedPayments)}
          />
          <StatCard
            label="Pending Bill Balance"
            value={money(summary.pendingBills)}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Report Type">
              <select
                value={reportType}
                onChange={(event) =>
                  setReportType(event.target.value as ReportType)
                }
                className={inputClass}
              >
                <option value="Residents">Residents</option>
                <option value="Payments">Payments</option>
                <option value="Billing">Billing</option>
                <option value="Inspections">Inspections</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Security Deposits">Security Deposits</option>
                <option value="Occupancy">Occupancy</option>
              </select>
            </Field>

            <Field label="From Date">
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="To Date">
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Resident">
              <select
                value={residentId}
                onChange={(event) => setResidentId(event.target.value)}
                className={inputClass}
              >
                <option value="">All Residents</option>

                {residents.map((resident) => (
                  <option
                    key={text(resident.id)}
                    value={text(resident.id)}
                  >
                    {residentName(resident)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Room">
              <select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                className={inputClass}
              >
                <option value="">All Rooms</option>

                {rooms.map((room) => (
                  <option key={text(room.id)} value={text(room.id)}>
                    Room {roomName(room)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Search" wide>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={inputClass}
                placeholder="Search current report"
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Refresh Data
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={report.rows.length === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={printReport}
              disabled={report.rows.length === 0}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Print / Save PDF
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-900">
              {reportType} Report
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Total records: {report.rows.length}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {report.headers.map((heading) => (
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
                {loading ? (
                  <tr>
                    <td
                      colSpan={Math.max(report.headers.length, 1)}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      Loading report data...
                    </td>
                  </tr>
                ) : report.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(report.headers.length, 1)}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      {row.columns.map((column, index) => (
                        <td
                          key={`${row.id}-${index}`}
                          className="whitespace-nowrap px-5 py-4 text-sm text-slate-700"
                        >
                          {column}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? "md:col-span-2 xl:col-span-3" : ""}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
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
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
  | "Admissions"
  | "Billing"
  | "Payments"
  | "Maintenance"
  | "Inspections";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstText(row: GenericRow | undefined, keys: string[]) {
  if (!row) return "";

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

function residentName(row: GenericRow | undefined) {
  return (
    firstText(row, ["full_name", "resident_name", "name"]) ||
    "Unknown resident"
  );
}

function roomNumber(row: GenericRow | undefined) {
  return (
    firstText(row, ["room_number", "room_no", "number", "name"]) ||
    "Unknown room"
  );
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function dateText(value: unknown) {
  const raw = text(value);
  return raw ? raw.slice(0, 10) : "-";
}

function escapeCsv(value: unknown) {
  const raw = text(value).replace(/"/g, '""');
  return `"${raw}"`;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("Residents");
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [residentFilter, setResidentFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [search, setSearch] = useState("");

  const [residents, setResidents] = useState<GenericRow[]>([]);
  const [rooms, setRooms] = useState<GenericRow[]>([]);
  const [admissions, setAdmissions] = useState<GenericRow[]>([]);
  const [bills, setBills] = useState<GenericRow[]>([]);
  const [payments, setPayments] = useState<GenericRow[]>([]);
  const [maintenance, setMaintenance] = useState<GenericRow[]>([]);
  const [inspections, setInspections] = useState<GenericRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      residentsResult,
      roomsResult,
      admissionsResult,
      billsResult,
      paymentsResult,
      maintenanceResult,
      inspectionsResult,
    ] = await Promise.all([
      supabase.from("residents").select("*"),
      supabase.from("rooms").select("*"),
      supabase.from("admissions").select("*"),
      supabase.from("bills").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("maintenance_requests").select("*"),
      supabase.from("inspections").select("*"),
    ]);

    const firstError =
      residentsResult.error ||
      roomsResult.error ||
      admissionsResult.error ||
      billsResult.error ||
      paymentsResult.error ||
      maintenanceResult.error ||
      inspectionsResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setResidents((residentsResult.data ?? []) as GenericRow[]);
      setRooms((roomsResult.data ?? []) as GenericRow[]);
      setAdmissions((admissionsResult.data ?? []) as GenericRow[]);
      setBills((billsResult.data ?? []) as GenericRow[]);
      setPayments((paymentsResult.data ?? []) as GenericRow[]);
      setMaintenance((maintenanceResult.data ?? []) as GenericRow[]);
      setInspections((inspectionsResult.data ?? []) as GenericRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeAdmissions = useMemo(
    () =>
      admissions.filter((row) =>
        ["active", ""].includes(
          firstText(row, ["status", "admission_status"]).toLowerCase()
        )
      ),
    [admissions]
  );

  const verifiedPaymentsTotal = useMemo(
    () =>
      payments
        .filter((row) =>
          ["verified", "paid", "approved"].includes(
            firstText(row, ["status", "payment_status"]).toLowerCase()
          )
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount ??
                row.payment_amount ??
                row.paid_amount
            ),
          0
        ),
    [payments]
  );

  const pendingBillBalance = useMemo(
    () =>
      bills.reduce(
        (sum, row) =>
          sum +
          numberValue(
            row.balance_amount ??
              row.balance ??
              row.pending_amount
          ),
        0
      ),
    [bills]
  );

  const reportRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const inDateRange = (value: unknown) => {
      const raw = dateText(value);
      if (raw === "-") return true;
      return (!fromDate || raw >= fromDate) && (!toDate || raw <= toDate);
    };

    const matchesCommon = (
      row: GenericRow,
      dateValue: unknown,
      searchable: string[],
      residentId?: string,
      roomId?: string
    ) => {
      if (!inDateRange(dateValue)) return false;
      if (residentFilter && residentId !== residentFilter) return false;
      if (roomFilter && roomId !== roomFilter) return false;
      if (!query) return true;

      return searchable.join(" ").toLowerCase().includes(query);
    };

    if (reportType === "Residents") {
      return residents.filter((row) =>
        matchesCommon(
          row,
          row.created_at,
          [
            residentName(row),
            firstText(row, ["phone", "contact_number"]),
            firstText(row, ["email"]),
            firstText(row, ["cnic"]),
            firstText(row, ["status", "admission_status"]),
          ],
          text(row.id)
        )
      );
    }

    if (reportType === "Admissions") {
      return admissions.filter((row) => {
        const residentId = firstText(row, ["resident_id"]);
        const roomId = firstText(row, ["room_id"]);
        const resident = residents.find(
          (item) => text(item.id) === residentId
        );
        const room = rooms.find((item) => text(item.id) === roomId);

        return matchesCommon(
          row,
          row.admission_date ?? row.created_at,
          [
            residentName(resident),
            roomNumber(room),
            firstText(row, ["status", "admission_status"]),
            firstText(row, ["bed_number", "bed_id"]),
          ],
          residentId,
          roomId
        );
      });
    }

    if (reportType === "Billing") {
      return bills.filter((row) => {
        const residentId = firstText(row, ["resident_id"]);
        const resident = residents.find(
          (item) => text(item.id) === residentId
        );

        return matchesCommon(
          row,
          row.billing_month ?? row.due_date ?? row.created_at,
          [
            firstText(row, ["bill_number", "invoice_number"]),
            residentName(resident),
            firstText(row, ["billing_month"]),
            firstText(row, ["bill_status", "status"]),
          ],
          residentId
        );
      });
    }

    if (reportType === "Payments") {
      return payments.filter((row) => {
        const residentId = firstText(row, ["resident_id"]);
        const resident = residents.find(
          (item) => text(item.id) === residentId
        );

        return matchesCommon(
          row,
          row.payment_date ?? row.verified_at ?? row.created_at,
          [
            residentName(resident),
            firstText(row, ["payment_reference", "reference"]),
            firstText(row, ["status", "payment_status"]),
            firstText(row, ["payment_method", "method"]),
          ],
          residentId
        );
      });
    }

    if (reportType === "Maintenance") {
      return maintenance.filter((row) => {
        const residentId = firstText(row, ["resident_id"]);
        const roomId = firstText(row, ["room_id"]);
        const resident = residents.find(
          (item) => text(item.id) === residentId
        );
        const room = rooms.find((item) => text(item.id) === roomId);

        return matchesCommon(
          row,
          row.created_at,
          [
            firstText(row, ["request_number"]),
            residentName(resident),
            roomNumber(room),
            firstText(row, ["title", "category"]),
            firstText(row, ["priority"]),
            firstText(row, ["status"]),
          ],
          residentId,
          roomId
        );
      });
    }

    return inspections.filter((row) => {
      const residentId = firstText(row, ["resident_id"]);
      const roomId = firstText(row, ["room_id"]);
      const resident = residents.find(
        (item) => text(item.id) === residentId
      );
      const room = rooms.find((item) => text(item.id) === roomId);

      return matchesCommon(
        row,
        row.inspection_date ?? row.created_at,
        [
          residentName(resident),
          roomNumber(room),
          firstText(row, ["damage_notes"]),
        ],
        residentId,
        roomId
      );
    });
  }, [
    admissions,
    bills,
    fromDate,
    inspections,
    maintenance,
    payments,
    reportType,
    residentFilter,
    residents,
    roomFilter,
    rooms,
    search,
    toDate,
  ]);

  function exportCsv() {
    const rows = getExportRows(
      reportType,
      reportRows,
      residents,
      rooms
    );

    if (rows.length === 0) {
      window.alert("No report data available.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCsv(row[header])).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportType.toLowerCase()}-report-${fromDate}-${toDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Hostel Management System
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Reports
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View, filter, export and print operational reports.
          </p>
        </section>

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
          <StatCard label="Residents" value={String(residents.length)} />
          <StatCard
            label="Active Admissions"
            value={String(activeAdmissions.length)}
          />
          <StatCard
            label="Verified Payments"
            value={money(verifiedPaymentsTotal)}
          />
          <StatCard
            label="Pending Bill Balance"
            value={money(pendingBillBalance)}
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
                <option value="Admissions">Admissions</option>
                <option value="Billing">Billing</option>
                <option value="Payments">Payments</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inspections">Inspections</option>
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
                value={residentFilter}
                onChange={(event) =>
                  setResidentFilter(event.target.value)
                }
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
                value={roomFilter}
                onChange={(event) =>
                  setRoomFilter(event.target.value)
                }
                className={inputClass}
              >
                <option value="">All Rooms</option>

                {rooms.map((room) => (
                  <option key={text(room.id)} value={text(room.id)}>
                    {roomNumber(room)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2 xl:col-span-3">
              <Field label="Search">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={inputClass}
                  placeholder="Search current report"
                />
              </Field>
            </div>
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
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Print / Save PDF
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-900">
              {reportType} Report
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Total records: {reportRows.length}
            </p>
          </div>

          {loading ? (
            <p className="p-10 text-center text-sm text-slate-500">
              Loading report data...
            </p>
          ) : (
            <ReportTable
              type={reportType}
              rows={reportRows}
              residents={residents}
              rooms={rooms}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label>
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
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </article>
  );
}

function ReportTable({
  type,
  rows,
  residents,
  rooms,
}: {
  type: ReportType;
  rows: GenericRow[];
  residents: GenericRow[];
  rooms: GenericRow[];
}) {
  const exportRows = getExportRows(type, rows, residents, rooms);
  const headers =
    exportRows.length > 0 ? Object.keys(exportRows[0]) : [];

  if (exportRows.length === 0) {
    return (
      <p className="p-10 text-center text-sm text-slate-500">
        No records found for the selected filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {exportRows.map((row, index) => (
            <tr key={index}>
              {headers.map((header) => (
                <td
                  key={header}
                  className="whitespace-nowrap px-5 py-4 text-sm text-slate-700"
                >
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getExportRows(
  type: ReportType,
  rows: GenericRow[],
  residents: GenericRow[],
  rooms: GenericRow[]
): Record<string, string>[] {
  if (type === "Residents") {
    return rows.map((row) => ({
      Resident: residentName(row),
      Phone: firstText(row, ["phone", "contact_number"]) || "-",
      Email: firstText(row, ["email"]) || "-",
      CNIC: firstText(row, ["cnic"]) || "-",
      Status:
        firstText(row, ["status", "admission_status"]) || "-",
      Created: dateText(row.created_at),
    }));
  }

  if (type === "Admissions") {
    return rows.map((row) => {
      const resident = residents.find(
        (item) =>
          text(item.id) === firstText(row, ["resident_id"])
      );

      const room = rooms.find(
        (item) => text(item.id) === firstText(row, ["room_id"])
      );

      return {
        Resident: residentName(resident),
        Room: roomNumber(room),
        Bed: firstText(row, ["bed_number", "bed_id"]) || "-",
        "Admission Date": dateText(
          row.admission_date ?? row.created_at
        ),
        "Expected Leaving": dateText(row.expected_leaving_date),
        Status:
          firstText(row, ["status", "admission_status"]) || "-",
      };
    });
  }

  if (type === "Billing") {
    return rows.map((row) => {
      const resident = residents.find(
        (item) =>
          text(item.id) === firstText(row, ["resident_id"])
      );

      return {
        "Bill No.":
          firstText(row, ["bill_number", "invoice_number"]) || "-",
        Resident: residentName(resident),
        Month: dateText(row.billing_month),
        Total: money(row.total_amount ?? row.total),
        Paid: money(row.paid_amount),
        Balance: money(
          row.balance_amount ?? row.balance ?? row.pending_amount
        ),
        Status:
          firstText(row, ["bill_status", "status"]) || "-",
      };
    });
  }

  if (type === "Payments") {
    return rows.map((row) => {
      const resident = residents.find(
        (item) =>
          text(item.id) === firstText(row, ["resident_id"])
      );

      return {
        Resident: residentName(resident),
        Amount: money(
          row.amount ?? row.payment_amount ?? row.paid_amount
        ),
        Reference:
          firstText(row, ["payment_reference", "reference"]) || "-",
        Method:
          firstText(row, ["payment_method", "method"]) || "-",
        Status:
          firstText(row, ["status", "payment_status"]) || "-",
        Date: dateText(
          row.payment_date ?? row.verified_at ?? row.created_at
        ),
      };
    });
  }

  if (type === "Maintenance") {
    return rows.map((row) => {
      const resident = residents.find(
        (item) =>
          text(item.id) === firstText(row, ["resident_id"])
      );

      const room = rooms.find(
        (item) => text(item.id) === firstText(row, ["room_id"])
      );

      return {
        "Request No.": firstText(row, ["request_number"]) || "-",
        Resident: residentName(resident),
        Room: roomNumber(room),
        Issue: firstText(row, ["title", "category"]) || "-",
        Priority: firstText(row, ["priority"]) || "-",
        Status: firstText(row, ["status"]) || "-",
        Cost: money(row.actual_cost ?? row.estimated_cost),
      };
    });
  }

  return rows.map((row) => {
    const resident = residents.find(
      (item) =>
        text(item.id) === firstText(row, ["resident_id"])
    );

    const room = rooms.find(
      (item) => text(item.id) === firstText(row, ["room_id"])
    );

    return {
      Resident: residentName(resident),
      Room: roomNumber(room),
      Date: dateText(row.inspection_date ?? row.created_at),
      "Before Photo": row.before_photo ? "Yes" : "No",
      "After Photo": row.after_photo ? "Yes" : "No",
      "Damage Notes": firstText(row, ["damage_notes"]) || "-",
    };
  });
}
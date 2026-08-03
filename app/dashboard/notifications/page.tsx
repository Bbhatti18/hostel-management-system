"use client";

import { useState } from "react";

type Notification = {
  id: number;
  title: string;
  message: string;
  category: string;
  date: string;
  read: boolean;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      title: "Monthly Rent Reminder",
      message: "Monthly rent invoices have been generated successfully.",
      category: "Billing",
      date: "Today",
      read: false,
    },
    {
      id: 2,
      title: "New Admission",
      message: "A new resident has been admitted to Room A-203.",
      category: "Admissions",
      date: "Today",
      read: false,
    },
    {
      id: 3,
      title: "Maintenance Request",
      message: "Room B-105 has a pending maintenance request.",
      category: "Maintenance",
      date: "Yesterday",
      read: true,
    },
    {
      id: 4,
      title: "Contract Expiring",
      message: "A resident contract will expire within 7 days.",
      category: "Contracts",
      date: "Yesterday",
      read: false,
    },
    {
      id: 5,
      title: "Payment Received",
      message: "Online payment received and awaiting verification.",
      category: "Payments",
      date: "2 Days Ago",
      read: true,
    },
  ]);

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  };

  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 p-6">

      <div className="mx-auto max-w-6xl space-y-6">

        <div className="rounded-3xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 p-8 text-white shadow-xl">

          <h1 className="text-3xl font-bold">
            Notification Center
          </h1>

          <p className="mt-2 text-blue-100">
            Stay updated with billing, payments, admissions,
            maintenance, inspections and resident activities.
          </p>

        </div>

        <div className="grid gap-6 md:grid-cols-4">

          <div className="rounded-2xl bg-white p-6 shadow-sm border">

            <p className="text-sm text-slate-500">
              Total Notifications
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              {notifications.length}
            </h2>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border">

            <p className="text-sm text-slate-500">
              Unread
            </p>

            <h2 className="mt-2 text-3xl font-bold text-red-600">
              {unreadCount}
            </h2>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border">

            <p className="text-sm text-slate-500">
              Read
            </p>

            <h2 className="mt-2 text-3xl font-bold text-green-600">
              {notifications.length - unreadCount}
            </h2>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border">

            <p className="text-sm text-slate-500">
              Status
            </p>

            <h2 className="mt-2 text-xl font-bold text-blue-600">
              Live Updates
            </h2>

          </div>

        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center justify-between">

            <div>

              <h2 className="text-2xl font-bold">
                Recent Notifications
              </h2>

              <p className="text-slate-500">
                Latest activities from your hostel management system.
              </p>

            </div>

            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              {unreadCount} Unread
            </span>

          </div>

          <div className="space-y-4">

            {notifications.map((item) => (

              <div
                key={item.id}
                className={`rounded-2xl border p-5 transition ${
                  item.read
                    ? "border-slate-200 bg-white"
                    : "border-blue-200 bg-blue-50"
                }`}
              >

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                  <div className="flex-1">

                    <div className="flex items-center gap-3">

                      <h3 className="text-lg font-bold">
                        {item.title}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                        {item.category}
                      </span>

                    </div>

                    <p className="mt-3 text-slate-600">
                      {item.message}
                    </p>

                    <p className="mt-3 text-sm text-slate-400">
                      {item.date}
                    </p>

                  </div>

                  <div className="flex items-center gap-3">

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.read
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.read ? "Read" : "Unread"}
                    </span>

                    {!item.read && (
                      <button
                        onClick={() => markAsRead(item.id)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Mark as Read
                      </button>
                    )}

                  </div>

                </div>

              </div>

            ))}

          </div>
          <div className="mt-8 border-t border-slate-200 pt-6">

            <div className="grid gap-5 md:grid-cols-3">

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

                <p className="text-sm font-medium text-blue-700">
                  Billing Alerts
                </p>

                <h3 className="mt-2 text-2xl font-bold text-blue-900">
                  {
                    notifications.filter(
                      (item) => item.category === "Billing"
                    ).length
                  }
                </h3>

                <p className="mt-2 text-sm text-blue-700">
                  Monthly rent and billing updates.
                </p>

              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

                <p className="text-sm font-medium text-emerald-700">
                  Payment Alerts
                </p>

                <h3 className="mt-2 text-2xl font-bold text-emerald-900">
                  {
                    notifications.filter(
                      (item) => item.category === "Payments"
                    ).length
                  }
                </h3>

                <p className="mt-2 text-sm text-emerald-700">
                  Online and manual payment updates.
                </p>

              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

                <p className="text-sm font-medium text-amber-700">
                  Maintenance Alerts
                </p>

                <h3 className="mt-2 text-2xl font-bold text-amber-900">
                  {
                    notifications.filter(
                      (item) => item.category === "Maintenance"
                    ).length
                  }
                </h3>

                <p className="mt-2 text-sm text-amber-700">
                  Pending maintenance and repair requests.
                </p>

              </div>

            </div>

          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-xl font-bold text-slate-900">
              Notification Categories
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Notifications available inside StayHub.
            </p>

            <div className="mt-6 space-y-4">

              {[
                "Billing",
                "Payments",
                "Admissions",
                "Maintenance",
                "Contracts",
              ].map((category) => {

                const total = notifications.filter(
                  (item) => item.category === category
                ).length;

                return (

                  <div
                    key={category}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
                  >

                    <span className="font-semibold text-slate-700">
                      {category}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                      {total}
                    </span>

                  </div>

                );

              })}

            </div>

          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-xl font-bold text-slate-900">
              Notification Statistics
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Current notification overview.
            </p>

            <div className="mt-6 space-y-5">

              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">

                <span className="font-medium text-slate-700">
                  Total Notifications
                </span>

                <span className="text-xl font-bold">
                  {notifications.length}
                </span>

              </div>

              <div className="flex items-center justify-between rounded-2xl bg-red-50 p-4">

                <span className="font-medium text-red-700">
                  Unread Notifications
                </span>

                <span className="text-xl font-bold text-red-700">
                  {unreadCount}
                </span>

              </div>

              <div className="flex items-center justify-between rounded-2xl bg-green-50 p-4">

                <span className="font-medium text-green-700">
                  Read Notifications
                </span>

                <span className="text-xl font-bold text-green-700">
                  {notifications.length - unreadCount}
                </span>

              </div>

            </div>

          </div>

        </div>

        <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">

          <h2 className="text-xl font-bold text-indigo-900">
            Notification Tips
          </h2>

          <ul className="mt-4 space-y-3 text-sm leading-6 text-indigo-800">

            <li>
              • Review unread notifications daily.
            </li>

            <li>
              • Verify payment notifications before approval.
            </li>

            <li>
              • Resolve maintenance requests as early as possible.
            </li>

            <li>
              • Monitor contract expiry reminders regularly.
            </li>

            <li>
              • Keep billing notifications up to date every month.
            </li>

          </ul>

        </div>

        <div className="mt-8 flex justify-end gap-4">

          <button
            type="button"
            className="rounded-xl border border-slate-300 px-6 py-3 font-medium hover:bg-slate-100"
          >
            Refresh
          </button>

          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Notification Settings
          </button>

        </div>
      </div>

    </main>
  );
}
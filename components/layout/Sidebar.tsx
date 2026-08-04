"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Residents", href: "/residents" },
  { name: "Rooms", href: "/rooms" },
  { name: "Beds", href: "/beds" },
  { name: "Admissions", href: "/admissions" },
  { name: "Contracts", href: "/contracts" },
  { name: "Billing", href: "/billing" },
  { name: "Payments", href: "/payments" },
  { name: "Inspections", href: "/inspection" },
  { name: "Maintenance", href: "/maintenance" },
  { name: "Notices", href: "/notices" },
  { name: "Reports", href: "/reports" },
  { name: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-3xl font-bold text-blue-400">StayHub</h1>
      <p className="mt-1 text-sm text-gray-400">Hostel Management</p>

      <nav className="mt-10 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg p-3 transition ${
              pathname === item.href ? "bg-blue-600" : "hover:bg-slate-800"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

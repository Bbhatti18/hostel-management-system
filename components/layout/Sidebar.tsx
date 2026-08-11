"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Admissions", href: "/admissions" },
  { name: "Residents", href: "/residents" },
  { name: "Rooms", href: "/rooms" },
  { name: "Beds", href: "/beds" },
  { name: "Payments", href: "/payments" },
  { name: "Billing", href: "/billing" },
  { name: "Contracts", href: "/contracts" },
  { name: "Inspections", href: "/inspection" },
  { name: "Maintenance", href: "/maintenance" },
  { name: "Notices", href: "/notices" },
  { name: "Reports", href: "/reports" },
  { name: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    const matchesRoute = pathname === href || pathname.startsWith(`${href}/`);

    if (href === "/payments") {
      return matchesRoute ||
        pathname === "/payment-verification" ||
        pathname.startsWith("/payment-verification/");
    }

    return matchesRoute;
  }

  return (
    <aside className="flex min-h-screen w-72 shrink-0 flex-col bg-slate-900 p-6 text-white">
      <Link
        href="/dashboard"
        className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
      >
        <h1 className="text-3xl font-bold text-blue-400">StayHub</h1>
        <p className="mt-1 text-sm text-gray-400">Hostel Management System</p>
      </Link>

      <nav className="mt-10 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg p-3 transition ${
              isActive(item.href) ? "bg-blue-600" : "hover:bg-slate-800"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

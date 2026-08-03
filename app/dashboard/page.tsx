import Sidebar from "@/components/layout/Sidebar";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-10">

          <header className="mb-8 flex items-center justify-between">

            <div>

              <h2 className="text-4xl font-bold">
                Welcome Back 👋
              </h2>

              <p className="mt-2 text-gray-600">
                StayHub Admin Dashboard
              </p>

            </div>

            <div className="flex items-center gap-4">

              <button className="rounded-xl border bg-white px-5 py-3 shadow hover:bg-gray-50">
                🔔 Notifications
              </button>

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white font-bold">
                A
              </div>

            </div>

          </header>

          <h3 className="mb-6 text-2xl font-semibold text-gray-800">
            Quick Actions
          </h3>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

            <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">👤</div>
              <h4 className="mt-4 text-xl font-bold">
                Add Resident
              </h4>
              <p className="mt-2 text-sm text-gray-500">
                Register a new resident.
              </p>
            </div>

            <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">🛏️</div>
              <h4 className="mt-4 text-xl font-bold">
                Assign Room
              </h4>
              <p className="mt-2 text-sm text-gray-500">
                Allocate room or bed.
              </p>
            </div>

            <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">💳</div>
              <h4 className="mt-4 text-xl font-bold">
                Generate Billing
              </h4>
              <p className="mt-2 text-sm text-gray-500">
                Generate monthly rent and electricity bills.
              </p>
            </div>

            <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">📄</div>
              <h4 className="mt-4 text-xl font-bold">
                Contracts
              </h4>
              <p className="mt-2 text-sm text-gray-500">
                Manage resident contracts.
              </p>
            </div>

          </div>
          {/* Bottom Section */}

          <div className="mt-10 grid gap-6 lg:grid-cols-2">

            {/* Today's Tasks */}

            <div className="rounded-2xl bg-white p-6 shadow-lg">

              <h3 className="text-xl font-bold">
                Today's Tasks
              </h3>

              <div className="mt-5 space-y-4">

                <div className="rounded-xl border p-4">
                  📄 Contracts waiting for signatures
                </div>

                <div className="rounded-xl border p-4">
                  💳 Generate monthly billing
                </div>

                <div className="rounded-xl border p-4">
                  🚪 Upcoming resident check-outs
                </div>

                <div className="rounded-xl border p-4">
                  🛠 Pending maintenance requests
                </div>

              </div>

            </div>

            {/* Recent Activity */}

            <div className="rounded-2xl bg-white p-6 shadow-lg">

              <h3 className="text-xl font-bold">
                Recent Activity
              </h3>

              <div className="mt-5 space-y-4">

                <div className="border-l-4 border-blue-600 pl-4">
                  Resident admission completed.
                </div>

                <div className="border-l-4 border-green-600 pl-4">
                  Monthly payment received.
                </div>

                <div className="border-l-4 border-purple-600 pl-4">
                  Contract uploaded.
                </div>

                <div className="border-l-4 border-orange-500 pl-4">
                  Room inspection completed.
                </div>

              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}
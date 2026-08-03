"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Resident = {
  id: number;
  full_name: string;
};

type Contract = {
  id: number;
  resident_id: number;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  contract_status: string;
  agreement_file: string | null;
  notes: string | null;
};

export default function EditContractPage() {
  const params = useParams();
  const router = useRouter();

  const contractId = params.id as string;

  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentId, setResidentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [contractStatus, setContractStatus] = useState("Active");
  const [notes, setNotes] = useState("");

  const [currentAgreement, setCurrentAgreement] =
    useState<string | null>(null);

  const [newAgreementFile, setNewAgreementFile] =
    useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (contractId) {
      loadPageData();
    }
  }, [contractId]);

  async function loadPageData() {
    setLoading(true);
    setMessage("");

    const {
      data: residentsData,
      error: residentsError,
    } = await supabase
      .from("residents")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (residentsError) {
      console.error("Residents loading error:", residentsError);
      setMessage("Failed to load residents.");
      setLoading(false);
      return;
    }

    setResidents((residentsData || []) as Resident[]);

    const {
      data: contractData,
      error: contractError,
    } = await supabase
      .from("contracts")
      .select(`
        id,
        resident_id,
        start_date,
        end_date,
        monthly_rent,
        security_deposit,
        contract_status,
        agreement_file,
        notes
      `)
      .eq("id", Number(contractId))
      .single();

    if (contractError || !contractData) {
      console.error("Contract loading error:", contractError);
      setMessage("Failed to load contract.");
      setLoading(false);
      return;
    }

    const contract = contractData as Contract;

    setResidentId(String(contract.resident_id));
    setStartDate(contract.start_date || "");
    setEndDate(contract.end_date || "");
    setMonthlyRent(String(contract.monthly_rent ?? ""));
    setSecurityDeposit(String(contract.security_deposit ?? ""));
    setContractStatus(contract.contract_status || "Active");
    setNotes(contract.notes || "");
    setCurrentAgreement(contract.agreement_file || null);

    setLoading(false);
  }

  async function uploadAgreement(file: File) {
    const safeFileName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");

    const filePath = `${contractId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("contract-agreements")
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("contract-agreements")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!residentId || !startDate || !endDate || !monthlyRent) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setMessage("End date must be later than start date.");
      return;
    }

    if (Number(monthlyRent) <= 0) {
      setMessage("Monthly rent must be greater than zero.");
      return;
    }

    if (securityDeposit && Number(securityDeposit) < 0) {
      setMessage("Security deposit cannot be negative.");
      return;
    }

    if (
      newAgreementFile &&
      newAgreementFile.type !== "application/pdf"
    ) {
      setMessage("Only PDF files are allowed.");
      return;
    }

    setSaving(true);

    let agreementUrl = currentAgreement;

    if (newAgreementFile) {
      try {
        agreementUrl = await uploadAgreement(newAgreementFile);
      } catch (uploadError) {
        console.error("Agreement upload error:", uploadError);
        setMessage("Failed to upload agreement file.");
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("contracts")
      .update({
        resident_id: Number(residentId),
        start_date: startDate,
        end_date: endDate,
        monthly_rent: Number(monthlyRent),
        security_deposit: securityDeposit
          ? Number(securityDeposit)
          : 0,
        contract_status: contractStatus,
        agreement_file: agreementUrl,
        notes: notes.trim() || null,
      })
      .eq("id", Number(contractId));

    if (updateError) {
      console.error("Contract update error:", updateError);
      setMessage("Failed to update contract.");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(`/contracts/${contractId}`);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p className="text-gray-600">Loading contract...</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Edit Contract
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Update contract ID: {contractId}
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Resident *
              </label>

              <select
                value={residentId}
                onChange={(event) =>
                  setResidentId(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Select Resident</option>

                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Start Date *
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                End Date *
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Monthly Rent *
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyRent}
                onChange={(event) =>
                  setMonthlyRent(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Security Deposit
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={securityDeposit}
                onChange={(event) =>
                  setSecurityDeposit(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Contract Status *
              </label>

              <select
                value={contractStatus}
                onChange={(event) =>
                  setContractStatus(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Replace Agreement PDF
              </label>

              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) =>
                  setNewAgreementFile(
                    event.target.files?.[0] || null
                  )
                }
                className="w-full rounded-lg border border-gray-300 p-2"
              />

              <p className="mt-1 text-xs text-gray-500">
                Leave empty to keep the current PDF.
              </p>
            </div>
          </div>

          {currentAgreement && (
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="mb-3 text-sm font-medium text-gray-700">
                Current Agreement
              </p>

              <a
                href={currentAgreement}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                View Current PDF
              </a>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Notes
            </label>

            <textarea
              rows={4}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Contract notes"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update Contract"}
            </button>

            <Link
              href={`/contracts/${contractId}`}
              className="rounded-lg bg-gray-200 px-5 py-2 font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
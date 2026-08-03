"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Contract = {
  id: number;
  resident_id: number;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  contract_status: string;
  agreement_file: string | null;
  resident_signature: string | null;
  notes: string | null;
  residents: {
    full_name: string;
  } | null;
};

export default function ViewContractPage() {
  const params = useParams();
  const contractId = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (contractId) {
      fetchContract();
    }
  }, [contractId]);

  async function fetchContract() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
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
        resident_signature,
        notes,
        residents (
          full_name
        )
      `)
      .eq("id", Number(contractId))
      .single();

    if (error) {
      console.error("Contract loading error:", error);
      setMessage("Failed to load contract.");
      setContract(null);
      setLoading(false);
      return;
    }

    setContract(data as unknown as Contract);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">
          Loading contract...
        </p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-6">
        <p className="mb-4 text-red-600">
          {message || "Contract not found."}
        </p>

        <Link
          href="/contracts"
          className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700"
        >
          Back to Contracts
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Contract Details
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Contract ID: {contract.id}
            </p>
          </div>

          <Link
            href={`/contracts/edit/${contract.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Edit Contract
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">
              Resident
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {contract.residents?.full_name || "-"}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">
              Status
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {contract.contract_status}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">
              Start Date
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {contract.start_date}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">
              End Date
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {contract.end_date}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">
              Monthly Rent
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {contract.monthly_rent}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">
              Security Deposit
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {contract.security_deposit}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border p-4">
          <p className="text-sm text-gray-500">
            Notes
          </p>

          <p className="mt-1 whitespace-pre-wrap text-gray-800">
            {contract.notes || "No notes available."}
          </p>
        </div>

        <div className="mt-5 rounded-lg border p-4">
          <p className="mb-3 text-sm text-gray-500">
            Agreement File
          </p>

          {contract.agreement_file ? (
            <a
              href={contract.agreement_file}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              View Agreement PDF
            </a>
          ) : (
            <p className="text-gray-600">
              No agreement file uploaded.
            </p>
          )}
        </div>
{contract?.resident_signature && (
  <div className="mt-5 rounded-lg border p-4">
    <p className="mb-3 text-sm text-gray-500">
      Resident Signature
    </p>

    <img
      src={contract.resident_signature}
      alt="Resident Signature"
      className="max-w-full rounded border"
    />
  </div>
)}
        <div className="mt-6">
          <Link
            href="/contracts"
            className="inline-block rounded-lg bg-gray-200 px-5 py-2 text-gray-700 hover:bg-gray-300"
          >
            Back to Contracts
          </Link>
        </div>
      </div>
    </div>
  );
}
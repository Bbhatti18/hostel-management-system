"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SignatureCanvas from "react-signature-canvas";
import { useRef } from "react";

type Resident = {
  id: number;
  full_name: string;
};
type ContractTemplate = {
  id: number;
  title: string;
  content: string;
};
export default function AddContractPage() {
  const router = useRouter();
const signatureRef = useRef<SignatureCanvas | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentId, setResidentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [contractStatus, setContractStatus] =
    useState("Active");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [activeTemplate, setActiveTemplate] =
  useState<ContractTemplate | null>(null);
  const [agreementFile, setAgreementFile] =
    useState<File | null>(null);

  const [loadingResidents, setLoadingResidents] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchResidents();
    fetchActiveTemplate();
  }, []);

  async function fetchResidents() {
    setLoadingResidents(true);
    setMessage("");

    const { data, error } = await supabase
      .from("residents")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Resident loading error:", error);
      setMessage("Failed to load residents.");
      setResidents([]);
      setLoadingResidents(false);
      return;
    }

    setResidents((data || []) as Resident[]);
    setLoadingResidents(false);
  }
async function fetchActiveTemplate() {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("id, title, content")
    .eq("is_active", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Template loading error:", error);
    setActiveTemplate(null);
    return;
  }

  console.log("Active template:", data);
  setActiveTemplate(data);
}
  async function uploadAgreement(
    file: File,
    contractId: number
  ) {
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

    const { data: urlData } = supabase.storage
      .from("contract-agreements")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }
async function uploadSignature(contractId: number) {
  if (!signatureRef.current) {
    return null;
  }

  if (signatureRef.current.isEmpty()) {
    return null;
  }

  const canvas = signatureRef.current.getCanvas();

  const signatureBlob = await new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(
              new Error(
                "Failed to create signature image."
              )
            );
          }
        },
        "image/png"
      );
    }
  );

  const filePath =
    `${contractId}/` +
    `${Date.now()}-resident-signature.png`;

  const { error: uploadError } =
    await supabase.storage
      .from("contract-signature")
      .upload(filePath, signatureBlob, {
        contentType: "image/png",
        upsert: false,
      });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } =
    supabase.storage
      .from("contract-signature")
      .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
if (!acceptedTerms) {
  setMessage("Please accept the Terms & Conditions.");
  return;
}
    if (
      !residentId ||
      !startDate ||
      !endDate ||
      !monthlyRent
    ) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setMessage(
        "End date must be later than start date."
      );
      return;
    }

    if (Number(monthlyRent) <= 0) {
      setMessage(
        "Monthly rent must be greater than zero."
      );
      return;
    }

    if (
      securityDeposit &&
      Number(securityDeposit) < 0
    ) {
      setMessage(
        "Security deposit cannot be negative."
      );
      return;
    }

    if (
      agreementFile &&
      agreementFile.type !== "application/pdf"
    ) {
      setMessage("Only PDF files are allowed.");
      return;
    }

    setSaving(true);

    const { data: contractData, error: contractError } =
      await supabase
        .from("contracts")
        .insert({
          resident_id: Number(residentId),
          start_date: startDate,
          end_date: endDate,
          monthly_rent: Number(monthlyRent),
          security_deposit: securityDeposit
            ? Number(securityDeposit)
            : 0,
          contract_status: contractStatus,
          agreement_file: null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

    if (contractError || !contractData) {
      console.error("Contract saving error:", contractError);
      setMessage("Failed to save contract.");
      setSaving(false);
      return;
    }
const signatureUrl = await uploadSignature(contractData.id);

if (signatureUrl) {
  const { error: signatureUpdateError } = await supabase
    .from("contracts")
    .update({
      resident_signature: signatureUrl,
    })
    .eq("id", contractData.id);

  if (signatureUpdateError) {
    console.error(
      "Signature saving error:",
      signatureUpdateError
    );

    setMessage(
      "Contract saved, but signature could not be saved."
    );

    setSaving(false);
    return;
  }
}
    if (agreementFile) {
      try {
        const agreementUrl = await uploadAgreement(
          agreementFile,
          contractData.id
        );

        const { error: updateError } = await supabase
          .from("contracts")
          .update({
            agreement_file: agreementUrl,
          })
          .eq("id", contractData.id);

        if (updateError) {
          throw updateError;
        }
      } catch (fileError) {
        console.error("Agreement upload error:", fileError);
        setMessage(
          "Contract saved, but agreement file could not be uploaded."
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push("/contracts");
    router.refresh();
  }

 return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Add Contract
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a new resident contract.
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
              <label className="mb-2 block text-sm font-medium">
                Resident *
              </label>

              <select
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                required
                disabled={loadingResidents}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="">
                  {loadingResidents
                    ? "Loading residents..."
                    : "Select Resident"}
                </option>

                {residents.map((resident) => (
                  <option
                    key={resident.id}
                    value={resident.id}
                  >
                    {resident.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Start Date *
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                End Date *
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Monthly Rent *
              </label>

              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Security Deposit
              </label>

              <input
                type="number"
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Status
              </label>

              <select
                value={contractStatus}
                onChange={(e) =>
                  setContractStatus(e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Agreement PDF
              </label>

              <input
                type="file"
                accept=".pdf"
                onChange={(e) =>
                  setAgreementFile(
                    e.target.files?.[0] || null
                  )
                }
                className="w-full rounded-lg border p-2"
              />
            </div>

          </div>
          {activeTemplate && (
  <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
    <h3 className="mb-3 text-lg font-semibold text-gray-800">
      {activeTemplate.title}
    </h3>

    <div className="whitespace-pre-wrap text-sm text-gray-700">
      {activeTemplate.content}
    </div>

    <label className="mt-4 flex items-start gap-3">
      <input
        type="checkbox"
        checked={acceptedTerms}
        onChange={(event) =>
          setAcceptedTerms(event.target.checked)
        }
        className="mt-1 h-4 w-4"
      />

      <span className="text-sm text-gray-700">
        I have read and accept all Terms & Conditions.
      </span>
    </label>
  </div>
)}
          <div>
            <div>
  <label className="mb-2 block text-sm font-medium text-gray-700">
    Resident Signature
  </label>

  <div className="rounded-lg border border-gray-300 bg-white">
    <SignatureCanvas
      ref={signatureRef}
      penColor="black"
      canvasProps={{
        width: 700,
        height: 200,
        className: "w-full",
      }}
    />
  </div>

  <button
    type="button"
    onClick={() => signatureRef.current?.clear()}
    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white"
  >
    Clear Signature
  </button>
</div>
            <label className="mb-2 block text-sm font-medium">
              Notes
            </label>

            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-white"
            >
              {saving ? "Saving..." : "Save Contract"}
            </button>

            <Link
              href="/contracts"
              className="rounded-lg bg-gray-300 px-5 py-2"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
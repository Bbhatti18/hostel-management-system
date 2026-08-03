"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MaintenanceRequest = {
  id: number;
  complaint_type: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  description: string | null;
  request_date: string;
  completion_date: string | null;
  maintenance_cost: number | null;
  residents: {
    full_name: string;
  } | null;
  rooms: {
    room_number: string;
  } | null;
};

type MaintenancePhoto = {
  id: number;
  photo_type: "Before" | "After";
  photo_url: string;
};

export default function MaintenanceViewPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [request, setRequest] =
    useState<MaintenanceRequest | null>(null);

  const [photos, setPhotos] =
    useState<MaintenancePhoto[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  async function fetchRequest() {
    setLoading(true);
    setMessage("");

    const { data: requestData, error: requestError } =
      await supabase
        .from("maintenance_requests")
        .select(`
          id,
          complaint_type,
          priority,
          status,
          assigned_to,
          description,
          request_date,
          completion_date,
          maintenance_cost,
          residents (
            full_name
          ),
          rooms (
            room_number
          )
        `)
        .eq("id", Number(id))
        .single();

    if (requestError || !requestData) {
      console.error(requestError);
      setMessage("Failed to load maintenance request.");
      setLoading(false);
      return;
    }

    const { data: photoData, error: photoError } =
      await supabase
        .from("maintenance_photos")
        .select("id, photo_type, photo_url")
        .eq("maintenance_id", Number(id))
        .order("id", { ascending: true });

    if (photoError) {
      console.error(photoError);
      setMessage(
        "Request loaded, but photos could not be loaded."
      );
    }

    setRequest(
      requestData as unknown as MaintenanceRequest
    );

    setPhotos(
      (photoData || []) as MaintenancePhoto[]
    );

    setLoading(false);
  }

  const beforePhotos = photos.filter(
    (photo) => photo.photo_type === "Before"
  );

  const afterPhotos = photos.filter(
    (photo) => photo.photo_type === "After"
  );

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">
          Loading maintenance request...
        </p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <p className="mb-4 text-red-600">
          {message || "Maintenance request not found."}
        </p>

        <Link
          href="/maintenance"
          className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700"
        >
          Back to Maintenance
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Maintenance Request Details
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Request ID: {request.id}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/maintenance/edit/${request.id}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Edit
            </Link>

            <Link
              href="/maintenance"
              className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
            >
              Back
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-lg bg-yellow-50 p-3 text-yellow-700">
            {message}
          </div>
        )}

        <div className="mb-6 rounded-xl bg-white p-6 shadow">
          <div className="grid gap-5 md:grid-cols-2">
            <Detail
              label="Resident"
              value={
                request.residents?.full_name || "-"
              }
            />

            <Detail
              label="Room"
              value={
                request.rooms?.room_number || "-"
              }
            />

            <Detail
              label="Complaint Type"
              value={request.complaint_type}
            />

            <Detail
              label="Priority"
              value={request.priority}
            />

            <Detail
              label="Status"
              value={request.status}
            />

            <Detail
              label="Assigned To"
              value={request.assigned_to || "-"}
            />

            <Detail
              label="Request Date"
              value={request.request_date || "-"}
            />

            <Detail
              label="Completion Date"
              value={request.completion_date || "-"}
            />

            <Detail
              label="Maintenance Cost"
              value={String(
                request.maintenance_cost ?? 0
              )}
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-gray-500">
              Description
            </p>

            <p className="mt-1 whitespace-pre-wrap text-gray-800">
              {request.description || "-"}
            </p>
          </div>
        </div>

        <PhotoSection
          title="Before Repair Photos"
          photos={beforePhotos}
        />

        <PhotoSection
          title="After Repair Photos"
          photos={afterPhotos}
        />
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-gray-800">
        {value}
      </p>
    </div>
  );
}

function PhotoSection({
  title,
  photos,
}: {
  title: string;
  photos: MaintenancePhoto[];
}) {
  return (
    <div className="mb-6 rounded-xl bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">
        {title}
      </h2>

      {photos.length === 0 ? (
        <p className="text-gray-500">
          No photos available.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.photo_url}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={photo.photo_url}
                alt={title}
                className="h-48 w-full rounded-lg border object-cover hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
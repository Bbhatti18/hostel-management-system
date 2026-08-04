"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AudienceType =
  | "All Residents"
  | "Specific Room"
  | "Specific Resident"
  | "Staff";

type PriorityType =
  | "Low"
  | "Normal"
  | "High"
  | "Urgent";

type StatusType =
  | "Active"
  | "Draft"
  | "Inactive";

type GenericRecord = {
  id: number;
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined;
};

const getTodayDate = () => {
  return new Date()
    .toISOString()
    .split("T")[0];
};

export default function AddNoticePage() {
  const router = useRouter();

  const [rooms, setRooms] =
    useState<GenericRecord[]>([]);

  const [residents, setResidents] =
    useState<GenericRecord[]>([]);

  const [staffMembers, setStaffMembers] =
    useState<GenericRecord[]>([]);

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [priority, setPriority] =
    useState<PriorityType>("Normal");

  const [audience, setAudience] =
    useState<AudienceType>("All Residents");

  const [roomId, setRoomId] =
    useState("");

  const [residentId, setResidentId] =
    useState("");

  const [staffId, setStaffId] =
    useState("");

  const [attachmentUrl, setAttachmentUrl] =
    useState("");

  const [publishDate, setPublishDate] =
    useState(getTodayDate());

  const [expiryDate, setExpiryDate] =
    useState("");

  const [pinned, setPinned] =
    useState(false);

  const [status, setStatus] =
    useState<StatusType>("Active");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const roomOptions = useMemo(() => {
    return rooms.map((room) => {
      const roomName =
        room.room_number ??
        room.room_name ??
        room.name ??
        room.id;

      return {
        value: room.id,
        label: `Room ${roomName}`,
      };
    });
  }, [rooms]);

  const residentOptions = useMemo(() => {
    return residents.map((resident) => {
      const combinedName = [
        resident.first_name,
        resident.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const name =
        resident.full_name ||
        resident.name ||
        combinedName ||
        `Resident ${resident.id}`;

      const phone = resident.phone
        ? ` - ${resident.phone}`
        : "";

      return {
        value: resident.id,
        label: `${name}${phone}`,
      };
    });
  }, [residents]);

  const staffOptions = useMemo(() => {
    return staffMembers.map((member) => {
      const combinedName = [
        member.first_name,
        member.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const name =
        member.full_name ||
        member.name ||
        combinedName ||
        `Staff ${member.id}`;

      const designation =
        member.designation ||
        member.role;

      return {
        value: member.id,
        label: designation
          ? `${name} - ${designation}`
          : String(name),
      };
    });
  }, [staffMembers]);

  const loadFormData = async () => {
    setLoading(true);
    setErrorMessage("");

    const [
      roomsResponse,
      residentsResponse,
      staffResponse,
    ] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .order("id", {
          ascending: true,
        }),

      supabase
        .from("residents")
        .select("*")
        .order("id", {
          ascending: true,
        }),

      supabase
        .from("staff")
        .select("*")
        .order("id", {
          ascending: true,
        }),
    ]);

    const firstError =
      roomsResponse.error ||
      residentsResponse.error ||
      staffResponse.error;

    if (firstError) {
      setErrorMessage(
        `Unable to load notice form data: ${firstError.message}`
      );

      setLoading(false);
      return;
    }

    setRooms(
      (roomsResponse.data ??
        []) as GenericRecord[]
    );

    setResidents(
      (residentsResponse.data ??
        []) as GenericRecord[]
    );

    setStaffMembers(
      (staffResponse.data ??
        []) as GenericRecord[]
    );

    setLoading(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadFormData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleAudienceChange = (
    value: AudienceType
  ) => {
    setAudience(value);
    setRoomId("");
    setResidentId("");
    setStaffId("");
    setErrorMessage("");
    setSuccessMessage("");
  };
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!title.trim()) {
      setErrorMessage(
        "Notice title is required."
      );
      return;
    }

    if (!description.trim()) {
      setErrorMessage(
        "Notice description is required."
      );
      return;
    }

    if (
      audience === "Specific Room" &&
      !roomId
    ) {
      setErrorMessage(
        "Please select a room."
      );
      return;
    }

    if (
      audience === "Specific Resident" &&
      !residentId
    ) {
      setErrorMessage(
        "Please select a resident."
      );
      return;
    }

    if (
      audience === "Staff" &&
      !staffId
    ) {
      setErrorMessage(
        "Please select a staff member."
      );
      return;
    }

    setSaving(true);

    const { error } =
      await supabase
        .from("notices")
        .insert({
          title: title.trim(),
          description:
            description.trim(),

          priority,

          audience,

          room_id:
            audience ===
            "Specific Room"
              ? Number(roomId)
              : null,

          resident_id:
            audience ===
            "Specific Resident"
              ? Number(residentId)
              : null,

          staff_id:
            audience === "Staff"
              ? Number(staffId)
              : null,

          attachment_url:
            attachmentUrl.trim() ||
            null,

          publish_date:
            publishDate,

          expiry_date:
            expiryDate || null,

          pinned,

          status,
        });

    if (error) {
      setErrorMessage(
        error.message
      );
      setSaving(false);
      return;
    }

    setSuccessMessage(
      "Notice created successfully."
    );

    setTimeout(() => {
      router.push(
        "/dashboard/notices"
      );
      router.refresh();
    }, 1200);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      <div className="mx-auto max-w-4xl">

        <div className="mb-6 flex items-center justify-between">

          <div>

            <h1 className="text-3xl font-bold">
              Add Notice
            </h1>

            <p className="mt-1 text-gray-600">
              Create a new hostel notice.
            </p>

          </div>

          <Link
            href="/dashboard/notices"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            Back
          </Link>

        </div>

        {errorMessage && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Enter notice title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>

              <textarea
                rows={6}
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Enter notice description"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Priority
              </label>

              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as PriorityType
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              >
                <option value="Low">
                  Low
                </option>

                <option value="Normal">
                  Normal
                </option>

                <option value="High">
                  High
                </option>

                <option value="Urgent">
                  Urgent
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Audience
              </label>

              <select
                value={audience}
                onChange={(event) =>
                  handleAudienceChange(
                    event.target.value as AudienceType
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              >
                <option value="All Residents">
                  All Residents
                </option>

                <option value="Specific Room">
                  Specific Room
                </option>

                <option value="Specific Resident">
                  Specific Resident
                </option>

                <option value="Staff">
                  Staff
                </option>
              </select>
            </div>

            {audience === "Specific Room" && (
              <div className="md:col-span-2">

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Select Room
                </label>

                <select
                  value={roomId}
                  onChange={(event) =>
                    setRoomId(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  required
                >
                  <option value="">
                    Select Room
                  </option>

                  {roomOptions.map((room) => (
                    <option
                      key={room.value}
                      value={room.value}
                    >
                      {room.label}
                    </option>
                  ))}

                </select>

              </div>
            )}

            {audience === "Specific Resident" && (
              <div className="md:col-span-2">

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Select Resident
                </label>

                <select
                  value={residentId}
                  onChange={(event) =>
                    setResidentId(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  required
                >
                  <option value="">
                    Select Resident
                  </option>

                  {residentOptions.map((resident) => (
                    <option
                      key={resident.value}
                      value={resident.value}
                    >
                      {resident.label}
                    </option>
                  ))}

                </select>

              </div>
            )}

            {audience === "Staff" && (
              <div className="md:col-span-2">

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Select Staff
                </label>

                <select
                  value={staffId}
                  onChange={(event) =>
                    setStaffId(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  required
                >
                  <option value="">
                    Select Staff
                  </option>

                  {staffOptions.map((member) => (
                    <option
                      key={member.value}
                      value={member.value}
                    >
                      {member.label}
                    </option>
                  ))}

                </select>

              </div>
            )}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Attachment URL
              </label>

              <input
                type="url"
                value={attachmentUrl}
                onChange={(event) =>
                  setAttachmentUrl(event.target.value)
                }
                placeholder="https://example.com/file.pdf"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              />
            </div>

          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Publish Date
              </label>

              <input
                type="date"
                value={publishDate}
                onChange={(event) =>
                  setPublishDate(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Expiry Date
              </label>

              <input
                type="date"
                value={expiryDate}
                onChange={(event) =>
                  setExpiryDate(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as StatusType
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              >
                <option value="Active">
                  Active
                </option>

                <option value="Draft">
                  Draft
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>
            </div>

            <div className="flex items-center pt-8">

              <input
                id="pinned"
                type="checkbox"
                checked={pinned}
                onChange={(event) =>
                  setPinned(
                    event.target.checked
                  )
                }
                className="mr-3 h-5 w-5"
              />

              <label
                htmlFor="pinned"
                className="text-sm font-medium text-gray-700"
              >
                Pin this Notice
              </label>

            </div>

          </div>

          <div className="mt-8 flex justify-end gap-3">

            <Link
              href="/dashboard/notices"
              className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium hover:bg-gray-100"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Notice"}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

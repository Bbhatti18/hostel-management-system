"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ContractTemplate = {
  id: number;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
};

export default function ContractTemplatePage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("contract_templates")
      .select(`
        id,
        title,
        content,
        is_active,
        created_at
      `)
      .order("id", { ascending: false });

    if (error) {
      console.error("Template loading error:", error);
      setTemplates([]);
      setMessage("Failed to load contract templates.");
      setLoading(false);
      return;
    }

    setTemplates((data || []) as ContractTemplate[]);
    setLoading(false);
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setIsActive(true);
    setEditingId(null);
    setMessage("");
  }

  function startEditing(template: ContractTemplate) {
    setEditingId(template.id);
    setTitle(template.title);
    setContent(template.content);
    setIsActive(template.is_active);
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!title.trim()) {
      setMessage("Please enter a template title.");
      return;
    }

    if (!content.trim()) {
      setMessage("Please enter contract rules and conditions.");
      return;
    }

    setSaving(true);

    if (isActive) {
      const { error: deactivateError } = await supabase
        .from("contract_templates")
        .update({
          is_active: false,
        })
        .neq("id", editingId ?? 0);

      if (deactivateError) {
        console.error(
          "Template deactivation error:",
          deactivateError
        );

        setMessage("Failed to update active template status.");
        setSaving(false);
        return;
      }
    }

    if (editingId) {
      const { error: updateError } = await supabase
        .from("contract_templates")
        .update({
          title: title.trim(),
          content: content.trim(),
          is_active: isActive,
        })
        .eq("id", editingId);

      if (updateError) {
        console.error("Template update error:", updateError);
        setMessage("Failed to update contract template.");
        setSaving(false);
        return;
      }

      setMessage("Contract template updated successfully.");
    } else {
      const { error: insertError } = await supabase
        .from("contract_templates")
        .insert({
          title: title.trim(),
          content: content.trim(),
          is_active: isActive,
        });

      if (insertError) {
        console.error("Template saving error:", insertError);
        setMessage("Failed to save contract template.");
        setSaving(false);
        return;
      }

      setMessage("Contract template saved successfully.");
    }

    setSaving(false);
    resetForm();
    await fetchTemplates();
  }

  async function activateTemplate(id: number) {
    const confirmed = confirm(
      "Make this the active contract template?"
    );

    if (!confirmed) return;
    setMessage("");

    const { error: deactivateError } = await supabase
      .from("contract_templates")
      .update({
        is_active: false,
      })
      .neq("id", id);

    if (deactivateError) {console.error(
      "Template deactivation error:",
      deactivateError
    );
    setMessage("Failed to update active template status.");
    return;
  }

  const { error: activateError } = await supabase
    .from("contract_templates")
    .update({
      is_active: true,
    })
    .eq("id", id);

  if (activateError) {
    console.error(
      "Template activation error:",
      activateError
    );
    setMessage("Failed to activate contract template.");
    return;
  }

  setMessage("Contract template activated successfully.");
  await fetchTemplates();
}
async function deleteTemplate(id: number) {
  const confirmed = confirm(
    "Delete this contract template?"
  );

  if (!confirmed) return;

  setMessage("");

  const { error } = await supabase
    .from("contract_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(
      "Template deletion error:",
      error
    );

    setMessage(
      "Failed to delete contract template."
    );

    return;
  }

  if (editingId === id) {
    resetForm();
  }

  setMessage(
    "Contract template deleted successfully."
  );

  await fetchTemplates();
}
return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Contract Templates
          </h1>

          <p className="mt-1 text-gray-600">
            Create and manage hostel contract templates.
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">
            {editingId ? "Edit Template" : "New Template"}
          </h2>
<form onSubmit={handleSubmit} className="space-y-4">
<div>
  <label className="mb-2 block text-sm font-medium text-gray-700">
    Template Title *
  </label>

  <input
    type="text"
    value={title}
    onChange={(event) => setTitle(event.target.value)}
    placeholder="Hostel Contract Rules"
    required
    className="w-full rounded-lg border border-gray-300 px-3 py-2"
  />
</div>
<div>
  <label className="mb-2 block text-sm font-medium text-gray-700">
    Contract Rules and Conditions *
  </label>

  <textarea
    value={content}
    onChange={(event) => setContent(event.target.value)}
    rows={12}
    placeholder="Write the complete hostel contract here..."
    required
    className="w-full rounded-lg border border-gray-300 px-3 py-2"
  />
</div>
<div className="flex gap-3">
  <button
    type="submit"
    disabled={saving}
    className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
  >
    {saving
      ? "Saving..."
      : editingId
      ? "Update Template"
      : "Save Template"}
  </button>

  {editingId && (
    <button
      type="button"
      onClick={resetForm}
      className="rounded-lg border border-gray-300 px-5 py-2 hover:bg-gray-100"
    >
      Cancel
    </button>
  )}
</div>
</form>
          </div>

        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Existing Templates
          </h2>

          <div className="space-y-3">
  {loading ? (
    <p className="text-gray-500">Loading templates...</p>
  ) : templates.length === 0 ? (
    <p className="text-gray-500">No contract templates found.</p>
  ) : (
    <div className="space-y-3">
  {templates.map((template) => (
    <div
      key={template.id}
      className="rounded-lg border border-gray-200 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">
            {template.title}
          </h3>

          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
            {template.content}
          </p>
        </div>

        <span
          className={
            template.is_active
              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
              : "rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
          }
        >
          {template.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
  <button
    type="button"
    onClick={() => startEditing(template)}
    className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
  >
    Edit
  </button>

  {!template.is_active && (
    <button
      type="button"
      onClick={() => activateTemplate(template.id)}
      className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
    >
      Make Active
    </button>
  )}

  <button
    type="button"
    onClick={() => deleteTemplate(template.id)}
    className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
  >
    Delete
  </button>
</div>
    </div>
  ))}
</div>
  )}
</div>
        </div>
      </div>
    </div>
  );
}
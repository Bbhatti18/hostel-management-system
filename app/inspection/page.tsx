/* eslint-disable @next/next/no-img-element -- Existing Supabase photo URLs are not restricted to a configured image host. */
"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabaseErrors";
import { safeStorageFileName, validateImageFile } from "@/lib/imageValidation";

type Row = Record<string, unknown>;
type Inspection = {
  id: string; resident_id: string | null; admission_id: string | null; room_id: string | null; bed_id: string | null;
  inspection_number: string | null; inspection_date: string; inspection_type: string | null;
  inspector_name: string | null; cleanliness: string | null; electrical_status: string | null;
  plumbing_status: string | null; furniture_condition: string | null; wall_floor_status: string | null;
  overall_status: string | null; notes: string | null; damage_found: boolean | null;
  damage_description: string | null; estimated_damage_cost: number | null; status: string | null;
  before_photos: unknown; after_photos: unknown; photos: unknown;
};
type LegacyInspection = { id: string; resident_id: string | null; room_id: string | null; inspection_date: string; before_photo: string | null; after_photo: string | null; damage_notes: string | null };
type FormState = { resident_id: string; admission_id: string; room_id: string; inspection_date: string; inspector_name: string; cleanliness: string; electrical_status: string; plumbing_status: string; furniture_condition: string; wall_floor_status: string; overall_status: string; notes: string; damage_found: boolean; damage_description: string; estimated_damage_cost: string };

const emptyForm: FormState = { resident_id: "", admission_id: "", room_id: "", inspection_date: new Date().toISOString().slice(0, 10), inspector_name: "", cleanliness: "", electrical_status: "", plumbing_status: "", furniture_condition: "", wall_floor_status: "", overall_status: "", notes: "", damage_found: false, damage_description: "", estimated_damage_cost: "0" };
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100";
const text = (value: unknown) => value == null ? "" : String(value);
const normalized = (value: unknown) => text(value).trim().toLowerCase();
const display = (row: Row | undefined, keys: string[], fallback = "—") => keys.map((key) => text(row?.[key]).trim()).find(Boolean) || fallback;
const photoList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

export default function InspectionPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [legacy, setLegacy] = useState<LegacyInspection[]>([]);
  const [residents, setResidents] = useState<Row[]>([]);
  const [rooms, setRooms] = useState<Row[]>([]);
  const [beds, setBeds] = useState<Row[]>([]);
  const [admissions, setAdmissions] = useState<Row[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Inspection | null>(null);
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [selectedView, setSelectedView] = useState<Inspection | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [residentFilter, setResidentFilter] = useState("All");
  const [roomFilter, setRoomFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    const [inspectionResult, legacyResult, residentResult, roomResult, admissionResult, bedResult] = await Promise.all([
      supabase.from("room_inspections").select("*").order("inspection_date", { ascending: false }),
      supabase.from("inspections").select("id,resident_id,room_id,inspection_date,before_photo,after_photo,damage_notes").order("inspection_date", { ascending: false }),
      supabase.from("residents").select("*").order("created_at", { ascending: true }),
      supabase.from("rooms").select("*").order("room_number", { ascending: true }),
      supabase.from("admissions").select("*").order("created_at", { ascending: false }),
      supabase.from("beds").select("id,bed_number,room_id"),
    ]);
    const failed = inspectionResult.error || legacyResult.error || residentResult.error || roomResult.error || admissionResult.error || bedResult.error;
    if (failed) setError(getSupabaseErrorMessage(failed, "Inspection records could not be loaded. Please refresh and try again."));
    else {
      setInspections((inspectionResult.data ?? []) as Inspection[]);
      setLegacy((legacyResult.data ?? []) as LegacyInspection[]);
      setResidents((residentResult.data ?? []) as Row[]); setRooms((roomResult.data ?? []) as Row[]); setAdmissions((admissionResult.data ?? []) as Row[]);
      setBeds((bedResult.data ?? []) as Row[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const selectableResidents = residents.filter((resident) => normalized(resident.status) !== "archived");
  const residentAdmissions = admissions.filter((admission) => text(admission.resident_id) === form.resident_id && !["cancelled", "archived"].includes(normalized(admission.status)));
  const filtered = useMemo(() => inspections.filter((inspection) => {
    const resident = residents.find((row) => text(row.id) === inspection.resident_id);
    const room = rooms.find((row) => text(row.id) === inspection.room_id);
    const haystack = [inspection.inspection_number, inspection.inspection_date, inspection.inspection_type, inspection.inspector_name, display(resident, ["full_name", "name"]), display(room, ["room_number", "name"])].join(" ").toLowerCase();
    return (!search.trim() || haystack.includes(search.trim().toLowerCase())) &&
      (statusFilter === "All" || inspection.status === statusFilter) &&
      (residentFilter === "All" || inspection.resident_id === residentFilter) &&
      (roomFilter === "All" || inspection.room_id === roomFilter) &&
      (typeFilter === "All" || inspection.inspection_type === typeFilter) &&
      (!dateFilter || inspection.inspection_date === dateFilter);
  }), [dateFilter, inspections, residentFilter, residents, roomFilter, rooms, search, statusFilter, typeFilter]);

  function reset() { setForm(emptyForm); setEditing(null); setBeforeFiles([]); setAfterFiles([]); setEvidenceFiles([]); }
  function openEdit(item: Inspection) {
    setEditing(item); setForm({ resident_id: item.resident_id ?? "", admission_id: item.admission_id ?? "", room_id: item.room_id ?? "", inspection_date: item.inspection_date, inspector_name: item.inspector_name ?? "", cleanliness: item.cleanliness ?? "", electrical_status: item.electrical_status ?? "", plumbing_status: item.plumbing_status ?? "", furniture_condition: item.furniture_condition ?? "", wall_floor_status: item.wall_floor_status ?? "", overall_status: item.overall_status ?? "", notes: item.notes ?? "", damage_found: Boolean(item.damage_found), damage_description: item.damage_description ?? "", estimated_damage_cost: String(item.estimated_damage_cost ?? 0) });
    setBeforeFiles([]); setAfterFiles([]); setEvidenceFiles([]); setShowForm(true); setMessage(""); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function chooseFiles(event: ChangeEvent<HTMLInputElement>, kind: "before" | "after" | "evidence") {
    const files = Array.from(event.target.files ?? []);
    const invalid = files.map(validateImageFile).find(Boolean);
    if (invalid) { setError(invalid); event.target.value = ""; return; }
    if (kind === "before") setBeforeFiles(files); else if (kind === "after") setAfterFiles(files); else setEvidenceFiles(files);
    setError("");
  }
  async function upload(files: File[], id: string, kind: "before" | "after" | "evidence") {
    const urls: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      setUploading(`Uploading ${kind} photo ${index + 1} of ${files.length}...`);
      const path = `${id}/${kind}/${Date.now()}-${index}-${safeStorageFileName(files[index])}`;
      const result = await supabase.storage.from("room-inspection-photos").upload(path, files[index], { cacheControl: "3600", upsert: false });
      if (result.error) throw new Error("PHOTO_UPLOAD");
      urls.push(supabase.storage.from("room-inspection-photos").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      if (!form.resident_id || !form.admission_id || !form.room_id || !form.inspection_date) throw new Error("REQUIRED");
      const residentResult = await supabase.from("residents").select("id,status").eq("id", form.resident_id).maybeSingle();
      if (residentResult.error || !residentResult.data || (!editing && normalized(residentResult.data.status) === "archived")) throw new Error("RESIDENT");
      const admissionResult = await supabase.from("admissions").select("id,resident_id,room_id,bed_id,status").eq("id", form.admission_id).maybeSingle();
      if (admissionResult.error || !admissionResult.data || text(admissionResult.data.resident_id) !== form.resident_id || text(admissionResult.data.room_id) !== form.room_id) throw new Error("ADMISSION");
      if (editing) {
        const current = await supabase.from("room_inspections").select("id,before_photos,after_photos,photos").eq("id", editing.id).maybeSingle();
        if (current.error || !current.data) throw new Error("STALE");
      }
      const selectedAdmission = admissionResult.data as Row;
      const payload = { resident_id: form.resident_id, admission_id: form.admission_id, room_id: form.room_id, bed_id: text(selectedAdmission.bed_id) || editing?.bed_id || null, inspection_date: form.inspection_date, inspection_type: editing?.inspection_type || "Check In", inspector_name: form.inspector_name.trim() || null, cleanliness: form.cleanliness.trim() || null, electrical_status: form.electrical_status.trim() || null, plumbing_status: form.plumbing_status.trim() || null, furniture_condition: form.furniture_condition.trim() || null, wall_floor_status: form.wall_floor_status.trim() || null, overall_status: form.overall_status.trim() || null, notes: form.notes.trim() || null, damage_found: form.damage_found, damage_description: form.damage_found ? form.damage_description.trim() || null : null, estimated_damage_cost: Number(form.estimated_damage_cost) || 0, status: editing?.status || "Completed", updated_at: new Date().toISOString() };
      const result = editing ? await supabase.from("room_inspections").update(payload).eq("id", editing.id).select("*").single() : await supabase.from("room_inspections").insert({ ...payload, inspection_number: `INS-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}` }).select("*").single();
      if (result.error || !result.data) throw new Error("DATABASE");
      const saved = result.data as Inspection;
      let before = photoList(saved.before_photos); let after = photoList(saved.after_photos); let evidence = photoList(saved.photos);
      try { before = [...before, ...(await upload(beforeFiles, saved.id, "before"))]; after = [...after, ...(await upload(afterFiles, saved.id, "after"))]; evidence = [...evidence, ...(await upload(evidenceFiles, saved.id, "evidence"))]; }
      catch { setError("The inspection was saved, but one or more photos could not be uploaded. Please edit the inspection and try again."); await refresh(); return; }
      if (beforeFiles.length || afterFiles.length || evidenceFiles.length) {
        const linked = await supabase.from("room_inspections").update({ before_photos: before, after_photos: after, photos: evidence, updated_at: new Date().toISOString() }).eq("id", saved.id);
        if (linked.error) { setError("The inspection and photos were saved, but the photo links could not be attached. Please refresh and try again."); await refresh(); return; }
      }
      setMessage(editing ? "Inspection updated successfully." : "Inspection recorded successfully."); reset(); setShowForm(false); await refresh();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      const messages: Record<string, string> = { REQUIRED: "Resident, admission, room, and inspection date are required.", RESIDENT: "The selected resident is no longer available for this inspection.", ADMISSION: "The selected admission, resident, and room no longer match.", STALE: "This inspection no longer exists. Please refresh and try again.", PHOTO_UPLOAD: "One or more inspection photos could not be uploaded.", DATABASE: "The inspection could not be saved. Please review the form and try again." };
      setError(messages[code] || "The inspection could not be saved. Please try again.");
    } finally { setUploading(""); setSaving(false); }
  }

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">StayHub</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Room Inspections</h1><p className="mt-1 text-sm text-slate-500">Record room condition, damage, costs, and inspection photos.</p></div><button type="button" onClick={() => { reset(); setShowForm(true); setError(""); setMessage(""); }} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">+ New Inspection</button></section>
    {(message || error) && <section className={`rounded-2xl border px-4 py-3 text-sm font-medium ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</section>}
    {showForm && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{editing ? "Edit Inspection" : "New Inspection"}</h2><button type="button" onClick={() => { reset(); setShowForm(false); }} className="rounded-lg border px-3 py-2 text-sm">Close</button></div><form onSubmit={save} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Resident *"><select required value={form.resident_id} onChange={(e) => setForm({ ...form, resident_id: e.target.value, admission_id: "", room_id: "" })} className={inputClass}><option value="">Select resident</option>{(editing && residents.find((r) => text(r.id) === form.resident_id) ? residents.filter((r) => text(r.id) === form.resident_id || normalized(r.status) !== "archived") : selectableResidents).map((r) => <option key={text(r.id)} value={text(r.id)}>{display(r, ["full_name", "name"])}</option>)}</select></Field>
      <Field label="Admission *"><select required value={form.admission_id} onChange={(e) => { const a = admissions.find((row) => text(row.id) === e.target.value); setForm({ ...form, admission_id: e.target.value, room_id: text(a?.room_id) }); }} className={inputClass}><option value="">Select admission</option>{(editing && admissions.find((a) => text(a.id) === form.admission_id) ? admissions.filter((a) => text(a.id) === form.admission_id || (text(a.resident_id) === form.resident_id && !["cancelled", "archived"].includes(normalized(a.status)))) : residentAdmissions).map((a) => <option key={text(a.id)} value={text(a.id)}>{display(a, ["admission_number", "admission_code"], text(a.id))} · {display(rooms.find((r) => text(r.id) === text(a.room_id)), ["room_number", "name"])}</option>)}</select></Field>
      <Field label="Room *"><select required disabled value={form.room_id} className={inputClass}><option value="">Selected from admission</option>{rooms.map((r) => <option key={text(r.id)} value={text(r.id)}>{display(r, ["room_number", "name"])}</option>)}</select></Field>
      <Field label="Inspection Date *"><input required type="date" value={form.inspection_date} onChange={(e) => setForm({ ...form, inspection_date: e.target.value })} className={inputClass}/></Field>
      <Field label="Inspection Type"><input value={editing?.inspection_type || "Check In"} disabled className={inputClass}/></Field>
      <Field label="Inspector"><input value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} className={inputClass}/></Field>
      {(["cleanliness", "electrical_status", "plumbing_status", "furniture_condition", "wall_floor_status", "overall_status"] as const).map((key) => <Field key={key} label={key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}><input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass}/></Field>)}
      <Field label="Damage Found"><select value={form.damage_found ? "Yes" : "No"} onChange={(e) => setForm({ ...form, damage_found: e.target.value === "Yes" })} className={inputClass}><option>No</option><option>Yes</option></select></Field>
      <Field label="Estimated Damage Cost"><input type="number" min="0" value={form.estimated_damage_cost} onChange={(e) => setForm({ ...form, estimated_damage_cost: e.target.value })} className={inputClass}/></Field>
      <Field label="Before Photos"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFiles(e, "before")} className={inputClass}/></Field>
      <Field label="After Photos"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFiles(e, "after")} className={inputClass}/></Field>
      <Field label="Additional Evidence Photos"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFiles(e, "evidence")} className={inputClass}/></Field>
      <Field label="Damage Description" wide><textarea value={form.damage_description} onChange={(e) => setForm({ ...form, damage_description: e.target.value })} disabled={!form.damage_found} className={`${inputClass} min-h-24`}/></Field>
      <Field label="Notes" wide><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputClass} min-h-24`}/></Field>
      {editing && <div className="md:col-span-2 xl:col-span-3"><PhotoLinks title="Existing before photos" urls={photoList(editing.before_photos)}/><PhotoLinks title="Existing after photos" urls={photoList(editing.after_photos)}/><PhotoLinks title="Existing evidence photos" urls={photoList(editing.photos)}/></div>}
      <div className="md:col-span-2 xl:col-span-3"><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{uploading || (saving ? "Saving..." : editing ? "Update Inspection" : "Save Inspection")}</button></div>
    </form></section>}
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:hidden"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inspections" className={inputClass}/><select value={residentFilter} onChange={(e) => setResidentFilter(e.target.value)} className={inputClass}><option value="All">All Residents</option>{residents.map((r) => <option key={text(r.id)} value={text(r.id)}>{display(r, ["full_name", "name"])}</option>)}</select><select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className={inputClass}><option value="All">All Rooms</option>{rooms.map((r) => <option key={text(r.id)} value={text(r.id)}>{display(r, ["room_number", "name"])}</option>)}</select><input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inputClass}/><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputClass}><option value="All">All Types</option>{Array.from(new Set(inspections.map((item) => item.inspection_type).filter(Boolean))).map((type) => <option key={type!} value={type!}>{type}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}><option value="All">All Statuses</option>{Array.from(new Set(inspections.map((item) => item.status).filter(Boolean))).map((status) => <option key={status!} value={status!}>{status}</option>)}</select></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b text-xs uppercase text-slate-500">{["Inspection", "Resident / Room", "Date / Type", "Condition", "Damage", "Photos", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={8} className="p-8 text-center">Loading inspections...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">No inspections found.</td></tr> : filtered.map((item) => { const resident = residents.find((r) => text(r.id) === item.resident_id); const room = rooms.find((r) => text(r.id) === item.room_id); return <tr key={item.id} className="border-b border-slate-100"><td className="px-4 py-4 font-semibold">{item.inspection_number || item.id}</td><td className="px-4 py-4">{display(resident, ["full_name", "name"])}<div className="text-xs text-slate-500">Room {display(room, ["room_number", "name"])}</div></td><td className="px-4 py-4">{item.inspection_date}<div className="text-xs text-slate-500">{item.inspection_type || "—"}</div></td><td className="px-4 py-4">{item.overall_status || "—"}</td><td className="px-4 py-4">{item.damage_found ? `Yes · Rs ${Number(item.estimated_damage_cost || 0).toLocaleString()}` : "No"}</td><td className="px-4 py-4">{photoList(item.before_photos).length + photoList(item.after_photos).length + photoList(item.photos).length}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{item.status || "Completed"}</span></td><td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={() => setSelectedView(item)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">View</button><button type="button" onClick={() => openEdit(item)} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700">Edit</button></div></td></tr>; })}</tbody></table></div></section>
    {selectedView && <InspectionView inspection={selectedView} resident={residents.find((r) => text(r.id) === selectedView.resident_id)} room={rooms.find((r) => text(r.id) === selectedView.room_id)} bed={beds.find((r) => text(r.id) === selectedView.bed_id)} onClose={() => setSelectedView(null)}/>}
    {legacy.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:hidden"><h2 className="text-xl font-bold">Legacy Inspection History</h2><p className="mt-1 text-sm text-slate-500">Preserved read-only records from the earlier inspection workflow.</p><div className="mt-4 space-y-3">{legacy.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-4 text-sm"><strong>{item.inspection_date}</strong> · {display(residents.find((r) => text(r.id) === item.resident_id), ["full_name", "name"])} · Room {display(rooms.find((r) => text(r.id) === item.room_id), ["room_number", "name"])}{item.damage_notes && <p className="mt-2 text-slate-600">{item.damage_notes}</p>}<PhotoLinks title="Photos" urls={[item.before_photo, item.after_photo].filter((url): url is string => Boolean(url))}/></article>)}</div></section>}
  </div></main>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "md:col-span-2 xl:col-span-3" : ""}><span className="mb-2 block text-sm font-semibold capitalize text-slate-700">{label}</span>{children}</label>; }
function PhotoLinks({ title, urls }: { title: string; urls: string[] }) { if (!urls.length) return null; return <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-500">{title}:</span>{urls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-indigo-700">Photo {index + 1}</a>)}</div>; }
function InspectionView({ inspection, resident, room, bed, onClose }: { inspection: Inspection; resident?: Row; room?: Row; bed?: Row; onClose: () => void }) {
  const galleries = [{ label: "Before Photos", urls: photoList(inspection.before_photos) }, { label: "After Photos", urls: photoList(inspection.after_photos) }, { label: "Additional Evidence", urls: photoList(inspection.photos) }];
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:fixed print:inset-0 print:z-50 print:overflow-auto print:border-0 print:shadow-none"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">StayHub Inspection Report</p><h2 className="mt-2 text-2xl font-bold">{inspection.inspection_number || "Inspection"}</h2></div><div className="flex gap-2 print:hidden"><button type="button" onClick={() => window.print()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Print</button><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-semibold">Close</button></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReportItem label="Resident" value={display(resident, ["full_name", "name"])}/><ReportItem label="Room" value={display(room, ["room_number", "name"])}/><ReportItem label="Bed" value={display(bed, ["bed_number", "name"])}/><ReportItem label="Inspector" value={inspection.inspector_name || "—"}/><ReportItem label="Date" value={inspection.inspection_date}/><ReportItem label="Type" value={inspection.inspection_type || "—"}/><ReportItem label="Condition" value={inspection.overall_status || "—"}/><ReportItem label="Estimated Damage Cost" value={`Rs ${Number(inspection.estimated_damage_cost || 0).toLocaleString()}`}/></div><div className="mt-5 grid gap-4 md:grid-cols-2"><ReportText label="Condition Notes" value={inspection.notes || "No condition notes recorded."}/><ReportText label="Damage Notes" value={inspection.damage_description || "No damage recorded."}/></div>{galleries.map((gallery) => gallery.urls.length > 0 && <div key={gallery.label} className="mt-6"><h3 className="font-bold">{gallery.label}</h3><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{gallery.urls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${gallery.label} ${index + 1}`} className="h-40 w-full rounded-xl border object-cover"/></a>)}</div></div>)}</section>;
}
function ReportItem({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function ReportText({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-4"><h3 className="font-bold">{label}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{value}</p></div>; }

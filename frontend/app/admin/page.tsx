"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  UserPlus, CalendarDays, ClipboardList, LogOut, Menu,
  RefreshCw, Stethoscope, Building2, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, CheckCircle2, X, BanIcon, Eye, Search
} from "lucide-react";

type Doctor = { id: number; name: string; department: string; qualification?: string; experience_years?: number; available: boolean; hospital_name?: string; hospital_lat?: number; hospital_lng?: number; };
type Appointment = { id: number; patient_name: string; doctor_name: string; input_text: string; predicted_department: string; appointment_date: string; appointment_time: string; status: string; is_correct: boolean | null; corrected_department: string | null; };
type DoctorForm = { name: string; department: string; qualification: string; experience_years: string; profile_image: string; hospital_name: string; hospital_lat: string; hospital_lng: string; };
type Tab = "doctors" | "availability" | "appointments";

const emptyForm: DoctorForm = { name: "", department: "", qualification: "", experience_years: "", profile_image: "", hospital_name: "", hospital_lat: "", hospital_lng: "" };

const PRESET_TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
});

const TIME_PERIODS = [
  { label: "Early Morning", range: [0, 6] },
  { label: "Morning",       range: [6, 12] },
  { label: "Afternoon",     range: [12, 17] },
  { label: "Evening",       range: [17, 21] },
  { label: "Night",         range: [21, 24] },
] as const;

const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h < 12 ? "AM" : "PM"}`; };

const statusConfig: Record<string, { cls: string; label: string }> = {
  confirmed:      { cls: "bg-emerald-100 text-emerald-700", label: "Confirmed" },
  pending_review: { cls: "bg-amber-100 text-amber-700",     label: "Pending Review" },
  review:         { cls: "bg-yellow-100 text-yellow-700",   label: "Needs Review" },
};

const NAV_ITEMS: { key: Tab; label: string; Icon: React.ElementType }[] = [
  { key: "doctors",      label: "Doctors",      Icon: Stethoscope },
  { key: "availability", label: "Availability", Icon: CalendarDays },
  { key: "appointments", label: "Appointments", Icon: ClipboardList },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("doctors");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorForm, setDoctorForm] = useState<DoctorForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [doctorMsg, setDoctorMsg] = useState("");
  const [adminHospital, setAdminHospital] = useState("");
  const [adminLat, setAdminLat] = useState<number | null>(null);
  const [adminLng, setAdminLng] = useState<number | null>(null);

  const [slotDoctorId, setSlotDoctorId] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [activePeriod, setActivePeriod] = useState<string>("Morning");
  const [calendarMonth, setCalendarMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [slotMsg, setSlotMsg] = useState("");
  const [slotSubmitting, setSlotSubmitting] = useState(false);
  const [viewSlotsForDoctor, setViewSlotsForDoctor] = useState<number | null>(null);
  const [existingSlots, setExistingSlots] = useState<{ id: number; available_date: string; available_time: string; is_booked: boolean }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [correctionMap, setCorrectionMap] = useState<Record<number, string>>({});

  // Appointment filters
  const [apptSearch, setApptSearch] = useState("");
  const [apptStatus, setApptStatus] = useState("all");
  const [apptDoctor, setApptDoctor] = useState("all");
  const [apptSort, setApptSort] = useState("date-desc");

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchDoctors(); fetchAppointments();
    api.get("/admin/me").then((res) => {
      setAdminHospital(res.data.hospital_name ?? "");
      setAdminLat(res.data.hospital_lat ?? null);
      setAdminLng(res.data.hospital_lng ?? null);
      setDoctorForm((p) => ({ ...p, hospital_name: res.data.hospital_name ?? "" }));
    }).catch(() => {});
  }, []);

  const fetchDoctors = async () => { try { const r = await api.get("/admin/doctors"); setDoctors(r.data); } catch {} };
  const fetchAppointments = async () => { try { const r = await api.get("/admin/appointments"); setAppointments(r.data); } catch {} };

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setDoctorMsg("");
    const payload = { ...doctorForm, experience_years: doctorForm.experience_years ? Number(doctorForm.experience_years) : null, hospital_lat: adminLat, hospital_lng: adminLng };
    try {
      editingId !== null ? await api.put(`/admin/doctors/${editingId}`, payload) : await api.post("/admin/doctors", payload);
      setDoctorMsg(editingId !== null ? "Doctor updated." : "Doctor created.");
      setDoctorForm({ ...emptyForm, hospital_name: adminHospital });
      setEditingId(null); fetchDoctors();
    } catch (err: any) { setDoctorMsg(err.response?.data?.detail || "Operation failed"); }
  };

  const handleEdit = (doc: Doctor) => {
    setEditingId(doc.id);
    setDoctorForm({ name: doc.name, department: doc.department, qualification: doc.qualification ?? "", experience_years: doc.experience_years?.toString() ?? "", profile_image: "", hospital_name: adminHospital, hospital_lat: "", hospital_lng: "" });
    setDoctorMsg("");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this doctor?")) return;
    try { await api.delete(`/admin/doctors/${id}`); fetchDoctors(); }
    catch (err: any) { alert(err.response?.data?.detail || "Delete failed"); }
  };

  const handleSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSlotMsg("");
    if (!slotDoctorId || selectedDates.length === 0 || timeSlots.length === 0) {
      setSlotMsg("Select a doctor, at least one date, and at least one time."); return;
    }
    setSlotSubmitting(true);
    const combos = selectedDates.flatMap(d => timeSlots.map(t => ({ doctor_id: Number(slotDoctorId), available_date: d, available_time: t })));
    let ok = 0, skip = 0;
    for (const s of combos) { try { await api.post("/admin/availability", s); ok++; } catch { skip++; } }
    setSlotSubmitting(false);
    setSlotMsg(`${ok} slot(s) added.${skip > 0 ? ` ${skip} skipped (already exist).` : ""}`);
    setSelectedDates([]); setTimeSlots([]); setSlotDoctorId("");
    if (viewSlotsForDoctor !== null) fetchExistingSlots(viewSlotsForDoctor);
  };

  const fetchExistingSlots = async (doctorId: number) => {
    setSlotsLoading(true);
    try {
      const r = await api.get(`/admin/doctors/${doctorId}/slots`);
      setExistingSlots(r.data);
    } catch {}
    setSlotsLoading(false);
  };

  const handleViewSlots = (doctorId: number) => {
    if (viewSlotsForDoctor === doctorId) { setViewSlotsForDoctor(null); setExistingSlots([]); return; }
    setViewSlotsForDoctor(doctorId);
    fetchExistingSlots(doctorId);
  };

  const handleToggleAvailabilityFromTab = async (doc: Doctor) => {
    try {
      const res = await api.patch(`/admin/doctors/${doc.id}/availability`);
      setDoctors(p => p.map(d => d.id === doc.id ? { ...d, available: res.data.available } : d));
    } catch {}
  };

  const handleFeedback = async (id: number, isCorrect: boolean) => {
    const corrected = isCorrect ? undefined : correctionMap[id];
    if (!isCorrect && !corrected) { alert("Enter the correct department first."); return; }
    try {
      await api.post(`/admin/appointments/${id}/feedback`, { is_correct: isCorrect, corrected_department: corrected ?? null });
      setAppointments((p) => p.map((a) => a.id === id ? { ...a, is_correct: isCorrect, corrected_department: corrected ?? null, status: isCorrect ? "confirmed" : "review" } : a));
    } catch (err: any) { alert(err.response?.data?.detail || "Feedback failed"); }
  };

  const calYear = calendarMonth.getFullYear(), calMon = calendarMonth.getMonth();
  const firstDay = new Date(calYear, calMon, 1).getDay();
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const calCells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (calCells.length % 7 !== 0) calCells.push(null);

  const pendingCount = appointments.filter(a => a.status === "pending_review").length;
  const emergencyCount = appointments.filter(a => a.predicted_department?.toLowerCase() === "emergency").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">S</div>
            <span className="font-bold text-gray-900 text-base hidden sm:block">SmartCare</span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 bg-gray-100 px-4 py-2 rounded-full hidden sm:block font-semibold"><Building2 className="w-4 h-4 inline-block" /> {adminHospital || "Admin"}</span>
          <button onClick={() => { localStorage.removeItem("token"); router.push("/login"); }}
            className="text-xs text-gray-500 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed md:sticky top-0 md:top-[57px] left-0 h-full md:h-[calc(100vh-57px)] w-64 bg-white border-r border-gray-200 z-20 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">A</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Admin Dashboard</p>
                <p className="text-xs text-gray-400 truncate max-w-[140px]">{adminHospital || "Hospital"}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button key={item.key} onClick={() => { setTab(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === item.key ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}>
                <item.Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {item.key === "appointments" && (emergencyCount > 0 || pendingCount > 0) && (
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${emergencyCount > 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {emergencyCount > 0 ? emergencyCount : pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto space-y-5">

          {/* ── DOCTORS ── */}
          {tab === "doctors" && (
            <>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{editingId !== null ? "Edit Doctor" : "Add Doctor"}</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage your hospital's medical staff.</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <form onSubmit={handleDoctorSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Full Name", key: "name", required: true },
                    { label: "Department", key: "department", required: true },
                    { label: "Qualification", key: "qualification", required: false },
                    { label: "Experience (years)", key: "experience_years", required: false, type: "number" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{f.label}</label>
                      <input type={f.type ?? "text"} required={f.required}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={(doctorForm as any)[f.key]}
                        onChange={(e) => setDoctorForm({ ...doctorForm, [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Hospital</label>
                    <input readOnly
                      className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
                      value={doctorForm.hospital_name} />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3 pt-1">
                    <button type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                      {editingId !== null ? "Update Doctor" : "Add Doctor"}
                    </button>
                    {editingId !== null && (
                      <button type="button" onClick={() => { setEditingId(null); setDoctorForm({ ...emptyForm, hospital_name: adminHospital }); setDoctorMsg(""); }}
                        className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-4 py-2.5 rounded-xl hover:bg-gray-100">Cancel</button>
                    )}
                    {doctorMsg && (
                      <span className={`text-sm font-medium ${doctorMsg.includes("failed") || doctorMsg.includes("Failed") ? "text-red-500" : "text-emerald-600"}`}>{doctorMsg}</span>
                    )}
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">Doctors</h2>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">{doctors.length} total</span>
                </div>
                {doctors.length === 0 ? (
                  <div className="text-center py-12">
                    <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No doctors added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {doctors.map((doc) => (
                      <div key={doc.id} className={`border rounded-xl transition-all ${doc.available ? "border-gray-100 bg-white" : "border-red-100 bg-red-50"}`}>
                        <div className="flex items-center justify-between px-4 py-3.5 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${doc.available ? "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600" : "bg-red-100 text-red-500"}`}>
                              {doc.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-800 text-sm">Dr. {doc.name}</p>
                                {!doc.available && (
                                  <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold border border-red-200">
                                    <BanIcon className="w-3 h-3" /> On Leave
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{doc.department}{doc.qualification ? ` · ${doc.qualification}` : ""}{doc.experience_years ? ` · ${doc.experience_years} yrs` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewSlots(doc.id)}
                              className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 transition-colors ${
                                viewSlotsForDoctor === doc.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                              }`}>
                              <Eye className="w-3 h-3" /> Slots
                            </button>
                            <button
                              onClick={() => handleToggleAvailabilityFromTab(doc)}
                              className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition-colors ${
                                doc.available
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                  : "bg-red-100 text-red-600 border-red-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                              }`}>
                              {doc.available ? "✓ Available" : "✗ On Leave"}
                            </button>
                            <button onClick={() => handleEdit(doc)} className="text-xs text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors font-medium">Edit</button>
                            <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-400 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors font-medium">Delete</button>
                          </div>
                        </div>

                        {/* Inline slots panel */}
                        {viewSlotsForDoctor === doc.id && (
                          <div className="px-4 pb-4 pt-0 border-t border-gray-100 mt-0">
                            {!doc.available && (
                              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-100 border border-red-200 rounded-xl px-3 py-2.5 mt-3 mb-3">
                                <BanIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                On leave — patients cannot book until marked available again.
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-3 mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upcoming Slots</p>
                              <button onClick={() => fetchExistingSlots(doc.id)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refresh</button>
                            </div>
                            {slotsLoading ? (
                              <p className="text-xs text-gray-400 py-2 text-center">Loading...</p>
                            ) : existingSlots.length === 0 ? (
                              <p className="text-xs text-gray-400 py-2 text-center">No upcoming slots. Add them in the Availability tab.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {existingSlots.map(slot => (
                                  <div key={slot.id} className={`border rounded-xl px-3 py-2.5 text-xs ${slot.is_booked ? "bg-gray-50 border-gray-100 text-gray-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                                    <p className="font-semibold">{slot.available_date}</p>
                                    <p className="mt-0.5">{fmtTime(slot.available_time)}</p>
                                    {slot.is_booked && <p className="text-gray-400 mt-0.5">Booked</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── AVAILABILITY ── */}
          {tab === "availability" && (
            <>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Doctor Availability</h1>
                <p className="text-sm text-gray-500 mt-0.5">Set when doctors are available for appointments.</p>
              </div>

              {/* Add slots form */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-7">
                <form onSubmit={handleSlotSubmit} className="space-y-7">
                  {/* Doctor */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Select Doctor</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {doctors.map((d) => (
                        <button key={d.id} type="button" onClick={() => setSlotDoctorId(String(d.id))}
                          className={`text-left border rounded-xl px-4 py-3 transition-all ${
                            slotDoctorId === String(d.id) ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm text-gray-800">Dr. {d.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{d.department}</p>
                            </div>
                            {!d.available && (
                              <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-semibold border border-red-200 flex-shrink-0">Leave</span>
                            )}
                          </div>
                          {slotDoctorId === String(d.id) && !d.available && (
                            <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><BanIcon className="w-3 h-3" /> On leave — slots won&apos;t be bookable until marked available.</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calendar */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Dates</p>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setCalendarMonth(new Date(calYear, calMon - 1, 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-sm font-semibold text-gray-700 min-w-32 text-center">
                          {calendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                        </span>
                        <button type="button" onClick={() => setCalendarMonth(new Date(calYear, calMon + 1, 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 mb-2">
                      {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                        <div key={d} className="text-center text-xs text-gray-400 py-1 font-semibold">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calCells.map((day, i) => {
                        if (!day) return <div key={i} />;
                        const ds = `${calYear}-${String(calMon+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                        const isPast = new Date(calYear, calMon, day) < today;
                        const isSel = selectedDates.includes(ds);
                        return (
                          <button key={i} type="button" disabled={isPast}
                            onClick={() => setSelectedDates(p => p.includes(ds) ? p.filter(x => x !== ds) : [...p, ds])}
                            className={`rounded-xl py-2 text-sm font-medium transition-all ${
                              isPast ? "text-gray-200 cursor-not-allowed" :
                              isSel ? "bg-blue-600 text-white shadow-sm" :
                              "hover:bg-blue-50 text-gray-700"
                            }`}>
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDates.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {[...selectedDates].sort().map(d => (
                          <span key={d} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">
                            {d}
                            <button type="button" onClick={() => setSelectedDates(p => p.filter(x => x !== d))} className="hover:text-red-500 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Times */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Time Slots</p>
                      <div className="flex gap-3">
                        {timeSlots.length < PRESET_TIMES.length && (
                          <button type="button" onClick={() => setTimeSlots([...PRESET_TIMES])} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Select all</button>
                        )}
                        {timeSlots.length > 0 && (
                          <button type="button" onClick={() => setTimeSlots([])} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear</button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {TIME_PERIODS.map((p) => {
                        const periodTimes = PRESET_TIMES.filter(t => { const h = parseInt(t.split(":")[0]); return h >= p.range[0] && h < p.range[1]; });
                        const allSelected = periodTimes.every(t => timeSlots.includes(t));
                        return (
                          <button key={p.label} type="button" onClick={() => setActivePeriod(p.label)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              activePeriod === p.label ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                            }`}>
                            {p.label} {allSelected && periodTimes.length > 0 && <span className="ml-1 opacity-70">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    {TIME_PERIODS.filter(p => p.label === activePeriod).map((p) => {
                      const periodTimes = PRESET_TIMES.filter(t => { const h = parseInt(t.split(":")[0]); return h >= p.range[0] && h < p.range[1]; });
                      const allSelected = periodTimes.every(t => timeSlots.includes(t));
                      return (
                        <div key={p.label}>
                          <div className="flex justify-end mb-2">
                            <button type="button"
                              onClick={() => allSelected ? setTimeSlots(prev => prev.filter(t => !periodTimes.includes(t))) : setTimeSlots(prev => [...new Set([...prev, ...periodTimes])])}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                              {allSelected ? `Deselect ${p.label}` : `Select all ${p.label}`}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {periodTimes.map((t) => {
                              const sel = timeSlots.includes(t);
                              return (
                                <button key={t} type="button"
                                  onClick={() => setTimeSlots(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    sel ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                                  }`}>
                                  {fmtTime(t)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {timeSlots.length > 0 && <p className="text-xs text-gray-400 mt-2 font-medium">{timeSlots.length} time(s) selected</p>}
                  </div>

                  {slotDoctorId && selectedDates.length > 0 && timeSlots.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 flex-shrink-0" />
                      This will create <span className="font-bold">{selectedDates.length * timeSlots.length}</span> slot(s) total.
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <button type="submit" disabled={slotSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2">
                      {slotSubmitting ? <><span className="animate-spin">⏳</span> Adding...</> : "Add Slots"}
                    </button>
                    {slotMsg && (
                      <span className={`text-sm font-medium ${slotMsg.includes("added") ? "text-emerald-600" : "text-red-500"}`}>{slotMsg}</span>
                    )}
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ── APPOINTMENTS ── */}
          {tab === "appointments" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Appointments</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{appointments.length} total · {pendingCount} pending review</p>
                </div>
                <button onClick={fetchAppointments} className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
              </div>

              {/* Filters */}
              {(() => {
                const doctorOptions = Array.from(new Set(appointments.map(a => a.doctor_name))).sort();
                const filtered = appointments
                  .filter(a => apptStatus === "all" || a.status === apptStatus)
                  .filter(a => apptDoctor === "all" || a.doctor_name === apptDoctor)
                  .filter(a => {
                    if (!apptSearch.trim()) return true;
                    const q = apptSearch.toLowerCase();
                    return [a.patient_name, a.doctor_name, a.predicted_department, a.input_text]
                      .some(s => (s ?? "").toLowerCase().includes(q));
                  })
                  .sort((a, b) => {
                    const da = new Date(`${a.appointment_date}T${a.appointment_time}`).getTime();
                    const db = new Date(`${b.appointment_date}T${b.appointment_time}`).getTime();
                    if (apptSort === "date-desc") return db - da;
                    if (apptSort === "date-asc")  return da - db;
                    if (apptSort === "patient")   return a.patient_name.localeCompare(b.patient_name);
                    if (apptSort === "doctor")    return a.doctor_name.localeCompare(b.doctor_name);
                    return 0;
                  });

                const hasFilters = apptStatus !== "all" || apptDoctor !== "all" || apptSearch.trim() !== "";

                const emergencyAppts = filtered.filter(a => a.predicted_department?.toLowerCase() === "emergency");
                const regularAppts   = filtered.filter(a => a.predicted_department?.toLowerCase() !== "emergency");

                const AppointmentCard = ({ a }: { a: Appointment }) => {
                  const sc = statusConfig[a.status] ?? { cls: "bg-gray-100 text-gray-600", label: a.status };
                  return (
                    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${
                      a.status === "pending_review" ? "border-amber-200" :
                      a.status === "review" ? "border-yellow-200" : "border-gray-100"
                    }`}>
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm flex-shrink-0">
                            {a.patient_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{a.patient_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Dr. {a.doctor_name} · {a.appointment_date} at {fmtTime(a.appointment_time)}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 space-y-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Symptom</p>
                        <p className="text-sm text-gray-700">{a.input_text}</p>
                        <p className="text-xs font-semibold text-blue-600 mt-1">Predicted: {a.predicted_department}</p>
                      </div>
                      {a.is_correct === null ? (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <p className="text-xs text-gray-500 font-medium">Was this prediction correct?</p>
                          <button onClick={() => handleFeedback(a.id, true)}
                            className="text-xs px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition-colors font-semibold">
                            ✓ Correct
                          </button>
                          <div className="flex items-center gap-2">
                            <input className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs w-44 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
                              placeholder="Correct department..."
                              value={correctionMap[a.id] ?? ""}
                              onChange={(e) => setCorrectionMap((p) => ({ ...p, [a.id]: e.target.value }))} />
                            <button onClick={() => handleFeedback(a.id, false)}
                              className="text-xs px-3 py-1.5 rounded-full border border-red-300 text-red-500 hover:bg-red-50 transition-colors font-semibold">
                              ✗ Incorrect
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {a.is_correct
                            ? <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-semibold">✓ Marked correct</span>
                            : <span className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-full font-semibold">✗ Corrected to: {a.corrected_department}</span>
                          }
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* Filter bar */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3.5 flex flex-wrap gap-3 items-center">
                      {/* Search */}
                      <div className="relative flex-1 min-w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search patient, doctor, symptom..."
                          value={apptSearch}
                          onChange={e => setApptSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Status filter */}
                      <select
                        value={apptStatus}
                        onChange={e => setApptStatus(e.target.value)}
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none text-gray-700 font-medium cursor-pointer">
                        <option value="all">All statuses</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="pending_review">Pending Review</option>
                        <option value="review">Needs Review</option>
                      </select>

                      {/* Doctor filter */}
                      <select
                        value={apptDoctor}
                        onChange={e => setApptDoctor(e.target.value)}
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none text-gray-700 font-medium cursor-pointer">
                        <option value="all">All doctors</option>
                        {doctorOptions.map(d => <option key={d} value={d}>Dr. {d}</option>)}
                      </select>

                      {/* Sort */}
                      <select
                        value={apptSort}
                        onChange={e => setApptSort(e.target.value)}
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none text-gray-700 font-medium cursor-pointer">
                        <option value="date-desc">Newest first</option>
                        <option value="date-asc">Oldest first</option>
                        <option value="patient">Patient A–Z</option>
                        <option value="doctor">Doctor A–Z</option>
                      </select>

                      {/* Clear */}
                      {hasFilters && (
                        <button
                          onClick={() => { setApptSearch(""); setApptStatus("all"); setApptDoctor("all"); }}
                          className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Clear
                        </button>
                      )}

                      <span className="text-xs text-gray-400 ml-auto font-medium">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                    </div>

                    {/* Emergency section */}
                    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Emergency</span>
                        <span className="text-sm font-semibold text-red-800">{emergencyAppts.length} appointment{emergencyAppts.length !== 1 ? "s" : ""}</span>
                      </div>
                      {emergencyAppts.length === 0 ? (
                        <p className="text-sm text-red-400 text-center py-4">No emergency appointments{hasFilters ? " matching filters" : ""}.</p>
                      ) : (
                        emergencyAppts.map(a => <AppointmentCard key={a.id} a={a} />)
                      )}
                    </div>

                    {/* Regular section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-gray-800">Regular Appointments</h2>
                        {pendingCount > 0 && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">{pendingCount} pending</span>
                        )}
                      </div>
                      {regularAppts.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-400 text-sm">{hasFilters ? "No appointments match your filters." : "No regular appointments yet."}</p>
                        </div>
                      ) : (
                        regularAppts.map(a => <AppointmentCard key={a.id} a={a} />)
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

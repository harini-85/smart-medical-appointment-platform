"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  Stethoscope, CalendarDays, Building2, User, AlertTriangle,
  LogOut, Menu, RefreshCw, Search, X, MapPin, Clock, CheckCircle2,
  AlertCircle, ChevronDown, Phone, Mail, Navigation, Heart,
  Activity, Brain, Wind, HelpCircle, Siren
} from "lucide-react";

type TopPrediction = { department: string; confidence: number };
type PredictionResult = { status: string; predicted_department: string; confidence: number; top_3: TopPrediction[] };
type Doctor = { id: number; name: string; department: string; qualification?: string; experience_years?: number; available: boolean; hospital_name?: string; distance_km?: number; };
type Slot = { id: number; available_date: string; available_time: string };
type Appointment = { id: number; doctor_id: number; doctor_name: string; doctor_qualification?: string; hospital_name?: string; predicted_department?: string; input_text?: string; appointment_date: string; appointment_time: string; status: string; };
type Hospital = { hospital_name: string; hospital_phone?: string; hospital_address?: string; hospital_lat?: number; hospital_lng?: number; email?: string; mobile?: string; };
type Profile = { name?: string; email?: string; mobile?: string; age?: number; gender?: string; blood_group?: string; height_cm?: number; weight_kg?: number; address?: string; allergies?: string; chronic_conditions?: string; };
type Tab = "predict" | "appointments" | "profile" | "hospitals";

const EMERGENCY_SUBTYPES = [
  { key: "Cardiac",     label: "Chest pain / Heart",   desc: "Chest tightness, palpitations, arm or jaw pain",    Icon: Heart },
  { key: "Trauma",      label: "Injury / Accident",    desc: "Fall, fracture, wound, road accident",              Icon: AlertTriangle },
  { key: "Neuro",       label: "Neurological",         desc: "Severe headache, seizure, stroke, unconsciousness", Icon: Brain },
  { key: "Respiratory", label: "Breathing difficulty", desc: "Choking, severe asthma, can't breathe",             Icon: Wind },
  { key: "Other",       label: "Other emergency",      desc: "Serious condition not listed above",                Icon: HelpCircle },
];

const URGENCY_CONFIG: Record<string, { cls: string; label: string }> = {
  critical: { cls: "bg-red-100 text-red-700 border-red-200",         label: "Critical — Seek immediate care" },
  high:     { cls: "bg-orange-100 text-orange-700 border-orange-200", label: "High urgency — Go to Emergency now" },
  moderate: { cls: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Moderate — Emergency assessment needed" },
};

const EMERGENCY_CONTACTS = [
  { label: "Ambulance",          number: "108" },
  { label: "Police",             number: "100" },
  { label: "Fire",               number: "101" },
  { label: "National Emergency", number: "112" },
];

const statusConfig: Record<string, { cls: string; label: string }> = {
  confirmed:      { cls: "bg-emerald-100 text-emerald-700", label: "Confirmed" },
  pending_review: { cls: "bg-amber-100 text-amber-700",     label: "Pending Review" },
  review:         { cls: "bg-yellow-100 text-yellow-700",   label: "Needs Review" },
};

const NAV_ITEMS: { key: Tab; label: string; Icon: React.ElementType }[] = [
  { key: "predict",      label: "Book Appointment", Icon: Stethoscope },
  { key: "appointments", label: "My Appointments",  Icon: CalendarDays },
  { key: "hospitals",    label: "Hospitals",        Icon: Building2 },
  { key: "profile",      label: "My Profile",       Icon: User },
];

export default function PatientDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("predict");
  const [symptomText, setSymptomText] = useState("");
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predError, setPredError] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingMsg, setBookingMsg] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [profileMsg, setProfileMsg] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyDoctors, setEmergencyDoctors] = useState<Doctor[]>([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyRefineMode, setEmergencyRefineMode] = useState(false);
  const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
  const [refineResult, setRefineResult] = useState<{ sub_type: string; description: string; urgency: string } | null>(null);
  const [refining, setRefining] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apptStatus, setApptStatus] = useState<string>("all");
  const [apptSort, setApptSort] = useState<string>("date-desc");
  const [apptSearch, setApptSearch] = useState<string>("");
  const [apptDept, setApptDept] = useState<string>("all");
  const [deptOpen, setDeptOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchAppointments(); fetchProfile(); fetchHospitals();
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("Location access denied — showing all available doctors.")
    );
  }, []);

  useEffect(() => {
    const handler = () => { setDeptOpen(false); setSortOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchAppointments = async () => { try { const r = await api.get("/appointments/me"); setAppointments(r.data); } catch { } };
  const fetchProfile = async () => { try { const r = await api.get("/patient/profile"); setProfile(r.data); } catch { } };
  const fetchHospitals = async () => { try { const r = await api.get("/hospitals"); setHospitals(r.data); } catch { } };

  const handleEmergency = async () => {
    setShowEmergency(true); setEmergencyLoading(true);
    try {
      const ep = userLocation ? "/doctors/nearby" : "/doctors";
      const p = userLocation ? { lat: userLocation.lat, lng: userLocation.lng, department: "Emergency" } : { department: "Emergency" };
      const res = await api.get(ep, { params: p });
      setEmergencyDoctors(res.data.filter((d: Doctor) => d.available));
    } catch { }
    setEmergencyLoading(false);
  };

  const handleRefineSubType = async (subType: string) => {
    setSelectedSubType(subType); setRefining(true);
    try {
      const res = await api.post("/predict/emergency-refine", { text: symptomText, sub_type: subType });
      setRefineResult(res.data);
      const ep = userLocation ? "/doctors/nearby" : "/doctors";
      const p = userLocation ? { lat: userLocation.lat, lng: userLocation.lng, department: "Emergency" } : { department: "Emergency" };
      const dr = await api.get(ep, { params: p });
      setDoctors(dr.data.filter((d: Doctor) => d.available));
    } catch { }
    setRefining(false);
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault(); setPredError("");
    const trimmed = symptomText.trim();
    if (trimmed.length < 10) { setPredError("Please enter at least 10 characters."); return; }
    if (trimmed.split(/\s+/).filter(Boolean).length < 3) { setPredError("Please use at least 3 words."); return; }
    setPredicting(true); setPrediction(null);
    setDoctors([]); setSelectedDoctor(null); setSlots([]); setSelectedSlot(null); setBookingMsg("");
    setEmergencyRefineMode(false); setSelectedSubType(null); setRefineResult(null);
    try {
      const res = await api.post("/predict", { text: symptomText });
      setPrediction(res.data);
      if (res.data.predicted_department === "Emergency") { setEmergencyRefineMode(true); setPredicting(false); return; }
      const ep = userLocation ? "/doctors/nearby" : "/doctors";
      const p = userLocation ? { lat: userLocation.lat, lng: userLocation.lng, department: res.data.predicted_department } : { department: res.data.predicted_department };
      const dr = await api.get(ep, { params: p });
      setDoctors(dr.data.filter((d: Doctor) => d.available));
    } catch (err: any) { setPredError(err.response?.data?.detail || "Prediction failed"); }
    finally { setPredicting(false); }
  };

  const handleSelectDoctor = async (doc: Doctor) => {
    setSelectedDoctor(doc); setSelectedSlot(null); setBookingMsg("");
    try { const r = await api.get(`/doctors/${doc.id}/availability`); setSlots(r.data); } catch { }
  };

  const handleBook = async () => {
    if (!selectedDoctor || !selectedSlot || !prediction) return;
    setBookingMsg("");
    try {
      const res = await api.post("/appointments", { doctor_id: selectedDoctor.id, availability_id: selectedSlot.id, input_text: symptomText, predicted_department: prediction.predicted_department, confidence: prediction.confidence });
      setBookingMsg(res.data.status === "pending_review" ? "Booked! Under review by the hospital." : "Appointment booked successfully!");
      fetchAppointments();
      setSlots((p) => p.filter((s) => s.id !== selectedSlot.id));
      setSelectedSlot(null);
    } catch (err: any) { setBookingMsg(err.response?.data?.detail || "Booking failed"); }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault(); setProfileMsg("");
    try { await api.post("/patient/profile", profile); setProfileMsg("Profile saved!"); }
    catch (err: any) { setProfileMsg(err.response?.data?.detail || "Save failed"); }
  };

  const confColor = (c: number) => c >= 0.7 ? "text-emerald-600" : c >= 0.45 ? "text-amber-600" : "text-red-500";
  const confBg = (c: number) => c >= 0.7 ? "bg-emerald-50 border-emerald-200" : c >= 0.45 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

  const deptOptions = [
    "all",
    ...Array.from(
      new Set(
        appointments
          .map(a => a.predicted_department)
          .filter((d): d is string => !!d)
      )
    ).sort()
  ];
  const filteredAppts = appointments
    .filter(a => apptStatus === "all" || a.status === apptStatus)
    .filter(a =>
      apptDept === "all" ||
      (a.predicted_department || "").toLowerCase() === apptDept.toLowerCase()
    )
    .filter(a => {
      if (!apptSearch.trim()) return true;
      const q = apptSearch.toLowerCase();
      return [
        a.doctor_name,
        a.predicted_department ?? "",
        a.hospital_name ?? "",
        a.input_text ?? ""
      ].some(s => (s || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const da = new Date(`${a.appointment_date}T${a.appointment_time}`).getTime();
      const db = new Date(`${b.appointment_date}T${b.appointment_time}`).getTime();

      if (apptSort === "date-desc") return db - da;
      if (apptSort === "date-asc") return da - db;
      if (apptSort === "doctor") return a.doctor_name.localeCompare(b.doctor_name);
      if (apptSort === "dept") return (a.predicted_department ?? "").localeCompare(b.predicted_department ?? "");
      return 0;
    });
  const hasApptFilters = apptStatus !== "all" || apptDept !== "all" || apptSearch.trim() !== "";
  const clearApptFilters = () => { setApptStatus("all"); setApptDept("all"); setApptSearch(""); };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">S</div>
            <span className="font-bold text-gray-900 text-base hidden sm:block">SmartCare</span>
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleEmergency} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"><Siren className="w-3.5 h-3.5" /> Emergency</button>
          <button onClick={() => { localStorage.removeItem("token"); router.push("/login"); }} className="text-xs text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
        </div>
      </header>

      <div className="flex flex-1">
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed md:sticky top-0 md:top-[57px] left-0 h-full md:h-[calc(100vh-57px)] w-64 bg-white border-r border-gray-200 z-20 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm">{profile.name?.charAt(0)?.toUpperCase() ?? "P"}</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{profile.name || "Patient Portal"}</p>
                <p className="text-xs text-gray-400 truncate max-w-[140px]">{profile.email || "Welcome back"}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV_ITEMS.map(item => (
              <button key={item.key} onClick={() => { setTab(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === item.key ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
                <item.Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {item.key === "appointments" && appointments.length > 0 && (
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{appointments.length}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto space-y-5">

          {/* ── BOOK APPOINTMENT ── */}
          {tab === "predict" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Book an Appointment</h1>
                <p className="text-sm text-gray-500 mt-0.5">Describe your symptoms and we&apos;ll find the right department and doctor.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                {locationError && <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {locationError}</div>}
                {userLocation && <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-4"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /> Location detected — doctors sorted by proximity</div>}
                <form onSubmit={handlePredict} className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">What are your symptoms?</label>
                    <textarea rows={4} required
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none transition-all"
                      placeholder="e.g. I have chest pain and shortness of breath since this morning..."
                      value={symptomText} onChange={e => setSymptomText(e.target.value)} />
                    <div className="flex justify-between mt-1.5">
                      <p className="text-xs text-gray-400">Minimum 3 words · 10 characters</p>
                      <p className={`text-xs font-medium ${symptomText.trim().split(/\s+/).filter(Boolean).length >= 3 && symptomText.trim().length >= 10 ? "text-emerald-500" : "text-gray-400"}`}>
                        {symptomText.trim().split(/\s+/).filter(Boolean).length} words · {symptomText.trim().length} chars
                      </p>
                    </div>
                  </div>
                  <button type="submit" disabled={predicting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm flex items-center gap-2">
                    {predicting ? <><Activity className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Search className="w-4 h-4" /> Predict Department</>}
                  </button>
                </form>
                {predError && <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {predError}</div>}
              </div>

              {prediction && (
                <div className={`rounded-2xl border-2 p-6 ${confBg(prediction.confidence)}`}>
                  <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Recommended Department</p>
                      <p className="text-3xl font-extrabold text-gray-900">{prediction.predicted_department}</p>
                    </div>
                    <div className="text-right bg-white/60 rounded-xl px-4 py-2">
                      <p className={`text-3xl font-extrabold ${confColor(prediction.confidence)}`}>{(prediction.confidence * 100).toFixed(0)}%</p>
                      <p className="text-xs text-gray-400">confidence</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {prediction.top_3.map(t => (
                      <span key={t.department} className="bg-white/70 text-gray-700 text-xs px-3 py-1.5 rounded-full border border-gray-200 font-medium">
                        {t.department} <span className="text-gray-400">· {(t.confidence * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {emergencyRefineMode && prediction && (
                <div className="border-2 border-red-300 bg-red-50 rounded-2xl p-6 space-y-5">
                  <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><Siren className="w-3 h-3" /> Emergency Detected</span>
                  <p className="text-sm text-red-800 font-medium">Select the type that best matches your situation:</p>
                  {!selectedSubType ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {EMERGENCY_SUBTYPES.map(s => (
                        <button key={s.key} type="button" onClick={() => handleRefineSubType(s.key)}
                          className="text-left border border-red-200 bg-white rounded-xl px-4 py-3 hover:border-red-400 hover:shadow-sm transition-all">
                          <div className="flex items-center gap-2 mb-1"><s.Icon className="w-4 h-4 text-red-500" /><p className="font-semibold text-gray-800 text-sm">{s.label}</p></div>
                          <p className="text-xs text-gray-500">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  ) : refining ? (
                    <p className="text-sm text-gray-500 flex items-center gap-2"><Activity className="w-4 h-4 animate-spin" /> Assessing...</p>
                  ) : refineResult ? (
                    <div className="space-y-4">
                      <div className={`border rounded-xl px-4 py-3 ${URGENCY_CONFIG[refineResult.urgency]?.cls ?? ""}`}>
                        <p className="font-bold text-sm">{URGENCY_CONFIG[refineResult.urgency]?.label}</p>
                        <p className="text-sm mt-1">{refineResult.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {EMERGENCY_CONTACTS.map(c => (
                          <a key={c.label} href={`tel:${c.number}`} className="flex justify-between items-center bg-white border border-red-200 rounded-xl px-3 py-2.5 hover:bg-red-50">
                            <span className="text-xs text-gray-600 font-medium">{c.label}</span>
                            <span className="text-red-600 font-bold">{c.number}</span>
                          </a>
                        ))}
                      </div>
                      {doctors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nearest Emergency Hospitals</p>
                          {doctors.map(doc => (
                            <div key={doc.id} className="border border-gray-100 bg-white rounded-xl px-4 py-3 flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-gray-800 text-sm">{doc.hospital_name || "Emergency Department"}</p>
                                <p className="text-xs text-gray-400 mt-0.5">Dr. {doc.name}{doc.qualification ? ` · ${doc.qualification}` : ""}</p>
                              </div>
                              {doc.distance_km !== undefined && <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-medium">{doc.distance_km} km</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={() => { setSelectedSubType(null); setRefineResult(null); setDoctors([]); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Change emergency type</button>
                    </div>
                  ) : null}
                </div>
              )}

              {doctors.length > 0 && !emergencyRefineMode && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-800">Available Doctors</h2>
                    {userLocation && <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full flex items-center gap-1"><MapPin className="w-3 h-3" /> Sorted by distance</span>}
                  </div>
                  <div className="space-y-3">
                    {doctors.map(doc => (
                      <button key={doc.id} type="button" onClick={() => handleSelectDoctor(doc)}
                        className={`w-full text-left border rounded-xl p-4 transition-all ${selectedDoctor?.id === doc.id ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">{doc.name.charAt(0)}</div>
                            <div>
                              <p className="font-semibold text-gray-800">Dr. {doc.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{doc.qualification}{doc.experience_years ? ` · ${doc.experience_years} yrs` : ""}</p>
                              {doc.hospital_name && <p className="text-xs text-blue-600 mt-0.5 font-medium">{doc.hospital_name}</p>}
                            </div>
                          </div>
                          {doc.distance_km !== undefined && <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">{doc.distance_km} km</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {prediction && doctors.length === 0 && !predicting && !emergencyRefineMode && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <p className="text-gray-500 text-sm">No available doctors found for <span className="font-semibold text-gray-700">{prediction.predicted_department}</span>.</p>
                </div>
              )}

              {selectedDoctor && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">{selectedDoctor.name.charAt(0)}</div>
                    <div>
                      <h2 className="font-semibold text-gray-800">Dr. {selectedDoctor.name}</h2>
                      <p className="text-xs text-gray-400">{selectedDoctor.hospital_name}</p>
                    </div>
                  </div>
                  {slots.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No available slots for this doctor.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {slots.map(slot => (
                        <button key={slot.id} type="button" onClick={() => setSelectedSlot(slot)}
                          className={`border rounded-xl px-3 py-3 text-sm transition-all text-left ${selectedSlot?.id === slot.id ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" : "border-gray-100 hover:border-blue-200 text-gray-700"}`}>
                          <p className="font-semibold text-xs">{slot.available_date}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{fmtTime(slot.available_time)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSlot && (
                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-4 flex-wrap">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700 font-medium flex items-center gap-2"><CalendarDays className="w-4 h-4" /> {selectedSlot.available_date} at {fmtTime(selectedSlot.available_time)}</div>
                      <button type="button" onClick={handleBook} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Confirm Booking</button>
                    </div>
                  )}
                  {bookingMsg && (
                    <div className={`mt-3 text-sm font-medium px-4 py-2.5 rounded-xl ${bookingMsg.toLowerCase().includes("fail") ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>{bookingMsg}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── MY APPOINTMENTS ── */}
          {tab === "appointments" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">My Appointments</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{filteredAppts.length} of {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={fetchAppointments} className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
              </div>

              {appointments.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                  {/* Search */}
                  <div className="p-4">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Search className="w-4 h-4" /></span>
                      <input type="text" placeholder="Search doctor, department, hospital or symptoms..."
                        className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={apptSearch} onChange={e => setApptSearch(e.target.value)} />
                      {apptSearch && <button type="button" onClick={() => setApptSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>}
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="px-4 py-3 flex flex-wrap gap-1.5">
                    {[
                      { value: "all",            label: "All" },
                      { value: "confirmed",      label: "Confirmed" },
                      { value: "pending_review", label: "Pending" },
                      { value: "review",         label: "Needs Review" },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => setApptStatus(opt.value)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all whitespace-nowrap ${apptStatus === opt.value ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"}`}>
                        {opt.label}
                        {opt.value !== "all" && <span className={`ml-1 ${apptStatus === opt.value ? "opacity-70" : "text-gray-400"}`}>{appointments.filter(a => a.status === opt.value).length}</span>}
                      </button>
                    ))}
                  </div>

                  {/* Active chips */}
                  {(apptStatus !== "all" || apptSearch.trim()) && (
                    <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap bg-gray-50">
                      <span className="text-xs text-gray-400 font-medium">Active:</span>
                      {apptStatus !== "all" && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
                          {apptStatus === "confirmed" ? "Confirmed" : apptStatus === "pending_review" ? "Pending Review" : "Needs Review"}
                          <button type="button" onClick={() => setApptStatus("all")} className="hover:text-red-500 ml-0.5">×</button>
                        </span>
                      )}
                      {apptSearch.trim() && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full font-medium">
                          &ldquo;{apptSearch}&rdquo;
                          <button type="button" onClick={() => setApptSearch("")} className="hover:text-red-500 ml-0.5">×</button>
                        </span>
                      )}
                      <button type="button" onClick={() => { setApptStatus("all"); setApptSearch(""); }} className="text-xs text-red-400 hover:text-red-600 font-medium ml-auto">Clear all</button>
                    </div>
                  )}
                </div>
              )}

              {appointments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                  <p className="text-5xl mb-4">📋</p>
                  <p className="text-gray-500 text-sm font-medium">No appointments yet</p>
                  <p className="text-gray-400 text-xs mt-1">Book one from the &quot;Book Appointment&quot; tab.</p>
                  <button type="button" onClick={() => setTab("predict")} className="mt-4 text-sm text-blue-600 hover:underline font-medium">Book now →</button>
                </div>
              ) : filteredAppts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <p className="text-gray-500 text-sm font-medium">No appointments match your filters</p>
                  <button type="button" onClick={clearApptFilters} className="mt-3 text-sm text-blue-600 hover:underline font-medium">Clear all filters</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAppts.map(a => {
                    const sc = statusConfig[a.status] ?? { cls: "bg-gray-100 text-gray-600", label: a.status };
                    const isPast = new Date(`${a.appointment_date}T${a.appointment_time}`) < new Date();
                    return (
                      <div key={a.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${a.status === "review" ? "border-yellow-300" : a.status === "pending_review" ? "border-amber-200" : "border-gray-100"} ${isPast && a.status === "confirmed" ? "opacity-70" : ""}`}>
                        <div className="px-5 pt-5 pb-4 flex justify-between items-start flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-base flex-shrink-0">{a.doctor_name.charAt(0)}</div>
                            <div>
                              <p className="font-semibold text-gray-900">Dr. {a.doctor_name}</p>
                              {a.doctor_qualification && <p className="text-xs text-gray-400 mt-0.5">{a.doctor_qualification}</p>}
                              {a.hospital_name && <p className="text-xs text-blue-600 mt-0.5 font-medium">{a.hospital_name}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {isPast && a.status === "confirmed" && <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">Past</span>}
                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                          </div>
                        </div>
                        <div className="px-5 pb-4 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full font-medium"><CalendarDays className="w-3.5 h-3.5" /> {a.appointment_date}</span>
                          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full font-medium"><Clock className="w-3.5 h-3.5" /> {fmtTime(a.appointment_time)}</span>
                          {a.predicted_department && <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full font-medium border border-blue-100"><Building2 className="w-3.5 h-3.5" /> {a.predicted_department}</span>}
                        </div>
                        {a.input_text && (
                          <div className="mx-5 mb-4 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">Symptoms</p>
                            <p className="text-sm text-gray-600 leading-relaxed">{a.input_text}</p>
                          </div>
                        )}
                        {a.status === "review" && (
                          <div className="mx-5 mb-5 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                            <p className="text-xs font-semibold text-yellow-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Department mismatch flagged</p>
                            <p className="text-xs text-yellow-700 mt-0.5">The hospital found the predicted department may be incorrect. Please contact them or rebook with updated symptoms.</p>
                          </div>
                        )}
                        {a.status === "pending_review" && (
                          <div className="mx-5 mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Awaiting hospital review</p>
                            <p className="text-xs text-amber-700 mt-0.5">Your appointment is being reviewed by the hospital. You&apos;ll be notified once confirmed.</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── HOSPITALS ── */}
          {tab === "hospitals" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Registered Hospitals</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{hospitals.length} hospital{hospitals.length !== 1 ? "s" : ""} available</p>
                </div>
                <button type="button" onClick={fetchHospitals} className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
              </div>
              {hospitals.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center"><p className="text-5xl mb-4">🏥</p><p className="text-gray-400 text-sm">No hospitals registered yet.</p></div>
              ) : hospitals.map((h, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4"><h3 className="text-lg font-bold text-white">{h.hospital_name}</h3></div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {h.hospital_phone && <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"><p className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p><a href={`tel:${h.hospital_phone}`} className="text-sm font-semibold text-blue-600 hover:underline">{h.hospital_phone}</a></div>}
                      {h.email && <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"><p className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p><a href={`mailto:${h.email}`} className="text-sm font-semibold text-blue-600 hover:underline break-all">{h.email}</a></div>}
                      {h.mobile && <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"><p className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> Admin Mobile</p><a href={`tel:${h.mobile}`} className="text-sm font-semibold text-blue-600 hover:underline">{h.mobile}</a></div>}
                      {h.hospital_address && <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 sm:col-span-2"><p className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</p><p className="text-sm text-gray-700">{h.hospital_address}</p></div>}
                    </div>
                    {h.hospital_lat && h.hospital_lng && (
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.hospital_lat},${h.hospital_lng}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm">
                        <Navigation className="w-4 h-4" /> Get Directions
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PROFILE ── */}
          {tab === "profile" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-500 mt-0.5">Your health information helps doctors prepare for your visit.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">{profile.name?.charAt(0)?.toUpperCase() ?? "P"}</div>
                  <div><p className="text-lg font-bold text-gray-900">{profile.name || "—"}</p><p className="text-sm text-gray-400">{profile.email || "—"}</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"><p className="text-xs text-gray-400 font-medium mb-0.5">Full Name</p><p className="text-sm font-semibold text-gray-800">{profile.name || "—"}</p></div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"><p className="text-xs text-gray-400 font-medium mb-0.5">Email</p><p className="text-sm font-semibold text-gray-800 break-all">{profile.email || "—"}</p></div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"><p className="text-xs text-gray-400 font-medium mb-0.5">Mobile</p><p className="text-sm font-semibold text-gray-800">{profile.mobile || "—"}</p></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Health Details</h2>
                <form onSubmit={handleProfileSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { label: "Age", key: "age", type: "number" },
                    { label: "Blood Group", key: "blood_group", type: "text" },
                    { label: "Height (cm)", key: "height_cm", type: "number" },
                    { label: "Weight (kg)", key: "weight_kg", type: "number" },
                    { label: "Address", key: "address", type: "text" },
                  ] as { label: string; key: keyof Profile; type: string }[]).map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{f.label}</label>
                      <input type={f.type}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={(profile[f.key] as string | number) ?? ""}
                        onChange={e => setProfile({ ...profile, [f.key]: f.type === "number" ? Number(e.target.value) || undefined : e.target.value })} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Gender</label>
                    <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      value={profile.gender ?? ""} onChange={e => setProfile({ ...profile, gender: e.target.value })}>
                      <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Allergies</label>
                    <input type="text" placeholder="e.g. Penicillin, Peanuts"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      value={profile.allergies ?? ""} onChange={e => setProfile({ ...profile, allergies: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Chronic Conditions</label>
                    <input type="text" placeholder="e.g. Diabetes, Hypertension"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      value={profile.chronic_conditions ?? ""} onChange={e => setProfile({ ...profile, chronic_conditions: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-4 pt-2">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm">Save Health Details</button>
                    {profileMsg && <span className={`text-sm font-medium ${profileMsg.toLowerCase().includes("fail") ? "text-red-500" : "text-emerald-600"}`}>{profileMsg}</span>}
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Emergency Modal */}
      {showEmergency && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Siren className="w-6 h-6 text-white" />
                <div><h2 className="text-white font-bold text-lg">Emergency</h2><p className="text-red-100 text-xs">Nearest emergency doctors</p></div>
              </div>
              <button type="button" onClick={() => setShowEmergency(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Emergency Contacts</p>
                <div className="grid grid-cols-2 gap-2">
                  {EMERGENCY_CONTACTS.map(c => (
                    <a key={c.label} href={`tel:${c.number}`} className="flex justify-between items-center bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 hover:bg-red-100">
                      <span className="text-xs text-gray-600 font-medium">{c.label}</span>
                      <span className="text-red-600 font-bold">{c.number}</span>
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Nearby Emergency Doctors</p>
                {emergencyLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4"><Activity className="w-4 h-4 animate-spin" /> Finding nearest emergency doctors...</div>
                ) : emergencyDoctors.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No emergency doctors found nearby.</p>
                ) : (
                  <div className="space-y-2">
                    {emergencyDoctors.map(doc => (
                      <div key={doc.id} className="border border-gray-100 bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{doc.hospital_name || "Emergency Department"}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Dr. {doc.name}{doc.qualification ? ` · ${doc.qualification}` : ""}</p>
                        </div>
                        {doc.distance_km !== undefined && <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-medium">{doc.distance_km} km</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setShowEmergency(false)} className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

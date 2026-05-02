"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { User, Mail, Lock, Phone, Building2, MapPin, AlertCircle, UserPlus, Loader2 } from "lucide-react";

type FormData = {
  name: string;
  email: string;
  password: string;
  mobile: string;
  role: string;
  hospital_name: string;
  hospital_phone: string;
  hospital_address: string;
  hospital_lat: number | null;
  hospital_lng: number | null;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const inputCls = (err?: string) =>
  `w-full border rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors ${err ? "border-red-300" : "border-gray-200"}`;

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    name: "", email: "", password: "", mobile: "",
    role: "patient", hospital_name: "", hospital_phone: "",
    hospital_address: "", hospital_lat: null, hospital_lng: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetectMsg, setAutoDetectMsg] = useState("");

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.name.trim() || formData.name.length < 3)
      e.name = "Name must be at least 3 characters";
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email))
      e.email = "Enter a valid email address";
    if (!formData.password || formData.password.length < 6)
      e.password = "Password must be at least 6 characters";
    if (!formData.mobile || !/^[6-9]\d{9}$/.test(formData.mobile))
      e.mobile = "Enter a valid 10-digit mobile number";
    if (formData.role === "admin") {
      if (!formData.hospital_name.trim()) e.hospital_name = "Hospital name is required";
      if (!formData.hospital_phone.trim()) e.hospital_phone = "Hospital phone is required";
      if (!formData.hospital_address.trim()) e.hospital_address = "Hospital address is required";
      if (formData.hospital_lat === null) e.hospital_lat = "Latitude is required";
      if (formData.hospital_lng === null) e.hospital_lng = "Longitude is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "mobile" ? value.replace(/\D/g, "") : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleLatLng = (field: "hospital_lat" | "hospital_lng", value: string) => {
    if (field === "hospital_lat") setLatInput(value);
    else setLngInput(value);
    const num = parseFloat(value);
    setFormData((prev) => ({ ...prev, [field]: isNaN(num) ? null : num }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAutoDetect = () => {
    setAutoDetecting(true);
    setAutoDetectMsg("");
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatInput(lat.toString());
        setLngInput(lng.toString());
        setFormData((prev) => ({ ...prev, hospital_lat: lat, hospital_lng: lng }));
        setAutoDetecting(false);
        setAutoDetectMsg("Location detected. Verify these match your hospital's actual coordinates.");
      },
      () => {
        setAutoDetecting(false);
        setAutoDetectMsg("Auto-detect failed. Please enter coordinates manually.");
      }
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setMessage(""); setLoading(true);
    try {
      await api.post("/signup", formData);
      router.push("/login");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
          <p className="text-sm text-gray-500 mt-1">Create your account to get started</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg shadow-gray-100 border border-gray-100 p-8">
          <form onSubmit={handleSignup} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input name="name" type="text" placeholder="John Doe"
                  className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.name ? "border-red-300" : "border-gray-200"}`}
                  value={formData.name} onChange={handleChange} />
              </div>
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input name="email" type="email" placeholder="you@example.com"
                  className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.email ? "border-red-300" : "border-gray-200"}`}
                  value={formData.email} onChange={handleChange} />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input name="password" type="password" placeholder="••••••••"
                  className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.password ? "border-red-300" : "border-gray-200"}`}
                  value={formData.password} onChange={handleChange} />
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            {/* Mobile */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input name="mobile" type="text" placeholder="9876543210" maxLength={10}
                  className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.mobile ? "border-red-300" : "border-gray-200"}`}
                  value={formData.mobile} onChange={handleChange} />
              </div>
              {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
            </div>

            {/* Role */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Role</label>
              <select name="role"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors"
                value={formData.role} onChange={handleChange}>
                <option value="patient">Patient</option>
                <option value="admin">Hospital Admin</option>
              </select>
            </div>

            {/* Admin hospital fields */}
            {formData.role === "admin" && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hospital Details</p>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Hospital Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input name="hospital_name" type="text" placeholder="City General Hospital"
                      className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.hospital_name ? "border-red-300" : "border-gray-200"}`}
                      value={formData.hospital_name} onChange={handleChange} />
                  </div>
                  {errors.hospital_name && <p className="text-xs text-red-500 mt-1">{errors.hospital_name}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Hospital Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input name="hospital_phone" type="text" placeholder="+91 9876543210"
                      className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.hospital_phone ? "border-red-300" : "border-gray-200"}`}
                      value={formData.hospital_phone} onChange={handleChange} />
                  </div>
                  {errors.hospital_phone && <p className="text-xs text-red-500 mt-1">{errors.hospital_phone}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Hospital Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                    <textarea name="hospital_address" rows={3} placeholder="123 Main Street, City, State - 600001"
                      className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.hospital_address ? "border-red-300" : "border-gray-200"}`}
                      value={formData.hospital_address} onChange={handleChange} />
                  </div>
                  {errors.hospital_address && <p className="text-xs text-red-500 mt-1">{errors.hospital_address}</p>}
                </div>

                {/* Coordinates */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-600">Hospital Coordinates</label>
                    <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline">Find on Google Maps</a>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Open Google Maps, right-click your hospital, and copy the coordinates shown.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Latitude</label>
                      <input type="number" step="any" placeholder="e.g. 13.0827"
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white transition-colors ${errors.hospital_lat ? "border-red-300" : "border-gray-200"}`}
                        value={latInput} onChange={(e) => handleLatLng("hospital_lat", e.target.value)} />
                      {errors.hospital_lat && <p className="text-xs text-red-500 mt-1">{errors.hospital_lat}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Longitude</label>
                      <input type="number" step="any" placeholder="e.g. 80.2707"
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white transition-colors ${errors.hospital_lng ? "border-red-300" : "border-gray-200"}`}
                        value={lngInput} onChange={(e) => handleLatLng("hospital_lng", e.target.value)} />
                      {errors.hospital_lng && <p className="text-xs text-red-500 mt-1">{errors.hospital_lng}</p>}
                    </div>
                  </div>
                  <button type="button" onClick={handleAutoDetect} disabled={autoDetecting}
                    className="mt-3 text-xs text-blue-600 hover:underline disabled:opacity-50">
                    {autoDetecting ? "Detecting..." : "Or use my current location as a starting point"}
                  </button>
                  {autoDetectMsg && (
                    <p className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-2">
                      {autoDetectMsg}
                    </p>
                  )}
                  {formData.hospital_lat && formData.hospital_lng && (
                    <a href={`https://www.google.com/maps?q=${formData.hospital_lat},${formData.hospital_lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs text-green-600 hover:underline">
                      Verify on map: {formData.hospital_lat.toFixed(5)}, {formData.hospital_lng.toFixed(5)}
                    </a>
                  )}
                </div>
              </div>
            )}

            {message && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {message}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm shadow-blue-200 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : <><UserPlus className="w-4 h-4" /> Create Account</>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

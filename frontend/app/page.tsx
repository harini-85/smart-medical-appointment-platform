"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Brain, MapPin, CalendarCheck, LayoutDashboard, LogIn, UserPlus } from "lucide-react";

export default function HomePage() {
  const [dashboardPath, setDashboardPath] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setDashboardPath(payload.role === "admin" ? "/admin" : "/patient");
      } catch {}
    }
  }, []);

  const steps = [
    {
      step: "01",
      title: "Enter Symptoms",
      desc: "Type your symptoms in natural language. Our system understands even incomplete or misspelled inputs using NLP techniques.",
      extra: "Example: chest pain and shortness of breath"
    },
    {
      step: "02",
      title: "AI Analysis",
      desc: "Our trained ML model processes your input and predicts the most relevant medical department with a confidence score.",
      extra: "Uses NLP + classification model"
    },
    {
      step: "03",
      title: "Book Appointment",
      desc: "Choose from available doctors nearby, select your preferred time slot, and confirm instantly.",
      extra: "Real-time slot availability"
    }
  ];

  const [active, setActive] = useState(0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">

      {/* Nav */}
      <header className="w-full px-8 py-5 flex justify-between items-center border-b border-white/60 bg-white/70 backdrop-blur sticky top-0 z-10">
        <span className="text-xl font-bold text-blue-700 tracking-tight">
          SmartCare
        </span>

        <div className="flex gap-3">
          {dashboardPath ? (
            <Link href={dashboardPath} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 rounded-xl border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 transition flex items-center gap-2">
                <LogIn className="w-4 h-4" /> Login
              </Link>
              <Link href="/signup" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center space-y-8">

          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            AI-Powered Healthcare Assistant
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
            Smart Hospital <br />
            <span className="text-blue-600">Appointment Booking</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Get accurate department predictions, discover nearby doctors, and book
            appointments seamlessly — powered by intelligent AI.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/login"
              className="px-8 py-3.5 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200 hover:scale-[1.02]">
              Get Started
            </Link>
            <Link href="/signup"
              className="px-8 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition hover:scale-[1.02]">
              Create Account
            </Link>
          </div>

          
        </div>
      </section>

      {/* Features */}
<section className="pb-20 px-6">
  <div className="max-w-5xl mx-auto text-center space-y-10">

    <h2 className="text-2xl font-bold text-gray-800">
      Core Features
    </h2>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {[
        {
          title: "AI-Based Department Prediction",
          desc: "Leverages NLP and machine learning to accurately map user symptoms to the most relevant medical department, even with incomplete or misspelled input.",
          Icon: Brain,
        },
        {
          title: "Location-Aware Doctor Discovery",
          desc: "Identifies nearby doctors based on user location and availability, helping patients find the most accessible healthcare options quickly.",
          Icon: MapPin,
        },
        {
          title: "Seamless Appointment Booking",
          desc: "Allows users to select time slots, confirm appointments instantly, and manage bookings through a smooth and intuitive workflow.",
          Icon: CalendarCheck,
        },
      ].map((f) => (
        <div
          key={f.title}
          className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1 text-left"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <f.Icon className="w-5 h-5" />
          </div>
          <p className="font-semibold text-gray-800 mt-4">{f.title}</p>
          <p className="text-sm text-gray-500 leading-relaxed mt-2">{f.desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>

      {/* Interactive How It Works */}
      <section className="pb-20 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto text-center space-y-10">

          <h2 className="text-2xl font-bold text-gray-800">
            How It Works
          </h2>

          {/* Step Buttons */}
          <div className="flex justify-center gap-4 flex-wrap">
            {steps.map((item, index) => (
              <button
                key={item.step}
                onClick={() => setActive(index)}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition
                  ${active === index
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-blue-50"}
                `}
              >
                {item.step}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="bg-white border border-gray-100 shadow-md rounded-3xl p-8 text-left transition-all">

            <div className="text-blue-600 font-bold text-lg">
              Step {steps[active].step}
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mt-2">
              {steps[active].title}
            </h3>

            <p className="text-gray-500 mt-3 leading-relaxed">
              {steps[active].desc}
            </p>

            <div className="mt-4 text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg inline-block">
              {steps[active].extra}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 h-2 rounded-full mt-6 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${((active + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Departments */}

<section className="pb-20 px-6">
  <div className="max-w-5xl mx-auto space-y-10">

    <h2 className="text-2xl font-bold text-gray-800 text-center">
      Supported Departments
    </h2>

    <p className="text-center text-gray-500 max-w-2xl mx-auto text-sm">
      Our system supports a wide range of medical departments, ensuring accurate
      routing of patients based on their symptoms and healthcare needs.
    </p>

    {/* Grid */}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

      {[
        { name: "General Medicine", desc: "Primary care and general health issues" },
        { name: "Cardiology", desc: "Heart and blood vessel conditions" },
        { name: "Dermatology", desc: "Skin, hair, and nail disorders" },
        { name: "Orthopedics", desc: "Bones, joints, and muscles" },
        { name: "Neurology", desc: "Brain and nervous system" },
        { name: "Pediatrics", desc: "Child healthcare services" },
        { name: "ENT", desc: "Ear, nose, and throat care" },
        { name: "Gynecology", desc: "Women’s reproductive health" },
        { name: "Psychiatry", desc: "Mental health and behavior" },
        { name: "Gastroenterology", desc: "Digestive system disorders" }
      ].map((dept) => (
        <div
          key={dept.name}
          className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
        >
          <p className="font-semibold text-gray-800 text-sm">
            {dept.name}
          </p>

          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {dept.desc}
          </p>

          {/* subtle underline hover */}
          <div className="h-[2px] w-0 bg-blue-600 mt-3 group-hover:w-full transition-all duration-300 rounded-full" />
        </div>
      ))}

    </div>

    

  </div>
</section>
      {/* CTA */}
<section className="pb-20 px-6">
  <div className="max-w-5xl mx-auto">

    <div className="bg-white border border-gray-100 rounded-3xl p-10 shadow-md flex flex-col md:flex-row items-center justify-between gap-8">

      {/* Left Content */}
      <div className="space-y-4 max-w-xl">
        <h3 className="text-2xl font-bold text-gray-800">
          Book Smarter Healthcare Appointments
        </h3>

        <p className="text-sm text-gray-500 leading-relaxed">
          Use AI-powered symptom analysis to identify the right department,
          discover nearby doctors, and schedule appointments efficiently —
          all in a single streamlined platform.
        </p>

        {/* Key Points */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
            AI-Based Prediction
          </span>
          <span className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
            Real-Time Availability
          </span>
          <span className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
            Secure Booking
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex flex-col sm:flex-row gap-3">

        <Link href="/signup"
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm text-center">
          Create Account
        </Link>

        <Link href="/login"
          className="px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-center">
          Login
        </Link>

      </div>

    </div>

    

  </div>
</section>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-400 pb-6">
        © {new Date().getFullYear()} SmartCare • AI-powered healthcare system
      </footer>
    </main>
  );
}
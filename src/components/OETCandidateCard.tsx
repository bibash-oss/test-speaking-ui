import React from "react";

export interface OETCandidateCardData {
  profession?: string; // "Medicine" | "Nursing"
  setting?: string;
  role?: string; // "Doctor" | "Nurse" | "DOCTOR"
  background?: string;
  tasks?: string[];
  patient_name?: string;
}

interface OETCandidateCardProps {
  data: OETCandidateCardData;
  className?: string;
}

/**
 * Authentic OET Candidate Card formatted exactly to the official OET paper examination standard.
 * Features:
 * - Solid grey header with "Candidate Card" on left, profession ("Medicine") on right.
 * - Crisp white card surface with thin border.
 * - Standard 2-column tabular grid with bold uppercase labels: SETTING, DOCTOR/NURSE, TASK.
 * - Disc bullet points for candidate tasks.
 */
export function OETCandidateCard({ data, className = "" }: OETCandidateCardProps) {
  const profession = data.profession || "Medicine";
  const roleLabel = (data.role || "DOCTOR").toUpperCase();
  const setting = data.setting || "Medical ward in a hospital";
  const background = data.background || "";
  const tasks = data.tasks && data.tasks.length > 0 ? data.tasks : [];

  return (
    <div
      className={`bg-white text-slate-900 border-2 border-[#707070] shadow-2xl rounded-none font-sans max-w-2xl w-full mx-auto select-text overflow-hidden ${className}`}
      style={{ fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif" }}
    >
      {/* Top Banner: Official OET Header Bar */}
      <div className="bg-[#707070] text-white px-5 py-2.5 flex items-center justify-between font-bold text-base sm:text-lg tracking-normal select-none">
        <span>Candidate Card</span>
        <span>{profession}</span>
      </div>

      {/* Card Content in authentic tabular layout */}
      <div className="p-6 sm:p-8 space-y-6 text-[15px] sm:text-[15.5px] leading-relaxed text-black">
        {/* SETTING Row */}
        <div className="grid grid-cols-[90px_1fr] sm:grid-cols-[115px_1fr] gap-4 sm:gap-6 items-baseline">
          <span className="font-bold tracking-wider text-black text-[15px] sm:text-[15.5px]">SETTING</span>
          <span className="text-black font-normal">{setting}</span>
        </div>

        {/* DOCTOR / NURSE (Role & Scenario Background) Row */}
        <div className="grid grid-cols-[90px_1fr] sm:grid-cols-[115px_1fr] gap-4 sm:gap-6 items-baseline">
          <span className="font-bold tracking-wider text-black text-[15px] sm:text-[15.5px]">{roleLabel}</span>
          <p className="text-black font-normal m-0 leading-relaxed text-justify sm:text-left">
            {background}
          </p>
        </div>

        {/* TASK Row */}
        <div className="grid grid-cols-[90px_1fr] sm:grid-cols-[115px_1fr] gap-4 sm:gap-6 items-start">
          <span className="font-bold tracking-wider text-black text-[15px] sm:text-[15.5px] pt-0.5">TASK</span>
          <ul className="list-disc pl-5 space-y-3 text-black font-normal m-0 text-justify sm:text-left marker:text-black">
            {tasks?.map((task, idx) => (
              <li key={idx} className="leading-relaxed pl-1">
                {task}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


"use client";

import React, { useState, useCallback } from "react";
import { Interviewer3DScene } from "./Interviewer3DScene";

// ────────────────────────────────────────────────────────────────────────────
// PRESENTATIONAL PIECES
// ────────────────────────────────────────────────────────────────────────────

export const SceneStyles = () => (
  <style>{`
    @keyframes uiFadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes uiRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
    @keyframes auraOut {
      0%   { opacity: 0;    transform: scale(0.8) }
      30%  { opacity: 0.55 }
      100% { opacity: 0;    transform: scale(1.45) }
    }
    @keyframes softGlow {
      0%, 100% { opacity: 0.35 }
      50%      { opacity: 0.75 }
    }
    @keyframes levelBar {
      0%, 100% { transform: scaleY(0.3) }
      50%      { transform: scaleY(0.9) }
    }
    @keyframes sweep {
      0%   { transform: translateX(-100%) }
      100% { transform: translateX(320%) }
    }
    .ui-fade  { animation: uiFadeIn .35s ease-out both }
    .ui-rise  { animation: uiRise .4s ease-out both }
    .ui-sweep { animation: sweep 1.35s ease-in-out infinite }
  `}</style>
);

/**
 * The candidate marker. Small on purpose - its only job is to say
 * "it is your turn" or "it is not your turn", plus show live mic level.
 */
export const YouIndicator = ({
  active,
  level = 0,
  status,
  hint,
}: {
  active: boolean;
  level?: number;
  status: string;
  hint: string;
}) => (
  <div
    className={`flex items-center gap-3 sm:gap-4 rounded-2xl border px-4 py-3 sm:px-5 sm:py-3.5 backdrop-blur-md transition-all duration-500 ${
      active
        ? "border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_26px_rgba(52,211,153,0.18)]"
        : "border-white/10 bg-white/[0.04]"
    }`}
  >
    {/* small candidate face */}
    <svg viewBox="0 0 60 60" className="w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0">
      <circle cx="30" cy="30" r="28" fill={active ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.05)"} />
      <ellipse cx="30" cy="24" rx="13" ry="14" fill="none" stroke={active ? "rgba(110,231,183,0.9)" : "rgba(148,163,184,0.6)"} strokeWidth="2.5" />
      <circle cx="25" cy="23" r="2.4" fill={active ? "#6ee7b7" : "rgba(148,163,184,0.8)"} />
      <circle cx="35" cy="23" r="2.4" fill={active ? "#6ee7b7" : "rgba(148,163,184,0.8)"} />
      {active ? (
        <ellipse
          cx="30"
          cy="31"
          rx="5"
          ry="2.6"
          fill="#6ee7b7"
          style={{ animation: "talk .4s ease-in-out infinite", transformOrigin: "30px 31px" }}
        />
      ) : (
        <path d="M25 31 Q30 34 35 31" fill="none" stroke="rgba(148,163,184,0.8)" strokeWidth="2" strokeLinecap="round" />
      )}
      <path d="M12 56 Q12 42 30 42 Q48 42 48 56" fill="none" stroke={active ? "rgba(110,231,183,0.7)" : "rgba(148,163,184,0.5)"} strokeWidth="2.5" />
    </svg>

    <div className="min-w-0 flex-1 text-left">
      <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">You</div>
      <div className={`text-sm sm:text-lg font-bold leading-tight truncate ${active ? "text-emerald-300" : "text-slate-400"}`}>
        {status}
      </div>
      <div className="text-[10px] sm:text-xs text-slate-500 truncate">{hint}</div>
    </div>

    {/* live mic level */}
    <div className="flex items-end gap-[3px] h-8 sm:h-9 flex-shrink-0" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const weight = i === 2 ? 1 : i === 1 || i === 3 ? 0.78 : 0.52;

        let transform: string | undefined = "scaleY(0.2)";
        let animation: string | undefined;
        if (active && level > 0) {
          transform = `scaleY(${Math.max(0.16, Math.min(1, level * weight * 1.5))})`;
        } else if (active) {
          transform = undefined;
          animation = `levelBar 1.1s ease-in-out ${i * 0.1}s infinite`;
        }

        return (
          <span
            key={i}
            className="w-[3px] sm:w-1 rounded-full"
            style={{
              height: "100%",
              transformOrigin: "bottom",
              background: active ? "rgba(110,231,183,0.85)" : "rgba(148,163,184,0.28)",
              transform,
              animation,
            }}
          />
        );
      })}
    </div>
  </div>
);

export interface InterviewerAvatarProps {
  isSpeaking?: boolean;
  speaking?: boolean;
  isListening?: boolean;
  isProcessing?: boolean;
  thinking?: boolean;
  compact?: boolean;
  fullScreen?: boolean;
  name?: string;
  roleSubtitle?: string;
  showChip?: boolean;
  audioElement?: HTMLAudioElement | null;
  lipsyncCues?: Array<[string, number, number]> | null;
  size?: number;
}

/**
 * Main InterviewerAvatar component used across the interview screen.
 * Displays the 3D examiner scene with lip-sync and interactive states.
 */
export const InterviewerAvatar = React.memo(function InterviewerAvatar({
  isSpeaking = false,
  speaking,
  isListening = false,
  isProcessing = false,
  thinking,
  compact = false,
  fullScreen = false,
  name,
  roleSubtitle,
  showChip = true,
  audioElement,
  lipsyncCues,
}: InterviewerAvatarProps) {
  const [has3DError, setHas3DError] = useState(false);

  const handle3DError = useCallback(() => {
    console.error("3D scene error loading model.");
    setHas3DError(true);
  }, []);

  const actualSpeaking = speaking !== undefined ? speaking : isSpeaking;
  const actualThinking = thinking !== undefined ? thinking : isProcessing;

  const statusText = actualSpeaking
    ? "Speaking"
    : actualThinking
    ? "Thinking"
    : isListening
    ? "Listening"
    : "Ready";

  const chipClass = actualSpeaking
    ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200"
    : actualThinking
    ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
    : isListening
    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
    : "border-white/12 bg-white/5 text-slate-400";

  const chipDotColor = actualSpeaking
    ? "#a5b4fc"
    : actualThinking
    ? "#fcd34d"
    : isListening
    ? "#6ee7b7"
    : "#64748b";

  // ─────────────────────────────────────────────────────────────────────────
  // FULL SCREEN INTERVIEWER STAGE (IMMERSIVE VIDEO-CALL EXPERIENCE)
  // ─────────────────────────────────────────────────────────────────────────
  if (fullScreen) {
    return (
      <div className="absolute inset-0 w-full h-full select-none overflow-hidden bg-slate-950">
        <SceneStyles />

        {/* Subtle Ambient Vignettes for UI Text Contrast */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950/80 via-slate-950/25 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent z-10" />

        {/* 3D Model Stage */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <Interviewer3DScene
            isSpeaking={actualSpeaking}
            isListening={isListening}
            isProcessing={actualThinking}
            audioElement={audioElement}
            lipsyncCues={lipsyncCues}
            fullScreen={true}
            onError={handle3DError}
          />
        </div>

        {/* Floating Top HUD Pill for Interviewer Status */}
        {(name || showChip) && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-2xl pointer-events-auto">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: chipDotColor,
                animation:
                  actualSpeaking || actualThinking || isListening
                    ? "softGlow .9s ease-in-out infinite"
                    : "none",
              }}
            />
            {name && (
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                {name}
              </span>
            )}
            <span className="text-xs text-slate-400 font-medium">• {statusText}</span>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FRAMED CARD AVATAR (COMPACT CARD PRESENTATION)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center select-none">
      <SceneStyles />

      {/* AVATAR DISPLAY AREA */}
      <div className="relative flex items-center justify-center">
        {/* Soft aura rings - radiate outward while the examiner talks */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: `${75 + i * 14}%`,
              height: `${75 + i * 14}%`,
              background:
                "radial-gradient(circle, rgba(129,140,248,0.18) 0%, rgba(129,140,248,0) 68%)",
              border: "1px solid rgba(165,180,252,0.24)",
              animation: actualSpeaking ? `auraOut 2.1s ease-out ${i * 0.55}s infinite` : "none",
              opacity: actualSpeaking ? undefined : 0,
            }}
            aria-hidden="true"
          />
        ))}

        {/* Ambient halo glow */}
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            width: "90%",
            height: "90%",
            background:
              "radial-gradient(circle, rgba(129,140,248,0.22) 0%, rgba(99,102,241,0.06) 55%, rgba(0,0,0,0) 72%)",
            animation: actualThinking ? "softGlow 1.6s ease-in-out infinite" : "none",
          }}
          aria-hidden="true"
        />

        <div
          className={`relative rounded-3xl border border-indigo-500/25 bg-gradient-to-b from-slate-900/50 via-slate-900/70 to-slate-950/90 shadow-[0_0_50px_rgba(99,102,241,0.22)] backdrop-blur-md overflow-hidden flex items-center justify-center ${
            compact
              ? "w-[150px] h-[150px] sm:w-[180px] sm:h-[180px]"
              : "w-[240px] h-[240px] sm:w-[320px] sm:h-[320px]"
          }`}
        >
          <Interviewer3DScene
            isSpeaking={actualSpeaking}
            isListening={isListening}
            isProcessing={actualThinking}
            audioElement={audioElement}
            lipsyncCues={lipsyncCues}
            compact={compact}
            onError={handle3DError}
          />
        </div>
      </div>

      {/* METADATA & STATUS CHIP */}
      {(name || showChip) && (
        <div className="text-center mt-3 flex flex-col items-center">
          {name && (
            <div className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-tight">
              {name}
            </div>
          )}
          {roleSubtitle && (
            <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mt-0.5">
              {roleSubtitle}
            </div>
          )}
          {showChip && (
            <div className="mt-2 flex items-center gap-2">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs sm:text-sm font-semibold transition-all duration-500 ${chipClass}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: chipDotColor,
                    animation:
                      actualSpeaking || actualThinking || isListening
                        ? "softGlow .9s ease-in-out infinite"
                        : "none",
                  }}
                />
                {statusText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  IconMicrophone,
  IconVolume,
  IconCheck,
  IconPlayerPlay,
  IconInfoCircle,
  IconShieldCheck,
  IconArrowRight,
  IconWaveSine,
  IconListCheck,
  IconChevronDown,
  IconAlertTriangle,
  IconRefresh,
  IconLock,
  IconArrowLeft,
} from "@tabler/icons-react";

export interface PreInterviewSetupProps {
  onStart: () => void;
  onExit?: () => void;
  backLabel?: string;
  isConnecting?: boolean;
  disabled?: boolean;
  role?: string;
  candidateName?: string;
  companyName?: string;
}

type MicPermissionState = "checking" | "prompt" | "requesting" | "granted" | "denied" | "error";
type MicStatusState = "untested" | "listening" | "working" | "error";
type SpeakerStatusState = "untested" | "playing" | "working";

export function PreInterviewSetup({
  onStart,
  onExit,
  backLabel,
  isConnecting = false,
  disabled = false,
  role,
  candidateName,
}: PreInterviewSetupProps) {
  // Device lists & selection
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");

  // Step 1: Microphone interactive states
  const [micPermission, setMicPermission] = useState<MicPermissionState>("checking");
  const [micStatus, setMicStatus] = useState<MicStatusState>("untested");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Step 2: Speaker interactive states
  const [speakerStatus, setSpeakerStatus] = useState<SpeakerStatusState>("untested");
  const [hasPlayedChime, setHasPlayedChime] = useState(false);

  // References to Web Audio resources
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // 1. Enumerate Audio Devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === "audioinput");
        const outputs = devices.filter((d) => d.kind === "audiooutput");

        setAudioInputDevices(inputs);
        setAudioOutputDevices(outputs);

        if (inputs.length > 0 && !selectedInputId) {
          setSelectedInputId(inputs[0].deviceId || "default");
        }
        if (outputs.length > 0 && !selectedOutputId) {
          setSelectedOutputId(outputs[0].deviceId || "default");
        }
      }
    } catch (err) {
      console.warn("Could not enumerate audio devices:", err);
    }
  }, [selectedInputId, selectedOutputId]);

  // Clean up any active stream and context
  const cleanupAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
  }, []);

  // Connect active media stream to analyser for live volume metering
  const attachStreamToAnalyser = useCallback(async (stream: MediaStream) => {
    cleanupAudio();
    streamRef.current = stream;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Resume context if browser started it in suspended state
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => { });
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let detectedFrames = 0;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(1, avg / 70); // 0.0 to 1.0

        setAudioLevel(normalized);

        // When candidate speaks, meter reacts and verifies mic
        if (normalized > 0.08) {
          setIsSpeaking(true);
          detectedFrames++;
          if (detectedFrames >= 5) {
            setMicStatus("working");
          }
        } else {
          setIsSpeaking(false);
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn("Failed to attach audio analyser:", e);
      setMicStatus("error");
    }
  }, [cleanupAudio]);

  // Request Microphone Permission (Triggered either by candidate click or verified permission)
  const requestMicAccess = useCallback(async (preferredDeviceId?: string) => {
    setMicPermission("requesting");
    try {
      const constraints: MediaStreamConstraints = {
        audio:
          preferredDeviceId && preferredDeviceId !== "default"
            ? { deviceId: { exact: preferredDeviceId } }
            : true,
      };

      // Native browser permission prompt triggers here
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMicPermission("granted");
      setMicStatus("listening");

      await updateDeviceList();
      await attachStreamToAnalyser(stream);
    } catch (err: unknown) {
      console.warn("Microphone access request failed:", err);
      const errorName = (err as { name?: string })?.name;
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        setMicPermission("denied");
      } else {
        setMicPermission("error");
      }
      setMicStatus("error");
    }
  }, [attachStreamToAnalyser, updateDeviceList]);

  // Check initial permission state without forcing prompt until candidate clicks or if already granted
  useEffect(() => {
    let ignore = false;

    async function checkPermissionInitially() {
      // Check permissions API if available
      if (typeof navigator !== "undefined" && navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (ignore) return;

          if (perm.state === "granted") {
            setMicPermission("granted");
            requestMicAccess();
          } else if (perm.state === "denied") {
            setMicPermission("denied");
          } else {
            // 'prompt' -> let candidate click "Allow Microphone Access"
            setMicPermission("prompt");
          }

          perm.onchange = () => {
            if (ignore) return;
            if (perm.state === "granted") {
              setMicPermission("granted");
              requestMicAccess();
            } else if (perm.state === "denied") {
              setMicPermission("denied");
              setMicStatus("error");
            }
          };
          return;
        } catch {
          // Fall back if query name 'microphone' not supported
        }
      }

      // Default state: prompt user to grant permission explicitly
      if (!ignore) {
        setMicPermission("prompt");
      }
    }

    void checkPermissionInitially();

    const handleDeviceChange = () => {
      void updateDeviceList();
    };

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }

    return () => {
      ignore = true;
      cleanupAudio();
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
    };
  }, [cleanupAudio, requestMicAccess, updateDeviceList]);

  // Switch microphone input device
  const handleDeviceChange = (deviceId: string) => {
    setSelectedInputId(deviceId);
    if (micPermission === "granted") {
      requestMicAccess(deviceId);
    }
  };

  // Step 2: Play Speaker Test Chime (C5 -> E5 -> G5)
  const playSpeakerTestSound = () => {
    if (speakerStatus === "playing") return;
    setSpeakerStatus("playing");

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.3); // G5

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);

      setTimeout(() => {
        setSpeakerStatus("untested");
        setHasPlayedChime(true);
        ctx.close().catch(() => { });
      }, 750);
    } catch (e) {
      console.warn("Failed to play test sound:", e);
      setSpeakerStatus("untested");
    }
  };

  const selectedMicLabel =
    audioInputDevices.find((d) => d.deviceId === selectedInputId)?.label ||
    (micPermission === "granted" ? "Default - System Microphone" : "Awaiting permission...");

  const selectedSpeakerLabel =
    audioOutputDevices.find((d) => d.deviceId === selectedOutputId)?.label ||
    "Default - System Speakers";

  // Total meter bars count
  const TOTAL_BARS = 20;
  const activeBarsCount = Math.round(audioLevel * TOTAL_BARS);

  // Verification check: both microphone and speakers MUST be working to proceed
  const isReadyToStart = micStatus === "working" && speakerStatus === "working";
  const completedStepsCount =
    (micStatus === "working" ? 1 : 0) + (speakerStatus === "working" ? 1 : 0);

  return (
    <div className="w-full max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6 select-none font-sans text-slate-800">
      {onExit && (
        <div className="mb-6">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <IconArrowLeft size={15} />
            <span>{backLabel || "Back to Assessment Stream Selection"}</span>
          </button>
        </div>
      )}

      {/* ─── 1. PAGE HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
            <IconWaveSine size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Interview Setup
              </h1>
              {role && (
                <span className="hidden md:inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {role}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {candidateName
                ? `Welcome ${candidateName}. Check your microphone and speakers before starting your interview.`
                : "Check your microphone and speakers before starting your interview."}
            </p>
          </div>
        </div>

        <div className="self-start sm:self-center">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${completedStepsCount === 2
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 border-slate-200/80 text-slate-600"
              }`}
          >
            {completedStepsCount === 2 ? "✓ Ready to Begin" : `Step ${completedStepsCount} of 2 Completed`}
          </span>
        </div>
      </div>

      {/* ─── 2. MAIN 2-COLUMN GRID ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: HARDWARE CHECKS (8 of 12 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-8">
          {/* SECTION A: MICROPHONE CHECK */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${micStatus === "working"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : micPermission === "denied"
                        ? "border-red-200 bg-red-50 text-red-600"
                        : "border-blue-100 bg-blue-50/60 text-blue-600"
                    }`}
                >
                  <IconMicrophone size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Step 1
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Microphone Check
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {micPermission !== "granted"
                      ? "Grant microphone permission so the AI interviewer can hear you."
                      : micStatus === "working"
                        ? "Your voice was detected clearly."
                        : "Speak a few words into your microphone to verify audio."}
                  </p>
                </div>
              </div>

              {/* Dynamic status pill */}
              <div>
                {micStatus === "working" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Working
                  </span>
                ) : micPermission === "requesting" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 animate-pulse">
                    Requesting...
                  </span>
                ) : micPermission === "denied" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Blocked
                  </span>
                ) : micPermission === "granted" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    Speak to test
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
                    Permission Needed
                  </span>
                )}
              </div>
            </div>

            {/* If Permission is Denied: Show guide to unblock */}
            {micPermission === "denied" && (
              <div className="p-4 rounded-xl bg-red-50/80 border border-red-200 mb-5">
                <div className="flex items-start gap-3">
                  <IconAlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-red-900">
                      Microphone Access Blocked by Browser
                    </div>
                    <p className="text-red-700 leading-relaxed">
                      Your browser or OS has blocked microphone access for this page.
                    </p>
                    <ol className="list-decimal pl-4 text-red-700 space-y-0.5 pt-1">
                      <li>Click the lock or site settings icon in your browser URL bar.</li>
                      <li>Change &quot;Microphone&quot; from &quot;Block&quot; to &quot;Allow&quot;.</li>
                      <li>Click the button below to re-check.</li>
                    </ol>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => requestMicAccess()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-xs text-xs transition-colors"
                      >
                        <IconRefresh size={14} />
                        Retry Microphone Permission
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If Permission is Not Yet Granted: Interactive Button to Trigger Native Browser Prompt */}
            {micPermission !== "granted" && micPermission !== "denied" && (
              <div className="p-5 rounded-xl bg-blue-50/70 border border-blue-200/80 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900">
                    Microphone permission required
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Click the button below to allow your browser to access the microphone.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => requestMicAccess()}
                  disabled={micPermission === "requesting"}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all shrink-0"
                >
                  <IconMicrophone size={16} />
                  <span>
                    {micPermission === "requesting" ? "Requesting..." : "Allow Microphone Access"}
                  </span>
                </button>
              </div>
            )}

            {/* Device Selector */}
            <div className="relative mb-5">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <IconMicrophone size={16} />
              </div>
              <select
                value={selectedInputId}
                disabled={micPermission !== "granted"}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
              >
                {audioInputDevices.length > 0 ? (
                  audioInputDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="default">Default - System Microphone</option>
                )}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <IconChevronDown size={16} />
              </div>
            </div>

            {/* Live Segmented Volume Level Bars */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1 flex-1 py-1">
                {Array.from({ length: TOTAL_BARS }).map((_, i) => {
                  const isActive = i < activeBarsCount;
                  return (
                    <span
                      key={i}
                      className={`h-4 sm:h-5 flex-1 rounded-sm transition-colors duration-75 ${isActive
                          ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
                          : "bg-slate-200/90"
                        }`}
                    />
                  );
                })}
              </div>
              <span className="text-xs font-medium text-slate-400 w-24 text-right shrink-0">
                {micPermission !== "granted"
                  ? "Standby"
                  : isSpeaking
                    ? "Speaking..."
                    : micStatus === "working"
                      ? "Listening..."
                      : "Say something..."}
              </span>
            </div>

            {/* Status Feedback Box */}
            {micStatus === "working" ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <IconCheck size={14} stroke={3} />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      Your microphone is working properly.
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      We can hear your voice clearly.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMicStatus("listening");
                    requestMicAccess(selectedInputId);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors shrink-0"
                >
                  <IconWaveSine size={14} />
                  Test again
                </button>
              </div>
            ) : micPermission === "granted" ? (
              <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>
                  Microphone enabled! Please speak a phrase like <strong>&quot;Hello, testing 1 2 3&quot;</strong> to confirm audio reception.
                </span>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100" />

          {/* SECTION B: SPEAKER CHECK */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${speakerStatus === "working"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : "border-blue-100 bg-blue-50/60 text-blue-600"
                    }`}
                >
                  <IconVolume size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Step 2
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Speaker Check
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Play a short sound to make sure you can hear the interviewer.
                  </p>
                </div>
              </div>

              <div>
                {speakerStatus === "working" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Working
                  </span>
                ) : speakerStatus === "playing" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 animate-pulse">
                    Playing...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Not Tested
                  </span>
                )}
              </div>
            </div>

            {/* Device Selector */}
            <div className="relative mb-5">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <IconVolume size={16} />
              </div>
              <select
                value={selectedOutputId}
                onChange={(e) => setSelectedOutputId(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm cursor-pointer"
              >
                {audioOutputDevices.length > 0 ? (
                  audioOutputDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Speaker ${i + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="default">Default - System Speakers</option>
                )}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <IconChevronDown size={16} />
              </div>
            </div>

            {/* Sound Test Box */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={playSpeakerTestSound}
                  disabled={speakerStatus === "playing"}
                  title="Play test chime"
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-all shrink-0 ${speakerStatus === "playing"
                      ? "bg-blue-400 animate-pulse cursor-wait"
                      : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                    }`}
                >
                  <IconPlayerPlay size={18} className="ml-0.5" />
                </button>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    Play test sound
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {speakerStatus === "playing"
                      ? "Playing test chime through your speakers..."
                      : "You should hear a short beep from your speakers."}
                  </div>
                </div>
              </div>

              <div>
                {speakerStatus === "working" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    <IconCheck size={12} stroke={3} />
                    Audio detected
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={playSpeakerTestSound}
                    disabled={speakerStatus === "playing"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors"
                  >
                    <IconPlayerPlay size={14} />
                    Test Speakers
                  </button>
                )}
              </div>
            </div>

            {/* Interactive confirmation after sound plays */}
            {hasPlayedChime && speakerStatus !== "working" && (
              <div className="mt-3 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <span className="text-xs font-medium text-slate-700">
                  Did you hear the test chime clearly from your speakers?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSpeakerStatus("working")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <IconCheck size={14} />
                    Yes, I heard it
                  </button>
                  <button
                    type="button"
                    onClick={playSpeakerTestSound}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors"
                  >
                    No, play again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DEVICE STATUS & TIPS (4 of 12 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* CARD 1: DEVICE STATUS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IconListCheck size={18} className="text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Device Status
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {completedStepsCount}/2 Verified
              </span>
            </div>

            <div className="space-y-4">
              {/* Mic Status Item */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${micStatus === "working"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                        : "border-blue-100 bg-blue-50/50 text-blue-600"
                      }`}
                  >
                    <IconMicrophone size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 leading-tight">
                      Microphone
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {selectedMicLabel}
                    </div>
                  </div>
                </div>

                <div>
                  {micStatus === "working" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Working
                    </span>
                  ) : micPermission === "denied" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 shrink-0">
                      Blocked
                    </span>
                  ) : micPermission === "granted" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 shrink-0">
                      Testing...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Speaker Status Item */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${speakerStatus === "working"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                        : "border-blue-100 bg-blue-50/50 text-blue-600"
                      }`}
                  >
                    <IconVolume size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 leading-tight">
                      Speakers
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {selectedSpeakerLabel}
                    </div>
                  </div>
                </div>

                <div>
                  {speakerStatus === "working" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Working
                    </span>
                  ) : speakerStatus === "playing" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 shrink-0">
                      Playing...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: TIPS FOR A BETTER EXPERIENCE */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3.5">
              <IconInfoCircle size={18} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Tips for a better experience
              </h3>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-600 pl-4 list-disc marker:text-slate-400 leading-relaxed">
              <li>Use a quiet environment</li>
              <li>Speak clearly and at a normal volume</li>
              <li>Make sure your speakers are not muted</li>
              <li>Use a wired headset if possible</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── 3. BOTTOM PRIVACY & START ACTION BAR ─────────────────────────── */}
      <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <IconShieldCheck size={18} className="text-slate-400 shrink-0" />
          <span>
            Your privacy matters. We only use these devices for the duration of your interview.
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!isReadyToStart && (
            <span className="text-xs text-amber-600 font-medium text-center sm:text-right">
              {micStatus !== "working" && speakerStatus !== "working"
                ? "Complete microphone & speaker tests to start"
                : micStatus !== "working"
                  ? "Complete microphone test to start"
                  : "Complete speaker test to start"}
            </span>
          )}

          <button
            type="button"
            onClick={onStart}
            disabled={disabled || isConnecting || !isReadyToStart}
            title={
              !isReadyToStart
                ? "Please verify both microphone and speakers to start the interview"
                : "Start AI Voice Interview"
            }
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shrink-0 ${isReadyToStart && !disabled && !isConnecting
                ? "bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-sm hover:shadow-md cursor-pointer"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none"
              }`}
          >
            <span>
              {isConnecting
                ? "Connecting..."
                : !isReadyToStart
                  ? "Start"
                  : "Start"}
            </span>
            {isReadyToStart ? (
              <IconArrowRight size={16} />
            ) : (
              <IconLock size={15} className="text-slate-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

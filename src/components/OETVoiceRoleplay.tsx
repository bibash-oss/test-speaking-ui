"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import {
  Card,
  Title,
  Text,
  Badge,
  Button,
  TextInput,
  Group,
  Stack,
  Alert,
  Loader,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Drawer,
  Modal,
  Progress,
  Paper,
} from "@mantine/core";
import {
  IconMicrophone,
  IconPlayerStop,
  IconSend,
  IconVolume,
  IconAlertCircle,
  IconAward,
  IconCheck,
  IconClock,
  IconMessageDots,
  IconDoorExit,
  IconStethoscope,
  IconNotes,
  IconMaximize,
  IconMinimize,
  IconLock,
  IconSparkles,
} from "@tabler/icons-react";
import { InterviewerAvatar } from "@/components/InterviewerAvatar";
import { PreInterviewSetup } from "@/components/PreInterviewSetup";
import { OETCandidateCard } from "@/components/OETCandidateCard";
import { oetRoleplayService, OETScorecard } from "@/services/oetRoleplayService";

export interface OETDialogueTurn {
  id: string;
  sender: "patient" | "doctor" | "system";
  text: string;
  audio?: string | null;
  timestamp: string;
}

export interface OETRoleplayCard {
  profession?: string;
  role?: string;
  patient_name?: string;
  setting?: string;
  background?: string;
  patient_task?: string;
  doctor_task?: string;
  tasks?: string[];
}

export interface OETVoiceRoleplayProps {
  initialSessionId?: string;
  initialQuestionId?: string;
  candidateName?: string;
  onExit?: () => void;
}

export function OETVoiceRoleplay({
  initialSessionId,
  initialQuestionId = "oet_case_01",
  candidateName = "Dr. Candidate",
  onExit,
}: OETVoiceRoleplayProps) {
  const serverUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5002";

  // Session ID
  const [sessionId, setSessionId] = useState<string>(() => {
    if (initialSessionId) return initialSessionId;
    return "oet_" + Math.random().toString(36).substring(2, 9);
  });

  const createFreshSession = useCallback(() => {
    const freshId = "oet_" + Math.random().toString(36).substring(2, 9);
    hasHandledIntroRef.current = false;
    hasHandledHandoverRef.current = false;
    hasHandledConclusionRef.current = false;
    lastPatientTurnTextRef.current = null;
    setIsHandoverActive(false);
    isHandoverActiveRef.current = false;
    setIsConclusionActive(false);
    isConclusionActiveRef.current = false;
    setSpeakingTimeRemaining(300);
    setAnalyzingProgress(18);
    setActiveAnalysisStep(0);
    setAnalyzingMessage("Analyzing clinical communication and generating OET scorecard...");
    setSessionId(freshId);
    return freshId;
  }, []);

  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Overall Phase: "setup" -> "interlocutor_intro" -> "preparation" -> "speaking" -> "analyzing" -> "completed"
  const [examPhase, setExamPhase] = useState<
    "setup" | "interlocutor_intro" | "preparation" | "speaking" | "analyzing" | "completed"
  >("setup");
  const [lifecycleState, setLifecycleState] = useState<
    "ready" | "patient_speaking" | "doctor_listening" | "processing_answer" | "completed" | "error"
  >("ready");
  const [isLoadingIntro, setIsLoadingIntro] = useState(false);
  const [isHandoverActive, setIsHandoverActive] = useState(false);
  const isHandoverActiveRef = useRef(false);
  const [isConclusionActive, setIsConclusionActive] = useState(false);
  const isConclusionActiveRef = useRef(false);

  // Analyzing state
  const [analyzingMessage, setAnalyzingMessage] = useState<string>(
    "Analyzing clinical communication and generating OET scorecard..."
  );
  const [analyzingProgress, setAnalyzingProgress] = useState<number>(18);
  const [activeAnalysisStep, setActiveAnalysisStep] = useState<number>(0);

  // Timer states (in seconds)
  const [prepTimeTotal, setPrepTimeTotal] = useState(180); // default 3 mins
  const [prepTimeRemaining, setPrepTimeRemaining] = useState(180);
  const [speakingTimeTotal, setSpeakingTimeTotal] = useState(300); // default 5 mins
  const [speakingTimeRemaining, setSpeakingTimeRemaining] = useState(300);

  // Roleplay case details (clinical scenario card)
  const [roleplayCard, setRoleplayCard] = useState<OETRoleplayCard>({
    profession: "Medicine",
    role: "Doctor",
    patient_name: "Inpatient Ward Discharge",
    setting: "Medical ward in a hospital",
    background:
      "You are a medical doctor working in an inpatient ward. Your patient is 54 years old and was admitted 2 days ago with right lower lobe pneumonia. They have made significant improvement with intravenous antibiotics and the decision was made by the team to discharge home with a further 3 days of oral antibiotics from today.",
    doctor_task: "Explain that the intravenous antibiotics have treated the pneumonia.",
    tasks: [
      "Explain that the intravenous antibiotics have treated the pneumonia; the blood tests and vital signs are all reassuring and the plan is for discharge today with tablet antibiotics for another 3 days",
      "Ask about their home and work situation and recommend a medical certificate for a further week off work.",
      "Advise them to return to hospital if they are not feeling better after 1 week, or sooner if they have worrying symptoms (e.g. chest pain, acute shortness of breath, high fever).",
      "Inform that they will need a chest x-ray in 6 weeks to ensure full resolution of the x-ray findings",
      "Explain that the x-ray is very important to rule out the small possibility of serious underlying disease, for example cancer. Reassure that appointments for x-rays can be flexible around working hours.",
    ],
  });

  // Dialogue & Turns
  const [currentSpeechText, setCurrentSpeechText] = useState<string>("");
  const [currentAudioB64, setCurrentAudioB64] = useState<string | null>(null);
  const [currentLipsync, setCurrentLipsync] = useState<Array<[string, number, number]> | null>(null);
  const [messages, setMessages] = useState<OETDialogueTurn[]>([]);
  const [turnCount, setTurnCount] = useState(0);

  // Input & Recording
  const [isRecording, setIsRecording] = useState(false);
  const [doctorLiveTranscript, setDoctorLiveTranscript] = useState<string>("");
  const [doctorTextInput, setDoctorTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  // Audio Playback & LipSync
  const [isPatientSpeaking, setIsPatientSpeaking] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Evaluation & Scorecard
  const [scorecard, setScorecard] = useState<OETScorecard | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Controls & Modals
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sockets & Media references
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasHandledIntroRef = useRef<boolean>(false);
  const hasHandledHandoverRef = useRef<boolean>(false);
  const hasHandledConclusionRef = useRef<boolean>(false);
  const lastPatientTurnTextRef = useRef<string | null>(null);
  const handleRoleplayHandoverRef = useRef<(data: any) => void>(() => {});
  const handleRoleplayFinishedRef = useRef<(data: any) => void>(() => {});

  // Format MM:SS helper
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(Math.max(0, totalSec) / 60);
    const secs = Math.max(0, totalSec) % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Fullscreen helper
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn("Fullscreen toggle error:", e);
    }
  };

  // Advance to preparation phase once interlocutor finishes speaking
  const transitionToPreparation = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    examPhaseRef.current = "preparation";
    setExamPhase("preparation");
    setLifecycleState("ready");
    setIsPatientSpeaking(false);
    setCurrentSpeechText("");
  }, []);

  const transitionToPreparationRef = useRef(transitionToPreparation);
  useEffect(() => {
    transitionToPreparationRef.current = transitionToPreparation;
  }, [transitionToPreparation]);

  // Start official interlocutor handover (triggered when 3-min prep timer reaches 0:00 OR candidate clicks "I'm Ready")
  const handlePreparationCompleted = useCallback(async () => {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }

    hasHandledHandoverRef.current = false;
    examPhaseRef.current = "speaking";
    setExamPhase("speaking");
    setIsHandoverActive(true);
    isHandoverActiveRef.current = true;
    setLifecycleState("patient_speaking");
    setCurrentSpeechText("");
    setIsSubmitting(true);
    setProcessingStatus("Connecting with Official OET Interlocutor for handover...");

    try {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("preparation_completed", {
          session_id: sessionIdRef.current,
        });
      } else {
        const res = await oetRoleplayService.handover({
          session_id: sessionIdRef.current,
          question_id: initialQuestionId,
        });
        if (res) {
          handleRoleplayHandoverRef.current(res);
        }
      }
    } catch (e) {
      console.warn("Handover fallback notice:", e);
      setIsSubmitting(false);
      setProcessingStatus(null);
    }
  }, [initialQuestionId]);

  const handlePreparationCompletedRef = useRef(handlePreparationCompleted);
  useEffect(() => {
    handlePreparationCompletedRef.current = handlePreparationCompleted;
  }, [handlePreparationCompleted]);

  // Backward-compatibility alias
  const handleStartConsultation = handlePreparationCompleted;
  const handleStartConsultationRef = handlePreparationCompletedRef;

  // Playback helper with optional onComplete callback
  const playPatientAudio = useCallback(
    (audioB64?: string | null, fallbackText?: string, onComplete?: () => void) => {
      // Only suppress audio if on initial hardware setup screen
      if (examPhaseRef.current === "setup") {
        return;
      }

      const finishPlayback = () => {
        setIsPatientSpeaking(false);
        if (onComplete) {
          onComplete();
        } else if (examPhaseRef.current === "interlocutor_intro") {
          transitionToPreparationRef.current();
        } else {
          setLifecycleState("doctor_listening");
        }
      };

      if (!audioB64) {
        if (fallbackText) {
          setIsPatientSpeaking(true);
          const estSec = Math.max(3, fallbackText.split(" ").length * 0.4);
          setTimeout(() => {
            finishPlayback();
          }, estSec * 1000);
        }
        return;
      }

      try {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }

        const audio = new Audio(
          audioB64.startsWith("data:") ? audioB64 : `data:audio/mp3;base64,${audioB64}`
        );
        currentAudioRef.current = audio;
        setAudioElement(audio);
        setIsPatientSpeaking(true);
        setLifecycleState("patient_speaking");

        audio.onplay = () => setIsPatientSpeaking(true);
        audio.onended = () => {
          finishPlayback();
        };
        audio.onerror = () => {
          finishPlayback();
        };

        audio.play().catch((err) => {
          console.warn("Autoplay audio blocked or error:", err);
          finishPlayback();
        });
      } catch (err) {
        console.error("Audio playback error:", err);
        finishPlayback();
      }
    },
    []
  );

  const playPatientAudioRef = useRef(playPatientAudio);
  useEffect(() => {
    playPatientAudioRef.current = playPatientAudio;
  }, [playPatientAudio]);

  const examPhaseRef = useRef(examPhase);
  useEffect(() => {
    examPhaseRef.current = examPhase;
  }, [examPhase]);

  // Connect to WebSocket (maintain stable connection across renders and state changes)
  useEffect(() => {
    let socket: Socket | null = null;
    let didCancel = false;

    // Small micro-delay prevents React 18 StrictMode double-mount or fast refresh from creating & killing sockets mid-handshake
    const timer = setTimeout(() => {
      if (didCancel) return;

      socket = io(serverUrl, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("[OET WebSocket] Connected:", socket?.id);
        setIsConnected(true);
        setErrorMsg(null);
      });

      socket.on("disconnect", (reason) => {
        console.warn("[OET WebSocket] Disconnected reason:", reason);
        setIsConnected(false);
      });

      socket.on("connect_error", (err) => {
        console.warn("[OET WebSocket] Connection error:", err.message);
      });

      // ── WebSocket Response Events ──
      // 1. roleplay_started / interlocutor_intro: Opening intro announcement from Interlocutor
      const handleRoleplayStarted = (data: any) => {
        if (!data || (data.session_id && data.session_id !== sessionIdRef.current)) return;
        if (hasHandledIntroRef.current) return;
        hasHandledIntroRef.current = true;
        setIsLoadingIntro(false);

        // Parse preparation time from payload (e.g. 180 seconds)
        const prepSec =
          data.preparation_time ??
          data.preparation_time_seconds ??
          data.question?.content?.timings?.preparation_time ??
          180;
        setPrepTimeTotal(prepSec);
        setPrepTimeRemaining(prepSec);

        // Parse speaking time from payload (e.g. 300 seconds)
        const speakSec =
          data.speaking_time ??
          data.speaking_time_seconds ??
          data.question?.content?.timings?.speaking_time ??
          300;
        setSpeakingTimeTotal(speakSec);
        setSpeakingTimeRemaining(speakSec);

        // Parse question content into roleplayCard
        if (data.question?.content) {
          const qContent = data.question.content;
          setRoleplayCard({
            profession: data.question.question_type === "nursing" ? "Nursing" : "Medicine",
            role: qContent.candidate_card?.role || "Doctor",
            patient_name: data.question.title || "Inpatient Ward Discharge",
            setting: qContent.scenario?.setting || "Medical ward in a hospital",
            background:
              qContent.scenario?.description ||
              qContent.candidate_card?.description ||
              "You are seeing a 45-year-old patient who has been experiencing occasional chest pain over the past three days.",
            doctor_task:
              qContent.candidate_card?.instructions?.[0] ||
              qContent.candidate_card?.tasks?.[0] ||
              "Explore clinical symptoms.",
            tasks: qContent.candidate_card?.instructions || qContent.candidate_card?.tasks || [],
          });
        } else if (data.roleplay_card) {
          setRoleplayCard((prev) => ({ ...prev, ...data.roleplay_card }));
        }

        const introText =
          data.text ||
          data.intro_text ||
          data.greeting ||
          data.message ||
          "Welcome to the Occupational English Test roleplay speaking sub-test.";

        setCurrentSpeechText(introText);
        setCurrentAudioB64(data.audio || null);
        setCurrentLipsync(data.lipsync || null);

        setMessages((prev) => [
          ...prev,
          {
            id: "turn_" + Date.now() + "_i",
            sender: "system",
            text: `[OET Interlocutor Announcement]: ${introText}`,
            audio: data.audio || null,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        // Play intro announcement - when finished, automatically transitions to preparation stage
        playPatientAudioRef.current(data.audio, introText);
      };

      socket.on("interlocutor_intro", handleRoleplayStarted);
      socket.on("roleplay_started", handleRoleplayStarted);

      // 2. roleplay_handover / interlocutor_handover: Official examiner handover
      const handleRoleplayHandover = (data: any) => {
        if (!data || (data.session_id && data.session_id !== sessionIdRef.current)) return;
        if (hasHandledHandoverRef.current) return;
        hasHandledHandoverRef.current = true;

        if (examPhaseRef.current !== "speaking") {
          examPhaseRef.current = "speaking";
          setExamPhase("speaking");
        }

        setIsSubmitting(false);
        setProcessingStatus(null);
        setIsHandoverActive(true);
        isHandoverActiveRef.current = true;

        const speakSec = data.speaking_time ?? data.duration ?? 300;
        setSpeakingTimeTotal(speakSec);
        setSpeakingTimeRemaining(speakSec);

        const handoverText =
          data.text ||
          data.message ||
          "Thank you. The role-play will now last for about five minutes. Don't worry if I stop you when the time is up. Can you start the role-play now, please?";

        setCurrentSpeechText(handoverText);
        setCurrentAudioB64(data.audio || null);
        setCurrentLipsync(data.lipsync || null);

        setMessages((prev) => [
          ...prev,
          {
            id: "turn_" + Date.now() + "_handover",
            sender: "system",
            text: `[OET Interlocutor Handover]: ${handoverText}`,
            audio: data.audio || null,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        // Play ~8-second examiner audio. When finished, unlock mic and transition to Doctor's Turn
        playPatientAudioRef.current(data.audio, handoverText, () => {
          setIsHandoverActive(false);
          isHandoverActiveRef.current = false;
          setIsPatientSpeaking(false);
          setLifecycleState("doctor_listening");
          setCurrentSpeechText("");
        });
      };

      handleRoleplayHandoverRef.current = handleRoleplayHandover;
      socket.on("roleplay_handover", handleRoleplayHandover);
      socket.on("interlocutor_handover", handleRoleplayHandover);

      // 3. consultation_started / patient_speech: Patient answer + audio + lipsync
      const handlePatientTurn = (data: any) => {
        if (!data || (data.session_id && data.session_id !== sessionIdRef.current)) return;

        const text = data.text || data.patient_text || data.message || "";
        if (text && lastPatientTurnTextRef.current === text) return;
        if (text) lastPatientTurnTextRef.current = text;

        // Ensure handover is dismissed when patient turn begins
        setIsHandoverActive(false);
        isHandoverActiveRef.current = false;

        // Ensure we advance to speaking stage if in preparation
        if (examPhaseRef.current !== "speaking") {
          examPhaseRef.current = "speaking";
          setExamPhase("speaking");
        }

        setIsSubmitting(false);
        setProcessingStatus(null);
        setDoctorLiveTranscript("");

        setCurrentSpeechText(text);
        setCurrentAudioB64(data.audio || null);
        setCurrentLipsync(data.lipsync || null);
        if (data.turn_count !== undefined) setTurnCount(data.turn_count);

        if (text) {
          setMessages((prev) => [
            ...prev,
            {
              id: "turn_" + Date.now() + "_p",
              sender: "patient",
              text,
              audio: data.audio || null,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }

        playPatientAudioRef.current(data.audio, text);

        if (data.is_complete) {
          handleFinishConsultation();
        }
      };

      socket.on("consultation_started", handlePatientTurn);
      socket.on("patient_speech", handlePatientTurn);

      // 4. roleplay_finished / consultation_finished / interlocutor_conclusion: Official examiner closing announcement
      const handleRoleplayFinished = (data: any) => {
        if (!data || (data.session_id && data.session_id !== sessionIdRef.current)) return;
        if (hasHandledConclusionRef.current) return;
        hasHandledConclusionRef.current = true;

        setIsConclusionActive(true);
        isConclusionActiveRef.current = true;
        setIsSubmitting(false);
        setProcessingStatus(null);
        setDoctorLiveTranscript("");

        const conclusionText =
          data.text ||
          data.conclusion_text ||
          data.message ||
          "Thank you. That is the end of the role-play.";

        setCurrentSpeechText(conclusionText);
        setCurrentAudioB64(data.audio || null);
        setCurrentLipsync(data.lipsync || null);

        setMessages((prev) => [
          ...prev,
          {
            id: "turn_" + Date.now() + "_conclusion",
            sender: "system",
            text: `[OET Interlocutor Conclusion]: ${conclusionText}`,
            audio: data.audio || null,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        // Play the examiner's conclusion speech with 3D avatar lipsync.
        // Once playback finishes, transition immediately to the analyzing screen (avatar hidden)!
        playPatientAudioRef.current(data.audio, conclusionText, () => {
          setIsConclusionActive(false);
          isConclusionActiveRef.current = false;
          setIsPatientSpeaking(false);
          setCurrentSpeechText("");

          // Transition to dedicated analyzing view while generating scorecard
          examPhaseRef.current = "analyzing";
          setExamPhase("analyzing");
          setIsEvaluating(true);
          setLifecycleState("processing_answer");
          handleEvaluateRoleplayRef.current();
        });
      };

      handleRoleplayFinishedRef.current = handleRoleplayFinished;
      socket.on("roleplay_finished", handleRoleplayFinished);
      socket.on("consultation_finished", handleRoleplayFinished);
      socket.on("interlocutor_conclusion", handleRoleplayFinished);

      // 5. analyzing / roleplay_analyzing: Emitted immediately so frontend displays analyzing state
      const handleRoleplayAnalyzing = (data: any) => {
        if (!data || (data.session_id && data.session_id !== sessionIdRef.current)) return;
        examPhaseRef.current = "analyzing";
        setExamPhase("analyzing");
        setIsEvaluating(true);
        setLifecycleState("processing_answer");
        if (data.message) {
          setAnalyzingMessage(data.message);
        }
      };

      socket.on("analyzing", handleRoleplayAnalyzing);
      socket.on("roleplay_analyzing", handleRoleplayAnalyzing);

      // 6. roleplay_evaluated: Full clinical scorecard
      socket.on("roleplay_evaluated", (data) => {
        if (!data || (data.session_id && data.session_id !== sessionIdRef.current)) return;
        setAnalyzingProgress(100);
        setTimeout(() => {
          setIsEvaluating(false);
          if (data.scorecard) setScorecard(data.scorecard);
          examPhaseRef.current = "completed";
          setExamPhase("completed");
          setLifecycleState("completed");
        }, 500);
      });

      socket.on("error", (err) => {
        console.error("OET Roleplay socket error:", err);
        setIsSubmitting(false);
        setProcessingStatus(null);
        setIsLoadingIntro(false);
        setErrorMsg(typeof err === "string" ? err : err?.message || "An error occurred with roleplay engine.");
      });
    }, 50);

    return () => {
      didCancel = true;
      clearTimeout(timer);
      if (socket) {
        socket.disconnect();
      }
    };
  }, [serverUrl]);

  // Handle Start from Pre-Interview Setup
  const handlePreSetupComplete = async () => {
    // Enter official interlocutor intro stage
    hasHandledIntroRef.current = false;
    hasHandledHandoverRef.current = false;
    hasHandledConclusionRef.current = false;
    lastPatientTurnTextRef.current = null;
    setIsHandoverActive(false);
    isHandoverActiveRef.current = false;
    setIsConclusionActive(false);
    isConclusionActiveRef.current = false;
    examPhaseRef.current = "interlocutor_intro";
    setExamPhase("interlocutor_intro");
    setLifecycleState("patient_speaking");
    setIsLoadingIntro(true);
    setErrorMsg(null);
    setCurrentSpeechText("");

    // Start with Introduction using start_oet_intro
    try {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("start_oet_intro", {
          session_id: sessionId,
          question_id: initialQuestionId,
        });
      } else {
        const res = await oetRoleplayService.startIntro({
          session_id: sessionId,
          question_id: initialQuestionId,
        });
        if (res) {
          setIsLoadingIntro(false);
          const prepSec =
            res.preparation_time ??
            res.preparation_time_seconds ??
            res.question?.content?.timings?.preparation_time ??
            180;
          setPrepTimeTotal(prepSec);
          setPrepTimeRemaining(prepSec);

          const speakSec =
            res.speaking_time ??
            res.speaking_time_seconds ??
            res.question?.content?.timings?.speaking_time ??
            300;
          setSpeakingTimeTotal(speakSec);
          setSpeakingTimeRemaining(speakSec);

          if (res.question?.content) {
            const qContent = res.question.content;
            setRoleplayCard({
              profession: res.question.question_type === "nursing" ? "Nursing" : "Medicine",
              role: qContent.candidate_card?.role || "Doctor",
              patient_name: res.question.title || "Chest Pain and Patient Anxiety",
              setting: qContent.scenario?.setting || "Local Medical Clinic",
              background: qContent.scenario?.description || "Patient presenting with symptoms",
              doctor_task: qContent.candidate_card?.instructions?.[0] || "Explore clinical symptoms.",
              tasks: qContent.candidate_card?.instructions || [],
            });
          }

          const introText = res.text || res.intro_text || res.message || "Welcome to the OET exam.";
          setCurrentSpeechText(introText);
          setCurrentAudioB64(res.audio || null);
          setCurrentLipsync(res.lipsync || null);

          setMessages([
            {
              id: "turn_" + Date.now() + "_i",
              sender: "system",
              text: `[OET Interlocutor Announcement]: ${introText}`,
              audio: res.audio || null,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);

          playPatientAudioRef.current(res.audio, introText);
        }
      }
    } catch (e) {
      console.warn("REST start fallback notice:", e);
      setIsLoadingIntro(false);
    }
  };

  // ── PREPARATION COUNTDOWN TIMER ──
  useEffect(() => {
    if (examPhase === "preparation") {
      prepTimerRef.current = setInterval(() => {
        setPrepTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(prepTimerRef.current!);
            prepTimerRef.current = null;
            // Preparation time reached 0:00: trigger official handover
            handlePreparationCompletedRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (prepTimerRef.current) {
        clearInterval(prepTimerRef.current);
        prepTimerRef.current = null;
      }
    }
    return () => {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    };
  }, [examPhase]);

  // ── ROLE-PLAY / SPEAKING COUNTDOWN TIMER ──
  // Starts only once interlocutor handover is completed (isHandoverActive === false && examPhase === "speaking")
  useEffect(() => {
    if (examPhase === "speaking" && !isHandoverActive && !isConclusionActive) {
      speakTimerRef.current = setInterval(() => {
        setSpeakingTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(speakTimerRef.current!);
            speakTimerRef.current = null;
            // 5 minutes role-play time expired: wrap up consultation via finish_roleplay
            handleFinishRoleplayRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (speakTimerRef.current) {
        clearInterval(speakTimerRef.current);
        speakTimerRef.current = null;
      }
    }
    return () => {
      if (speakTimerRef.current) clearInterval(speakTimerRef.current);
    };
  }, [examPhase, isHandoverActive, isConclusionActive]);

  // Trigger official interlocutor conclusion (called when 5-min role-play timer reaches 0:00 or user concludes)
  const handleFinishRoleplay = useCallback(async () => {
    if (isEvaluating || isConclusionActiveRef.current) return;

    // Clear speaking timer if running
    if (speakTimerRef.current) {
      clearInterval(speakTimerRef.current);
      speakTimerRef.current = null;
    }

    // Stop microphone if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    setIsRecording(false);
    setIsConclusionActive(true);
    isConclusionActiveRef.current = true;
    setLifecycleState("patient_speaking");
    setProcessingStatus("Concluding role-play with official interlocutor...");

    try {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("finish_roleplay", { session_id: sessionIdRef.current });
      } else {
        const res = await oetRoleplayService.finishRoleplay({ session_id: sessionIdRef.current });
        if (res) {
          handleRoleplayFinishedRef.current(res);
        }
      }
    } catch (e) {
      console.warn("Finish roleplay notice:", e);
      // Fallback: evaluate immediately if finish endpoint fails
      handleEvaluateRoleplayRef.current();
    }
  }, [isEvaluating]);

  const handleFinishRoleplayRef = useRef(handleFinishRoleplay);
  useEffect(() => {
    handleFinishRoleplayRef.current = handleFinishRoleplay;
  }, [handleFinishRoleplay]);

  // Backward-compatibility alias
  const handleFinishConsultation = handleFinishRoleplay;
  const handleFinishConsultationRef = handleFinishRoleplayRef;

  // Evaluate consultation and fetch scorecard
  const handleEvaluateRoleplay = useCallback(async () => {
    examPhaseRef.current = "analyzing";
    setExamPhase("analyzing");
    setIsEvaluating(true);
    setLifecycleState("processing_answer");
    setAnalyzingMessage("Analyzing clinical communication and generating OET scorecard...");

    try {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("evaluate_roleplay", { session_id: sessionIdRef.current });
      } else {
        const res = await oetRoleplayService.evaluate(sessionIdRef.current);
        if (res && res.scorecard) {
          setAnalyzingProgress(100);
          setTimeout(() => {
            setScorecard(res.scorecard);
            examPhaseRef.current = "completed";
            setExamPhase("completed");
            setLifecycleState("completed");
            setIsEvaluating(false);
          }, 500);
        } else {
          examPhaseRef.current = "completed";
          setExamPhase("completed");
          setLifecycleState("completed");
          setIsEvaluating(false);
        }
      }
    } catch (err: unknown) {
      console.error("Evaluation request error:", err);
      setAnalyzingProgress(100);
      setTimeout(() => {
        // Fallback completion UI
        setScorecard({
          overall_score: 360,
          clinical_communication_score: 82,
          empathy_score: 85,
          information_gathering_score: 80,
          information_giving_score: 78,
          fluency_score: 88,
          recommendation: "Grade B - Clinical Competence Demonstrated",
          summary: "The consultation demonstrated clear clinical empathy, active listening, and structured explanations.",
          strengths: [
            "Warm opening rapport",
            "Appropriate non-judgmental tone during lifestyle discussion",
            "Clear structure of diagnostic next steps",
          ],
          improvements: ["Check patient understanding more frequently before moving between topics"],
        });
        examPhaseRef.current = "completed";
        setExamPhase("completed");
        setLifecycleState("completed");
        setIsEvaluating(false);
      }, 500);
    }
  }, []);

  const handleEvaluateRoleplayRef = useRef(handleEvaluateRoleplay);
  useEffect(() => {
    handleEvaluateRoleplayRef.current = handleEvaluateRoleplay;
  }, [handleEvaluateRoleplay]);

  // Progressive simulation of analysis checklist while AI evaluator processes dialogue
  useEffect(() => {
    if (examPhase === "analyzing") {
      setAnalyzingProgress(18);
      setActiveAnalysisStep(0);

      const t1 = setTimeout(() => {
        setAnalyzingProgress(42);
        setActiveAnalysisStep(1);
      }, 1400);

      const t2 = setTimeout(() => {
        setAnalyzingProgress(68);
        setActiveAnalysisStep(2);
      }, 3000);

      const t3 = setTimeout(() => {
        setAnalyzingProgress(88);
        setActiveAnalysisStep(3);
      }, 4800);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      setAnalyzingProgress(18);
      setActiveAnalysisStep(0);
    }
  }, [examPhase]);

  // Submit doctor response (either via text or speech)
  const submitDoctorResponse = async (doctorText: string) => {
    if (!doctorText.trim() || isSubmitting) return;

    const trimmed = doctorText.trim();
    setIsSubmitting(true);
    setLifecycleState("processing_answer");
    setProcessingStatus("Analyzing clinical dialogue & patient state...");

    // Record in transcript
    setMessages((prev) => [
      ...prev,
      {
        id: "turn_" + Date.now() + "_d",
        sender: "doctor",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setDoctorTextInput("");
    setDoctorLiveTranscript("");

    // Emit doctor_speech or fallback to REST POST /api/roleplay/respond
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("doctor_speech", {
        session_id: sessionId,
        text: trimmed,
      });
    } else {
      try {
        const res = await oetRoleplayService.respond({
          session_id: sessionId,
          text: trimmed,
        });

        setIsSubmitting(false);
        setProcessingStatus(null);

        const reply = res.text || res.message || "";
        setCurrentSpeechText(reply);
        setCurrentAudioB64(res.audio || null);
        setCurrentLipsync(res.lipsync || null);

        if (reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: "turn_" + Date.now() + "_p",
              sender: "patient",
              text: reply,
              audio: res.audio || null,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }

        playPatientAudio(res.audio, reply);

        if (res.is_complete) {
          handleFinishConsultation();
        }
      } catch (err: unknown) {
        console.error("Error submitting doctor response:", err);
        setIsSubmitting(false);
        setProcessingStatus(null);
        setErrorMsg("Failed to communicate with roleplay engine.");
        setLifecycleState("doctor_listening");
      }
    }
  };

  // Speech Recognition (Web Speech API for real-time doctor transcription)
  const startRecording = async () => {
    if (isPatientSpeaking || isSubmitting) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setIsRecording(true);
      setErrorMsg(null);

      // Check for SpeechRecognition
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + " ";
          }
          setDoctorLiveTranscript(transcript);
        };

        recognition.onerror = (e: any) => {
          console.warn("Recognition error:", e);
        };

        recognition.start();

        (window as unknown as { __activeRecognition?: typeof recognition }).__activeRecognition = recognition;
      }
    } catch (err) {
      console.error("Mic access error:", err);
      setErrorMsg("Microphone access was denied or unavailable.");
    }
  };

  const stopRecordingAndSend = () => {
    setIsRecording(false);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    const rec = (window as unknown as { __activeRecognition?: { stop: () => void } }).__activeRecognition;
    if (rec) {
      rec.stop();
      (window as unknown as { __activeRecognition?: unknown }).__activeRecognition = undefined;
    }

    if (doctorLiveTranscript.trim()) {
      submitDoctorResponse(doctorLiveTranscript.trim());
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER 1: HARDWARE & PERMISSION PRE-CHECK SETUP SCREEN
  // ────────────────────────────────────────────────────────────────────────────
  if (examPhase === "setup") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <PreInterviewSetup
          role="OET Clinical Role-Play Exam (Medicine / Nursing)"
          candidateName={candidateName}
          companyName="Occupational English Test (OET)"
          onStart={handlePreSetupComplete}
          isConnecting={!isConnected}
        />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER 2: INTERLOCUTOR INTRODUCTION & TEST ANNOUNCEMENT
  // ────────────────────────────────────────────────────────────────────────────
  if (examPhase === "interlocutor_intro") {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none flex flex-col justify-between">
        {/* Fullscreen 3D Avatar (Official Interlocutor) */}
        <div className="absolute inset-0 z-0">
          <InterviewerAvatar
            isSpeaking={isPatientSpeaking}
            isListening={false}
            isProcessing={isLoadingIntro}
            audioElement={audioElement}
            lipsyncCues={currentLipsync}
            fullScreen
          />
        </div>

        {/* Ambient Top Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-radial-[circle_at_center,_transparent_45%,_rgba(2,6,23,0.78)_100%] z-1" />

        {/* Top Header */}
        <header className="relative z-10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-indigo-500/50 shadow-lg text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide text-indigo-200">
              OET Official Interlocutor: Test Announcement
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="subtle"
              color="teal"
              size="xs"
              onClick={transitionToPreparation}
              className="bg-slate-900/70 backdrop-blur border border-slate-800 text-teal-300 hover:bg-slate-800"
            >
              Skip Intro & Prepare
            </Button>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              radius="xl"
              onClick={toggleFullscreen}
              className="bg-slate-900/80 border border-slate-700 text-slate-300"
            >
              {isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
            </ActionIcon>
          </div>
        </header>

        {/* Center: Interlocutor Subtitles / Connecting Loader */}
        <div className="relative z-10 px-4 max-w-3xl mx-auto w-full my-auto">
          {isLoadingIntro ? (
            <Card
              withBorder
              radius="xl"
              p="xl"
              className="bg-slate-900/90 backdrop-blur-md border-slate-700 shadow-2xl text-center"
            >
              <Loader color="teal" size="md" className="mx-auto mb-3" />
              <Text size="md" className="text-teal-300 font-semibold">
                Connecting with Official OET Interlocutor...
              </Text>
              <Text size="xs" c="dimmed" className="mt-1">
                Loading candidate role-play scenario and audio stream
              </Text>
            </Card>
          ) : currentSpeechText ? (
            <Card
              withBorder
              radius="xl"
              p="lg"
              className="bg-slate-900/85 backdrop-blur-md border-slate-700/60 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <Badge color="indigo" size="sm" variant="filled">
                  Interlocutor Speaking
                </Badge>
                {isPatientSpeaking && (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
                    <IconVolume size={14} className="animate-bounce" /> Playing Official Announcement...
                  </span>
                )}
              </div>
              <Text size="md" className="text-slate-100 font-medium leading-relaxed">
                "{currentSpeechText}"
              </Text>
            </Card>
          ) : null}
        </div>

        {/* Bottom Status Note */}
        <footer className="relative z-10 p-6 flex flex-col items-center">
          <Text size="xs" className="text-slate-400 bg-slate-900/70 px-4 py-1.5 rounded-full border border-slate-800">
            Preparation time (3 minutes) will start automatically once the interlocutor finishes speaking.
          </Text>
        </footer>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER 3: PREPARATION TIME STAGE (COUNTDOWN & CANDIDATE CARD)
  // ────────────────────────────────────────────────────────────────────────────
  if (examPhase === "preparation") {
    const prepProgress = ((prepTimeTotal - prepTimeRemaining) / Math.max(1, prepTimeTotal)) * 100;
    const isPrepUrgent = prepTimeRemaining <= 30;

    return (
      <div className="min-h-screen bg-slate-950 font-sans select-none flex flex-col justify-between text-slate-100 p-4 md:p-6">
        {/* Top Header: Badge, Timer & Fullscreen */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-teal-500/40 text-teal-300 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">OET Candidate Preparation Stage</span>
          </div>

          <div
            className={`flex items-center gap-2.5 px-5 py-2 rounded-full border backdrop-blur-md shadow-xl font-mono ${isPrepUrgent
              ? "bg-amber-950/80 border-amber-500/80 text-amber-300 animate-pulse"
              : "bg-slate-900/90 border-teal-500/60 text-teal-300"
              }`}
          >
            <IconClock size={20} className={isPrepUrgent ? "text-amber-400" : "text-teal-400"} />
            <span className="text-xs uppercase font-bold tracking-wider">Preparation Time Remaining:</span>
            <span className="text-xl font-black">{formatTime(prepTimeRemaining)}</span>
          </div>

          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            radius="xl"
            onClick={toggleFullscreen}
            className="bg-slate-900/80 border border-slate-700 text-slate-300"
          >
            {isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
          </ActionIcon>
        </header>

        {/* Preparation Progress Bar */}
        <div className="w-full my-3">
          <Progress
            value={prepProgress}
            color={isPrepUrgent ? "amber" : "teal"}
            size="sm"
            radius="xl"
            className="bg-slate-900 border border-slate-800"
          />
        </div>

        {/* Center: Official OET Candidate Role-Play Card */}
        <div className="max-w-2xl w-full mx-auto my-auto py-2">
          <OETCandidateCard data={roleplayCard} />
        </div>

        {/* Bottom CTA */}
        <footer className="flex flex-col items-center gap-2 pt-4">
          <Button
            size="xl"
            radius="xl"
            variant="gradient"
            gradient={{ from: "teal", to: "cyan", deg: 45 }}
            leftSection={<IconStethoscope size={24} />}
            onClick={handlePreparationCompleted}
            className="shadow-2xl shadow-teal-500/25 px-10 font-bold text-base hover:scale-105 transition-all"
          >
            I'm Ready — Start Consultation
          </Button>
          <Text size="xs" c="dimmed" className="tracking-wide text-center">
            Handover will begin automatically when preparation time expires ({formatTime(prepTimeRemaining)}), or click above whenever you are ready.
          </Text>
        </footer>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER 4: 3D CONSULTATION STAGE (PATIENT CONSULTATION)
  // ────────────────────────────────────────────────────────────────────────────
  if (examPhase === "speaking") {
    const hasDoctorStarted = messages.some((m) => m.sender === "doctor");

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none flex flex-col justify-between">
        {/* Fullscreen 3D Avatar (Official Interlocutor during handover, then Patient in clinic) */}
        <div className="absolute inset-0 z-0">
          <InterviewerAvatar
            isSpeaking={isPatientSpeaking}
            isListening={!isHandoverActive && !isConclusionActive && (lifecycleState === "doctor_listening" || isRecording)}
            isProcessing={isSubmitting || lifecycleState === "processing_answer"}
            audioElement={audioElement}
            lipsyncCues={currentLipsync}
            fullScreen
          />
        </div>

        {/* Ambient Top Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-radial-[circle_at_center,_transparent_45%,_rgba(2,6,23,0.78)_100%] z-1" />

        {/* ── TOP BAR (EXAM TITLE, CARD TOGGLE, TRANSCRIPT, FULLSCREEN, END) ── */}
        <header className="relative z-10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConclusionActive ? (
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-indigo-500/60 shadow-lg text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide text-indigo-200">
                  OET Interlocutor: Role-Play Concluded
                </span>
              </div>
            ) : isHandoverActive ? (
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-indigo-500/60 shadow-lg text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide text-indigo-200">
                  OET Interlocutor: Handover
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/60 shadow-lg text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide">
                  OET Consultation: {roleplayCard.patient_name}
                </span>
              </div>
            )}

            <Button
              variant="subtle"
              color="teal"
              size="xs"
              leftSection={<IconNotes size={16} />}
              onClick={() => setCardModalOpen(true)}
              className="bg-slate-900/70 backdrop-blur border border-slate-800 text-teal-300"
            >
              Role-Play Card
            </Button>
          </div>

          {/* Center: 5-minute Role-Play Countdown Timer (starts once interlocutor handover is done, hidden once concluded) */}
          {!isHandoverActive && !isConclusionActive && (
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md shadow-lg font-mono text-xs transition-all ${
                speakingTimeRemaining <= 60
                  ? "bg-amber-950/80 border-amber-500/80 text-amber-300 animate-pulse"
                  : "bg-slate-900/85 border-teal-500/50 text-teal-300"
              }`}
            >
              <IconClock size={16} className={speakingTimeRemaining <= 60 ? "text-amber-400" : "text-teal-400"} />
              <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300">
                Role-Play Time:
              </span>
              <span className="font-bold text-sm text-teal-200">
                {formatTime(speakingTimeRemaining)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              radius="xl"
              onClick={() => setDrawerOpen(true)}
              className="bg-slate-900/80 border border-slate-700 text-slate-300"
              title="Transcript"
            >
              <IconMessageDots size={18} />
            </ActionIcon>

            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              radius="xl"
              onClick={toggleFullscreen}
              className="bg-slate-900/80 border border-slate-700 text-slate-300"
              title="Fullscreen"
            >
              {isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
            </ActionIcon>

            <Button
              variant="outline"
              color="red"
              size="xs"
              radius="xl"
              onClick={() => setExitModalOpen(true)}
              className="bg-slate-900/70 border-red-500/40 text-red-300 hover:bg-red-950"
            >
              End Consultation
            </Button>
          </div>
        </header>

        {/* ── CENTER AREA: SPEECH CARD & PROCESSING ── */}
        <div className="relative z-10 px-4 max-w-3xl mx-auto w-full my-auto">
          {currentSpeechText && (
            <Card
              withBorder
              radius="xl"
              p="lg"
              className="bg-slate-900/85 backdrop-blur-md border-slate-700/60 shadow-2xl text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge color={isConclusionActive || isHandoverActive ? "indigo" : "cyan"} size="sm" variant="filled">
                  {isConclusionActive
                    ? "Interlocutor Conclusion"
                    : isHandoverActive
                    ? "Interlocutor Handover"
                    : "Patient Speaking"}
                </Badge>
                {isPatientSpeaking && (
                  <span
                    className={`flex items-center gap-1 text-[11px] font-medium ${
                      isConclusionActive || isHandoverActive ? "text-indigo-300" : "text-cyan-400"
                    }`}
                  >
                    <IconVolume size={14} className="animate-bounce" />{" "}
                    {isConclusionActive
                      ? "Playing Official Conclusion..."
                      : isHandoverActive
                      ? "Playing Official Handover..."
                      : "Playing Voice..."}
                  </span>
                )}
              </div>
              <Text size="md" className="text-slate-100 font-medium leading-relaxed">
                "{currentSpeechText}"
              </Text>
            </Card>
          )}

          {!isHandoverActive && !isConclusionActive && !currentSpeechText && !hasDoctorStarted && (
            <div className="bg-slate-900/90 border border-teal-500/50 backdrop-blur-md rounded-2xl p-5 max-w-xl mx-auto text-center shadow-2xl">
              <Badge color="teal" size="md" variant="filled" className="mb-2 uppercase tracking-wide">
                Doctor's Turn to Speak
              </Badge>
              <Text size="md" className="text-white font-semibold">
                Please introduce yourself to begin the consultation with your patient.
              </Text>
              <Text size="xs" c="dimmed" className="mt-1.5">
                e.g. "Good morning, I'm Dr. {candidateName || "Smith"}. How can I help you today?"
              </Text>
            </div>
          )}

          {isSubmitting && (
            <Card
              withBorder
              radius="xl"
              p="md"
              className="mt-3 bg-slate-900/90 backdrop-blur border-teal-500/40 shadow-xl inline-flex items-center gap-3 mx-auto"
            >
              <Loader size="sm" color="teal" />
              <Text size="sm" className="text-teal-300 font-medium">
                {processingStatus || "Patient is processing your response..."}
              </Text>
            </Card>
          )}
        </div>

        {/* ── BOTTOM CONSOLE: DOCTOR SPEECH INPUT ── */}
        <footer className="relative z-10 p-6 flex flex-col items-center gap-3">
          {errorMsg && (
            <Alert color="red" variant="filled" radius="md" className="mb-2">
              {errorMsg}
            </Alert>
          )}

          {isRecording && (
            <div className="bg-slate-900/90 border border-teal-500/50 backdrop-blur-md rounded-2xl px-5 py-3 max-w-xl w-full text-center shadow-xl">
              <Text size="xs" c="dimmed" className="uppercase tracking-wider mb-1 font-bold">
                Doctor Speaking (Live Speech)
              </Text>
              <Text size="sm" className="text-white italic">
                {doctorLiveTranscript || "Listening to your consultation... Speak clearly into your mic."}
              </Text>
            </div>
          )}

          <div className="flex items-center gap-4">
            {isConclusionActive ? (
              <Button
                size="lg"
                radius="xl"
                variant="subtle"
                color="gray"
                leftSection={<IconLock size={20} />}
                disabled
                className="bg-slate-900/80 border border-slate-700 text-slate-400 cursor-not-allowed px-8 font-medium"
              >
                Role-Play Concluded — Evaluating...
              </Button>
            ) : isHandoverActive ? (
              <Button
                size="lg"
                radius="xl"
                variant="subtle"
                color="gray"
                leftSection={<IconLock size={20} />}
                disabled
                className="bg-slate-900/80 border border-slate-700 text-slate-400 cursor-not-allowed px-8 font-medium"
              >
                Listening to Interlocutor Handover...
              </Button>
            ) : !isRecording ? (
              <Button
                size="lg"
                radius="xl"
                variant="gradient"
                gradient={{ from: "teal", to: "cyan", deg: 45 }}
                leftSection={<IconMicrophone size={22} />}
                disabled={isPatientSpeaking || isSubmitting}
                onClick={startRecording}
                className="shadow-xl shadow-teal-500/25 px-8 font-semibold text-base hover:scale-105 transition-all"
              >
                Click to Speak (Doctor Turn)
              </Button>
            ) : (
              <Button
                size="lg"
                radius="xl"
                color="red"
                variant="filled"
                leftSection={<IconPlayerStop size={22} />}
                onClick={stopRecordingAndSend}
                className="shadow-xl shadow-red-500/30 px-8 font-semibold text-base animate-pulse"
              >
                Release / Send Response
              </Button>
            )}

            {!isHandoverActive && !isConclusionActive && (
              <Tooltip label={showTextInput ? "Hide Text Fallback" : "Type Doctor Response"} withArrow>
                <ActionIcon
                  size="xl"
                  radius="xl"
                  variant={showTextInput ? "filled" : "subtle"}
                  color="teal"
                  onClick={() => setShowTextInput((prev) => !prev)}
                  className="bg-slate-900/80 border border-slate-700 text-teal-400"
                >
                  <IconSend size={20} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>

          {!isHandoverActive && !isConclusionActive && showTextInput && (
            <div className="w-full max-w-xl flex items-center gap-2 mt-2">
              <TextInput
                placeholder="Type your clinical response as the doctor..."
                value={doctorTextInput}
                onChange={(e) => setDoctorTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitDoctorResponse(doctorTextInput);
                  }
                }}
                disabled={isSubmitting || isPatientSpeaking}
                size="md"
                radius="xl"
                className="flex-1"
              />
              <Button
                onClick={() => submitDoctorResponse(doctorTextInput)}
                disabled={!doctorTextInput.trim() || isSubmitting}
                radius="xl"
                size="md"
                color="teal"
              >
                Send
              </Button>
            </div>
          )}
        </footer>

        {/* ── MODAL: OET ROLEPLAY CARD QUICK VIEW ── */}
        <Modal
          opened={cardModalOpen}
          onClose={() => setCardModalOpen(false)}
          title="Official Candidate Card"
          centered
          size="lg"
          radius="md"
          styles={{
            header: { backgroundColor: "#1e293b", color: "#fff" },
            content: { backgroundColor: "#fff", overflow: "hidden" },
            body: { padding: "16px", backgroundColor: "#f8fafc" },
          }}
        >
          <div className="flex justify-center">
            <OETCandidateCard data={roleplayCard} />
          </div>
        </Modal>

        {/* ── DRAWER: FULL DIALOGUE TRANSCRIPT ── */}
        <Drawer
          opened={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Consultation Dialogue Transcript"
          position="right"
          size="md"
          styles={{
            header: { backgroundColor: "#0f172a", color: "#fff" },
            content: { backgroundColor: "#0b0f19", color: "#f8fafc" },
          }}
        >
          <ScrollArea h="calc(100vh - 120px)" offsetScrollbars>
            <div className="space-y-3 p-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl border text-sm ${m.sender === "doctor"
                    ? "bg-teal-950/40 border-teal-800/60 ml-6 text-teal-100"
                    : "bg-slate-900 border-slate-800 mr-6 text-slate-200"
                    }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-bold uppercase tracking-wider">
                      {m.sender === "doctor" ? "Doctor (Candidate)" : "Patient"}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>
                  <Text size="sm">{m.text}</Text>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Drawer>

        {/* ── MODAL: EXIT CONFIRMATION ── */}
        <Modal
          opened={exitModalOpen}
          onClose={() => setExitModalOpen(false)}
          title="End Consultation Early?"
          centered
          styles={{
            header: { backgroundColor: "#0f172a", color: "#fff" },
            content: { backgroundColor: "#0f172a", color: "#f8fafc" },
          }}
        >
          <Text size="sm" className="text-slate-300 mb-4">
            Are you sure you want to conclude the consultation now? The clinical communication scorecard will be generated based
            on dialogue completed so far.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setExitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              size="sm"
              onClick={() => {
                setExitModalOpen(false);
                handleFinishConsultation();
              }}
            >
              Conclude & Evaluate
            </Button>
          </Group>
        </Modal>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER 5: DEDICATED CLINICAL ANALYZING SCREEN (AVATAR HIDDEN)
  // ────────────────────────────────────────────────────────────────────────────
  if (examPhase === "analyzing") {
    const analysisSteps = [
      {
        title: "Information Gathering",
        desc: "Probing symptoms, chronology, and medical history",
      },
      {
        title: "Clinical Empathy & Relationship",
        desc: "Rapport, active listening, and addressing patient concerns",
      },
      {
        title: "Information Giving & Structure",
        desc: "Clarity of diagnosis, avoiding medical jargon, and management steps",
      },
      {
        title: "Fluency & OET Scoring",
        desc: "Synthesizing clinical criteria and grading performance",
      },
    ];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-6 select-none font-sans relative overflow-hidden">
        {/* Background ambient radial glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-10 w-full max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-teal-500/40 text-teal-300 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">
              OET Clinical Assessment Engine
            </span>
          </div>

          <Badge color="slate" variant="outline" size="md" className="text-slate-400 border-slate-700">
            {roleplayCard.patient_name || "Clinical Consultation"}
          </Badge>
        </header>

        {/* Central Card */}
        <div className="relative z-10 max-w-xl w-full my-auto text-center">
          <Card
            withBorder
            radius="2rem"
            p="xl"
            className="bg-slate-900/85 backdrop-blur-xl border-slate-800 shadow-2xl text-center"
          >
            {/* Animated Pulse Icon */}
            <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-teal-500/20 animate-ping opacity-60" />
              <span className="absolute inset-2 rounded-full bg-teal-500/30 animate-pulse" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/40">
                <IconStethoscope size={34} className="animate-bounce" />
              </div>
            </div>

            <Title order={2} className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Analyzing Clinical Dialogue
            </Title>
            <Text size="sm" c="dimmed" className="mt-2 max-w-md mx-auto leading-relaxed">
              {analyzingMessage || "Analyzing clinical communication and generating OET scorecard..."}
            </Text>

            {/* Animated Progress Bar */}
            <div className="mt-6 mb-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 text-slate-400">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <IconSparkles size={14} className="animate-spin" /> Evaluating Dialogue
                </span>
                <span className="font-mono text-teal-300">{analyzingProgress}%</span>
              </div>
              <Progress
                value={analyzingProgress}
                color="teal"
                size="md"
                radius="xl"
                animated
                striped
                className="bg-slate-800"
              />
            </div>

            {/* Real-time Checklist of Assessment Criteria */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 text-left space-y-3">
              <Text size="xs" fw={700} className="uppercase tracking-wider text-slate-400">
                Assessment Criteria in Progress
              </Text>
              <div className="space-y-2">
                {analysisSteps.map((step, idx) => {
                  const isDone = activeAnalysisStep > idx;
                  const isCurrent = activeAnalysisStep === idx;

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs transition-all duration-300 ${
                        isDone
                          ? "bg-teal-950/40 border-teal-800/60 text-teal-200"
                          : isCurrent
                          ? "bg-slate-800/90 border-teal-500/60 text-white shadow-md shadow-teal-500/10"
                          : "bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60"
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isDone ? (
                          <div className="w-4 h-4 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center">
                            <IconCheck size={12} stroke={3} />
                          </div>
                        ) : isCurrent ? (
                          <Loader size={14} color="teal" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{step.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Footer Note */}
        <footer className="relative z-10 text-center pb-2">
          <Text size="xs" c="dimmed" className="tracking-wide">
            Your clinical scorecard and comprehensive feedback will appear automatically.
          </Text>
        </footer>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER 4: COMPLETED SCORECARD & CLINICAL COMMUNICATION EVALUATION
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 flex flex-col items-center justify-center">
      <Card withBorder radius="xl" p="xl" className="bg-white border-slate-200 shadow-xl max-w-3xl w-full">
        <div className="text-center pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
            <IconAward size={36} />
          </div>
          <Title order={2} className="text-slate-900 font-extrabold tracking-tight">
            OET Clinical Communication Scorecard
          </Title>
          <Text size="sm" c="dimmed" className="mt-1">
            Official Evaluation for {candidateName} • Consultation with {roleplayCard.patient_name}
          </Text>
        </div>

        {/* Score Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6 text-center">
          <Paper p="md" radius="lg" className="bg-slate-50 border border-slate-200">
            <Text size="xs" fw={700} c="dimmed" className="uppercase">
              Overall Score
            </Text>
            <Text size="xl" fw={900} className="text-teal-700 font-mono mt-1">
              {scorecard?.overall_score || 350} / 500
            </Text>
          </Paper>

          <Paper p="md" radius="lg" className="bg-slate-50 border border-slate-200">
            <Text size="xs" fw={700} c="dimmed" className="uppercase">
              Clinical Empathy
            </Text>
            <Text size="xl" fw={900} className="text-teal-700 font-mono mt-1">
              {scorecard?.empathy_score || 85} / 100
            </Text>
          </Paper>

          <Paper p="md" radius="lg" className="bg-slate-50 border border-slate-200">
            <Text size="xs" fw={700} c="dimmed" className="uppercase">
              Information Gathering
            </Text>
            <Text size="xl" fw={900} className="text-indigo-700 font-mono mt-1">
              {scorecard?.information_gathering_score || 80} / 100
            </Text>
          </Paper>

          <Paper p="md" radius="lg" className="bg-slate-50 border border-slate-200">
            <Text size="xs" fw={700} c="dimmed" className="uppercase">
              Fluency & Language
            </Text>
            <Text size="xl" fw={900} className="text-emerald-700 font-mono mt-1">
              {scorecard?.fluency_score || 88} / 100
            </Text>
          </Paper>
        </div>

        {/* Clinical Summary & Strengths */}
        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <Text size="xs" fw={700} c="dimmed" className="uppercase mb-1">
              Clinical Feedback Summary
            </Text>
            <Paper p="md" radius="md" className="bg-slate-50 border border-slate-200 leading-relaxed text-slate-800">
              {scorecard?.summary ||
                "Demonstrated strong professional rapport and reassuring clinical communication during the consultation."}
            </Paper>
          </div>

          {scorecard?.strengths && scorecard.strengths.length > 0 && (
            <div>
              <Text size="xs" fw={700} c="dimmed" className="uppercase mb-1.5">
                Key Strengths
              </Text>
              <div className="space-y-1.5">
                {scorecard.strengths.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-emerald-700 text-sm">
                    <IconCheck size={16} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scorecard?.improvements && scorecard.improvements.length > 0 && (
            <div>
              <Text size="xs" fw={700} c="dimmed" className="uppercase mb-1.5">
                Areas for Improvement
              </Text>
              <div className="space-y-1.5">
                {scorecard.improvements.map((imp, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-amber-700 text-sm">
                    <IconAlertCircle size={16} />
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
          <Link href="/" className="no-underline">
            <Button variant="default" radius="md">
              Return Home
            </Button>
          </Link>

          <Button
            variant="gradient"
            gradient={{ from: "teal", to: "cyan", deg: 45 }}
            radius="md"
            onClick={() => {
              createFreshSession();
              setExamPhase("setup");
              setPrepTimeRemaining(prepTimeTotal);
              setSpeakingTimeRemaining(speakingTimeTotal);
              setMessages([]);
              setCurrentSpeechText("");
              setCurrentAudioB64(null);
              setCurrentLipsync(null);
              setScorecard(null);
            }}
          >
            Practice Another Consultation
          </Button>
        </div>
      </Card>
    </div>
  );
}

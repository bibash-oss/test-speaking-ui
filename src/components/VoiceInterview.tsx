"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
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
} from "@mantine/core";
import {
  IconMicrophone,
  IconPlayerStop,
  IconSend,
  IconVolume,
  IconAlertCircle,
  IconAward,
  IconCheck,
  IconSparkles,
  IconMessageDots,
  IconDoorExit,
  IconKeyboard,
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import { InterviewerAvatar } from "@/components/InterviewerAvatar";
import { PreInterviewSetup } from "@/components/PreInterviewSetup";
import { CandidateRegistrationCard } from "@/components/CandidateRegistrationCard";

export type InterviewLifecycleState =
  | "ready"
  | "interviewer_speaking"
  | "candidate_listening"
  | "processing_answer"
  | "completed"
  | "error";

export interface ScorecardData {
  overall_score?: number;
  recommendation?: string;
  summary?: string;
  technical_depth_score?: number;
  communication_score?: number;
  problem_solving_score?: number;
  strengths?: string[];
  concerns?: string[];
  improvements?: string[];
  [key: string]: unknown;
}

export interface DialogueTurn {
  id: string;
  sender: "interviewer" | "candidate" | "system";
  text: string;
  audio?: string | null;
  timestamp: string;
}

export interface VoiceInterviewProps {
  initialSessionId?: string;
  initialRole?: string;
  initialLevel?: string;
  candidateName?: string;
  companyName?: string;
  onExit?: () => void;
}

export function VoiceInterview({
  initialSessionId,
  initialRole,
  initialLevel,
  candidateName = "Candidate",
  companyName = "Ktmbees",
  onExit,
}: VoiceInterviewProps = {}) {
  const serverUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5002";

  // Session ID management (uses initialSessionId if provided, or registeredSessionId from candidate card)
  const [registeredSessionId, setRegisteredSessionId] = useState<string | null>(
    initialSessionId || null
  );
  const [currentCandidateName, setCurrentCandidateName] = useState<string>(candidateName !== "Candidate" ? candidateName : "");
  const [currentRole, setCurrentRole] = useState<string>(initialRole || "");
  const [currentLevel, setCurrentLevel] = useState<string>(initialLevel || "");
  const [currentCompany, setCurrentCompany] = useState<string>(companyName || "");

  const sessionId = registeredSessionId || "";

  // Dynamic role, level, candidate and company from backend session or props
  const [sessionRole, setSessionRole] = useState<string>("");
  const [sessionLevel, setSessionLevel] = useState<string>("");
  const [sessionCompany, setSessionCompany] = useState<string>("");
  const [sessionCandidate, setSessionCandidate] = useState<string>("");
  const [, setJobDescription] = useState<string>("");

  const role = sessionRole || currentRole || initialRole || "";
  const company = sessionCompany || currentCompany || companyName || "Ktmbees";
  const candidate = sessionCandidate || currentCandidateName || candidateName || "Candidate";

  // Lifecycle states
  const [isConnected, setIsConnected] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [lifecycleState, setLifecycleState] = useState<InterviewLifecycleState>("ready");
  const [, setStage] = useState(1);
  const [totalStages, setTotalStages] = useState(10);
  const [answeredStages, setAnsweredStages] = useState(0);

  // Active question & dialog
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentAudioB64, setCurrentAudioB64] = useState<string | null>(null);
  const [currentLipsync, setCurrentLipsync] = useState<Array<[string, number, number]> | null>(null);
  const [messages, setMessages] = useState<DialogueTurn[]>([]);

  // Processing & status
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [candidateLiveTranscript, setCandidateLiveTranscript] = useState<string>("");

  // Candidate Recording & input
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio playback & lip sync
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Completion & scorecard
  const [isCompleted, setIsCompleted] = useState(false);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string>(
    "Your interview has been completed."
  );
  // UI Modals & Drawers
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcriptDrawerOpen, setTranscriptDrawerOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen helper functions (Browser Native Fullscreen Mode)
  const enterFullscreen = useCallback(async () => {
    try {
      if (typeof document === "undefined") return;
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request not permitted or was dismissed:", err);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (typeof document === "undefined") return;
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      if (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      ) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Could not exit fullscreen mode:", err);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      void exitFullscreen();
    } else {
      void enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Track browser native fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      const isFs = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Lock body & html scroll during active interview to prevent scrolling or page offset
  useEffect(() => {
    if (isInterviewActive) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [isInterviewActive]);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const hasEmittedFinishedRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string>(sessionId);
  const pendingCompletionDataRef = useRef<{
    scorecard?: ScorecardData | null;
    message?: string;
  } | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Helper to cleanup media recorder and microphone tracks
  const stopMediaTracks = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Already stopped
      }
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Helper to stop any active audio playback
  const stopAudioPlayback = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {
        // Paused
      }
      currentAudioRef.current = null;
    }
    setIsInterviewerSpeaking(false);
    setAudioElement(null);
  }, []);

  // Play Kokoro TTS Audio and synchronize playback_finished event
  const playInterviewerAudio = useCallback(
    (base64Audio: string | null, text: string) => {
      stopAudioPlayback();
      hasEmittedFinishedRef.current = false;

      if (!base64Audio) {
        // Graceful fallback if Kokoro audio is missing
        setIsInterviewerSpeaking(true);
        // Estimate reading time: ~180 words per minute, min 2.5s
        const wordCount = (text || "").split(/\s+/).length;
        const readingMs = Math.max(2500, Math.min(8000, (wordCount / 3) * 1000));

        const timer = setTimeout(() => {
          setIsInterviewerSpeaking(false);
          if (!hasEmittedFinishedRef.current) {
            hasEmittedFinishedRef.current = true;
            if (socketRef.current) {
              socketRef.current.emit("playback_finished", { session_id: sessionIdRef.current });
            }
          }
          // If pending completion, trigger completion screen now
          if (pendingCompletionDataRef.current) {
            setIsCompleted(true);
          }
        }, readingMs);

        return () => clearTimeout(timer);
      }

      try {
        const audioUrl = `data:audio/wav;base64,${base64Audio}`;
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        setAudioElement(audio);

        // Synchronize speaking state only when audio playback actually starts outputting sound
        audio.onplay = () => {
          setIsInterviewerSpeaking(true);
        };
        audio.onplaying = () => {
          setIsInterviewerSpeaking(true);
        };
        audio.onpause = () => {
          setIsInterviewerSpeaking(false);
        };

        audio.onended = () => {
          setIsInterviewerSpeaking(false);
          setAudioElement(null);
          if (!hasEmittedFinishedRef.current) {
            hasEmittedFinishedRef.current = true;
            if (socketRef.current) {
              socketRef.current.emit("playback_finished", { session_id: sessionIdRef.current });
            }
          }
          // If this was the closing farewell audio, show completion screen now
          if (pendingCompletionDataRef.current) {
            setIsCompleted(true);
          }
        };

        audio.onerror = (e) => {
          console.warn("Audio playback error, falling back:", e);
          setIsInterviewerSpeaking(false);
          setAudioElement(null);
          if (!hasEmittedFinishedRef.current) {
            hasEmittedFinishedRef.current = true;
            if (socketRef.current) {
              socketRef.current.emit("playback_finished", { session_id: sessionIdRef.current });
            }
          }
          if (pendingCompletionDataRef.current) {
            setIsCompleted(true);
          }
        };

        audio.play().catch((err) => {
          console.warn("Audio play prevented or aborted:", err);
          setIsInterviewerSpeaking(false);
          setAudioElement(null);
          if (!hasEmittedFinishedRef.current) {
            hasEmittedFinishedRef.current = true;
            if (socketRef.current) {
              socketRef.current.emit("playback_finished", { session_id: sessionIdRef.current });
            }
          }
          if (pendingCompletionDataRef.current) {
            setIsCompleted(true);
          }
        });
      } catch (err) {
        console.error("Audio init error:", err);
        setIsInterviewerSpeaking(false);
        setAudioElement(null);
        if (!hasEmittedFinishedRef.current) {
          hasEmittedFinishedRef.current = true;
          if (socketRef.current) {
            socketRef.current.emit("playback_finished", { session_id: sessionIdRef.current });
          }
        }
        if (pendingCompletionDataRef.current) {
          setIsCompleted(true);
        }
      }
    },
    [stopAudioPlayback]
  );

  // Initialize and maintain WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    const socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 8,
      timeout: 10000,
    });
    socketRef.current = socket;

    // ── CONNECT ──
    socket.on("connect", () => {
      setIsConnected(true);
      setErrorMsg(null);
      // Join existing or new room
      socket.emit("join", { session_id: sessionIdRef.current });
      // Request state recovery
      socket.emit("get_interview_state", { session_id: sessionIdRef.current });
    });

    socket.on("connect_error", (err) => {
      setIsConnected(false);
      setErrorMsg(`Reconnecting to interview server: ${err.message}`);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // ── SERVER LIFECYCLE EVENTS ──
    socket.on("joined", (data) => {
      if (data && data.session_id === sessionIdRef.current) {
        if (data.stage) setStage(data.stage);
        if (data.total_stages) setTotalStages(data.total_stages);
        if (data.answered_stages !== undefined) setAnsweredStages(data.answered_stages);
        if (data.role) setSessionRole(data.role);
        if (data.level) setSessionLevel(data.level);
        if (data.company) setSessionCompany(data.company);
        if (data.candidate_name) setSessionCandidate(data.candidate_name);
        if (data.job_description) setJobDescription(data.job_description);

        if (data.current_question || data.question) {
          setCurrentQuestion((prev) => prev || data.current_question || data.question);
        }
        if (data.state && data.state !== "ready") {
          if (data.state === "completed") {
            setIsCompleted(true);
            setIsInterviewActive(false);
          } else {
            setIsInterviewActive(true);
            setLifecycleState(data.state);
          }
        }
      }
    });

    socket.on("interview_state", (data) => {
      if (data && data.session_id === sessionIdRef.current) {
        setLifecycleState(data.state);
        if (data.stage) setStage(data.stage);
        if (data.total_stages) setTotalStages(data.total_stages);
        if (data.answered_stages !== undefined) setAnsweredStages(data.answered_stages);
        if (data.role) setSessionRole(data.role);
        if (data.level) setSessionLevel(data.level);
        if (data.company) setSessionCompany(data.company);
        if (data.candidate_name) setSessionCandidate(data.candidate_name);
        if (data.job_description) setJobDescription(data.job_description);

        if (data.current_question || data.question) {
          setCurrentQuestion((prev) => prev || data.current_question || data.question);
        }
        if (data.scorecard) {
          setScorecard(data.scorecard);
        }

        if (data.state === "candidate_listening") {
          setIsSubmitting(false);
          setProcessingStatus(null);
          setProcessingMessage(null);
        } else if (data.state === "completed") {
          setIsSubmitting(false);
          setProcessingStatus(null);
          setProcessingMessage(null);
          setIsCompleted(true);
          setIsInterviewActive(false);
        } else if (data.state !== "ready") {
          setIsInterviewActive(true);
        }
      }
    });

    socket.on("candidate_turn", (data) => {
      if (data && data.session_id === sessionIdRef.current) {
        setLifecycleState("candidate_listening");
        setIsSubmitting(false);
        setProcessingStatus(null);
        setProcessingMessage(null);
        if (data.stage) setStage(data.stage);
        if (data.total_stages) setTotalStages(data.total_stages);
      }
    });

    socket.on("processing_status", (data) => {
      if (data && data.session_id === sessionIdRef.current) {
        setProcessingStatus(data.status);
        setProcessingMessage(data.message);
      }
    });

    socket.on("candidate_transcript", (data) => {
      if (data && data.session_id === sessionIdRef.current && data.text) {
        const trimmed = data.text.trim();
        setCandidateLiveTranscript(trimmed);

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === "candidate" && lastMsg.text === trimmed) {
            return prev;
          }
          return [
            ...prev,
            {
              id: "turn_" + Date.now() + "_c",
              sender: "candidate",
              text: trimmed,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ];
        });
      }
    });

    socket.on("bot_message", (data) => {
      if (data && (!data.session_id || data.session_id === sessionIdRef.current)) {
        const text = data.text || data.message || "";
        if (text) {
          setMessages((prev) => [
            ...prev,
            {
              id: "turn_" + Date.now() + "_b",
              sender: "interviewer",
              text,
              audio: data.audio || null,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
        if (data.audio) {
          playInterviewerAudio(data.audio, text);
        }
      }
    });

    socket.on("interviewer_message", (data) => {
      if (data && data.session_id === sessionIdRef.current) {
        setIsInterviewActive(true);
        setIsSubmitting(false);
        setProcessingStatus(null);
        setProcessingMessage(null);
        setCandidateLiveTranscript("");

        if (data.role) setSessionRole(data.role);
        if (data.level) setSessionLevel(data.level);
        if (data.company) setSessionCompany(data.company);
        if (data.candidate_name) setSessionCandidate(data.candidate_name);
        if (data.job_description) setJobDescription(data.job_description);

        const qText = data.text || data.message || "";
        setCurrentQuestion(qText);
        setCurrentAudioB64(data.audio || null);
        setCurrentLipsync(data.lipsync || null);

        if (data.stage) setStage(data.stage);
        if (data.total_stages) setTotalStages(data.total_stages);
        if (data.answered_stages !== undefined) setAnsweredStages(data.answered_stages);

        // Record in dialogue transcript
        if (qText) {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.sender === "interviewer" && lastMsg.text === qText) {
              return prev;
            }
            return [
              ...prev,
              {
                id: "turn_" + Date.now() + "_i",
                sender: "interviewer",
                text: qText,
                audio: data.audio,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ];
          });
        }

        // If interview reached conclusion
        if (data.is_complete) {
          const compData = {
            scorecard: data.scorecard,
            message: data.message || "Your interview has been completed.",
          };
          pendingCompletionDataRef.current = compData;
          if (data.scorecard) setScorecard(data.scorecard);
          if (data.message) setCompletionMessage(data.message);
        }

        // Play Kokoro synthesized speech
        playInterviewerAudio(data.audio, qText);
      }
    });

    socket.on("interview_completed", (data) => {
      if (data && data.session_id === sessionIdRef.current) {
        stopMediaTracks();
        const compData = {
          scorecard: data.scorecard,
          message: data.message || "Your interview has been completed.",
        };
        pendingCompletionDataRef.current = compData;
        if (data.scorecard) setScorecard(data.scorecard);
        if (data.message) setCompletionMessage(data.message);

        // If no audio is currently playing, transition immediately to completion screen
        if (!currentAudioRef.current || currentAudioRef.current.paused || currentAudioRef.current.ended) {
          setIsCompleted(true);
        }
      }
    });

    socket.on("error", (err) => {
      setIsSubmitting(false);
      setProcessingStatus(null);
      setProcessingMessage(null);
      const code = err?.code;
      const msg = typeof err === "object" ? err.error || JSON.stringify(err) : String(err);

      if (code === "SESSION_COMPLETED") {
        setIsCompleted(true);
      } else {
        setErrorMsg(msg);
      }
    });

    return () => {
      socket.disconnect();
      stopAudioPlayback();
      stopMediaTracks();
    };
  }, [serverUrl, sessionId, playInterviewerAudio, stopAudioPlayback, stopMediaTracks]);

  // Start interview (launches browser native full display mode)
  const handleStartInterview = async () => {
    if (!socketRef.current || !isConnected) {
      setErrorMsg("Unable to connect to interview voice engine. Please check connection.");
      return;
    }

    // Enter browser fullscreen mode on user click gesture (covers display, hides Chrome toolbar & tabs)
    await enterFullscreen();

    setErrorMsg(null);
    setIsInterviewActive(true);
    setLifecycleState("interviewer_speaking");
    setMessages([]);

    const payload: {
      session_id: string;
      total_stages: number;
      role?: string;
      level?: string;
    } = {
      session_id: sessionId,
      total_stages: totalStages,
    };

    // If initialRole / initialLevel was explicitly provided by the job invitation, include it;
    // otherwise do not pass static fallbacks so backend uses the session's authoritative job description and level.
    if (initialRole) payload.role = initialRole;
    if (initialLevel) payload.level = initialLevel;

    socketRef.current.emit("start_interview", payload);
  };

  // Recording candidate speech
  const startRecording = async () => {
    if (lifecycleState !== "candidate_listening" || isInterviewerSpeaking || isSubmitting) {
      return;
    }

    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Release tracks
        stream.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) {
          setErrorMsg("No audio recorded. Please try speaking again.");
          setIsSubmitting(false);
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (socketRef.current && isConnected) {
            setIsSubmitting(true);
            setLifecycleState("processing_answer");
            setProcessingStatus("transcribing_audio");
            setProcessingMessage("Sending your speech to interviewer...");

            socketRef.current.emit("candidate_speech", {
              session_id: sessionId,
              audio: reader.result,
              mime_type: "audio/webm",
            });
          }
        };
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          // Auto-stop at 2 minutes limit
          if (prev >= 120) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg("Microphone permission denied or unavailable: " + message);
      setIsRecording(false);
      setShowTextInput(true); // Fallback to text input
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Submit text answer fallback
  const handleSendText = () => {
    if (!textInput.trim() || !socketRef.current || !isConnected || isSubmitting) return;
    const textToSend = textInput.trim();
    setTextInput("");
    setErrorMsg(null);
    setIsSubmitting(true);
    setLifecycleState("processing_answer");
    setProcessingStatus("generating_question");
    setProcessingMessage("Evaluating your response...");

    socketRef.current.emit("candidate_speech", {
      session_id: sessionId,
      text: textToSend,
    });
  };

  // Exit interview
  const handleConfirmExit = () => {
    void exitFullscreen();
    stopAudioPlayback();
    stopMediaTracks();
    setIsInterviewActive(false);
    setIsCompleted(false);
    setExitModalOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("ktmbees_interview_session_id");
    }
    setRegisteredSessionId(initialSessionId || null);
    if (onExit) {
      onExit();
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 0. CANDIDATE REGISTRATION CARD (FILL UP FIRST IF NO ACTIVE SESSION ID)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <CandidateRegistrationCard
        defaultRole={initialRole || ""}
        defaultLevel={initialLevel || ""}
        onSuccess={(data) => {
          const sId = data.session_token || data.session_id;
          if (sId) {
            setRegisteredSessionId(sId);
            if (typeof window !== "undefined") {
              localStorage.setItem("ktmbees_interview_session_id", sId);
            }
          }
          if (data.candidate?.full_name) {
            setCurrentCandidateName(data.candidate.full_name);
            setSessionCandidate(data.candidate.full_name);
          }
          if (data.job?.title) {
            setCurrentRole(data.job.title);
            setSessionRole(data.job.title);
          }
          if (data.job?.level) {
            setCurrentLevel(data.job.level);
            setSessionLevel(data.job.level);
          }
          if (data.job?.company_name) {
            setCurrentCompany(data.job.company_name);
            setSessionCompany(data.job.company_name);
          }
        }}
        onExit={onExit}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. COMPLETION SCREEN (RENDERED WHEN INTERVIEW ENDS)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isCompleted) {
    const overallScore = scorecard?.overall_score ?? 8.0;
    const recommendation = scorecard?.recommendation || "Hire";

    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 my-auto">
          {/* Header Card */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white mx-auto shadow-xl shadow-emerald-500/25 mb-4 animate-bounce">
              <IconAward size={36} />
            </div>
            <Badge color="teal" variant="light" size="lg" className="mb-2">
              Interview Completed
            </Badge>
            <Title order={1} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Great Job, {candidate}!
            </Title>
            <Text size="sm" c="dimmed" className="text-slate-400 max-w-md mx-auto mt-1">
              {completionMessage}
            </Text>
          </div>

          {/* Scorecard Hero Card */}
          <Card withBorder radius="xl" p="xl" className="bg-slate-900/90 border-slate-800 shadow-2xl mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-slate-800 text-center">
              <div>
                <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">
                  Overall Score
                </Text>
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-indigo-400">{overallScore}</span>
                  <span className="text-slate-500 text-sm">/ 10</span>
                </div>
              </div>

              <div>
                <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">
                  Recommendation
                </Text>
                <div className="mt-2">
                  <Badge
                    size="lg"
                    radius="md"
                    color={
                      recommendation.toLowerCase().includes("strong")
                        ? "teal"
                        : recommendation.toLowerCase().includes("not")
                          ? "red"
                          : "indigo"
                    }
                  >
                    {recommendation}
                  </Badge>
                </div>
              </div>

              <div>
                <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">
                  Questions Answered
                </Text>
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-emerald-400">
                    {answeredStages || totalStages}
                  </span>
                  <span className="text-slate-500 text-sm">/ {totalStages}</span>
                </div>
              </div>
            </div>

            {/* Sub-Scores if provided */}
            {(scorecard?.technical_depth_score || scorecard?.communication_score) && (
              <div className="grid grid-cols-3 gap-3 py-4 border-b border-slate-800 text-center">
                {scorecard.technical_depth_score !== undefined && (
                  <div>
                    <Text size="[10px]" c="dimmed" className="uppercase font-semibold">Technical Depth</Text>
                    <Text size="sm" fw={700} className="text-slate-200 mt-0.5">{scorecard.technical_depth_score} / 10</Text>
                  </div>
                )}
                {scorecard.communication_score !== undefined && (
                  <div>
                    <Text size="[10px]" c="dimmed" className="uppercase font-semibold">Communication</Text>
                    <Text size="sm" fw={700} className="text-slate-200 mt-0.5">{scorecard.communication_score} / 10</Text>
                  </div>
                )}
                {scorecard.problem_solving_score !== undefined && (
                  <div>
                    <Text size="[10px]" c="dimmed" className="uppercase font-semibold">Problem Solving</Text>
                    <Text size="sm" fw={700} className="text-slate-200 mt-0.5">{scorecard.problem_solving_score} / 10</Text>
                  </div>
                )}
              </div>
            )}

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {scorecard?.strengths && scorecard.strengths.length > 0 && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <Text size="xs" fw={700} className="text-emerald-400 mb-2 flex items-center gap-1.5">
                    <IconCheck size={16} /> Key Strengths
                  </Text>
                  <ul className="text-xs text-slate-300 space-y-1.5 pl-4 list-disc">
                    {scorecard.strengths.map((str, idx) => (
                      <li key={idx}>{str}</li>
                    ))}
                  </ul>
                </div>
              )}

              {((scorecard?.concerns && scorecard.concerns.length > 0) ||
                (scorecard?.improvements && scorecard.improvements.length > 0)) && (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <Text size="xs" fw={700} className="text-amber-400 mb-2 flex items-center gap-1.5">
                      <IconSparkles size={16} /> Growth Opportunities
                    </Text>
                    <ul className="text-xs text-slate-300 space-y-1.5 pl-4 list-disc">
                      {(scorecard.concerns || scorecard.improvements || []).map((imp, idx) => (
                        <li key={idx}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            {/* Summary Feedback */}
            {scorecard?.summary && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider mb-1.5">
                  Evaluator Summary
                </Text>
                <Text size="xs" className="text-slate-300 leading-relaxed whitespace-pre-line">
                  {scorecard.summary}
                </Text>
              </div>
            )}
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="default"
              size="md"
              radius="xl"
              leftSection={<IconMessageDots size={18} />}
              onClick={() => setTranscriptDrawerOpen(true)}
              className="w-full sm:w-auto"
            >
              Review Full Transcript ({messages.length})
            </Button>

            <Button
              variant="gradient"
              gradient={{ from: "indigo", to: "violet", deg: 45 }}
              size="md"
              radius="xl"
              onClick={handleConfirmExit}
              className="w-full sm:w-auto shadow-lg shadow-indigo-500/25"
            >
              Finish & Return Home
            </Button>
          </div>
        </div>

        {/* Transcript Review Drawer */}
        <Drawer
          opened={transcriptDrawerOpen}
          onClose={() => setTranscriptDrawerOpen(false)}
          title={<span className="font-bold text-slate-900">Interview Transcript</span>}
          position="right"
          size="md"
        >
          <ScrollArea h="calc(100vh - 80px)">
            <Stack gap="md" className="py-2 pr-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${m.sender === "candidate"
                      ? "bg-indigo-50 border border-indigo-200 text-indigo-950 ml-4"
                      : "bg-slate-100 border border-slate-200 text-slate-900 mr-4"
                    }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1 opacity-70">
                    <span>{m.sender === "candidate" ? "Candidate (You)" : "AI Interviewer"}</span>
                    <span>{m.timestamp}</span>
                  </div>
                  <p>{m.text}</p>
                </div>
              ))}
            </Stack>
          </ScrollArea>
        </Drawer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. FULL-SCREEN INTERVIEW INTERFACE (ACTIVE INTERVIEW SESSION)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isInterviewActive) {
    const isInterviewerTurn =
      lifecycleState === "interviewer_speaking" || isInterviewerSpeaking;
    const isCandidateTurn =
      lifecycleState === "candidate_listening" && !isInterviewerSpeaking;
    const isProcessing =
      lifecycleState === "processing_answer" ||
      isSubmitting ||
      (lifecycleState === "interviewer_speaking" && !isInterviewerSpeaking);

    return (
      <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-50 bg-slate-950 text-slate-100 flex flex-col w-full h-full overflow-hidden select-none">
        {/* FULL-SCREEN 3D INTERVIEWER CHARACTER BACKGROUND */}
        <InterviewerAvatar
          fullScreen={true}
          isSpeaking={isInterviewerSpeaking}
          isListening={isCandidateTurn && isRecording}
          isProcessing={isProcessing}
          name="AI Interviewer"
          roleSubtitle="Your interviewer"
          audioElement={audioElement}
          lipsyncCues={currentLipsync}
        />

        {/* MINIMAL FLOATING TOP CONTROLS (NO NAVBAR / NO QUESTION COUNTER) */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
          {currentAudioB64 && (
            <Tooltip label="Replay Audio" withArrow position="bottom">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="xl"
                className="bg-black/30 hover:bg-black/60 text-white/70 hover:text-white backdrop-blur-md border border-white/10"
                onClick={() => playInterviewerAudio(currentAudioB64, currentQuestion)}
                disabled={isRecording || isSubmitting}
              >
                <IconVolume size={16} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Fullscreen Display Toggle */}
          <Tooltip
            label={isFullscreen ? "Exit Full Screen" : "Full Display Screen"}
            withArrow
            position="bottom"
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="xl"
              className="bg-black/30 hover:bg-black/60 text-white/70 hover:text-white backdrop-blur-md border border-white/10"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
            >
              {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Exit Interview" withArrow position="bottom">
            <button
              type="button"
              onClick={() => setExitModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-red-400 text-xs font-medium transition-all cursor-pointer"
            >
              <IconDoorExit size={14} />
              <span>Exit</span>
            </button>
          </Tooltip>
        </div>

        {/* MAIN FOCAL STAGE (QUESTION CARD & CANDIDATE CONSOLE FLOATING OVER FULL-SCREEN INTERVIEWER) */}
        <main className="relative z-10 flex-1 flex flex-col justify-end p-4 sm:p-6 pb-6 overflow-y-auto max-w-4xl w-full mx-auto pointer-events-none">
          {/* Current Question Display Card */}
          <div className="w-full max-w-2xl mx-auto mb-4 pointer-events-auto">
            <Card
              withBorder
              radius="2xl"
              p="lg"
              className="bg-slate-950/80 border-slate-700/60 backdrop-blur-xl shadow-2xl text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Badge
                  size="sm"
                  variant="light"
                  color={
                    isInterviewerTurn
                      ? "indigo"
                      : isCandidateTurn
                        ? "teal"
                        : "amber"
                  }
                >
                  {isInterviewerTurn
                    ? "Interviewer is asking..."
                    : isCandidateTurn
                      ? "Your Turn to Answer"
                      : processingStatus
                        ? processingStatus.replace(/_/g, " ")
                        : "Evaluating Your Answer..."}
                </Badge>
              </div>

              <Text
                size="md"
                fw={600}
                className="text-white leading-relaxed font-sans sm:text-lg min-h-[44px] flex items-center justify-center"
              >
                {currentQuestion || "Connecting to interviewer..."}
              </Text>

              {/* Live Candidate Transcript when processing */}
              {candidateLiveTranscript && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 italic">
                  <span className="text-slate-400 not-italic font-semibold">You said: </span>
                  &ldquo;{candidateLiveTranscript}&rdquo;
                </div>
              )}
            </Card>
          </div>

          {/* Error Banner if any */}
          {errorMsg && (
            <div className="w-full max-w-xl mx-auto mb-3 pointer-events-auto">
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
                className="shadow-lg"
                withCloseButton
                onClose={() => setErrorMsg(null)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>{errorMsg}</span>
                  {(isProcessing || isSubmitting) && (
                    <Button
                      size="xs"
                      color="red"
                      variant="outline"
                      onClick={() => {
                        setIsSubmitting(false);
                        setLifecycleState("candidate_listening");
                        setProcessingStatus(null);
                        setProcessingMessage(null);
                        setErrorMsg(null);
                      }}
                    >
                      Retry Answering
                    </Button>
                  )}
                </div>
              </Alert>
            </div>
          )}

          {/* BOTTOM INTERACTION CONSOLE */}
          <div className="w-full max-w-2xl mx-auto pb-2 pointer-events-auto">
            <Card
              withBorder
              radius="2xl"
              p="md"
              className="bg-slate-900/90 border-slate-800/90 backdrop-blur-md shadow-2xl"
            >
              {/* Status Header */}
              <div className="flex items-center justify-between mb-3 text-xs">
                <div className="flex items-center gap-2">
                  {isProcessing && <Loader size={14} color="amber" />}
                  {isProcessing && processingStatus && (
                    <Badge size="xs" variant="light" color="amber" className="capitalize">
                      {processingStatus.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <Text size="xs" fw={600} className="text-slate-300">
                    {isInterviewerSpeaking
                      ? "Interviewer is speaking..."
                      : isProcessing
                        ? processingMessage || (processingStatus ? processingStatus.replace(/_/g, " ") : "Preparing response...")
                        : isCandidateTurn
                          ? isRecording
                            ? `Recording answer (${formatTime(recordingSeconds)})`
                            : "Ready for your response"
                          : "Preparing next question..."}
                  </Text>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTextInput((s) => !s)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                >
                  <IconKeyboard size={13} />
                  <span>{showTextInput ? "Hide Text" : "Prefer Typing?"}</span>
                </button>
              </div>

              {/* Primary Recording Button / Controls */}
              <div className="flex flex-col items-center justify-center gap-3">
                {!isRecording ? (
                  <Button
                    size="lg"
                    radius="xl"
                    color="indigo"
                    leftSection={<IconMicrophone size={22} />}
                    onClick={startRecording}
                    disabled={!isCandidateTurn || isSubmitting || !isConnected}
                    className="w-full sm:w-72 shadow-lg shadow-indigo-500/25 font-bold"
                  >
                    Start Recording Speech
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    radius="xl"
                    color="red"
                    leftSection={<IconPlayerStop size={22} />}
                    onClick={stopRecording}
                    className="w-full sm:w-72 shadow-lg shadow-red-500/30 animate-pulse font-bold"
                  >
                    Stop & Send Answer ({formatTime(recordingSeconds)})
                  </Button>
                )}

                {/* Text Input Fallback */}
                {showTextInput && (
                  <div className="w-full flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
                    <TextInput
                      placeholder="Type your answer here..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendText();
                        }
                      }}
                      size="sm"
                      radius="md"
                      className="flex-1"
                      disabled={!isCandidateTurn || isSubmitting || isRecording}
                    />
                    <Button
                      size="sm"
                      radius="md"
                      color="indigo"
                      onClick={handleSendText}
                      disabled={!textInput.trim() || !isCandidateTurn || isSubmitting || isRecording}
                      leftSection={<IconSend size={16} />}
                    >
                      Send
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </main>

        {/* TRANSCRIPT HISTORY DRAWER */}
        <Drawer
          opened={transcriptDrawerOpen}
          onClose={() => setTranscriptDrawerOpen(false)}
          title={<span className="font-bold text-slate-900">Interview Transcript</span>}
          position="right"
          size="md"
        >
          <ScrollArea h="calc(100vh - 80px)">
            <Stack gap="md" className="py-2 pr-2">
              {messages.length === 0 ? (
                <Text size="xs" c="dimmed" className="text-center py-8">
                  No dialog recorded yet.
                </Text>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl text-xs leading-relaxed ${m.sender === "candidate"
                        ? "bg-indigo-50 border border-indigo-200 text-indigo-950 ml-4"
                        : "bg-slate-100 border border-slate-200 text-slate-900 mr-4"
                      }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1 opacity-70">
                      <span>{m.sender === "candidate" ? "Candidate (You)" : "AI Interviewer"}</span>
                      <span>{m.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Drawer>

        {/* EXIT CONFIRMATION MODAL */}
        <Modal
          opened={exitModalOpen}
          onClose={() => setExitModalOpen(false)}
          title={<span className="font-bold text-slate-900">Exit Interview?</span>}
          centered
          size="sm"
          radius="lg"
        >
          <Text size="sm" className="text-slate-600 mb-4">
            Are you sure you want to exit the interview session? Your progress in this session will be closed.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" size="sm" onClick={() => setExitModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" size="sm" onClick={handleConfirmExit}>
              Yes, Exit
            </Button>
          </Group>
        </Modal>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. INITIAL PRE-INTERVIEW SETUP EXPERIENCE
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6">
      {/* Error Alert */}
      {errorMsg && (
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 mb-4">
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Notice"
            color="red"
            className="w-full shadow-sm"
            withCloseButton
            onClose={() => setErrorMsg(null)}
          >
            {errorMsg}
          </Alert>
        </div>
      )}

      <PreInterviewSetup
        onStart={handleStartInterview}
        onExit={() => {
          if (!initialSessionId) {
            setRegisteredSessionId(null);
          } else if (onExit) {
            onExit();
          }
        }}
        backLabel={!initialSessionId ? "Back to Candidate Profile" : "Back to Assessment Stream Selection"}
        isConnecting={!isConnected}
        disabled={!isConnected}
        role={role}
        candidateName={candidate}
        companyName={company}
      />
    </div>
  );
}

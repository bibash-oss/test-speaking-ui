import axiosInstance from "@/config/axios";

export interface OETSessionState {
  session_id: string;
  state: "ready" | "preparation" | "speaking" | "completed" | string;
  turn_count: number;
  dialogue?: Array<{
    sender: "patient" | "doctor" | "system";
    text: string;
    timestamp?: string;
  }>;
  preparation_time_seconds?: number;
  speaking_time_seconds?: number;
  roleplay_card?: {
    patient_name?: string;
    setting?: string;
    background?: string;
    patient_task?: string;
    doctor_task?: string;
    tasks?: string[];
  };
}

export interface OETStartResponse {
  session_id: string;
  question_id?: string;
  greeting?: string;
  audio?: string;
  lipsync?: Array<[string, number, number]>;
  preparation_time_seconds?: number;
  speaking_time_seconds?: number;
  roleplay_card?: {
    patient_name?: string;
    setting?: string;
    background?: string;
    patient_task?: string;
    doctor_task?: string;
    tasks?: string[];
  };
}

export interface OETRespondResponse {
  session_id: string;
  text?: string;
  message?: string;
  audio?: string;
  lipsync?: Array<[string, number, number]>;
  turn_count?: number;
  is_complete?: boolean;
}

export interface OETScorecard {
  overall_score?: number;
  clinical_communication_score?: number;
  empathy_score?: number;
  information_gathering_score?: number;
  information_giving_score?: number;
  fluency_score?: number;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  recommendation?: string;
  [key: string]: unknown;
}

export interface OETEvaluateResponse {
  session_id: string;
  scorecard: OETScorecard;
  dialogue?: Array<{
    sender: "patient" | "doctor" | "system";
    text: string;
    timestamp?: string;
  }>;
}

export const oetRoleplayService = {
  // POST /api/roleplay/start
  async startRoleplay(payload?: {
    session_id?: string;
    question_id?: string;
    candidate_name?: string;
    with_intro?: boolean;
  }): Promise<OETStartResponse> {
    const res = await axiosInstance.post("/api/roleplay/start", payload || {});
    return res as unknown as OETStartResponse;
  },

  // POST /api/roleplay/intro
  async startIntro(payload: { session_id: string; question_id?: string }): Promise<any> {
    const res = await axiosInstance.post("/api/roleplay/intro", payload);
    return res;
  },

  // POST /api/roleplay/handover
  async handover(payload: { session_id: string; question_id?: string }): Promise<any> {
    const res = await axiosInstance.post("/api/roleplay/handover", payload);
    return res;
  },

  // POST /api/roleplay/finish
  async finishRoleplay(payload: { session_id: string }): Promise<any> {
    const res = await axiosInstance.post("/api/roleplay/finish", payload);
    return res;
  },

  // POST /api/roleplay/start-consultation
  async startConsultation(payload: { session_id: string; question_id?: string }): Promise<any> {
    const res = await axiosInstance.post("/api/roleplay/start-consultation", payload);
    return res;
  },

  // POST /api/roleplay/respond
  async respond(payload: { session_id: string; text?: string; audio?: Blob }): Promise<OETRespondResponse> {
    const res = await axiosInstance.post("/api/roleplay/respond", payload);
    return res as unknown as OETRespondResponse;
  },

  // GET /api/roleplay/state/<session_id>
  async getState(sessionId: string): Promise<OETSessionState> {
    const res = await axiosInstance.get(`/api/roleplay/state/${encodeURIComponent(sessionId)}`);
    return res as unknown as OETSessionState;
  },

  // POST /api/roleplay/evaluate/<session_id>
  async evaluate(sessionId: string): Promise<OETEvaluateResponse> {
    const res = await axiosInstance.post(`/api/roleplay/evaluate/${encodeURIComponent(sessionId)}`);
    return res as unknown as OETEvaluateResponse;
  },
};


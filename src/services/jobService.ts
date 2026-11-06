import axiosInstance from "@/config/axios";

export interface Job {
  id: string;
  title: string;
  level: "Intern" | "Junior" | "Mid-Level" | "Senior" | "Lead" | string;
  company_name: string;
  description: string;
  invite_token: string;
  invite_url: string;
  is_active: boolean;
  candidate_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateJobPayload {
  title: string;
  level: string;
  company_name: string;
  description: string;
}

export interface CreateJobResponse {
  message: string;
  job: Job;
}

export interface JobsListResponse {
  jobs: Job[];
}

export interface CandidateInterview {
  session_token: string;
  status: "pending" | "in_progress" | "completed" | "failed" | string;
  stage: number;
  scorecard: {
    overall_score?: number;
    strengths?: string[];
    improvements?: string[];
    feedback?: string;
    [key: string]: unknown;
  } | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Candidate {
  id: string;
  job_id: string;
  full_name: string;
  email: string;
  phone?: string;
  resume_filename?: string;
  has_resume: boolean;
  status: "registered" | "in_progress" | "completed" | string;
  created_at: string | null;
  updated_at: string | null;
  interview?: CandidateInterview | null;
}

export interface JobCandidatesResponse {
  job: {
    id: string;
    title: string;
    level: string;
    company_name: string;
  };
  candidate_count: number;
  candidates: Candidate[];
}

export interface PublicInviteInfoResponse {
  job: {
    title: string;
    level: string;
    description: string;
    company_name: string;
    invite_token: string;
  };
}

export interface CandidateRegisterResponse {
  message: string;
  candidate_id: string;
  session_token: string;
  session_id?: string;
  candidate?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
  job: {
    id?: string;
    title: string;
    level: string;
    company_name?: string;
  };
}

export const jobService = {
  /**
   * POST /api/jobs
   * Used by the company/admin to create a new job position and generate the public invite link.
   */
  async createJob(payload: CreateJobPayload): Promise<CreateJobResponse> {
    const res = (await axiosInstance.post("/api/jobs", payload)) as unknown as CreateJobResponse;
    return res;
  },

  /**
   * GET /api/jobs
   * Used to list all jobs created with their invite links and candidate counts.
   */
  async getJobs(): Promise<JobsListResponse> {
    const res = (await axiosInstance.get("/api/jobs")) as unknown as JobsListResponse;
    return res;
  },

  /**
   * GET /api/jobs/:id
   * Get specific job details.
   */
  async getJob(id: string): Promise<{ job: Job }> {
    const res = (await axiosInstance.get(`/api/jobs/${id}`)) as unknown as { job: Job };
    return res;
  },

  /**
   * GET /api/jobs/:id/candidates
   * Get all candidates and their interview progress for a job position.
   */
  async getJobCandidates(id: string): Promise<JobCandidatesResponse> {
    const res = (await axiosInstance.get(`/api/jobs/${id}/candidates`)) as unknown as JobCandidatesResponse;
    return res;
  },

  /**
   * GET /api/invite/:token
   * Public endpoint for candidates to view the job info before registering.
   */
  async getInviteInfo(token: string): Promise<PublicInviteInfoResponse> {
    const res = (await axiosInstance.get(`/api/invite/${token}`)) as unknown as PublicInviteInfoResponse;
    return res;
  },

  /**
   * POST /api/invite/:token/register
   * Register candidate for a specific job invite link.
   */
  /**
   * POST /api/resume/parse
   * Upload CV/Resume to parse into structured text with AI.
   * Payload: multipart/form-data with field resume=@file
   */
  async parseResume(file: File): Promise<{ success: boolean; filename: string; resume_text: string }> {
    const formData = new FormData();
    formData.append("resume", file);
    const res = (await axiosInstance.post("/api/resume/parse", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })) as unknown as {
      success: boolean;
      filename: string;
      resume_text: string;
    };
    return res;
  },

  /**
   * POST /api/invite/:token/register
   * Register candidate for a specific job invite link.
   */
  async registerCandidate(
    token: string,
    data: FormData | { full_name: string; email: string; phone?: string; resume_text?: string }
  ): Promise<CandidateRegisterResponse> {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const res = (await axiosInstance.post(`/api/invite/${token}/register`, data, {
      headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
    })) as unknown as CandidateRegisterResponse;
    return res;
  },

  /**
   * POST /api/candidates/register
   * Direct candidate registration without needing an invite link.
   */
  async registerDirectCandidate(
    data: FormData | { full_name: string; email: string; phone?: string; role?: string; resume_text?: string }
  ): Promise<CandidateRegisterResponse> {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const res = (await axiosInstance.post("/api/candidates/register", data, {
      headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
    })) as unknown as CandidateRegisterResponse;
    return res;
  },

  /**
   * GET /api/candidates/:candidate_id
   * Get candidate details including parsed resume_text and interview session transcript.
   */
  async getCandidateDetails(candidateId: string): Promise<{
    candidate: Candidate & {
      resume_text?: string | null;
      job?: {
        id: string;
        title: string;
        level: string;
        company_name: string;
        description: string;
      };
      interview_session?: {
        id: string;
        candidate_id: string;
        session_token: string;
        stage: number;
        status: string;
        transcript: Array<{ role: string; text: string }>;
        scorecard: {
          overall_score?: number;
          strengths?: string[];
          improvements?: string[];
          feedback?: string;
          [key: string]: unknown;
        } | null;
        started_at: string | null;
        completed_at: string | null;
        created_at: string | null;
      } | null;
    };
  }> {
    const res = (await axiosInstance.get(`/api/candidates/${candidateId}`)) as unknown as {
      candidate: Candidate & {
        resume_text?: string | null;
        job?: {
          id: string;
          title: string;
          level: string;
          company_name: string;
          description: string;
        };
        interview_session?: {
          id: string;
          candidate_id: string;
          session_token: string;
          stage: number;
          status: string;
          transcript: Array<{ role: string; text: string }>;
          scorecard: {
            overall_score?: number;
            strengths?: string[];
            improvements?: string[];
            feedback?: string;
            [key: string]: unknown;
          } | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string | null;
        } | null;
      };
    };
    return res;
  },
};

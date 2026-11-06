"use client";

import React, { useState } from "react";
import {
  Card,
  Title,
  Text,
  Badge,
  TextInput,
  Textarea,
  FileInput,
  Button,
  Stack,
  Alert,
  Loader,
  Group,
  Select,
} from "@mantine/core";
import {
  IconUser,
  IconMail,
  IconPhone,
  IconBriefcase,
  IconUpload,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconAlertCircle,
  IconSparkles,
  IconFileText,
  IconIdBadge2,
} from "@tabler/icons-react";
import { jobService, CandidateRegisterResponse } from "@/services/jobService";
import { label } from "three/tsl";

export interface CandidateRegistrationCardProps {
  defaultRole?: string;
  defaultLevel?: string;
  onSuccess: (data: CandidateRegisterResponse) => void;
  onExit?: () => void;
}

const EXPERIENCE_LEVELS = [
  { value: "Intern", label: "Intern" },
  { value: "Junior", label: "Junior (0-2 yrs)" },
  { value: "Mid-Level", label: "Mid-Level (3-5 yrs)" },
  { value: "Senior", label: "Senior (5+ yrs)" },
  { value: "Lead", label: "Lead / Principal (8+ yrs)" },
];

// Direct candidate profile entry card with manual role input
export function CandidateRegistrationCard({
  defaultRole = "",
  defaultLevel = "",
  onSuccess,
  onExit,
}: CandidateRegistrationCardProps) {
  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [level, setLevel] = useState<string | null>(defaultLevel || null);

  // Resume State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [showManualText, setShowManualText] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Submit State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Handle CV Upload & AI Parse
  const handleResumeFileChange = async (file: File | null) => {
    setResumeFile(file);
    setResumeText("");
    setParseNotice(null);
    setParseError(null);
    if (!file) return;

    setParsingResume(true);
    try {
      const res = await jobService.parseResume(file);
      if (res && res.resume_text) {
        setResumeText(res.resume_text);
        setParseNotice(`✓ Successfully analyzed ${res.filename || file.name} with Gemini AI`);
      }
    } catch (err: unknown) {
      console.warn("Resume parsing notice:", err);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setParseError(
        e?.response?.data?.error ||
        e?.message ||
        "Could not parse CV text. Your file will still be sent to the interviewer."
      );
    } finally {
      setParsingResume(false);
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setSubmitError("Please provide your full name and email address.");
      return;
    }

    if (!role.trim()) {
      setSubmitError("Please type in your target position / role.");
      return;
    }

    const effectiveRole = role.trim();
    setSubmitting(true);
    setSubmitError(null);

    try {
      let currentResumeText = resumeText;
      // If candidate selected a file but parsing has not yet completed
      if (resumeFile && !currentResumeText) {
        setParsingResume(true);
        try {
          const parseRes = await jobService.parseResume(resumeFile);
          if (parseRes && parseRes.resume_text) {
            currentResumeText = parseRes.resume_text;
            setResumeText(parseRes.resume_text);
          }
        } catch (parseErr) {
          console.warn("Parse attempt on submit:", parseErr);
        } finally {
          setParsingResume(false);
        }
      }

      let payload: FormData | {
        full_name: string;
        email: string;
        phone?: string;
        role: string;
        resume_text?: string;
      };

      if (resumeFile) {
        const formData = new FormData();
        formData.append("full_name", fullName.trim());
        formData.append("email", email.trim());
        if (phone.trim()) formData.append("phone", phone.trim());
        formData.append("role", `${effectiveRole}${level ? ` (${level})` : ""}`);
        if (currentResumeText.trim()) formData.append("resume_text", currentResumeText.trim());
        formData.append("resume", resumeFile);
        payload = formData;
      } else {
        payload = {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          role: `${effectiveRole}${level ? ` (${level})` : ""}`,
          resume_text: currentResumeText.trim() || undefined,
        };
      }

      const res = await jobService.registerDirectCandidate(payload);
      if (res && (res.session_token || res.session_id)) {
        onSuccess(res);
      } else {
        setSubmitError("Failed to initiate interview session. Please try again.");
      }
    } catch (err: unknown) {
      console.error("Direct candidate registration error:", err);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setSubmitError(
        e?.response?.data?.error ||
        e?.message ||
        "Unable to register candidate profile. Ensure backend server is reachable."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto w-full">
        {/* Back Link */}
        {onExit && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              <IconArrowLeft size={16} />
              <span>Back to Assessment Stream Selection</span>
            </button>
          </div>
        )}

        {/* Candidate Registration Card */}
        <Card
          withBorder
          radius="24px"
          p="xl"
          className="bg-white border-slate-200 shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                <IconIdBadge2 size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Title order={2} className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Candidate Profile Card
                  </Title>
                  <Badge variant="light" color="indigo" size="sm">
                    Direct Entry
                  </Badge>
                </div>
                <Text size="xs" className="text-slate-500 mt-0.5">
                  Enter your details and target position. The AI interviewer personalizes questions to your background.
                </Text>
              </div>
            </div>
          </div>

          {submitError && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              variant="light"
              radius="md"
              className="mb-5"
              withCloseButton
              onClose={() => setSubmitError(null)}
            >
              {submitError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Target Role & Experience Level */}
            <div>
              <Text size="xs" fw={700} className="text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <IconBriefcase size={14} className="text-indigo-600" />
                Target Position & Seniority
              </Text>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <TextInput
                  label="Position / Role"
                  leftSection={<IconBriefcase size={16} className="text-slate-400" />}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  radius="md"
                  size="sm"
                />

                <Select
                  label="Seniority Level"
                  placeholder="Select level (Optional)"
                  data={EXPERIENCE_LEVELS}
                  value={level}
                  onChange={(val) => setLevel(val)}
                  clearable
                  radius="md"
                  size="sm"
                />
              </div>
            </div>

            {/* 2. Personal Information */}
            <div className="pt-2 border-t border-slate-100">
              <Text size="xs" fw={700} className="text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <IconUser size={14} className="text-indigo-600" />
                Candidate Details
              </Text>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <TextInput
                  label="Full Name"
                  leftSection={<IconUser size={16} className="text-slate-400" />}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  radius="md"
                  size="sm"
                />

                <TextInput
                  label="Email Address"
                  leftSection={<IconMail size={16} className="text-slate-400" />}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  radius="md"
                  size="sm"
                />
              </div>

              <TextInput
                label="Phone Number (Optional)"
                leftSection={<IconPhone size={16} className="text-slate-400" />}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                radius="md"
                size="sm"
              />
            </div>

            {/* 3. Resume / Experience Background */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <Text size="xs" fw={700} className="text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <IconFileText size={14} className="text-indigo-600" />
                  CV / Resume (Optional)
                </Text>
                <button
                  type="button"
                  onClick={() => setShowManualText((s) => !s)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold bg-transparent border-0 cursor-pointer p-0"
                >
                  {showManualText ? "Hide Text Bio" : "Or Paste Bio Text"}
                </button>
              </div>

              <FileInput
                label="Upload CV (PDF)"
                description="Gemini AI will extract your technical stack and project history to tailor questions."
                placeholder="Choose resume PDF file"
                leftSection={<IconUpload size={16} className="text-slate-400" />}
                accept="application/pdf"
                value={resumeFile}
                onChange={handleResumeFileChange}
                radius="md"
                size="sm"
                clearable
              />

              {parsingResume && (
                <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 font-medium animate-pulse">
                  <Loader size="xs" color="indigo" />
                  <span> Parsing CV...</span>
                </div>
              )}

              {parseNotice && !parsingResume && (
                <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800 font-medium">
                  <IconCheck size={16} className="text-teal-600 shrink-0" />
                  <span>{parseNotice}</span>
                </div>
              )}

              {parseError && !parsingResume && (
                <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                  <IconAlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {showManualText && (
                <div className="mt-3">
                  <Textarea
                    label="Resume / Experience Summary"
                    placeholder="Paste your key technical skills, past projects, or clinical background here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    rows={4}
                    radius="md"
                    size="sm"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <IconSparkles size={16} className="text-indigo-600 shrink-0" />
                <span>Instant profile generation with automated session lock</span>
              </div>

              <Button
                type="submit"
                variant="gradient"
                gradient={{ from: "indigo", to: "violet", deg: 45 }}
                size="md"
                radius="xl"
                rightSection={<IconArrowRight size={18} />}
                loading={submitting || parsingResume}
                className="w-full sm:w-auto shadow-md shadow-indigo-600/20 font-bold"
              >
                Proceed to Interview Setup
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}


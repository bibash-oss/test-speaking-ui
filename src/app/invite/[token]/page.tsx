"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Container,
  Title,
  Text,
  Badge,
  Card,
  TextInput,
  Button,
  Stack,
  Alert,
  Loader,
  Paper,
  Divider,
  FileInput,
} from "@mantine/core";
import {
  IconMicrophone,
  IconAlertCircle,
  IconSparkles,
  IconArrowRight,
  IconUser,
  IconMail,
  IconPhone,
  IconUpload,
  IconCheck,
} from "@tabler/icons-react";
import { VoiceInterview } from "@/components/VoiceInterview";
import { jobService } from "@/services/jobService";

interface InvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function InviteCandidatePage({ params }: InvitePageProps) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<{
    title: string;
    level: string;
    description: string;
    company_name: string;
    invite_token: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Registration Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // After registration: start voice interview
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    if (token) {
      jobService
        .getInviteInfo(token)
        .then((res) => {
          if (!ignore) {
            if (res && res.job) {
              setJob(res.job);
            } else {
              setError("Job position information not found.");
            }
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!ignore) {
            console.error("Error fetching invite info:", err);
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            const errMsg =
              typeof err === "string"
                ? err
                : e?.response?.data?.error ||
                  e?.message ||
                  "Invalid or expired invitation link. Please check with the recruiter.";
            setError(errMsg);
            setLoading(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [token]);

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
      setParseError(e?.response?.data?.error || e?.message || "Could not parse CV file. Please ensure it is a readable PDF.");
    } finally {
      setParsingResume(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setRegisterError("Full name and email are required.");
      return;
    }

    setRegistering(true);
    setRegisterError(null);

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

      let data: FormData | { full_name: string; email: string; phone?: string; resume_text?: string };

      if (resumeFile) {
        const formData = new FormData();
        formData.append("full_name", fullName.trim());
        formData.append("email", email.trim());
        if (phone.trim()) formData.append("phone", phone.trim());
        if (currentResumeText.trim()) formData.append("resume_text", currentResumeText.trim());
        formData.append("resume", resumeFile);
        data = formData;
      } else {
        data = {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
        };
      }

      const res = await jobService.registerCandidate(token, data);
      if (res && res.session_token) {
        setSessionToken(res.session_token);
      } else {
        setRegisterError("Failed to initiate interview session.");
      }
    } catch (err: unknown) {
      console.error("Error registering candidate:", err);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const errMsg =
        typeof err === "string"
          ? err
          : e?.response?.data?.error ||
            e?.message ||
            "Unable to register. Please ensure the backend is running.";
      setRegisterError(errMsg);
    } finally {
      setRegistering(false);
    }
  };

  // If already registered and interview active, show VoiceInterview component
  if (sessionToken && job) {
    return (
      <VoiceInterview
        initialSessionId={sessionToken}
        initialRole={job.title}
        initialLevel={job.level}
        candidateName={fullName}
        companyName={job.company_name}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 py-10 px-4 sm:px-6">
        <Container size="md">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4">
              <Loader color="indigo" size="lg" />
              <Text size="sm" c="dimmed">
                Loading job interview invitation...
              </Text>
            </div>
          ) : error || !job ? (
            <Card withBorder radius="lg" p="xl" className="bg-white text-center py-12 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                <IconAlertCircle size={32} />
              </div>
              <Title order={3} className="text-slate-900">
                Invalid or Expired Invitation
              </Title>
              <Text size="sm" c="dimmed" className="max-w-md mx-auto mt-2 mb-6">
                {error || "This interview invitation is no longer active or the URL is incorrect."}
              </Text>
              <Link href="/" className="no-underline">
                <Button variant="default" size="sm">
                  Return to Home
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Job Overview Card */}
              <Card
                withBorder
                radius="xl"
                p="xl"
                className="bg-white border-slate-200/80 shadow-xs relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        variant="gradient"
                        gradient={{ from: "indigo", to: "violet", deg: 45 }}
                        size="md"
                        radius="sm"
                      >
                        {job.company_name || "Company"}
                      </Badge>
                      <Badge
                        color={
                          job.level === "Senior" || job.level === "Lead"
                            ? "violet"
                            : "teal"
                        }
                        variant="light"
                        size="md"
                        radius="sm"
                      >
                        {job.level}
                      </Badge>
                    </div>

                    <Title order={2} className="text-slate-900 font-extrabold tracking-tight">
                      {job.title}
                    </Title>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700 flex items-center gap-2 self-start">
                    <IconMicrophone size={22} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      AI Voice Interview
                    </span>
                  </div>
                </div>
              </Card>

              {/* Candidate Registration Form */}
              <Card withBorder radius="xl" p="xl" className="bg-white border-slate-200/80 shadow-xs">
                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                      <IconUser size={18} />
                    </div>
                    <Title order={3} className="text-slate-900 font-bold">
                      Candidate Registration
                    </Title>
                  </div>
                  <Text size="xs" c="dimmed" className="mt-1">
                    Provide your details below to begin your personalized voice interview session.
                  </Text>
                </div>

                {registerError && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    variant="light"
                    radius="md"
                    className="mb-4"
                  >
                    {registerError}
                  </Alert>
                )}

                <form onSubmit={handleRegister}>
                  <Stack gap="md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <TextInput
                          label="Full Name *"
                          placeholder="e.g. Jane Doe"
                          leftSection={<IconUser size={16} className="text-slate-400" />}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          size="md"
                          radius="md"
                        />
                      </div>

                      <div>
                        <TextInput
                          label="Email Address *"
                          placeholder="e.g. jane.doe@example.com"
                          leftSection={<IconMail size={16} className="text-slate-400" />}
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          size="md"
                          radius="md"
                        />
                      </div>
                    </div>

                    <div>
                      <TextInput
                        label="Phone Number (Optional)"
                        placeholder="e.g. +1 (555) 000-0000"
                        leftSection={<IconPhone size={16} className="text-slate-400" />}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        size="md"
                        radius="md"
                      />
                    </div>

                    <div className="pt-1">
                      <FileInput
                        label="Upload CV / Resume (PDF)"
                        description="Upload your CV. Gemini AI will automatically extract your technical background and experience."
                        placeholder="Choose PDF file"
                        leftSection={<IconUpload size={18} className="text-slate-400" />}
                        accept="application/pdf"
                        value={resumeFile}
                        onChange={handleResumeFileChange}
                        size="md"
                        radius="md"
                        clearable
                      />

                      {parsingResume && (
                        <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 font-medium animate-pulse">
                          <Loader size="xs" color="indigo" />
                          <span>Parsing CV with Gemini AI (POST /api/resume/parse)...</span>
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
                    </div>

                    <Paper p="md" radius="md" className="bg-indigo-50/50 border border-indigo-100 mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <IconSparkles size={16} className="text-indigo-600" />
                        <Text size="xs" fw={700} className="text-indigo-950">
                          Interview Preparation Note
                        </Text>
                      </div>
                      <Text size="xs" className="text-indigo-900 leading-relaxed">
                        Ensure your microphone is enabled. The AI interviewer will greet you and assess your technical answers in real time with high-quality natural voice.
                      </Text>
                    </Paper>

                    <Button
                      type="submit"
                      loading={registering}
                      variant="gradient"
                      gradient={{ from: "indigo", to: "violet", deg: 45 }}
                      size="lg"
                      radius="md"
                      rightSection={<IconArrowRight size={18} />}
                      className="mt-2 shadow-sm shadow-indigo-500/25 hover:shadow-md hover:shadow-indigo-500/35 transition-all"
                    >
                      Start Voice Interview Now
                    </Button>
                  </Stack>
                </form>
              </Card>
            </div>
          )}
        </Container>
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  Loader,
  Alert,
  Table,
  Button,
  Card,
  Tabs,
} from "@mantine/core";
import {
  IconUsers,
  IconFileText,
  IconAward,
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconRefresh,
} from "@tabler/icons-react";
import { Candidate, jobService } from "@/services/jobService";

interface JobCandidatesModalProps {
  opened: boolean;
  onClose: () => void;
  jobId: string | null;
  jobTitle?: string;
}

export function JobCandidatesModal({
  opened,
  onClose,
  jobId,
  jobTitle,
}: JobCandidatesModalProps) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<
    Awaited<ReturnType<typeof jobService.getCandidateDetails>>["candidate"] | null
  >(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobService.getJobCandidates(jobId);
      setCandidates(res.candidates || []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(
        typeof err === "string"
          ? err
          : e?.response?.data?.error || e?.message || "Failed to load candidates"
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    let ignore = false;
    if (opened && jobId) {
      jobService
        .getJobCandidates(jobId)
        .then((res) => {
          if (!ignore) {
            setCandidates(res.candidates || []);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!ignore) {
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            setError(
              typeof err === "string"
                ? err
                : e?.response?.data?.error || e?.message || "Failed to load candidates"
            );
            setLoading(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [opened, jobId]);

  const handleSelectCandidate = async (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setLoadingDetails(true);
    setDetailsError(null);
    try {
      const res = await jobService.getCandidateDetails(candidate.id);
      setCandidateDetails(res.candidate);
    } catch (err: unknown) {
      console.error("Failed to load candidate details:", err);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setDetailsError(
        typeof err === "string"
          ? err
          : e?.response?.data?.error || e?.message || "Failed to load full interview details."
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleClose = () => {
    setSelectedCandidate(null);
    setCandidateDetails(null);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return (
          <Badge color="teal" variant="light" leftSection={<IconCheck size={12} />}>
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge color="blue" variant="light" leftSection={<IconClock size={12} />}>
            In Progress
          </Badge>
        );
      case "registered":
      default:
        return (
          <Badge color="gray" variant="light">
            Registered
          </Badge>
        );
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <IconUsers size={20} />
          </div>
          <div>
            <Title order={4} className="text-slate-800">
              Candidate Applications
            </Title>
            <Text size="xs" c="dimmed">
              {jobTitle || "Job Position"}
            </Text>
          </div>
        </div>
      }
      size="xl"
      radius="lg"
      padding="lg"
    >
      <Stack gap="md">
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Notice"
            color="yellow"
            variant="light"
          >
            {error} (Ensure your backend API is running on port 5002)
          </Alert>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader color="indigo" size="md" />
            <Text size="sm" c="dimmed">
              Loading candidates...
            </Text>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <IconUsers size={24} />
            </div>
            <Text fw={600} className="text-slate-700">
              No candidates have applied yet
            </Text>
            <Text size="sm" c="dimmed" className="max-w-md mx-auto mt-1">
              Share the job invite link with candidates to let them take the automated AI voice interview.
            </Text>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Text size="sm" fw={600} c="dimmed">
                Total Applicants: {candidates.length}
              </Text>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={fetchCandidates}
              >
                Refresh
              </Button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead className="bg-slate-50">
                  <Table.Tr>
                    <Table.Th>Candidate</Table.Th>
                    <Table.Th>Contact</Table.Th>
                    <Table.Th>Resume</Table.Th>
                    <Table.Th>Interview Status</Table.Th>
                    <Table.Th>AI Score</Table.Th>
                    <Table.Th>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {candidates.map((c) => {
                    const score = c.interview?.scorecard?.overall_score;
                    const isSelected = selectedCandidate?.id === c.id;
                    return (
                      <Table.Tr
                        key={c.id}
                        className={isSelected ? "bg-indigo-50/60 font-medium" : undefined}
                      >
                        <Table.Td>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                              {c.full_name?.charAt(0) || "C"}
                            </div>
                            <div>
                              <Text size="sm" fw={600} className="text-slate-900">
                                {c.full_name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}
                              </Text>
                            </div>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" className="text-slate-700">
                            {c.email}
                          </Text>
                          {c.phone && (
                            <Text size="xs" c="dimmed">
                              {c.phone}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {c.has_resume ? (
                            <Badge
                              color="violet"
                              variant="light"
                              size="sm"
                              leftSection={<IconFileText size={12} />}
                            >
                              Uploaded
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              None
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>{getStatusBadge(c.status || c.interview?.status || "registered")}</Table.Td>
                        <Table.Td>
                          {score !== undefined && score !== null ? (
                            <Badge
                              color={score >= 7 ? "teal" : score >= 5 ? "yellow" : "red"}
                              variant="filled"
                              size="sm"
                            >
                              {score} / 10
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Pending
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Button
                            variant={isSelected ? "filled" : "light"}
                            color="indigo"
                            size="xs"
                            onClick={() => handleSelectCandidate(c)}
                          >
                            {isSelected ? "Active" : "View"}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          </div>
        )}

        {/* Selected Candidate Detailed Assessment */}
        {selectedCandidate && (
          <Card withBorder radius="lg" p="lg" className="bg-slate-50/70 border-indigo-200 mt-2 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-indigo-500/30">
                  {selectedCandidate.full_name?.charAt(0) || "C"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Title order={4} className="text-slate-900 font-bold">
                      {selectedCandidate.full_name}
                    </Title>
                    {getStatusBadge(
                      candidateDetails?.status || selectedCandidate.status || "registered"
                    )}
                  </div>
                  <Text size="xs" c="dimmed">
                    {selectedCandidate.email} {selectedCandidate.phone ? `• ${selectedCandidate.phone}` : ""}
                  </Text>
                </div>
              </div>

              <Button
                variant="subtle"
                size="xs"
                color="gray"
                onClick={() => {
                  setSelectedCandidate(null);
                  setCandidateDetails(null);
                }}
              >
                Close Details
              </Button>
            </div>

            {loadingDetails ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2">
                <Loader color="indigo" size="sm" />
                <Text size="xs" c="dimmed">
                  Loading full candidate scorecard & transcript (GET /api/candidates/{selectedCandidate.id})...
                </Text>
              </div>
            ) : detailsError ? (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
                {detailsError}
              </Alert>
            ) : (
              <Tabs defaultValue="scorecard" color="indigo" radius="md">
                <Tabs.List className="mb-4">
                  <Tabs.Tab
                    value="scorecard"
                    leftSection={<IconAward size={16} className="text-amber-500" />}
                  >
                    AI Scorecard
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="transcript"
                    leftSection={<IconClock size={16} className="text-indigo-500" />}
                  >
                    Interview Transcript (
                    {candidateDetails?.interview_session?.transcript?.length || 0})
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="resume"
                    leftSection={<IconFileText size={16} className="text-violet-500" />}
                  >
                    Parsed Resume
                  </Tabs.Tab>
                </Tabs.List>

                {/* Tab: Scorecard */}
                <Tabs.Panel value="scorecard">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <Text size="xs" fw={700} c="dimmed" className="uppercase">
                        Interview Stage
                      </Text>
                      <Text size="lg" fw={700} className="text-slate-800 mt-0.5">
                        Stage {candidateDetails?.interview_session?.stage ?? selectedCandidate.interview?.stage ?? 0}
                      </Text>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <Text size="xs" fw={700} c="dimmed" className="uppercase">
                        Overall Score
                      </Text>
                      <Text size="lg" fw={800} className="text-indigo-600 mt-0.5">
                        {candidateDetails?.interview_session?.scorecard?.overall_score ??
                        selectedCandidate.interview?.scorecard?.overall_score !== undefined
                          ? `${candidateDetails?.interview_session?.scorecard?.overall_score ?? selectedCandidate.interview?.scorecard?.overall_score} / 10`
                          : "Not graded yet"}
                      </Text>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <Text size="xs" fw={700} c="dimmed" className="uppercase">
                        Resume File
                      </Text>
                      <Text size="xs" fw={600} className="text-slate-800 mt-1 truncate">
                        {selectedCandidate.resume_filename || "None provided"}
                      </Text>
                    </div>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <Text size="xs" fw={700} className="text-emerald-700 mb-2">
                        Key Strengths
                      </Text>
                      {candidateDetails?.interview_session?.scorecard?.strengths?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {candidateDetails.interview_session.scorecard.strengths.map((s, idx) => (
                            <Badge key={idx} color="teal" variant="light" size="sm">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Text size="xs" c="dimmed">
                          No specific strengths recorded yet.
                        </Text>
                      )}
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <Text size="xs" fw={700} className="text-amber-700 mb-2">
                        Areas for Improvement
                      </Text>
                      {candidateDetails?.interview_session?.scorecard?.improvements?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {candidateDetails.interview_session.scorecard.improvements.map((imp, idx) => (
                            <Badge key={idx} color="amber" variant="light" size="sm">
                              {imp}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Text size="xs" c="dimmed">
                          No specific areas for improvement recorded.
                        </Text>
                      )}
                    </div>
                  </div>

                  {/* Recruiter Summary Feedback */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                    <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider mb-1.5">
                      AI Recruiter Assessment Summary
                    </Text>
                    <Text size="xs" className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {candidateDetails?.interview_session?.scorecard?.feedback ||
                        selectedCandidate.interview?.scorecard?.feedback ||
                        "Candidate interview evaluation will be generated upon completion of all interview stages."}
                    </Text>
                  </div>
                </Tabs.Panel>

                {/* Tab: Transcript */}
                <Tabs.Panel value="transcript">
                  {candidateDetails?.interview_session?.transcript &&
                  candidateDetails.interview_session.transcript.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {candidateDetails.interview_session.transcript.map((msg, idx) => {
                        const isInterviewer = msg.role === "interviewer";
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col ${
                              isInterviewer ? "items-start" : "items-end"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <Badge
                                size="xs"
                                variant="light"
                                color={isInterviewer ? "indigo" : "teal"}
                              >
                                {isInterviewer ? "AI Interviewer" : candidateDetails.full_name}
                              </Badge>
                            </div>
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                isInterviewer
                                  ? "bg-white text-slate-800 border border-slate-200/80 shadow-2xs rounded-tl-xs"
                                  : "bg-indigo-600 text-white shadow-2xs rounded-tr-xs"
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
                      <Text size="xs" c="dimmed">
                        No transcript recorded yet for this candidate session.
                      </Text>
                    </div>
                  )}
                </Tabs.Panel>

                {/* Tab: Parsed Resume */}
                <Tabs.Panel value="resume">
                  {candidateDetails?.resume_text ? (
                    <div className="bg-white p-4 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <IconFileText size={16} className="text-indigo-600" />
                          Parsed CV Content ({candidateDetails.resume_filename || "Resume.pdf"})
                        </span>
                        <Badge size="xs" color="violet" variant="light">
                          AI Parsed
                        </Badge>
                      </div>
                      <Text
                        size="xs"
                        className="text-slate-700 whitespace-pre-wrap font-sans leading-relaxed"
                      >
                        {candidateDetails.resume_text}
                      </Text>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
                      <Text size="xs" c="dimmed">
                        No parsed resume text available for this candidate.
                      </Text>
                    </div>
                  )}
                </Tabs.Panel>
              </Tabs>
            )}
          </Card>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

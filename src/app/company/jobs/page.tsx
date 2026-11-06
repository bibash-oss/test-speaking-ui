"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Badge,
  TextInput,
  Select,
  CopyButton,
  Tooltip,
  ActionIcon,
  Loader,
  Alert,
} from "@mantine/core";
import {
  IconBriefcase,
  IconPlus,
  IconSearch,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconUsers,
  IconRefresh,
  IconAlertCircle,
  IconSparkles,
  IconCalendar,
  IconChevronRight,
  IconLogin,
} from "@tabler/icons-react";
import { jobService, Job } from "@/services/jobService";
import { JobCandidatesModal } from "@/components/JobCandidatesModal";

export default function CompanyJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string | null>("ALL");

  // Candidates modal
  const [selectedJobForCandidates, setSelectedJobForCandidates] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jobService.getJobs();
      setJobs(res.jobs || []);
    } catch (err: unknown) {
      console.error("Error fetching jobs:", err);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const errMsg =
        typeof err === "string"
          ? err
          : e?.response?.data?.error ||
            e?.message ||
            "Unable to connect to backend API. Please make sure the Flask backend is running on port 5002.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    jobService
      .getJobs()
      .then((res) => {
        if (!ignore) {
          setJobs(res.jobs || []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error("Error fetching jobs:", err);
          const e = err as { response?: { data?: { error?: string } }; message?: string };
          setError(
            typeof err === "string"
              ? err
              : e?.response?.data?.error ||
                e?.message ||
                "Unable to connect to backend API. Please make sure the Flask backend is running on port 5002."
          );
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Compute stats
  const totalJobs = jobs.length;
  const totalCandidates = jobs.reduce(
    (acc, j) => acc + (j.candidate_count || 0),
    0
  );
  const seniorRolesCount = jobs.filter(
    (j) => j.level === "Senior" || j.level === "Lead"
  ).length;

  // Filtered jobs
  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLevel =
      !levelFilter || levelFilter === "ALL" || j.level === levelFilter;

    return matchesSearch && matchesLevel;
  });

  const getLevelBadgeColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "lead":
        return "pink";
      case "senior":
        return "violet";
      case "mid-level":
        return "indigo";
      case "junior":
        return "cyan";
      case "intern":
        return "teal";
      default:
        return "gray";
    }
  };

  const getInviteUrl = (job: Job) => {
    if (job.invite_url) return job.invite_url;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/invite/${job.invite_token}`;
    }
    return `http://localhost:3000/invite/${job.invite_token}`;
  };

  return (
    <>
      <Container size="xl" p={0}>
        {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2">
                <Title order={2} className="text-slate-900 font-extrabold tracking-tight">
                  Recruiter Job Positions
                </Title>
                <Badge variant="light" color="indigo" size="md">
                  GET /api/jobs
                </Badge>
              </div>
              <Text size="sm" c="dimmed" className="mt-1">
                Manage your job positions and automated AI voice interview invite links.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                onClick={fetchJobs}
                disabled={loading}
              >
                Refresh
              </Button>

              <Link href="/company/jobs/new" className="no-underline">
                <Button
                  variant="gradient"
                  gradient={{ from: "indigo", to: "violet", deg: 45 }}
                  size="sm"
                  radius="md"
                  leftSection={<IconPlus size={16} />}
                  className="shadow-sm shadow-indigo-500/25 hover:shadow-md hover:shadow-indigo-500/35 transition-all"
                >
                  Create New Position
                </Button>
              </Link>
            </div>
          </div>

          {/* Metric Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card withBorder radius="lg" p="md" className="bg-white border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">
                    Total Positions
                  </Text>
                  <Title order={2} className="text-slate-900 mt-1">
                    {totalJobs}
                  </Title>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <IconBriefcase size={24} />
                </div>
              </div>
            </Card>

            <Card withBorder radius="lg" p="md" className="bg-white border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">
                    Total Applicants
                  </Text>
                  <Title order={2} className="text-slate-900 mt-1">
                    {totalCandidates}
                  </Title>
                </div>
                <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <IconUsers size={24} />
                </div>
              </div>
            </Card>

            <Card withBorder radius="lg" p="md" className="bg-white border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">
                    Senior / Lead Roles
                  </Text>
                  <Title order={2} className="text-slate-900 mt-1">
                    {seniorRolesCount}
                  </Title>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <IconSparkles size={24} />
                </div>
              </div>
            </Card>
          </div>

          {/* Error notice */}
          {error && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              title="Notice"
              color={error.toLowerCase().includes("authorization") ? "indigo" : "yellow"}
              variant="light"
              radius="md"
              className="mb-6 shadow-2xs"
              withCloseButton
              onClose={() => setError(null)}
            >
              <div className="text-sm">
                <p>{error}</p>
                {error.toLowerCase().includes("authorization") ? (
                  <div className="mt-2">
                    <Link href="/login?returnUrl=/company/jobs" className="no-underline">
                      <Button
                        variant="filled"
                        color="indigo"
                        size="xs"
                        leftSection={<IconLogin size={14} />}
                      >
                        Sign In as Organization Admin
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">
                    Ensure the Flask backend is running (`python app.py` on port 5002).
                  </p>
                )}
              </div>
            </Alert>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-80">
              <TextInput
                placeholder="Search by job title, company, or stack..."
                leftSection={<IconSearch size={16} className="text-slate-400" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                radius="md"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
              <Text size="xs" fw={600} c="dimmed">
                Level:
              </Text>
              <Select
                size="sm"
                radius="md"
                data={[
                  { value: "ALL", label: "All Levels" },
                  { value: "Intern", label: "Intern" },
                  { value: "Junior", label: "Junior" },
                  { value: "Mid-Level", label: "Mid-Level" },
                  { value: "Senior", label: "Senior" },
                  { value: "Lead", label: "Lead" },
                ]}
                value={levelFilter}
                onChange={(val) => setLevelFilter(val)}
                className="w-36"
              />
            </div>
          </div>

          {/* Jobs List / Loading / Empty */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader color="indigo" size="lg" />
              <Text size="sm" c="dimmed">
                Loading job positions from API...
              </Text>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-300 rounded-2xl bg-white p-8 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <IconBriefcase size={32} />
              </div>
              <Title order={3} className="text-slate-900">
                {jobs.length === 0 ? "No Job Positions Found" : "No Matching Positions"}
              </Title>
              <Text size="sm" c="dimmed" className="max-w-md mx-auto mt-2 mb-6">
                {jobs.length === 0
                  ? "Create your first job interview position to generate an automated AI voice interview link."
                  : "Try clearing your search query or level filter."}
              </Text>

              {jobs.length === 0 ? (
                <Link href="/company/jobs/new" className="no-underline">
                  <Button
                    variant="gradient"
                    gradient={{ from: "indigo", to: "violet", deg: 45 }}
                    size="md"
                    radius="md"
                    leftSection={<IconPlus size={18} />}
                  >
                    Create Your First Job
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="subtle"
                  onClick={() => {
                    setSearchQuery("");
                    setLevelFilter("ALL");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredJobs.map((job) => {
                const inviteUrl = getInviteUrl(job);

                return (
                  <Card
                    key={job.id}
                    withBorder
                    radius="lg"
                    p="lg"
                    className="bg-white border-slate-200 hover:border-indigo-200 transition-all hover:shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Left: Job Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Title order={4} className="text-slate-900 font-bold">
                            {job.title}
                          </Title>
                          <Badge
                            color={getLevelBadgeColor(job.level)}
                            variant="light"
                            radius="sm"
                            size="sm"
                          >
                            {job.level}
                          </Badge>
                          <Badge variant="outline" color="gray" radius="sm" size="sm">
                            {job.company_name || "Company"}
                          </Badge>
                          {job.is_active && (
                            <Badge variant="dot" color="teal" size="sm">
                              Active
                            </Badge>
                          )}
                        </div>

                        <Text size="xs" className="text-slate-600 line-clamp-2 leading-relaxed">
                          {job.description}
                        </Text>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                          {job.created_at && (
                            <span className="flex items-center gap-1">
                              <IconCalendar size={14} className="text-slate-400" />
                              Created {new Date(job.created_at).toLocaleDateString()}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedJobForCandidates({
                                id: job.id,
                                title: job.title,
                              })
                            }
                            className="flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer bg-transparent border-0 p-0"
                          >
                            <IconUsers size={14} />
                            <span>
                              {job.candidate_count}{" "}
                              {job.candidate_count === 1 ? "Candidate" : "Candidates"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Right: Public Invite Link Box */}
                      <div className="lg:w-96 flex flex-col gap-2 pt-2 lg:pt-0 lg:border-l lg:border-slate-100 lg:pl-6">
                        <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider">
                          Candidate Public Invite Link
                        </Text>

                        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                          <Text
                            size="xs"
                            className="flex-1 font-mono text-indigo-700 truncate select-all px-1.5"
                          >
                            {inviteUrl}
                          </Text>

                          <CopyButton value={inviteUrl} timeout={2000}>
                            {({ copied, copy }) => (
                              <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
                                <ActionIcon
                                  color={copied ? "teal" : "indigo"}
                                  variant="subtle"
                                  size="sm"
                                  onClick={copy}
                                >
                                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </CopyButton>

                          <Tooltip label="Open candidate interview page" withArrow>
                            <ActionIcon
                              component="a"
                              href={inviteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              color="gray"
                              variant="subtle"
                              size="sm"
                            >
                              <IconExternalLink size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <Button
                            variant="light"
                            size="xs"
                            radius="md"
                            color="indigo"
                            leftSection={<IconUsers size={14} />}
                            onClick={() =>
                              setSelectedJobForCandidates({
                                id: job.id,
                                title: job.title,
                              })
                            }
                          >
                            View Applicants ({job.candidate_count})
                          </Button>

                          <Link
                            href={inviteUrl}
                            target="_blank"
                            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors no-underline flex items-center gap-1"
                          >
                            <span>Preview</span>
                            <IconChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Container>

      {/* Candidates Modal */}
      <JobCandidatesModal
        opened={!!selectedJobForCandidates}
        onClose={() => setSelectedJobForCandidates(null)}
        jobId={selectedJobForCandidates?.id || null}
        jobTitle={selectedJobForCandidates?.title}
      />
    </>
  );
}

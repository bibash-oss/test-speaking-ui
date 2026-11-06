"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Container,
  Title,
  Text,
  TextInput,
  Textarea,
  Select,
  Button,
  Card,
  Badge,
  Group,
  Stack,
  Alert,
  CopyButton,
  Tooltip,
  Modal,
  Divider,
  Paper,
} from "@mantine/core";
import {
  IconBriefcase,
  IconBuildingSkyscraper,
  IconCheck,
  IconCopy,
  IconSparkles,
  IconArrowLeft,
  IconExternalLink,
  IconAlertCircle,
  IconShieldCheck,
  IconMicrophone,
  IconLogin,
} from "@tabler/icons-react";
import { jobService, Job } from "@/services/jobService";
import { authService } from "@/services/authService";

const LEVEL_OPTIONS = [
  { value: "Intern", label: "Intern" },
  { value: "Junior", label: "Junior" },
  { value: "Mid-Level", label: "Mid-Level" },
  { value: "Senior", label: "Senior" },
  { value: "Lead", label: "Lead" },
];

export default function CreateJobPage() {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string>("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuth] = useState(() =>
    typeof window !== "undefined" ? authService.isAuthenticated() : true
  );

  // Success modal state
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [successModalOpened, setSuccessModalOpened] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a job title.");
      return;
    }
    if (!description.trim()) {
      setError("Please enter a job description.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        level: level || "Junior",
        company_name: companyName.trim(),
        description: description.trim(),
      };

      const res = await jobService.createJob(payload);
      if (res && res.job) {
        setCreatedJob(res.job);
        setSuccessModalOpened(true);
      }
    } catch (err: unknown) {
      console.error("Error creating job:", err);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const errMsg =
        typeof err === "string"
          ? err
          : e?.response?.data?.error ||
          e?.message ||
          "Failed to create job position. Ensure backend is running at http://localhost:5002.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const getInviteUrl = () => {
    if (!createdJob) return "";
    if (createdJob.invite_url) return createdJob.invite_url;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/invite/${createdJob.invite_token}`;
    }
    return `http://localhost:3000/invite/${createdJob.invite_token}`;
  };

  return (
    <>
      <Container size="xl" p={0}>
        {/* Header & Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/company/jobs"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2 no-underline"
            >
              <IconArrowLeft size={14} />
              Back to Job Positions
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <Title order={2} className="text-slate-900 font-extrabold tracking-tight">
                  Create Job Interview Position
                </Title>
                <Text size="sm" c="dimmed" className="mt-1">
                  Define the role criteria. An automated AI voice interviewer will evaluate candidates using your specifications.
                </Text>
              </div>


            </div>
          </div>

          {!isAuth && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              title="Organization Sign-In Required"
              color="indigo"
              variant="light"
              radius="md"
              className="mb-6 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Text size="sm">
                  You need to be authenticated as an organization administrator to create job positions and generate interview invite links.
                </Text>
                <Link href="/login?returnUrl=/company/jobs/new" className="no-underline shrink-0">
                  <Button
                    variant="filled"
                    color="indigo"
                    size="xs"
                    radius="md"
                    leftSection={<IconLogin size={14} />}
                  >
                    Sign In
                  </Button>
                </Link>
              </div>
            </Alert>
          )}

          {error && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              title="Job Creation Failed"
              color="red"
              variant="light"
              radius="md"
              className="mb-6 shadow-2xs"
              withCloseButton
              onClose={() => setError(null)}
            >
              <div className="space-y-2">
                <div>{error}</div>
                {error.toLowerCase().includes("authorization") && (
                  <div>
                    <Link href="/login?returnUrl=/company/jobs/new" className="no-underline">
                      <Button
                        variant="filled"
                        color="red"
                        size="xs"
                        leftSection={<IconLogin size={14} />}
                      >
                        Sign In Now
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </Alert>
          )}

          {/* Grid: Form on Left, Live Preview on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-7">
              <Card
                withBorder
                radius="lg"
                p="xl"
                className="bg-white border-slate-200/80 shadow-xs"
              >
                <form onSubmit={handleSubmit}>
                  <Stack gap="lg">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <IconBriefcase size={18} className="text-indigo-600" />
                        <Text size="sm" fw={700} className="text-slate-800">
                          Role Title *
                        </Text>
                      </div>
                      <TextInput
                        placeholder="e.g. Senior Backend Engineer"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        size="md"
                        radius="md"
                        classNames={{
                          input: "focus:border-indigo-500 font-medium",
                        }}
                      />
                      <Text size="xs" c="dimmed" className="mt-1">
                        The role title determines the technical scope of the AI voice interviewer.
                      </Text>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Text size="sm" fw={700} className="text-slate-800 mb-1">
                          Seniority Level *
                        </Text>
                        <Select
                          data={LEVEL_OPTIONS}
                          value={level}
                          onChange={(val) => setLevel(val || "")}
                          size="md"
                          radius="md"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <IconBuildingSkyscraper size={16} className="text-indigo-600" />
                          <Text size="sm" fw={700} className="text-slate-800">
                            Company Name
                          </Text>
                        </div>
                        <TextInput
                          placeholder=""
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          size="md"
                          radius="md"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Text size="sm" fw={700} className="text-slate-800">
                          Job Description & Criteria *
                        </Text>
                        <Text size="xs" c="dimmed">
                          {description.length} characters
                        </Text>
                      </div>
                      <Textarea
                        placeholder=""
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        minRows={5}
                        autosize
                        size="md"
                        radius="md"
                        classNames={{
                          input: "focus:border-indigo-500 text-sm leading-relaxed",
                        }}
                      />
                      <Text size="xs" c="dimmed" className="mt-1">
                        The AI interviewer will test candidates specifically against the skills and technologies listed here.
                      </Text>
                    </div>

                    <Divider className="my-1 border-slate-100" />

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <IconShieldCheck size={16} className="text-emerald-500" />
                        <span>Generates an encrypted public invite token</span>
                      </div>

                      <Group gap="sm">
                        <Button
                          variant="subtle"
                          color="gray"
                          onClick={() => {
                            setTitle("");
                            setDescription("");
                          }}
                          disabled={loading}
                        >
                          Clear
                        </Button>

                        <Button
                          type="submit"
                          loading={loading}
                          variant="gradient"
                          gradient={{ from: "indigo", to: "violet", deg: 45 }}
                          size="md"
                          radius="md"
                          leftSection={<IconSparkles size={18} />}
                          className="shadow-sm shadow-indigo-500/25 hover:shadow-md hover:shadow-indigo-500/35 transition-all"
                        >
                          Create Job & Generate Invite Link
                        </Button>
                      </Group>
                    </div>
                  </Stack>
                </form>
              </Card>
            </div>

            {/* Live Preview Column */}
            <div className="lg:col-span-5">
              <div className="sticky top-24 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <IconSparkles size={16} className="text-indigo-600" />
                    <Text size="xs" fw={700} className="text-slate-600 uppercase tracking-wider">
                      Candidate Invitation Preview
                    </Text>
                  </div>
                  <Badge size="xs" variant="dot" color="teal">
                    Live Dynamic View
                  </Badge>
                </div>

                {/* Preview Card */}
                <Card
                  withBorder
                  radius="lg"
                  p="lg"
                  className="bg-white border-indigo-100 shadow-md shadow-indigo-500/5 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 rounded-bl-full pointer-events-none" />

                  <Stack gap="md">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge
                          variant="light"
                          color="indigo"
                          size="sm"
                          radius="sm"
                          className="mb-1"
                        >
                          {companyName || "Company Name"}
                        </Badge>
                        <Title order={4} className="text-slate-900 leading-snug">
                          {title || "Job Position Title"}
                        </Title>
                      </div>

                      <Badge
                        color={
                          level === "Senior" || level === "Lead"
                            ? "violet"
                            : level === "Mid-Level"
                              ? "blue"
                              : "teal"
                        }
                        variant="filled"
                        size="md"
                        radius="md"
                      >
                        {level}
                      </Badge>
                    </div>

                    <Divider className="border-slate-100" />

                    <div>
                      <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider mb-1">
                        Role Overview & Criteria
                      </Text>
                      <Text size="xs" className="text-slate-600 leading-relaxed whitespace-pre-line line-clamp-4">
                        {description || "Job description and technical stack will appear here..."}
                      </Text>
                    </div>

                    <Paper p="sm" radius="md" className="bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                          <IconMicrophone size={14} />
                        </div>
                        <Text size="xs" fw={700} className="text-slate-800">
                          Automated Candidate Flow
                        </Text>
                      </div>
                      <ol className="text-[11px] text-slate-500 space-y-1 pl-4 list-decimal">
                        <li>Candidate opens your unique invite link.</li>
                        <li>Registers their contact info and uploads resume (PDF/text).</li>
                        <li>Conducts interactive voice interview with Gemini AI.</li>
                        <li>Recruiter receives instant scorecards & evaluations.</li>
                      </ol>
                    </Paper>
                  </Stack>
                </Card>
              </div>
            </div>
          </div>
        </Container>

      {/* Success Modal */}
      <Modal
        opened={successModalOpened}
        onClose={() => setSuccessModalOpened(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <IconCheck size={18} stroke={3} />
            </div>
            <Title order={4} className="text-slate-900">
              Job Position Created!
            </Title>
          </div>
        }
        size="lg"
        radius="lg"
        padding="xl"
      >
        {createdJob && (
          <Stack gap="lg">
            <Alert color="teal" variant="light" radius="md">
              <Text size="sm" fw={600} className="text-teal-900">
                {createdJob.title} ({createdJob.level}) is live!
              </Text>
              <Text size="xs" className="text-teal-800 mt-0.5">
                The public invite link is generated and ready to share with candidates.
              </Text>
            </Alert>

            {/* Invite URL Box */}
            <div>
              <Text size="xs" fw={700} c="dimmed" className="uppercase tracking-wider mb-2">
                Public Candidate Invite Link
              </Text>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <Text
                  size="xs"
                  className="flex-1 font-mono text-indigo-700 truncate select-all"
                >
                  {getInviteUrl()}
                </Text>

                <CopyButton value={getInviteUrl()} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
                      <Button
                        size="xs"
                        variant={copied ? "filled" : "light"}
                        color={copied ? "teal" : "indigo"}
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        onClick={copy}
                      >
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </Tooltip>
                  )}
                </CopyButton>
              </div>
            </div>

            <Divider className="border-slate-100" />

            <Group justify="space-between" gap="sm">
              <Link href={getInviteUrl()} target="_blank" className="no-underline">
                <Button
                  variant="default"
                  size="sm"
                  leftSection={<IconExternalLink size={16} />}
                >
                  Test Candidate Flow
                </Button>
              </Link>

              <Group gap="xs">
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setSuccessModalOpened(false);
                    setTitle("");
                    setDescription("");
                  }}
                >
                  Create Another Job
                </Button>

                <Button
                  variant="gradient"
                  gradient={{ from: "indigo", to: "violet", deg: 45 }}
                  size="sm"
                  onClick={() => router.push("/company/jobs")}
                >
                  Go to Job Positions
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
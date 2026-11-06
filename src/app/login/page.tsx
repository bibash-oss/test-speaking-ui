"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Container,
  Card,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
  Badge,
} from "@mantine/core";
import {
  IconBuildingSkyscraper,
  IconLock,
  IconMail,
  IconAlertCircle,
  IconArrowRight,
} from "@tabler/icons-react";
import { authService } from "@/services/authService";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/company/jobs";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Fields 'email' and 'password' are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.login({
        email: email.trim().toLowerCase(),
        password: password,
      });

      // Redirect to returnUrl or jobs dashboard
      router.push(returnUrl);
      router.refresh();
    } catch (err: unknown) {
      console.error("Login error:", err);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const msg =
        typeof err === "string"
          ? err
          : e?.response?.data?.error ||
          e?.message ||
          "Unable to log in. Please ensure the backend is running on port 5002.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Container size="xs" className="w-full">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group no-underline mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <IconBuildingSkyscraper size={26} stroke={2} />
            </div>
          </Link>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Title order={2} className="text-slate-900 font-extrabold tracking-tight">
              Ktmbees AI Recruiter
            </Title>
            <Badge variant="filled" color="indigo" size="sm">
              Admin Portal
            </Badge>
          </div>
          <Text size="sm" c="dimmed">
            Sign in to create job positions and inspect candidate interviews.
          </Text>
        </div>

        {/* Login Card */}
        <Card withBorder radius="xl" p="xl" className="bg-white border-slate-200/80 shadow-sm">
          {error && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              title="Sign in failed"
              color="red"
              variant="light"
              radius="md"
              className="mb-5"
              withCloseButton
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack gap="md">
              <div>
                <TextInput
                  label="Email"
                  placeholder="email"
                  leftSection={<IconMail size={16} className="text-slate-400" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  size="md"
                  radius="md"
                />
              </div>

              <div>
                <PasswordInput
                  label="Password"
                  placeholder="Your secure password"
                  leftSection={<IconLock size={16} className="text-slate-400" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  size="md"
                  radius="md"
                />
              </div>

              <Button
                type="submit"
                loading={loading}
                variant="gradient"
                gradient={{ from: "indigo", to: "violet", deg: 45 }}
                size="md"
                radius="md"
                rightSection={<IconArrowRight size={18} />}
                className="mt-2 shadow-sm shadow-indigo-500/25 hover:shadow-md hover:shadow-indigo-500/35 transition-all"
              >
                Sign In
              </Button>
            </Stack>
          </form>

        </Card>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors no-underline"
          >
            ← Back to Home
          </Link>
        </div>
      </Container>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  );
}

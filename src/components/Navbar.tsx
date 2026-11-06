"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Container,
  Menu,
  UnstyledButton,
  Avatar,
  Text,
  Divider,
} from "@mantine/core";
import {
  IconBriefcase,
  IconPlus,
  IconBuildingSkyscraper,
  IconLogout,
  IconChevronDown,
  IconLogin,
} from "@tabler/icons-react";
import { authService, OrganizationProfile } from "@/services/authService";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(() =>
    typeof window !== "undefined" ? authService.isAuthenticated() : false
  );

  useEffect(() => {
    let ignore = false;
    if (authService.isAuthenticated()) {
      authService
        .getMe()
        .then((res) => {
          if (!ignore && res?.organization) {
            setOrg(res.organization);
          }
        })
        .catch((err) => {
          console.warn("Failed to load org profile:", err);
          if (!ignore) setOrg(null);
        })
        .finally(() => {
          if (!ignore) setLoadingOrg(false);
        });
    }

    return () => {
      ignore = true;
    };
  }, [pathname]);

  const handleLogout = () => {
    authService.logout();
    setOrg(null);
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <Container size="xl" className="h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 group no-underline">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <IconBuildingSkyscraper size={22} stroke={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent">
                Ktmbees
              </span>
              <Badge
                variant="gradient"
                gradient={{ from: "indigo", to: "violet", deg: 45 }}
                size="xs"
                radius="sm"
                className="font-semibold tracking-wide"
              >
                AI Recruiter
              </Badge>
            </div>
            <p className="text-xs text-slate-500 -mt-0.5">Automated Voice Interviews</p>
          </div>
        </Link>

        {/* Right CTA / Auth Status */}
        <div className="flex items-center gap-3">

          {!loadingOrg && org ? (
            <Menu shadow="md" width={220} position="bottom-end" radius="md">
              <Menu.Target>
                <UnstyledButton className="p-1.5 px-2 rounded-lg hover:bg-slate-100/80 transition-colors flex items-center gap-2 border border-slate-200">
                  <Avatar color="indigo" radius="xl" size="sm">
                    {org.name?.charAt(0) || "K"}
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <Text size="xs" fw={700} className="text-slate-800 leading-tight">
                      {org.name || "Organization"}
                    </Text>
                    <Text size="[10px]" c="dimmed" className="leading-tight">
                      {org.role || "Admin"}
                    </Text>
                  </div>
                  <IconChevronDown size={14} className="text-slate-400" />
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <div className="px-3 py-2">
                  <Text size="xs" fw={700} className="text-slate-900">
                    {org.name}
                  </Text>
                  <Text size="xs" c="dimmed" className="truncate">
                    {org.email}
                  </Text>
                  <Badge size="xs" color="indigo" variant="light" className="mt-1">
                    {org.role?.toUpperCase()}
                  </Badge>
                </div>

                <Divider />

                <Menu.Item
                  leftSection={<IconBriefcase size={16} />}
                  onClick={() => router.push("/company/jobs")}
                >
                  Manage Jobs
                </Menu.Item>

                <Menu.Item
                  leftSection={<IconPlus size={16} />}
                  onClick={() => router.push("/company/jobs/new")}
                >
                  Create New Job
                </Menu.Item>

                <Divider />

                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={handleLogout}
                >
                  Sign Out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : !loadingOrg ? (
            <Link href="/login" className="no-underline">
              <Button
                variant="default"
                size="sm"
                radius="md"
                leftSection={<IconLogin size={16} />}
                className="hover:border-indigo-300"
              >
                Sign In
              </Button>
            </Link>
          ) : null}
        </div>
      </Container>
    </header>
  );
}

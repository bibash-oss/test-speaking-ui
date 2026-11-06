"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Avatar,
  UnstyledButton,
  Text,
  Drawer,
  Burger,
  Tooltip,
} from "@mantine/core";
import {
  IconBriefcase,
  IconPlus,
  IconBuildingSkyscraper,
  IconLogout,
  IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react";
import { authService, OrganizationProfile } from "@/services/authService";

export default function CompanyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [mobileOpened, setMobileOpened] = useState(false);

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
          console.warn("Could not fetch org profile:", err);
        });
    }
    return () => {
      ignore = true;
    };
  }, []);

  const handleLogout = () => {
    authService.logout();
    router.push("/login");
  };

  const navItems = [
    {
      label: "Job Positions",
      href: "/company/jobs",
      icon: IconBriefcase,
      active: pathname === "/company/jobs" || pathname === "/company/jobs/",
    },
    {
      label: "Create New Job",
      href: "/company/jobs/new",
      icon: IconPlus,
      active: pathname === "/company/jobs/new",
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <Link href="/company/jobs" className="flex items-center gap-3 no-underline group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <IconBuildingSkyscraper size={22} stroke={2} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 tracking-tight text-base">
                Ktmbees
              </span>
              <Badge variant="filled" color="indigo" size="xs">
                Admin
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 font-medium -mt-0.5">Recruiter Dashboard</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Management
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpened(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all no-underline ${
                item.active
                  ? "bg-indigo-50 text-indigo-700 shadow-2xs border border-indigo-100 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  size={18}
                  className={item.active ? "text-indigo-600" : "text-slate-400"}
                />
                <span>{item.label}</span>
              </div>
              {item.active && <IconChevronRight size={14} className="text-indigo-500" />}
            </Link>
          );
        })}

        {/* AI Recruiter Engine Box */}
        <div className="mt-6 p-3.5 rounded-xl bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent border border-indigo-100/80">
          <div className="flex items-center gap-2 mb-1">
            <IconSparkles size={16} className="text-indigo-600" />
            <Text size="xs" fw={700} className="text-slate-800">
              AI Voice Interviewer
            </Text>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
            Candidates complete speech interviews evaluated by Gemini with automated scoring.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Engine Ready</span>
          </div>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar color="indigo" radius="xl" size="sm">
              {org?.name?.charAt(0) || "K"}
            </Avatar>
            <div className="min-w-0">
              <Text size="xs" fw={700} className="text-slate-800 truncate">
                {org?.name || "Ktmbees"}
              </Text>
              <Text size="[10px]" c="dimmed" className="truncate">
                {org?.email || "admin@ktmbees.com"}
              </Text>
            </div>
          </div>

          <Tooltip label="Sign Out" withArrow>
            <UnstyledButton
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <IconLogout size={16} />
            </UnstyledButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      <Drawer
        opened={mobileOpened}
        onClose={() => setMobileOpened(false)}
        size="280px"
        padding={0}
        withCloseButton={false}
      >
        {sidebarContent}
      </Drawer>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Burger
                opened={mobileOpened}
                onClick={() => setMobileOpened((o) => !o)}
                size="sm"
                aria-label="Toggle navigation"
              />
            </div>
            <div>
              <Text size="sm" fw={700} className="text-slate-900 leading-tight">
                Recruiter Portal
              </Text>
              <Text size="xs" c="dimmed" className="hidden sm:block leading-tight">
                Automated Candidate Evaluation & Management
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/company/jobs/new" className="no-underline">
              <Button
                variant="gradient"
                gradient={{ from: "indigo", to: "violet", deg: 45 }}
                size="xs"
                radius="md"
                leftSection={<IconPlus size={14} />}
                className="shadow-sm shadow-indigo-500/20"
              >
                Create Job
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Container,
  Title,
  Text,
  Badge,
  Card,
  Button,
  SimpleGrid,
  Paper,
} from "@mantine/core";
import {
  IconMicrophone,
  IconStethoscope,
  IconBriefcase,
  IconArrowRight,
  IconClock,
  IconSparkles,
  IconShieldCheck,
  IconAward,
} from "@tabler/icons-react";
import { OETVoiceRoleplay } from "@/components/OETVoiceRoleplay";
import { VoiceInterview } from "@/components/VoiceInterview";

export default function HomePage() {
  const [selectedExamMode, setSelectedExamMode] = useState<"interview" | "oet" | null>(null);

  // If user chooses OET Exam mode, launch the OET Roleplay experience
  if (selectedExamMode === "oet") {
    return <OETVoiceRoleplay onExit={() => setSelectedExamMode(null)} />;
  }

  // If user chooses Technical Interview mode, launch Voice Interview directly (Candidate Card first)
  if (selectedExamMode === "interview") {
    return (
      <VoiceInterview
        onExit={() => setSelectedExamMode(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-teal-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <Container size="xl" className="h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center shadow-sm text-white">
              <IconSparkles size={20} />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-lg text-slate-900">Ktmbees</span>
              <span className="text-xs text-teal-700 font-semibold ml-1.5 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200">
                AI Assessment Suite
              </span>
            </div>
          </div>
        </Container>
      </header>

      {/* Hero Section */}
      <main className="flex-1 py-12 md:py-16 px-4">
        <Container size="lg">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge
              variant="gradient"
              gradient={{ from: "teal", to: "indigo", deg: 45 }}
              size="lg"
              radius="md"
              className="mb-4 uppercase tracking-wider"
            >
              Choose Assessment Stream
            </Badge>

            <Title order={1} className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
              Real-Time AI Voice Assessment & Simulation
            </Title>

            <Text size="lg" className="text-slate-600 leading-relaxed">
              Select your examination module below. Practice clinical consultations with conversational 3D virtual patients or
              take corporate technical job interviews.
            </Text>
          </div>

          {/* Assessment Stream Cards */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" className="max-w-4xl mx-auto">
            {/* OPTION 1: OET Clinical Role-Play Exam */}
            <Card
              withBorder
              radius="24px"
              p="xl"
              className="bg-white border-teal-300 hover:border-teal-500 transition-all shadow-sm hover:shadow-xl flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-teal-50 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                    <IconStethoscope size={30} />
                  </div>
                  <Badge color="teal" variant="light" size="md">
                    Clinical Simulation
                  </Badge>
                </div>

                <Title order={2} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                  OET Clinical Role-Play Exam
                </Title>

                <Text size="sm" className="text-slate-600 leading-relaxed mb-6">
                  Practice Occupational English Test (OET) speaking consultations for doctors and nurses. Includes dynamic reading &
                  preparation countdown and interactive 5-minute patient voice dialogue.
                </Text>

                <div className="space-y-2.5 mb-8">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <IconClock size={16} className="text-teal-600 shrink-0" />
                    <span><strong>Preparation Time:</strong> Review clinical card & notes (countdown)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <IconMicrophone size={16} className="text-teal-600 shrink-0" />
                    <span><strong>Speaking Consultation:</strong> 5 mins doctor-patient dialogue</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <IconAward size={16} className="text-teal-600 shrink-0" />
                    <span><strong>Automated Scorecard:</strong> Empathy, information giving, and fluency</span>
                  </div>
                </div>
              </div>

              <Button
                variant="gradient"
                gradient={{ from: "teal", to: "cyan", deg: 45 }}
                size="lg"
                radius="xl"
                rightSection={<IconArrowRight size={18} />}
                onClick={() => setSelectedExamMode("oet")}
                className="w-full shadow-md shadow-teal-600/20 hover:shadow-lg font-bold"
              >
                Start OET Role-Play Exam
              </Button>
            </Card>

            {/* OPTION 2: Technical Voice Interview */}
            <Card
              withBorder
              radius="24px"
              p="xl"
              className="bg-white border-indigo-200 hover:border-indigo-400 transition-all shadow-sm hover:shadow-xl flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                    <IconBriefcase size={30} />
                  </div>
                  <Badge color="indigo" variant="light" size="md">
                    Direct Assessment
                  </Badge>
                </div>

                <Title order={2} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                  Technical Voice Interview
                </Title>

                <Text size="sm" className="text-slate-600 leading-relaxed mb-6">
                  Interactive software engineering voice interview with a conversational 3D AI interviewer. Practice coding concepts, system architecture, and technical communication.
                </Text>

                <div className="space-y-2.5 mb-8">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <IconShieldCheck size={16} className="text-indigo-600 shrink-0" />
                    <span><strong>Direct Access:</strong> Start immediately without requiring an invite link</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <IconMicrophone size={16} className="text-indigo-600 shrink-0" />
                    <span><strong>Conversational 3D AI:</strong> Live voice dialogue assessing technical depth</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <IconAward size={16} className="text-indigo-600 shrink-0" />
                    <span><strong>Instant Evaluation:</strong> Comprehensive scorecard across coding, problem solving & communication</span>
                  </div>
                </div>
              </div>

              <Button
                variant="gradient"
                gradient={{ from: "indigo", to: "violet", deg: 45 }}
                size="lg"
                radius="xl"
                rightSection={<IconArrowRight size={18} />}
                onClick={() => setSelectedExamMode("interview")}
                className="w-full shadow-md shadow-indigo-600/20 hover:shadow-lg font-bold"
              >
                Start Technical Interview
              </Button>
            </Card>
          </SimpleGrid>
        </Container>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <Container size="lg">
          Ktmbees AI Assessment Platform • Realistic 3D Conversational Agents & Evaluators
        </Container>
      </footer>
    </div>
  );
}

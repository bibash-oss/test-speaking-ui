"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ────────────────────────────────────────────────────────────────────────────
// PHONEME TO OCULUS VISEME MAPPING
// Supports Kokoro IPA phonemes, standard phonetic symbols, and direct visemes.
// ────────────────────────────────────────────────────────────────────────────
const PHONEME_TO_VISEME: Record<string, string> = {
  // Silence & punctuation
  " ": "viseme_sil",
  ".": "viseme_sil",
  ",": "viseme_sil",
  "!": "viseme_sil",
  "?": "viseme_sil",
  ";": "viseme_sil",
  ":": "viseme_sil",
  "—": "viseme_sil",
  "…": "viseme_sil",
  "ˈ": "viseme_sil",
  "ˌ": "viseme_sil",
  "ː": "viseme_sil",

  // Bilabials (P, B, M)
  p: "viseme_PP",
  b: "viseme_PP",
  m: "viseme_PP",
  β: "viseme_PP",
  ɸ: "viseme_PP",

  // Labiodentals (F, V)
  f: "viseme_FF",
  v: "viseme_FF",
  ʋ: "viseme_FF",

  // Dentals (TH)
  θ: "viseme_TH",
  ð: "viseme_TH",

  // Alveolars (T, D)
  t: "viseme_DD",
  d: "viseme_DD",
  ʈ: "viseme_DD",
  ɖ: "viseme_DD",

  // Velars (K, G)
  k: "viseme_kk",
  g: "viseme_kk",
  ɡ: "viseme_kk",
  x: "viseme_kk",
  ɣ: "viseme_kk",
  q: "viseme_kk",

  // Postalveolar & Affricates (CH, J, SH, ZH)
  ʧ: "viseme_CH",
  ʤ: "viseme_CH",
  ʃ: "viseme_CH",
  ʒ: "viseme_CH",
  ʨ: "viseme_CH",
  ʥ: "viseme_CH",

  // Sibilants (S, Z)
  s: "viseme_SS",
  z: "viseme_SS",
  ʦ: "viseme_SS",
  ʣ: "viseme_SS",
  ɕ: "viseme_SS",
  ç: "viseme_SS",

  // Nasals & Alveolar Approximants (N, L)
  n: "viseme_nn",
  ŋ: "viseme_nn",
  ɳ: "viseme_nn",
  ɲ: "viseme_nn",
  ɴ: "viseme_nn",
  l: "viseme_DD",
  ʎ: "viseme_DD",

  // Rhotics (R)
  r: "viseme_RR",
  ɹ: "viseme_RR",
  ɾ: "viseme_RR",
  ɻ: "viseme_RR",
  ʁ: "viseme_RR",
  ɽ: "viseme_RR",
  ɚ: "viseme_RR",
  ɜ: "viseme_RR",

  // Vowels - Open (AA)
  a: "viseme_aa",
  ɑ: "viseme_aa",
  æ: "viseme_aa",
  ʌ: "viseme_aa",
  ɐ: "viseme_aa",
  h: "viseme_aa",

  // Vowels - Mid Front (E)
  e: "viseme_E",
  ɛ: "viseme_E",
  ə: "viseme_E",
  ø: "viseme_E",
  œ: "viseme_E",

  // Vowels - Close Front (I)
  i: "viseme_I",
  ɪ: "viseme_I",
  y: "viseme_I",
  j: "viseme_I",
  ɨ: "viseme_I",
  ᵻ: "viseme_I",

  // Vowels - Back Rounded Mid (O)
  o: "viseme_O",
  ɔ: "viseme_O",
  ɒ: "viseme_O",
  ɤ: "viseme_O",

  // Vowels - Back Rounded Close (U, W)
  u: "viseme_U",
  ʊ: "viseme_U",
  w: "viseme_U",
  ɯ: "viseme_U",
  ɰ: "viseme_U",
};

// All 15 Oculus visemes present in examiner.glb
const ALL_VISEMES = [
  "viseme_sil",
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk",
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_aa",
  "viseme_E",
  "viseme_I",
  "viseme_O",
  "viseme_U",
];

export interface Interviewer3DSceneProps {
  isSpeaking: boolean;
  isListening: boolean;
  isProcessing: boolean;
  audioElement?: HTMLAudioElement | null;
  lipsyncCues?: Array<[string, number, number]> | null;
  onError?: (err: Error) => void;
  onLoaded?: () => void;
  compact?: boolean;
  fullScreen?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// PROCEDURAL INTERVIEW ROOM BUILDER (CHAIR, DESK, PROPS & BOARDROOM INTERIOR)
// ────────────────────────────────────────────────────────────────────────────
function buildInterviewRoom(scene: THREE.Scene) {
  const roomGroup = new THREE.Group();
  roomGroup.name = "InterviewRoom";

  // Reusable Materials
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x141a24,
    roughness: 0.58,
    metalness: 0.12,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.22,
    metalness: 0.88,
  });

  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x241b14,
    roughness: 0.36,
    metalness: 0.04,
  });

  const slatWoodMat = new THREE.MeshStandardMaterial({
    color: 0x2a1d15,
    roughness: 0.44,
    metalness: 0.02,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.32,
    metalness: 0.82,
  });

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e17,
    roughness: 0.65,
    metalness: 0.08,
  });

  // 1. FLOOR
  const floorGeo = new THREE.PlaneGeometry(16, 16);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  roomGroup.add(floor);

  // 2. FEATURE WALL (ACOUSTIC TIMBER SLATS)
  const backWallGeo = new THREE.PlaneGeometry(14, 5);
  const backWallMat = new THREE.MeshStandardMaterial({
    color: 0x080b12,
    roughness: 0.9,
  });
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, 2.5, -1.65);
  roomGroup.add(backWall);

  // Vertical timber acoustic slats
  const slatGroup = new THREE.Group();
  const slatGeo = new THREE.BoxGeometry(0.042, 4.4, 0.026);
  for (let i = 0; i < 48; i++) {
    const slat = new THREE.Mesh(slatGeo, slatWoodMat);
    slat.position.set((i - 23.5) * 0.115, 2.2, -1.63);
    slat.castShadow = false;
    slatGroup.add(slat);
  }
  roomGroup.add(slatGroup);

  // Recessed warm LED cove light strip on the feature wall
  const coveStripGeo = new THREE.BoxGeometry(6.2, 0.035, 0.04);
  const coveMat = new THREE.MeshStandardMaterial({
    color: 0xffedd5,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const coveStrip = new THREE.Mesh(coveStripGeo, coveMat);
  coveStrip.position.set(0, 3.2, -1.61);
  roomGroup.add(coveStrip);

  // 3. EXECUTIVE OFFICE CHAIR (POSITIONED BEHIND AVATAR)
  const chairGroup = new THREE.Group();
  chairGroup.name = "ExecutiveChair";

  // Seat cushion
  const seatGeo = new THREE.BoxGeometry(0.54, 0.085, 0.52);
  const seat = new THREE.Mesh(seatGeo, leatherMat);
  seat.position.set(0, 0.46, 0.04);
  seat.receiveShadow = true;
  chairGroup.add(seat);

  // Ergonomic backrest (tilted slightly back for natural support)
  const backrestGeo = new THREE.BoxGeometry(0.50, 0.72, 0.075);
  const backrest = new THREE.Mesh(backrestGeo, leatherMat);
  backrest.rotation.x = -0.11;
  backrest.position.set(0, 0.86, -0.18);
  backrest.castShadow = true;
  chairGroup.add(backrest);

  // Integrated Headrest
  const headrestGeo = new THREE.BoxGeometry(0.32, 0.16, 0.08);
  const headrest = new THREE.Mesh(headrestGeo, leatherMat);
  headrest.rotation.x = -0.08;
  headrest.position.set(0, 1.26, -0.25);
  chairGroup.add(headrest);

  // Padded Armrests
  const armPadGeo = new THREE.BoxGeometry(0.08, 0.035, 0.32);
  const leftArmPad = new THREE.Mesh(armPadGeo, leatherMat);
  leftArmPad.position.set(0.31, 0.65, 0.04);
  chairGroup.add(leftArmPad);

  const rightArmPad = new THREE.Mesh(armPadGeo, leatherMat);
  rightArmPad.position.set(-0.31, 0.65, 0.04);
  chairGroup.add(rightArmPad);

  // Armrest metal uprights
  const armPostGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.20, 12);
  const leftArmPost = new THREE.Mesh(armPostGeo, chromeMat);
  leftArmPost.position.set(0.31, 0.54, 0.04);
  chairGroup.add(leftArmPost);

  const rightArmPost = new THREE.Mesh(armPostGeo, chromeMat);
  rightArmPost.position.set(-0.31, 0.54, 0.04);
  chairGroup.add(rightArmPost);

  // Center hydraulic cylinder & 5-star base
  const pillarGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.38, 16);
  const pillar = new THREE.Mesh(pillarGeo, chromeMat);
  pillar.position.set(0, 0.22, 0.04);
  chairGroup.add(pillar);

  // 5-star base spokes on the floor
  const spokeGeo = new THREE.BoxGeometry(0.04, 0.035, 0.30);
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5;
    const spoke = new THREE.Mesh(spokeGeo, darkSteelMat);
    spoke.rotation.y = angle;
    spoke.position.set(Math.sin(angle) * 0.15, 0.04, 0.04 + Math.cos(angle) * 0.15);
    chairGroup.add(spoke);
  }
  roomGroup.add(chairGroup);

  // 4. INTERVIEW DESK / CONFERENCE TABLE
  const deskGroup = new THREE.Group();
  deskGroup.name = "InterviewDesk";

  // Tabletop (rich dark walnut)
  const deskTopGeo = new THREE.BoxGeometry(1.72, 0.042, 0.78);
  const deskTop = new THREE.Mesh(deskTopGeo, walnutMat);
  deskTop.position.set(0, 0.745, 0.50);
  deskTop.receiveShadow = true;
  deskTop.castShadow = true;
  deskGroup.add(deskTop);

  // Front modesty panel below desk
  const modestyGeo = new THREE.BoxGeometry(1.52, 0.36, 0.02);
  const modesty = new THREE.Mesh(modestyGeo, darkSteelMat);
  modesty.position.set(0, 0.53, 0.62);
  deskGroup.add(modesty);

  // Sleek architectural desk legs
  const legGeo = new THREE.BoxGeometry(0.05, 0.72, 0.70);
  const leftLeg = new THREE.Mesh(legGeo, darkSteelMat);
  leftLeg.position.set(0.76, 0.36, 0.50);
  leftLeg.castShadow = true;
  deskGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, darkSteelMat);
  rightLeg.position.set(-0.76, 0.36, 0.50);
  rightLeg.castShadow = true;
  deskGroup.add(rightLeg);

  // 5. DESK ACCESSORIES (LAPTOP, EVALUATION PORTFOLIO, TUMBLER)
  // A. Modern Open Laptop (Space Grey)
  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(0, 0.768, 0.44);

  const laptopBaseGeo = new THREE.BoxGeometry(0.29, 0.012, 0.20);
  const laptopMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.22,
  });
  const laptopBase = new THREE.Mesh(laptopBaseGeo, laptopMat);
  laptopBase.castShadow = true;
  laptopGroup.add(laptopBase);

  // Trackpad detail
  const trackpadGeo = new THREE.BoxGeometry(0.10, 0.002, 0.065);
  const trackpadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
  const trackpad = new THREE.Mesh(trackpadGeo, trackpadMat);
  trackpad.position.set(0, 0.007, 0.055);
  laptopGroup.add(trackpad);

  // Angled Laptop Screen (angled toward interviewer)
  const laptopScreenGeo = new THREE.BoxGeometry(0.29, 0.19, 0.008);
  const laptopScreen = new THREE.Mesh(laptopScreenGeo, laptopMat);
  laptopScreen.rotation.x = 0.44; // 115 degrees open
  laptopScreen.position.set(0, 0.095, -0.095);
  laptopScreen.castShadow = true;
  laptopGroup.add(laptopScreen);

  // Glowing Screen Face (soft cool-blue display light)
  const screenFaceGeo = new THREE.PlaneGeometry(0.27, 0.17);
  const screenFaceMat = new THREE.MeshStandardMaterial({
    color: 0xe0e7ff,
    emissive: 0x312e81,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const screenFace = new THREE.Mesh(screenFaceGeo, screenFaceMat);
  screenFace.rotation.x = 0.44;
  screenFace.position.set(0, 0.095, -0.090);
  laptopGroup.add(screenFace);

  // Laptop bounce point light illuminating interviewer's chest/collar
  const laptopBounce = new THREE.PointLight(0xa5b4fc, 0.65, 0.9);
  laptopBounce.position.set(0, 0.08, -0.06);
  laptopGroup.add(laptopBounce);

  deskGroup.add(laptopGroup);

  // B. Candidate Evaluation Portfolio & Notes (Left Side)
  const portfolioGroup = new THREE.Group();
  portfolioGroup.position.set(-0.42, 0.768, 0.42);
  portfolioGroup.rotation.y = 0.14;

  const folderGeo = new THREE.BoxGeometry(0.24, 0.015, 0.31);
  const folderMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const folder = new THREE.Mesh(folderGeo, folderMat);
  portfolioGroup.add(folder);

  const sheetGeo = new THREE.BoxGeometry(0.21, 0.004, 0.28);
  const sheetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.position.y = 0.01;
  portfolioGroup.add(sheet);

  // Ballpoint pen on notes
  const penGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.14, 10);
  const penMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
  const pen = new THREE.Mesh(penGeo, penMat);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.3;
  pen.position.set(0.08, 0.018, 0.02);
  portfolioGroup.add(pen);

  deskGroup.add(portfolioGroup);

  // C. Ceramic Coffee Tumbler (Right Side)
  const tumblerGroup = new THREE.Group();
  tumblerGroup.position.set(0.44, 0.768, 0.42);

  const mugGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.11, 20);
  const mugMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.15,
  });
  const mug = new THREE.Mesh(mugGeo, mugMat);
  mug.position.y = 0.055;
  mug.castShadow = true;
  tumblerGroup.add(mug);

  deskGroup.add(tumblerGroup);

  roomGroup.add(deskGroup);

  // 6. ARCHITECTURAL LIGHTING
  // Overhead Key Spotlight (aimed down onto table and interviewer)
  const keySpot = new THREE.SpotLight(0xffffff, 2.5);
  keySpot.position.set(0.3, 3.2, 1.4);
  keySpot.target.position.set(0, 0.85, 0.3);
  keySpot.angle = Math.PI / 3.8;
  keySpot.penumbra = 0.55;
  keySpot.castShadow = true;
  keySpot.shadow.mapSize.width = 1024;
  keySpot.shadow.mapSize.height = 1024;
  keySpot.shadow.bias = -0.001;
  roomGroup.add(keySpot);
  roomGroup.add(keySpot.target);

  // Soft Warm Room Fill (warm corporate lighting from upper left)
  const warmFill = new THREE.DirectionalLight(0xfde68a, 1.2);
  warmFill.position.set(-2.0, 2.5, 1.5);
  roomGroup.add(warmFill);

  // Cool Indigo Rim / Hair Light (separates character from back wall)
  const rimLight = new THREE.DirectionalLight(0x818cf8, 2.2);
  rimLight.position.set(0, 2.5, -1.5);
  roomGroup.add(rimLight);

  // Soft Ambient Fill
  const ambient = new THREE.AmbientLight(0xc7d2fe, 0.65);
  roomGroup.add(ambient);

  scene.add(roomGroup);
}

// ────────────────────────────────────────────────────────────────────────────
// POSE AVATAR INTO NATURAL SEATED INTERVIEW POSTURE
// Lowers hips to chair height, bends thighs and knees, and rests arms on desk.
// ────────────────────────────────────────────────────────────────────────────
function applySeatedPose(
  bones: Record<string, THREE.Bone>,
  armature: THREE.Object3D
) {
  // Lower armature so hips sit on the chair cushion
  armature.position.set(0, 0.50, -0.04);

  // 1. THIGHS FORWARD (LeftUpLeg & RightUpLeg bent forward at hip)
  if (bones.LeftUpLeg) {
    bones.LeftUpLeg.rotation.z += 1.48;
    bones.LeftUpLeg.rotation.x += 0.12;
  }
  if (bones.RightUpLeg) {
    bones.RightUpLeg.rotation.z += 1.48;
    bones.RightUpLeg.rotation.x += 0.12;
  }

  // 2. KNEES DOWN (LeftLeg & RightLeg bent 90 degrees downward)
  if (bones.LeftLeg) {
    bones.LeftLeg.rotation.z -= 1.48;
  }
  if (bones.RightLeg) {
    bones.RightLeg.rotation.z -= 1.48;
  }

  // 3. ARMS RESTING NATURALLY (Draped along sides, forearms forward resting on desk/armrests)
  // Left arm drops naturally along torso, forearm bent forward toward the desk
  if (bones.LeftArm) {
    bones.LeftArm.rotation.x += 0.05;
    bones.LeftArm.rotation.y += 0.55;
    bones.LeftArm.rotation.z -= 0.45;
  }
  if (bones.LeftForeArm) {
    bones.LeftForeArm.rotation.z -= 0.65;
  }
  if (bones.LeftHand) {
    bones.LeftHand.rotation.z -= 0.20;
  }

  // Right arm drops naturally along torso, forearm bent forward toward the desk
  if (bones.RightArm) {
    bones.RightArm.rotation.x -= 0.05;
    bones.RightArm.rotation.y -= 0.55;
    bones.RightArm.rotation.z -= 0.45;
  }
  if (bones.RightForeArm) {
    bones.RightForeArm.rotation.z -= 0.65;
  }
  if (bones.RightHand) {
    bones.RightHand.rotation.z -= 0.20;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CAMERA FRAMING (SEATED ACROSS THE TABLE AT EYE LEVEL)
// ────────────────────────────────────────────────────────────────────────────
function updateCameraFraming(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  fullScreen: boolean,
  compact: boolean
) {
  const aspect = width / height;
  camera.aspect = aspect;

  if (fullScreen) {
    // In full-screen video interview:
    // Candidate sits across the desk. Frames the conference desk with laptop/folder
    // and the interviewer seated in the executive chair.
    const aspectCorrection = aspect < 1 ? Math.max(1.0, 0.96 / aspect) : 1.0;
    const camDist = 1.62 * aspectCorrection;
    camera.fov = 32;
    camera.position.set(0, 1.16, camDist);
    camera.lookAt(new THREE.Vector3(0, 1.05, 0.22));
  } else if (compact) {
    camera.fov = 30;
    camera.position.set(0, 1.24, 1.18);
    camera.lookAt(new THREE.Vector3(0, 1.12, 0.15));
  } else {
    camera.fov = 31;
    camera.position.set(0, 1.20, 1.40);
    camera.lookAt(new THREE.Vector3(0, 1.08, 0.20));
  }

  camera.updateProjectionMatrix();
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN INTERVIEWER 3D SCENE COMPONENT
// ────────────────────────────────────────────────────────────────────────────
export const Interviewer3DScene = React.memo(function Interviewer3DScene({
  isSpeaking,
  isListening,
  isProcessing,
  audioElement,
  lipsyncCues,
  onError,
  onLoaded,
  compact = false,
  fullScreen = false,
}: Interviewer3DSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Keep references to state in refs for 60fps animation loop without re-triggering scene re-mounts
  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  const isProcessingRef = useRef(isProcessing);
  const audioElementRef = useRef(audioElement);
  const lipsyncCuesRef = useRef(lipsyncCues);
  const onErrorRef = useRef(onError);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
  useEffect(() => {
    audioElementRef.current = audioElement;
  }, [audioElement]);
  useEffect(() => {
    lipsyncCuesRef.current = lipsyncCues;
  }, [lipsyncCues]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  // Pointer position tracking for interactive gaze & head orientation
  const mouseTargetRef = useRef({ x: 0, y: 0 });
  const mouseCurrentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w) * 2 - 1;
      const ny = (e.clientY / h) * 2 - 1;
      mouseTargetRef.current = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      };
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("mousemove", handlePointerMove);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isDisposed = false;

    // 1. Scene & Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 30);
    updateCameraFraming(camera, width, height, fullScreen, compact);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Build the Interview Room (Executive Chair, Desk, Props, Acoustic Wall)
    buildInterviewRoom(scene);

    // 3. Model & Rig References
    const meshes: THREE.Mesh[] = [];
    const morphDicts: Record<string, number>[] = [];
    const bones: Record<string, THREE.Bone> = {};
    const initialQuaternions = new Map<THREE.Object3D, THREE.Quaternion>();

    // Morph target weights for smooth dampening
    const currentMorphWeights: Record<string, number> = {};
    ALL_VISEMES.forEach((v) => (currentMorphWeights[v] = 0));
    currentMorphWeights["jawOpen"] = 0;
    currentMorphWeights["eyeBlinkLeft"] = 0;
    currentMorphWeights["eyeBlinkRight"] = 0;
    currentMorphWeights["browInnerUp"] = 0;
    currentMorphWeights["mouthSmileLeft"] = 0;
    currentMorphWeights["mouthSmileRight"] = 0;

    const setTargetWeight = (name: string, targetValue: number, speed: number, dt: number) => {
      const current = currentMorphWeights[name] || 0;
      const next = THREE.MathUtils.damp(current, targetValue, speed, dt);
      currentMorphWeights[name] = next;

      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i];
        const dict = morphDicts[i];
        if (dict && typeof dict[name] === "number" && mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[dict[name]] = next;
        }
      }
    };

    // 4. Load & Pose GLB Model
    const loader = new GLTFLoader();
    loader.load(
      "/examiner.glb",
      (gltf) => {
        if (isDisposed) return;

        const root = gltf.scene;
        scene.add(root);

        const armature = root.getObjectByName("Armature") || root;

        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            meshes.push(mesh);
            morphDicts.push(mesh.morphTargetDictionary || {});

            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat) => {
                if ("roughness" in mat) {
                  (mat as THREE.MeshStandardMaterial).roughness = Math.max(
                    0.42,
                    (mat as THREE.MeshStandardMaterial).roughness
                  );
                }
              });
            }
          }

          if ((child as THREE.Bone).isBone) {
            const bone = child as THREE.Bone;
            bones[bone.name] = bone;
          }
        });

        // Apply Natural Seated Interview Posture
        applySeatedPose(bones, armature);

        // Store baseline quaternions after seated pose has been applied
        root.traverse((child) => {
          if ((child as THREE.Bone).isBone) {
            const bone = child as THREE.Bone;
            initialQuaternions.set(bone, bone.quaternion.clone());
          }
        });

        setLoading(false);
        onLoadedRef.current?.();
      },
      undefined,
      (err) => {
        console.error("Error loading examiner.glb:", err);
        setLoading(false);
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    );

    // 5. Animation State Machine Variables
    const clock = new THREE.Clock();
    let nextBlinkTime = 2.5;
    let blinkDuration = 0.16;
    let blinkTimer = 0;
    let isBlinking = false;

    let nextNodTime = 3.8;
    let nodTimer = 0;
    let isNodding = false;

    // 6. Main 60fps Render Loop
    const animate = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Smooth pointer tracking for seated gaze
      mouseCurrentRef.current.x = THREE.MathUtils.damp(
        mouseCurrentRef.current.x,
        mouseTargetRef.current.x,
        4.0,
        dt
      );
      mouseCurrentRef.current.y = THREE.MathUtils.damp(
        mouseCurrentRef.current.y,
        mouseTargetRef.current.y,
        4.0,
        dt
      );

      const speaking = isSpeakingRef.current;
      const listening = isListeningRef.current;
      const processing = isProcessingRef.current;
      const audio = audioElementRef.current;
      const cues = lipsyncCuesRef.current;

      // ─── A. REAL-TIME VISEME LIP-SYNC ──────────────────────────────────────
      let activeViseme: string | null = null;
      let visemeIntensity = 0;

      const isAudioActivelyPlaying = Boolean(
        audio && !audio.paused && !audio.ended
      );

      if (speaking && audio && isAudioActivelyPlaying && cues && cues.length > 0) {
        const currentMs = audio.currentTime * 1000;
        const cue = cues.find(
          ([, start, dur]) => currentMs >= start && currentMs < start + dur
        );

        if (cue) {
          const [phoneme, start, dur] = cue;
          const mapped = PHONEME_TO_VISEME[phoneme] || (ALL_VISEMES.includes(phoneme) ? phoneme : null);
          if (mapped && mapped !== "viseme_sil") {
            activeViseme = mapped;
            const progress = (currentMs - start) / Math.max(1, dur);
            visemeIntensity = Math.sin(Math.PI * Math.max(0, Math.min(1, progress))) * 0.95;
          }
        }
      } else if (speaking && isAudioActivelyPlaying) {
        // Audio is actively playing but no cues or between cue boundaries
        const cycle = Math.sin(time * 16) * 0.5 + 0.5;
        const phonemeCycle = Math.floor(time * 4) % 4;
        const proceduralVisemes = ["viseme_aa", "viseme_O", "viseme_DD", "viseme_E"];
        activeViseme = proceduralVisemes[phonemeCycle];
        visemeIntensity = cycle * 0.65;
      } else if (speaking && !audio) {
        // Fallback ONLY when there is NO audio element provided at all
        const cycle = Math.sin(time * 16) * 0.5 + 0.5;
        const phonemeCycle = Math.floor(time * 4) % 4;
        const proceduralVisemes = ["viseme_aa", "viseme_O", "viseme_DD", "viseme_E"];
        activeViseme = proceduralVisemes[phonemeCycle];
        visemeIntensity = cycle * 0.65;
      }

      for (const v of ALL_VISEMES) {
        const target = v === activeViseme ? visemeIntensity : 0;
        setTargetWeight(v, target, 26, dt);
      }

      const openVowelWeight =
        (currentMorphWeights["viseme_aa"] || 0) * 0.35 +
        (currentMorphWeights["viseme_O"] || 0) * 0.25 +
        (currentMorphWeights["viseme_E"] || 0) * 0.15;
      setTargetWeight("jawOpen", openVowelWeight, 22, dt);

      // ─── B. BLINKING ───────────────────────────────────────────────────────
      if (!isBlinking && time > nextBlinkTime) {
        isBlinking = true;
        blinkTimer = 0;
        blinkDuration = 0.14 + Math.random() * 0.05;
      }

      if (isBlinking) {
        blinkTimer += dt;
        const progress = blinkTimer / blinkDuration;
        if (progress >= 1.0) {
          isBlinking = false;
          nextBlinkTime = time + 2.8 + Math.random() * 3.5;
          setTargetWeight("eyeBlinkLeft", 0, 35, dt);
          setTargetWeight("eyeBlinkRight", 0, 35, dt);
        } else {
          const blinkCurve = Math.sin(Math.PI * progress);
          setTargetWeight("eyeBlinkLeft", blinkCurve, 40, dt);
          setTargetWeight("eyeBlinkRight", blinkCurve, 40, dt);
        }
      } else {
        setTargetWeight("eyeBlinkLeft", 0, 25, dt);
        setTargetWeight("eyeBlinkRight", 0, 25, dt);
      }

      // ─── C. FACIAL EXPRESSIONS ─────────────────────────────────────────────
      if (processing) {
        setTargetWeight("browInnerUp", 0.45, 12, dt);
        setTargetWeight("mouthSmileLeft", 0.0, 10, dt);
        setTargetWeight("mouthSmileRight", 0.0, 10, dt);
      } else if (listening) {
        setTargetWeight("browInnerUp", 0.15, 8, dt);
        setTargetWeight("mouthSmileLeft", 0.12, 8, dt);
        setTargetWeight("mouthSmileRight", 0.12, 8, dt);
      } else if (speaking) {
        setTargetWeight("browInnerUp", 0.05, 8, dt);
        setTargetWeight("mouthSmileLeft", 0.15, 10, dt);
        setTargetWeight("mouthSmileRight", 0.15, 10, dt);
      } else {
        setTargetWeight("browInnerUp", 0.0, 8, dt);
        setTargetWeight("mouthSmileLeft", 0.05, 8, dt);
        setTargetWeight("mouthSmileRight", 0.05, 8, dt);
      }

      // ─── D. PROCEDURAL SKELETAL ANIMATIONS (BREATHING, HEAD TILTS & NODS) ─
      // 1. Natural seated breathing (subtle spine pitch oscillation)
      const breathPhase = time * 1.5;
      const breathSpinePitch = Math.sin(breathPhase) * 0.010;

      // 2. Micro head drift
      const idleYaw = Math.sin(time * 0.7) * 0.012;
      const idlePitch = Math.sin(time * 1.1) * 0.010;
      const idleRoll = Math.cos(time * 0.8) * 0.006;

      // 3. Pointer gaze tracking (head tilts toward candidate's mouse)
      const mouseYaw = -mouseCurrentRef.current.x * 0.055;
      const mousePitch = mouseCurrentRef.current.y * 0.035;

      // 4. State-dependent head posture
      let statePitch = 0;
      let stateYaw = 0;
      let stateRoll = 0;

      if (processing) {
        statePitch = 0.025;
        stateRoll = 0.035;
        stateYaw = -0.02;
      } else if (listening) {
        statePitch = -0.02;
        if (!isNodding && time > nextNodTime) {
          isNodding = true;
          nodTimer = 0;
        }
        if (isNodding) {
          nodTimer += dt;
          const nodProgress = nodTimer / 0.85;
          if (nodProgress >= 1.0) {
            isNodding = false;
            nextNodTime = time + 3.0 + Math.random() * 2.5;
          } else {
            statePitch -= Math.sin(Math.PI * nodProgress) * 0.035;
          }
        }
      } else if (speaking) {
        statePitch += Math.sin(time * 6.5) * 0.018;
      }

      const targetHeadPitch = idlePitch + mousePitch + statePitch;
      const targetHeadYaw = idleYaw + mouseYaw + stateYaw;
      const targetHeadRoll = idleRoll + stateRoll;

      // Apply to Spine2 (breathing while seated)
      if (bones.Spine2) {
        const base = initialQuaternions.get(bones.Spine2);
        if (base) {
          const breathQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(breathSpinePitch, 0, 0, "XYZ")
          );
          bones.Spine2.quaternion.copy(base).multiply(breathQuat);
        }
      }

      // Apply to Neck
      if (bones.Neck) {
        const base = initialQuaternions.get(bones.Neck);
        if (base) {
          const neckQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(targetHeadPitch * 0.35, targetHeadYaw * 0.35, targetHeadRoll * 0.35, "XYZ")
          );
          bones.Neck.quaternion.copy(base).multiply(neckQuat);
        }
      }

      // Apply to Head
      if (bones.Head) {
        const base = initialQuaternions.get(bones.Head);
        if (base) {
          const headQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(targetHeadPitch * 0.65, targetHeadYaw * 0.65, targetHeadRoll * 0.65, "XYZ")
          );
          bones.Head.quaternion.copy(base).multiply(headQuat);
        }
      }

      // Render the scene
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 7. Resize Observer for dynamic responsiveness
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          updateCameraFraming(camera, newW, newH, fullScreen, compact);
          renderer.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(container);

    // 8. Cleanup on Unmount
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((mat) => {
              Object.keys(mat).forEach((key) => {
                const val = (mat as unknown as Record<string, unknown>)[key];
                if (val && typeof (val as THREE.Texture).dispose === "function") {
                  (val as THREE.Texture).dispose();
                }
              });
              mat.dispose();
            });
          }
        }
      });
    };
  }, [compact, fullScreen]);

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none overflow-hidden">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        className={`w-full h-full flex items-center justify-center transition-opacity duration-700 ${
          loading ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      />

      {/* Loading Skeleton / Subtle Spinner */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-slate-950/90 z-20">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
          <span className="text-[11px] font-semibold text-slate-400 mt-3 tracking-wider uppercase">
            Preparing Interview Room...
          </span>
        </div>
      )}
    </div>
  );
});

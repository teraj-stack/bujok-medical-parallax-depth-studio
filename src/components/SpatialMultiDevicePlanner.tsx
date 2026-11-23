import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Camera,
  Check,
  Compass,
  Copy,
  Layers,
  Move3d,
  Plus,
  QrCode,
  Radio,
  Radar,
  Smartphone,
} from 'lucide-react';
import {
  LiveCameraRigState,
  SolvedAirPose,
  SpatialAnchorNode,
  SpatialSensorTech,
} from '../types/studio';

interface SpatialMultiDevicePlannerProps {
  sessionId: string;
  sessionToken: string;
  anchors: SpatialAnchorNode[];
  solvedAirPose: SolvedAirPose;
  liveCameraRig: LiveCameraRigState;
  onChangeLiveCameraRig: (next: LiveCameraRigState) => void;
  onRegisterAnchor: (anchor: SpatialAnchorNode) => void;
  onSendRangingSample: (
    samples: Array<{ anchorId: string; distanceMeters: number; signalQuality?: number }>
  ) => void;
  onSendAirPose: (pose: { x: number; y: number; z: number }) => void;
  onTriggerAirShot?: () => void;
}

const SENSOR_TECH_OPTIONS: Array<{ id: SpatialSensorTech; label: string; accuracy: string }> = [
  { id: 'uwb_ble', label: 'UWB + BLE (IEEE 802.15.4z)', accuracy: '±5–10 cm' },
  { id: 'optical_apriltag', label: 'Kamera Optyczna (LED / AprilTag)', accuracy: '±1–3 cm' },
  { id: 'acoustic_tdoa', label: 'Ultradźwięki TDoA (WebAudio)', accuracy: '±4–8 cm' },
  { id: 'webxr_vio', label: 'WebXR 6DoF (SLAM / VIO)', accuracy: '±2 cm' },
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const SpatialMultiDevicePlanner: React.FC<SpatialMultiDevicePlannerProps> = ({
  sessionId,
  sessionToken,
  anchors,
  solvedAirPose,
  liveCameraRig,
  onChangeLiveCameraRig,
  onRegisterAnchor,
  onSendRangingSample,
  onSendAirPose,
  onTriggerAirShot,
}) => {
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>(
    anchors[0]?.id || 'ANCHOR-FL'
  );
  const [anchorQrUrl, setAnchorQrUrl] = useState<string>('');
  const [copiedAnchorLink, setCopiedAnchorLink] = useState<boolean>(false);
  const [showPlanBlueprint, setShowPlanBlueprint] = useState<boolean>(true);
  const airDragRef = useRef<boolean>(false);

  const selectedAnchor =
    anchors.find((a) => a.id === selectedAnchorId) || anchors[0] || null;

  const anchorDevicePairUrl = useMemo(() => {
    if (typeof window === 'undefined' || !selectedAnchor) return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    const tokenPart = sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : '';
    return `${base}?mode=tablet&deviceRole=spatial_anchor&anchorId=${encodeURIComponent(
      selectedAnchor.id
    )}&session=${encodeURIComponent(sessionId || 'BUJOK-STUDIO')}${tokenPart}`;
  }, [sessionId, sessionToken, selectedAnchor]);

  useEffect(() => {
    if (!anchorDevicePairUrl) return;
    QRCode.toDataURL(anchorDevicePairUrl, {
      width: 170,
      margin: 1,
      color: { dark: '#f4f1ea', light: '#090a0d' },
    })
      .then(setAnchorQrUrl)
      .catch(() => setAnchorQrUrl(''));
  }, [anchorDevicePairUrl]);

  const applyAirSpacePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    // Map SVG [-3.0m .. +3.0m] in X and Z
    const xMeters = Number(((nx * 2 - 1) * 2.5).toFixed(2));
    const zMeters = Number(((ny * 2 - 1) * 2.5).toFixed(2));
    const yMeters = solvedAirPose.y;

    onSendAirPose({ x: xMeters, y: yMeters, z: zMeters });
    onChangeLiveCameraRig({
      ...liveCameraRig,
      enabled: true,
      source: 'air_wand_6dof',
      airX: xMeters,
      airY: Number((yMeters - 1.4).toFixed(3)),
      airZ: Number((zMeters - 0.35).toFixed(3)),
    });
  };

  const handleHeightChange = (nextY: number) => {
    const clampedY = clamp(nextY, 0.3, 2.6);
    onSendAirPose({ x: solvedAirPose.x, y: clampedY, z: solvedAirPose.z });
    onChangeLiveCameraRig({
      ...liveCameraRig,
      enabled: true,
      source: 'air_wand_6dof',
      airX: solvedAirPose.x,
      airY: Number((clampedY - 1.4).toFixed(3)),
      airZ: Number((solvedAirPose.z - 0.35).toFixed(3)),
    });
  };

  const handleAddExtraAnchor = () => {
    const nextIdx = anchors.length + 1;
    const newAnchor: SpatialAnchorNode = {
      id: `ANCHOR-${nextIdx}`,
      label: `Dodatkowa Kotwica #${nextIdx}`,
      positionMeters: {
        x: nextIdx % 2 === 0 ? 1.8 : -1.8,
        y: 1.9,
        z: -1.6,
      },
      measuredDistMeters: Number(
        Math.hypot(
          solvedAirPose.x - (nextIdx % 2 === 0 ? 1.8 : -1.8),
          solvedAirPose.y - 1.9,
          solvedAirPose.z - -1.6
        ).toFixed(2)
      ),
      signalQuality: 91,
      connected: true,
      sensorTech: 'optical_apriltag',
      lastSeenAt: Date.now(),
    };
    onRegisterAnchor(newAnchor);
    setSelectedAnchorId(newAnchor.id);
  };

  // SVG room coordinate projection helper (room -3m..+3m -> 0..320px)
  const toSvgX = (xm: number) => ((clamp(xm, -3, 3) + 3) / 6) * 320;
  const toSvgZ = (zm: number) => ((clamp(zm, -3, 3) + 3) / 6) * 240;

  return (
    <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/40 p-4 sm:p-5 space-y-5">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#e8ca64]">
            <Radar className="w-4 h-4 text-[#d4af37]" />
            <span>
              Architektura Wielu Urządzeń Przestrzennych (Kotwice Odniesienia 1–4 + Ruch w Powietrzu 6DoF)
            </span>
          </div>
          <p className="text-[11px] text-[#b8b2a6] mt-0.5 max-w-3xl">
            Rozstaw 3–4 dodatkowe urządzenia wokół sceny jako kotwice odniesienia. Serwer na żywo oblicza pozycję (X, Y, Z) ruchomego sterownika metodą trilateracji 3D i steruje wirtualną kamerą w powietrzu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddExtraAnchor}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-semibold text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Dodaj Urządzenie Kotwicę</span>
          </button>

          {onTriggerAirShot && (
            <button
              type="button"
              onClick={onTriggerAirShot}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Wykonaj Rzut z Powietrza</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Top-Down 3D Room Radar + Extra Device QR Anchor Link */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Live Spatial Trilateration Radar (Drag wand in 3D space) */}
        <div className="lg:col-span-7 rounded-xl bg-[#090a0d] border border-white/12 p-4 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white inline-flex items-center gap-1.5">
              <Move3d className="w-4 h-4 text-[#d4af37]" />
              <span>Radar Przestrzenny (Przeciągnij sterownik w przestrzeni X/Z)</span>
            </span>
            <span className="font-mono-tabular text-[11px] text-[#e8ca64]">
              X: {solvedAirPose.x.toFixed(2)}m · Y: {solvedAirPose.y.toFixed(2)}m · Z:{' '}
              {solvedAirPose.z.toFixed(2)}m · PDOP {solvedAirPose.pdop}
            </span>
          </div>

          <div className="rounded-lg bg-[#0c0f17] border border-white/10 p-2 overflow-hidden">
            <svg
              viewBox="0 0 320 240"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                airDragRef.current = true;
                applyAirSpacePointer(e);
              }}
              onPointerMove={(e) => {
                if (!airDragRef.current) return;
                applyAirSpacePointer(e);
              }}
              onPointerUp={() => {
                airDragRef.current = false;
              }}
              onPointerCancel={() => {
                airDragRef.current = false;
              }}
              className="w-full h-56 touch-none cursor-crosshair select-none"
            >
              {/* Grid lines */}
              <line x1="160" y1="0" x2="160" y2="240" stroke="#1e2433" strokeWidth="1" />
              <line x1="0" y1="120" x2="320" y2="120" stroke="#1e2433" strokeWidth="1" />
              <rect
                x="26"
                y="20"
                width="268"
                height="200"
                fill="none"
                stroke="#252c3f"
                strokeDasharray="4 4"
              />

              {/* Virtual Scene Screen Front Plane at z = -2.6 */}
              <rect x="75" y="6" width="170" height="8" rx="2" fill="#d4af37" fillOpacity="0.4" />
              <text x="160" y="24" fill="#d4af37" fontSize="8.5" textAnchor="middle" fontFamily="monospace">
                EKRAN SCENY 3D (Z = -2.4m)
              </text>

              {/* Anchor range lines & spheres */}
              {anchors
                .filter((a) => a.connected)
                .map((a) => {
                  const ax = toSvgX(a.positionMeters.x);
                  const az = toSvgZ(a.positionMeters.z);
                  const wx = toSvgX(solvedAirPose.x);
                  const wz = toSvgZ(solvedAirPose.z);
                  const isSel = a.id === selectedAnchorId;
                  return (
                    <g key={a.id}>
                      <line
                        x1={ax}
                        y1={az}
                        x2={wx}
                        y2={wz}
                        stroke={isSel ? '#d4af37' : '#38bdf8'}
                        strokeOpacity="0.45"
                        strokeWidth={isSel ? '1.8' : '1'}
                        strokeDasharray="3 3"
                      />
                      <circle
                        cx={ax}
                        cy={az}
                        r={Math.min(110, (a.measuredDistMeters / 6) * 160)}
                        fill="none"
                        stroke={isSel ? '#d4af37' : '#38bdf8'}
                        strokeOpacity="0.16"
                        strokeWidth="1"
                      />
                      <rect
                        x={ax - 6}
                        y={az - 6}
                        width="12"
                        height="12"
                        rx="3"
                        fill={isSel ? '#d4af37' : '#0ea5e9'}
                        stroke="#090a0d"
                        strokeWidth="1.5"
                      />
                      <text
                        x={ax}
                        y={az - 10}
                        fill="#e2e8f0"
                        fontSize="8.5"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {a.id} ({a.measuredDistMeters.toFixed(1)}m)
                      </text>
                    </g>
                  );
                })}

              {/* Solved Air-Controller Camera Target */}
              <circle
                cx={toSvgX(solvedAirPose.x)}
                cy={toSvgZ(solvedAirPose.z)}
                r="10"
                fill="rgba(212, 175, 55, 0.25)"
                stroke="#d4af37"
                strokeWidth="2"
              />
              <circle
                cx={toSvgX(solvedAirPose.x)}
                cy={toSvgZ(solvedAirPose.z)}
                r="3.5"
                fill="#fef08a"
              />
            </svg>
          </div>

          {/* Elevation (Height Y in air) Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#c5bfb3]">
                Wysokość dłoni / sterownika w powietrzu (Oś Y)
              </span>
              <span className="font-mono-tabular text-[#d4af37]">
                {solvedAirPose.y.toFixed(2)} m · Pewność {solvedAirPose.confidencePct}%
              </span>
            </div>
            <input
              type="range"
              min={0.35}
              max={2.55}
              step={0.05}
              value={solvedAirPose.y}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>
        </div>

        {/* Right: Anchor Device Config + Dedicated QR Pairing for Extra Phones */}
        <div className="lg:col-span-5 rounded-xl bg-[#090a0d] border border-white/12 p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-white">
              Podłącz Dodatkowe Urządzenie jako Kotwicę ({anchors.length} węzłów)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {anchors.map((a) => {
                const active = a.id === selectedAnchor?.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAnchorId(a.id)}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-left text-[11px] cursor-pointer ${
                      active
                        ? 'bg-[#d4af37]/18 border-[#d4af37] text-white font-semibold'
                        : 'bg-[#121622] border-white/10 text-[#b8b2a6]'
                    }`}
                  >
                    <div className="truncate">{a.label}</div>
                    <div className="text-[10px] font-mono-tabular text-[#9e988c]">
                      d = {a.measuredDistMeters.toFixed(2)}m
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedAnchor && (
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <label key={axis} className="space-y-0.5">
                    <span className="text-[#9e988c] uppercase text-[10px]">
                      Pozycja {axis} (m)
                    </span>
                    <input
                      type="number"
                      step={0.1}
                      value={selectedAnchor.positionMeters[axis]}
                      onChange={(e) =>
                        onRegisterAnchor({
                          ...selectedAnchor,
                          positionMeters: {
                            ...selectedAnchor.positionMeters,
                            [axis]: Number(e.target.value) || 0,
                          },
                          lastSeenAt: Date.now(),
                        })
                      }
                      className="w-full rounded bg-[#141722] border border-white/12 px-2 py-1 text-xs font-mono-tabular text-white"
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#9e988c]">
                  Technologia pomiaru odległości tej kotwicy:
                </label>
                <select
                  value={selectedAnchor.sensorTech}
                  onChange={(e) =>
                    onRegisterAnchor({
                      ...selectedAnchor,
                      sensorTech: e.target.value as SpatialSensorTech,
                      lastSeenAt: Date.now(),
                    })
                  }
                  className="w-full min-h-[38px] rounded-lg bg-[#141722] border border-white/12 px-2.5 py-1 text-xs text-white"
                >
                  {SENSOR_TECH_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.accuracy})
                    </option>
                  ))}
                </select>
              </div>

              {/* QR + Quick Copy for pairing another phone directly as this spatial anchor */}
              <div className="flex items-center gap-3 pt-1">
                {anchorQrUrl ? (
                  <img
                    src={anchorQrUrl}
                    alt={`Kod QR kotwicy ${selectedAnchor.label}`}
                    className="w-20 h-20 rounded border border-white/15 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded bg-[#141722] flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6 text-[#d4af37]" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-[11px] font-medium text-[#eae6dc]">
                    Zeskanuj drugim telefonem, aby przypisać go jako <strong>{selectedAnchor.id}</strong>:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(anchorDevicePairUrl);
                        setCopiedAnchorLink(true);
                        window.setTimeout(() => setCopiedAnchorLink(false), 1800);
                      }}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#d4af37] text-[#090a0d] text-[11px] font-semibold cursor-pointer"
                    >
                      {copiedAnchorLink ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedAnchorLink ? 'Skopiowano!' : 'Kopiuj Link Kotwicy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSendRangingSample([
                          {
                            anchorId: selectedAnchor.id,
                            distanceMeters: Number(
                              clamp(
                                selectedAnchor.measuredDistMeters + (Math.random() - 0.5) * 0.25,
                                0.3,
                                6.0
                              ).toFixed(2)
                            ),
                            signalQuality: 96,
                          },
                        ]);
                      }}
                      className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181c26] border border-white/12 text-[11px] text-[#e8ca64] cursor-pointer"
                    >
                      <Radio className="w-3 h-3" />
                      <span>Testuj Ping Kotwicy</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Architectural Expansion Blueprint */}
      <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-white">
            <Layers className="w-4 h-4 text-[#d4af37]" />
            <span>Plan Rozbudowy: Jak Rozstawić Kilka Urządzeń do Sterowania Kamerą w Powietrzu</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanBlueprint((v) => !v)}
            className="text-[11px] font-medium text-[#d4af37] hover:underline cursor-pointer"
          >
            {showPlanBlueprint ? 'Zwiń plan' : 'Pokaż plan'}
          </button>
        </div>

        {showPlanBlueprint && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] text-[#c5bfb3]">
            <div className="rounded-lg bg-[#121622] border border-white/8 p-3 space-y-1">
              <div className="font-semibold text-[#e8ca64] inline-flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>01. Geometria 4 Kotwic (3D)</span>
              </div>
              <p className="leading-relaxed">
                Użyj 3 urządzeń na wysokości roboczej (lewy przód, prawy przód, tył) oraz 4. urządzenia wyżej (np. półka/statyw +2.7 m). Różnica wysokości eliminuje błąd lustrzany osi Y.
              </p>
            </div>

            <div className="rounded-lg bg-[#121622] border border-white/8 p-3 space-y-1">
              <div className="font-semibold text-[#e8ca64] inline-flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>02. Pomiar Odległości</span>
              </div>
              <p className="leading-relaxed">
                Najwyższą precyzję daje UWB (iPhone U1/U2 lub moduły ESP32-DW3000) albo optyczne śledzenie znacznika AprilTag/LED przez kamery stacjonarnych telefonów podłączonych pod ten sam kod QR.
              </p>
            </div>

            <div className="rounded-lg bg-[#121622] border border-white/8 p-3 space-y-1">
              <div className="font-semibold text-[#e8ca64] inline-flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5" />
                <span>03. Solver na Serwerze USCP</span>
              </div>
              <p className="leading-relaxed">
                Każda kotwica wysyła przez <code className="text-white">/ws/uscp</code> odległość <code className="text-white">d_i</code>. Serwer rozwiązuje układ równań sfer metodą Gaussa-Newtona 3D + łączy z żyroskopem dłoni (fuzja 6DoF).
              </p>
            </div>

            <div className="rounded-lg bg-[#121622] border border-white/8 p-3 space-y-1">
              <div className="font-semibold text-[#e8ca64] inline-flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                <span>04. Rzut i Zapis Kadru</span>
              </div>
              <p className="leading-relaxed">
                Rozwiązana pozycja <code className="text-white">(X, Y, Z)</code> i obrót przesuwają wirtualną kamerę Three.js na żywo. Przycisk <strong>„Zrób Rzut / Zapisz Kadr”</strong> zapisuje ujęcie z miejsca, w którym trzymasz kontroler.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

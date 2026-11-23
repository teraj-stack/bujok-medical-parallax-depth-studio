import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Code2,
  Compass,
  Copy,
  Crosshair,
  Gauge,
  RotateCcw,
  Sliders,
  Smartphone,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import {
  SpatialAxisConfig,
  SpatialAxisKey,
  SpatialControllerModel,
  SpatialDomainProfile,
  SpatialResponseCurve,
} from '../types/studio';
import {
  applySpatialTransferCurve,
  DEFAULT_CAMERA_3D_SPATIAL_MODEL,
  MEDICAL_TISSUE_VOLUME_SPATIAL_MODEL,
} from '../universal-controller/connectorProtocol';

interface SpatialCalibrationComposerProps {
  model: SpatialControllerModel;
  onChangeModel: (next: SpatialControllerModel) => void;
  onSyncSensitivityToRig?: (sensitivity: number) => void;
  compact?: boolean;
}

type CalibrationStage = 'idle' | 'step1_zero' | 'step2_envelope' | 'completed';

const AXIS_ORDER: SpatialAxisKey[] = [
  'yawDeg',
  'pitchDeg',
  'rollDeg',
  'dollyZ',
  'panX',
  'fovOffset',
];

function wrapDegDelta(delta: number): number {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const SpatialCalibrationComposer: React.FC<SpatialCalibrationComposerProps> = ({
  model,
  onChangeModel,
  onSyncSensitivityToRig,
  compact = false,
}) => {
  const [stage, setStage] = useState<CalibrationStage>('idle');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [sensorSource, setSensorSource] = useState<'gyro' | 'simulator'>('simulator');
  const [liveSimTilt, setLiveSimTilt] = useState<{ beta: number; gamma: number }>({
    beta: 0,
    gamma: 0,
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const modelRef = useRef(model);
  modelRef.current = model;
  const simTiltRef = useRef(liveSimTilt);
  simTiltRef.current = liveSimTilt;

  const samplesRef = useRef<Array<{ alpha: number; beta: number; gamma: number }>>([]);
  const gyroListenerRef = useRef<((ev: DeviceOrientationEvent) => void) | null>(null);
  const lastGyroRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);

  const cleanupGyroListener = useCallback(() => {
    if (gyroListenerRef.current) {
      window.removeEventListener('deviceorientation', gyroListenerRef.current, true);
      gyroListenerRef.current = null;
    }
  }, []);

  useEffect(() => cleanupGyroListener, [cleanupGyroListener]);

  const beginGyroCaptureIfPermitted = useCallback(async (): Promise<boolean> => {
    cleanupGyroListener();
    lastGyroRef.current = null;
    try {
      const devOri = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (devOri && typeof devOri.requestPermission === 'function') {
        const perm = await devOri.requestPermission();
        if (perm !== 'granted') return false;
      }

      const listener = (ev: DeviceOrientationEvent) => {
        if (ev.alpha === null || ev.beta === null || ev.gamma === null) return;
        const sample = {
          alpha: ev.alpha,
          beta: ev.beta,
          gamma: ev.gamma,
        };
        lastGyroRef.current = sample;
        samplesRef.current.push(sample);
        setSensorSource('gyro');
      };
      gyroListenerRef.current = listener;
      window.addEventListener('deviceorientation', listener, true);
      return true;
    } catch {
      return false;
    }
  }, [cleanupGyroListener]);

  // Step 1: Neutral Zero + Micro-Tremor Noise Floor (1.5s)
  const runStep1ZeroAndTremor = useCallback(async () => {
    samplesRef.current = [];
    setStage('step1_zero');
    setProgressPct(0);
    setStatusMessage('Trzymaj telefon / sondę stabilnie w pozycji spoczynkowej (1.5 s)...');

    await beginGyroCaptureIfPermitted();

    const durationMs = 1500;
    const t0 = performance.now();

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - t0;
      setProgressPct(Math.min(100, Math.round((elapsed / durationMs) * 100)));

      // If no real hardware gyro events arrived, sample simulator + realistic micro-tremor
      if (!lastGyroRef.current) {
        setSensorSource('simulator');
        const jitterB = (Math.random() - 0.5) * 0.9;
        const jitterG = (Math.random() - 0.5) * 0.9;
        samplesRef.current.push({
          alpha: 0,
          beta: simTiltRef.current.beta + jitterB,
          gamma: simTiltRef.current.gamma + jitterG,
        });
      }

      if (elapsed >= durationMs) {
        window.clearInterval(interval);
        const pts = samplesRef.current;
        const n = Math.max(1, pts.length);
        const meanA = pts.reduce((acc, p) => acc + p.alpha, 0) / n;
        const meanB = pts.reduce((acc, p) => acc + p.beta, 0) / n;
        const meanG = pts.reduce((acc, p) => acc + p.gamma, 0) / n;

        const variance =
          pts.reduce((acc, p) => {
            const db = p.beta - meanB;
            const dg = p.gamma - meanG;
            return acc + db * db + dg * dg;
          }, 0) / n;
        const measuredNoise = clamp(Number(Math.sqrt(variance).toFixed(2)), 0.25, 3.2);
        const autoDeadzone = clamp(
          Number((measuredNoise * 2.15 + 0.35).toFixed(2)),
          0.8,
          5.0
        );
        const autoSmooth = clamp(
          Number((0.52 - measuredNoise * 0.1).toFixed(2)),
          0.18,
          0.65
        );

        const nextModel: SpatialControllerModel = {
          ...modelRef.current,
          zeroAlpha: Number(meanA.toFixed(2)),
          zeroBeta: Number(meanB.toFixed(2)),
          zeroGamma: Number(meanG.toFixed(2)),
          noiseFloorDeg: measuredNoise,
          deadzoneDeg: autoDeadzone,
          smoothingAlpha: autoSmooth,
          calibratedAt: new Date().toISOString(),
        };
        onChangeModel(nextModel);

        // Automatically advance to Step 2
        samplesRef.current = [];
        setStage('step2_envelope');
        setProgressPct(0);
        setStatusMessage(
          `Punkt 0° zapisany (szum dłoni: ${measuredNoise}° → martwa strefa ${autoDeadzone}°). Teraz przechyl wygodnie narzędzie na boki i góra/dół (2.5 s)...`
        );

        const step2Duration = 2500;
        const t2Start = performance.now();
        let maxTiltObserved = 8;

        const interval2 = window.setInterval(() => {
          const el2 = performance.now() - t2Start;
          setProgressPct(Math.min(100, Math.round((el2 / step2Duration) * 100)));

          if (!lastGyroRef.current) {
            const curSim = simTiltRef.current;
            const obs = Math.max(Math.abs(curSim.beta), Math.abs(curSim.gamma));
            if (obs > maxTiltObserved) maxTiltObserved = obs;
          } else {
            const curGyro = lastGyroRef.current;
            const dB = Math.abs(curGyro.beta - meanB);
            const dG = Math.abs(curGyro.gamma - meanG);
            const dA = Math.abs(wrapDegDelta(curGyro.alpha - meanA));
            const peak = Math.max(dB, dG, dA * 0.65);
            if (peak > maxTiltObserved) maxTiltObserved = peak;
          }

          if (el2 >= step2Duration) {
            window.clearInterval(interval2);
            cleanupGyroListener();
            const envelopeDeg = clamp(Math.round(Math.max(14, maxTiltObserved)), 12, 45);
            const autoSens = clamp(Number((32 / envelopeDeg).toFixed(2)), 0.55, 2.4);

            const finalModel: SpatialControllerModel = {
              ...modelRef.current,
              zeroAlpha: Number(meanA.toFixed(2)),
              zeroBeta: Number(meanB.toFixed(2)),
              zeroGamma: Number(meanG.toFixed(2)),
              noiseFloorDeg: measuredNoise,
              deadzoneDeg: autoDeadzone,
              smoothingAlpha: autoSmooth,
              maxTiltDeg: envelopeDeg,
              sensitivityMultiplier: autoSens,
              calibratedAt: new Date().toISOString(),
            };
            onChangeModel(finalModel);
            onSyncSensitivityToRig?.(autoSens);
            setStage('completed');
            setProgressPct(100);
            setStatusMessage(
              `Kalibracja zakończona! Zakres: ±${envelopeDeg}° · Czułość: ${autoSens}× · Martwa strefa: ±${autoDeadzone}° (${
                lastGyroRef.current ? 'Żyroskop sprzętowy' : 'Symulator przechyłu'
              }).`
            );
          }
        }, 50);
      }
    }, 50);
  }, [beginGyroCaptureIfPermitted, cleanupGyroListener, onChangeModel, onSyncSensitivityToRig]);

  const applyDomainPreset = (profile: SpatialDomainProfile) => {
    if (profile === 'camera_3d') {
      const next = {
        ...DEFAULT_CAMERA_3D_SPATIAL_MODEL,
        calibratedAt: new Date().toISOString(),
      };
      onChangeModel(next);
      onSyncSensitivityToRig?.(next.sensitivityMultiplier);
      setStatusMessage('Załadowano model przestrzenny: Kamera 3D / VR.');
    } else if (profile === 'medical_tissue_volume') {
      const next = {
        ...MEDICAL_TISSUE_VOLUME_SPATIAL_MODEL,
        calibratedAt: new Date().toISOString(),
      };
      onChangeModel(next);
      onSyncSensitivityToRig?.(next.sensitivityMultiplier);
      setStatusMessage(
        'Załadowano profil medyczny: Sonda Wolumetryczna Tkanek (krzywa logarytmiczna ΔV o wysokiej mikro-precyzji).'
      );
    } else {
      onChangeModel({
        ...model,
        domainProfile: 'custom',
        name: model.name.includes('Własny') ? model.name : 'Własny Skomponowany Sterownik 3D',
      });
      setStatusMessage('Tryb własnej kompozycji osi — włącz lub nazwij dowolne osie poniżej.');
    }
  };

  const updateAxis = (key: SpatialAxisKey, patch: Partial<SpatialAxisConfig>) => {
    onChangeModel({
      ...model,
      axes: {
        ...model.axes,
        [key]: {
          ...model.axes[key],
          ...patch,
        },
      },
    });
  };

  // Generate SVG path for Response Curve (-45° .. +45° -> -100% .. +100%)
  const curveSvgData = useMemo(() => {
    const w = 320;
    const h = 150;
    const pts: string[] = [];
    for (let deg = -45; deg <= 45; deg += 1.5) {
      const out = applySpatialTransferCurve(deg, model, 1);
      const x = ((deg + 45) / 90) * w;
      const y = h / 2 - out * (h / 2 - 12);
      pts.push(`${pts.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    const dzLeft = ((-model.deadzoneDeg + 45) / 90) * w;
    const dzRight = ((model.deadzoneDeg + 45) / 90) * w;
    const maxLeft = ((-model.maxTiltDeg + 45) / 90) * w;
    const maxRight = ((model.maxTiltDeg + 45) / 90) * w;

    const liveOut = applySpatialTransferCurve(liveSimTilt.gamma, model, 1);
    const liveX = ((clamp(liveSimTilt.gamma, -45, 45) + 45) / 90) * w;
    const liveY = h / 2 - liveOut * (h / 2 - 12);

    return {
      pathD: pts.join(' '),
      dzX: dzLeft,
      dzW: Math.max(2, dzRight - dzLeft),
      maxLeft,
      maxRight,
      liveX,
      liveY,
      liveOut,
    };
  }, [model, liveSimTilt.gamma]);

  // Simulated medical tissue volume Delta-V readout based on tilt + calibrated curve
  const medicalMetrics = useMemo(() => {
    const outNorm = applySpatialTransferCurve(liveSimTilt.gamma, model, 1);
    const pitchNorm = applySpatialTransferCurve(liveSimTilt.beta, model, 1);
    const deltaVolumePct = Number((outNorm * 14.8 + pitchNorm * 4.2).toFixed(2));
    const deltaCm3 = Number((deltaVolumePct * 0.42).toFixed(2));
    const rejectionRatio = Math.min(
      99,
      Math.round((model.deadzoneDeg / Math.max(0.2, model.noiseFloorDeg)) * 38)
    );
    return {
      deltaVolumePct,
      deltaCm3,
      rejectionRatio,
    };
  }, [liveSimTilt, model]);

  const exportMedicalTsAdapter = useMemo(() => {
    return `// Skalibrowany Model Sterownika Przestrzennego USCP-1.0
// Profil: ${model.name} (${model.domainProfile})
export const CALIBRATED_SPATIAL_MODEL = ${JSON.stringify(model, null, 2)} as const;

export function mapSensorTiltToDiagnosticDelta(rawTiltDeg: number, zeroOffsetDeg = ${model.zeroGamma}) {
  const delta = rawTiltDeg - zeroOffsetDeg;
  const absDelta = Math.abs(delta);
  if (absDelta <= ${model.deadzoneDeg}) return 0; // Tłumienie drżenia dłoni (noise floor ${model.noiseFloorDeg}°)
  const span = Math.max(4, ${model.maxTiltDeg} - ${model.deadzoneDeg});
  const norm = Math.min(1, ((absDelta - ${model.deadzoneDeg}) / span) * ${model.sensitivityMultiplier});
  ${
    model.responseCurve === 'logarithmic_medical'
      ? `const shaped = norm * 0.25 + (Math.log1p(norm * 3.5) / Math.log1p(3.5)) * 0.75;`
      : model.responseCurve === 'precision_cubic'
      ? `const shaped = norm * 0.45 + Math.pow(norm, 2.2) * 0.55;`
      : `const shaped = norm;`
  }
  return Math.sign(delta) * shaped;
}`;
  }, [model]);

  const copyWithFeedback = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const enabledAxesCount = AXIS_ORDER.filter((k) => model.axes[k]?.enabled).length;

  return (
    <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/40 p-4 sm:p-5 space-y-5">
      {/* Header + Domain Presets */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#e8ca64]">
            <Crosshair className="w-4 h-4 text-[#d4af37]" />
            <span>
              Kompozytor Sterownika Przestrzennego &amp; Automatyczna Kalibracja Czułości
            </span>
          </div>
          <p className="text-[11px] text-[#b8b2a6] mt-0.5 max-w-3xl">
            Szybko skomponuj zestaw osi i skalibruj wrażliwość na pochył dłoni lub telefonu — zarówno dla kamery 3D, jak i zewnętrznej aplikacji diagnostyki zmiany objętości tkanek (<code className="text-[#e8ca64]">ΔV</code>).
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'camera_3d' as SpatialDomainProfile, label: 'Kamera 3D / VR', Icon: Compass },
            {
              id: 'medical_tissue_volume' as SpatialDomainProfile,
              label: 'Diagnostyka Tkanek (ΔV)',
              Icon: Stethoscope,
            },
            { id: 'custom' as SpatialDomainProfile, label: 'Własny Model', Icon: Sliders },
          ].map(({ id, label, Icon }) => {
            const active = model.domainProfile === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyDomainPreset(id)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37]'
                    : 'bg-[#090a0d] text-[#c5bfb3] border-white/12 hover:border-[#d4af37]/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-Calibration Wizard + Live SVG Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Guided 2-Step Auto Calibration */}
        <div className="lg:col-span-6 rounded-xl bg-[#090a0d] border border-white/12 p-4 flex flex-col justify-between gap-3.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                <span>Automatyczny Kreator Kalibracji (2 Kroki · ~4 sek.)</span>
              </span>
              <span className="text-[11px] font-mono-tabular text-[#d4af37]">
                {sensorSource === 'gyro' ? 'Żyroskop Live' : 'Symulator + Gyro'}
              </span>
            </div>
            <p className="text-[11px] text-[#9e988c] leading-relaxed">
              Krok 1 mierzy punkt spoczynkowy 0° i mikro-drżenie dłoni (<code className="text-[#eae6dc]">Noise Floor</code>), automatycznie dobierając martwą strefę i wygładzanie EMA. Krok 2 rejestruje Twój wygodny pochył narzędzia, obliczając mnożnik czułości.
            </p>
          </div>

          {/* Interactive Test / Calibration Pad (for desktop or live verification) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-5 flex flex-col items-center gap-1.5">
              <div
                onPointerMove={(e) => {
                  if (e.buttons !== 1 && e.pointerType === 'mouse') return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nx = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
                  const ny = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
                  setLiveSimTilt({
                    gamma: Number((nx * 40).toFixed(1)),
                    beta: Number((-ny * 35).toFixed(1)),
                  });
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nx = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
                  const ny = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
                  setLiveSimTilt({
                    gamma: Number((nx * 40).toFixed(1)),
                    beta: Number((-ny * 35).toFixed(1)),
                  });
                }}
                onDoubleClick={() => setLiveSimTilt({ beta: 0, gamma: 0 })}
                className="relative w-32 h-32 rounded-full bg-[#11141d] border border-[#d4af37]/40 touch-none cursor-crosshair overflow-hidden"
                title="Przeciągnij, aby zasymulować pochył telefonu lub sondy podczas kalibracji"
              >
                <div className="absolute inset-x-2 top-1/2 h-px bg-white/15 pointer-events-none" />
                <div className="absolute inset-y-2 left-1/2 w-px bg-white/15 pointer-events-none" />
                <div
                  className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-[#d4af37]/30 border-2 border-[#d4af37] pointer-events-none"
                  style={{
                    left: `${50 + (liveSimTilt.gamma / 40) * 40}%`,
                    top: `${50 - (liveSimTilt.beta / 35) * 40}%`,
                  }}
                />
                <span className="absolute bottom-1.5 inset-x-0 text-center text-[9px] font-mono-tabular text-[#9e988c] pointer-events-none">
                  SYMULATOR POCHYŁU
                </span>
              </div>
              <div className="text-[10px] font-mono-tabular text-[#c5bfb3]">
                Pochył: {liveSimTilt.gamma.toFixed(1)}° / {liveSimTilt.beta.toFixed(1)}°
              </div>
            </div>

            <div className="sm:col-span-7 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-tabular">
                <div className="rounded-lg bg-[#11141d] border border-white/10 p-2">
                  <div className="text-[#9e988c] text-[10px]">Szum dłoni (Noise)</div>
                  <div className="text-white font-semibold">{model.noiseFloorDeg.toFixed(2)}°</div>
                </div>
                <div className="rounded-lg bg-[#11141d] border border-white/10 p-2">
                  <div className="text-[#9e988c] text-[10px]">Martwa strefa</div>
                  <div className="text-[#e8ca64] font-semibold">±{model.deadzoneDeg.toFixed(1)}°</div>
                </div>
                <div className="rounded-lg bg-[#11141d] border border-white/10 p-2">
                  <div className="text-[#9e988c] text-[10px]">Zakres pochyłu</div>
                  <div className="text-white font-semibold">±{model.maxTiltDeg}°</div>
                </div>
                <div className="rounded-lg bg-[#11141d] border border-white/10 p-2">
                  <div className="text-[#9e988c] text-[10px]">Czułość (Gain)</div>
                  <div className="text-emerald-300 font-semibold">
                    {model.sensitivityMultiplier.toFixed(2)}×
                  </div>
                </div>
              </div>

              {/* Progress bar when active */}
              {(stage === 'step1_zero' || stage === 'step2_envelope') && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono-tabular text-[#e8ca64]">
                    <span>
                      {stage === 'step1_zero'
                        ? 'Krok 1/2: Pomiar punktu 0° i drżenia...'
                        : 'Krok 2/2: Przechyl narzędzie w wygodnym zakresie...'}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1a1f2d] overflow-hidden">
                    <div
                      className="h-full bg-[#d4af37] transition-all duration-75"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={stage === 'step1_zero' || stage === 'step2_envelope'}
                  onClick={runStep1ZeroAndTremor}
                  className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-60 text-xs font-semibold text-[#090a0d] cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {stage === 'step1_zero' || stage === 'step2_envelope'
                      ? 'Kalibracja w toku...'
                      : 'Uruchom Auto-Kalibrację'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLiveSimTilt({ beta: 0, gamma: 0 });
                    onChangeModel({
                      ...model,
                      zeroAlpha: 0,
                      zeroBeta: 0,
                      zeroGamma: 0,
                      calibratedAt: new Date().toISOString(),
                    });
                    setStatusMessage('Wyzerowano punkt spoczynkowy 0° sterownika.');
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-[#e5dec9] cursor-pointer"
                  title="Zeruj offset osi"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#d4af37]" />
                </button>
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="rounded-lg bg-[#11141d] border border-[#d4af37]/30 px-3 py-2 text-[11px] text-[#e8ca64]">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Right: SVG Transfer Curve + Medical ΔV Telemetry */}
        <div className="lg:col-span-6 rounded-xl bg-[#090a0d] border border-white/12 p-4 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
              <Activity className="w-4 h-4 text-[#d4af37]" />
              <span>Krzywa Odpowiedzi Przestrzennej (Pochył° → Sygnał %)</span>
            </span>

            <div className="flex gap-1">
              {[
                { id: 'linear' as SpatialResponseCurve, label: 'Liniowa' },
                { id: 'precision_cubic' as SpatialResponseCurve, label: 'Kubiczna' },
                { id: 'logarithmic_medical' as SpatialResponseCurve, label: 'Medyczna ΔV' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChangeModel({ ...model, responseCurve: c.id })}
                  className={`min-h-[30px] px-2 py-1 rounded-md text-[10px] font-medium border cursor-pointer ${
                    model.responseCurve === c.id
                      ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37] font-semibold'
                      : 'bg-[#141722] text-[#c5bfb3] border-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-[#0d1018] border border-white/8 p-2">
            <svg viewBox="0 0 320 150" className="w-full h-36">
              {/* Deadzone band */}
              <rect
                x={curveSvgData.dzX}
                y={6}
                width={curveSvgData.dzW}
                height={138}
                fill="rgba(212, 175, 55, 0.14)"
              />
              {/* Axes */}
              <line x1="0" y1="75" x2="320" y2="75" stroke="#2c3347" strokeWidth="1" />
              <line x1="160" y1="6" x2="160" y2="144" stroke="#2c3347" strokeWidth="1" />
              {/* Max Tilt envelope markers */}
              <line
                x1={curveSvgData.maxLeft}
                y1="10"
                x2={curveSvgData.maxLeft}
                y2="140"
                stroke="#475569"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <line
                x1={curveSvgData.maxRight}
                y1="10"
                x2={curveSvgData.maxRight}
                y2="140"
                stroke="#475569"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {/* Transfer curve */}
              <path
                d={curveSvgData.pathD}
                fill="none"
                stroke="#d4af37"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* Live tilt probe marker */}
              <circle
                cx={curveSvgData.liveX}
                cy={curveSvgData.liveY}
                r="5"
                fill="#fef08a"
                stroke="#090a0d"
                strokeWidth="1.5"
              />
              <text x="8" y="18" fill="#9e988c" fontSize="9" fontFamily="monospace">
                +100%
              </text>
              <text x="8" y="142" fill="#9e988c" fontSize="9" fontFamily="monospace">
                -100%
              </text>
              <text x="166" y="18" fill="#e8ca64" fontSize="9" fontFamily="monospace">
                ±{model.deadzoneDeg.toFixed(1)}° strefa martwa
              </text>
            </svg>
          </div>

          {/* Fine calibration sliders + Medical Tissue Volume ΔV test card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <label className="space-y-1">
              <span className="flex justify-between text-[#b8b2a6]">
                <span>Martwa</span>
                <span className="font-mono-tabular text-[#d4af37]">
                  {model.deadzoneDeg.toFixed(1)}°
                </span>
              </span>
              <input
                type="range"
                min={0.2}
                max={6}
                step={0.1}
                value={model.deadzoneDeg}
                onChange={(e) =>
                  onChangeModel({ ...model, deadzoneDeg: Number(e.target.value) })
                }
                className="studio-slider w-full"
              />
            </label>

            <label className="space-y-1">
              <span className="flex justify-between text-[#b8b2a6]">
                <span>Max poch.</span>
                <span className="font-mono-tabular text-[#d4af37]">{model.maxTiltDeg}°</span>
              </span>
              <input
                type="range"
                min={10}
                max={45}
                step={1}
                value={model.maxTiltDeg}
                onChange={(e) =>
                  onChangeModel({ ...model, maxTiltDeg: Number(e.target.value) })
                }
                className="studio-slider w-full"
              />
            </label>

            <label className="space-y-1">
              <span className="flex justify-between text-[#b8b2a6]">
                <span>Czułość</span>
                <span className="font-mono-tabular text-[#d4af37]">
                  {model.sensitivityMultiplier.toFixed(2)}×
                </span>
              </span>
              <input
                type="range"
                min={0.4}
                max={2.6}
                step={0.05}
                value={model.sensitivityMultiplier}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChangeModel({ ...model, sensitivityMultiplier: val });
                  onSyncSensitivityToRig?.(val);
                }}
                className="studio-slider w-full"
              />
            </label>

            <label className="space-y-1">
              <span className="flex justify-between text-[#b8b2a6]">
                <span>EMA α</span>
                <span className="font-mono-tabular text-[#d4af37]">
                  {model.smoothingAlpha.toFixed(2)}
                </span>
              </span>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.02}
                value={model.smoothingAlpha}
                onChange={(e) =>
                  onChangeModel({ ...model, smoothingAlpha: Number(e.target.value) })
                }
                className="studio-slider w-full"
              />
            </label>
          </div>

          <div className="rounded-lg bg-[#11141d] border border-white/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular">
            <span className="inline-flex items-center gap-1.5 text-[#c5bfb3]">
              <Gauge className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>
                Symulacja odczytu ΔV tkanek: <strong className="text-white">{medicalMetrics.deltaVolumePct > 0 ? '+' : ''}{medicalMetrics.deltaVolumePct}%</strong> ({medicalMetrics.deltaCm3} cm³)
              </span>
            </span>
            <span className="text-emerald-300">
              Tłumienie drżeń: {medicalMetrics.rejectionRatio}%
            </span>
          </div>
        </div>
      </div>

      {/* Rapid Controller Element Composer (Axes Toggle + Labels + Export) */}
      {!compact && (
        <div className="rounded-xl bg-[#090a0d] border border-white/12 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-white">
                Szybki Kompozytor Osi Sterownika Przestrzennego ({enabledAxesCount}/6 aktywnych osi)
              </h4>
              <p className="text-[11px] text-[#9e988c]">
                Włącz tylko potrzebne osie, zmień ich nazwy lub jednostki (np. mm, cm³, %) — układ natychmiast zaktualizuje potencjometry i eksport USCP-1.0.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyWithFeedback('model_json', JSON.stringify(model, null, 2))}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-white cursor-pointer"
              >
                {copiedKey === 'model_json' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                )}
                <span>
                  {copiedKey === 'model_json' ? 'Skopiowano Model JSON!' : 'Kopiuj Model (.JSON)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => copyWithFeedback('med_ts', exportMedicalTsAdapter)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] cursor-pointer"
              >
                {copiedKey === 'med_ts' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Code2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {copiedKey === 'med_ts'
                    ? 'Skopiowano Kod .TS!'
                    : 'Kopiuj Funkcję Kalibracji (.TS)'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {AXIS_ORDER.map((axisKey) => {
              const axis = model.axes[axisKey];
              if (!axis) return null;
              return (
                <div
                  key={axisKey}
                  className={`rounded-lg border p-2.5 space-y-2 transition-opacity ${
                    axis.enabled
                      ? 'bg-[#121622] border-[#d4af37]/35'
                      : 'bg-[#0c0e14] border-white/8 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => updateAxis(axisKey, { enabled: !axis.enabled })}
                      className={`min-h-[32px] px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        axis.enabled
                          ? 'bg-[#d4af37] text-[#090a0d]'
                          : 'bg-[#1a1f2d] text-[#9e988c]'
                      }`}
                    >
                      {axis.enabled ? 'OŚ WŁ.' : 'OŚ WYŁ.'}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateAxis(axisKey, { invert: !axis.invert })}
                      className={`min-h-[30px] px-2 py-0.5 rounded border text-[10px] font-mono-tabular cursor-pointer ${
                        axis.invert
                          ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                          : 'bg-[#090a0d] border-white/10 text-[#9e988c]'
                      }`}
                    >
                      {axis.invert ? 'Odwrócona (-1×)' : 'Normalna (+1×)'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={axis.label}
                      onChange={(e) => updateAxis(axisKey, { label: e.target.value.slice(0, 42) })}
                      aria-label={`Etykieta osi ${axisKey}`}
                      className="flex-1 min-w-0 rounded bg-[#090a0d] border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#d4af37]"
                    />
                    <input
                      type="text"
                      value={axis.unit}
                      onChange={(e) => updateAxis(axisKey, { unit: e.target.value.slice(0, 6) })}
                      aria-label={`Jednostka osi ${axisKey}`}
                      className="w-12 rounded bg-[#090a0d] border border-white/10 px-1.5 py-1 text-[11px] font-mono-tabular text-center text-[#d4af37] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

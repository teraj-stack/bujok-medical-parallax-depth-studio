import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Compass,
  Gamepad2,
  Move3d,
  Play,
  RotateCcw,
  Sliders,
  Smartphone,
  Square,
} from 'lucide-react';
import { LiveCameraRigState, SpatialControllerModel } from '../types/studio';
import {
  applySpatialTransferCurve,
  DEFAULT_CAMERA_3D_SPATIAL_MODEL,
} from '../universal-controller/connectorProtocol';

interface CameraPotentiometerAndVRPadProps {
  rig: LiveCameraRigState;
  onChangeRig: (next: LiveCameraRigState) => void;
  spatialModel?: SpatialControllerModel;
  onCaptureToState?: (target: 'A' | 'B') => void;
  allowedKnobKeys?: Array<KnobSpec['key']>;
  compact?: boolean;
}

interface KnobSpec {
  key: 'yawDeg' | 'pitchDeg' | 'rollDeg' | 'dollyZ' | 'panX' | 'fovOffset';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const KNOB_SPECS: KnobSpec[] = [
  { key: 'yawDeg', label: 'Obrót YAW', unit: '°', min: -45, max: 45, step: 1 },
  { key: 'pitchDeg', label: 'Pochył PITCH', unit: '°', min: -30, max: 30, step: 1 },
  { key: 'rollDeg', label: 'Przechył ROLL', unit: '°', min: -25, max: 25, step: 1 },
  { key: 'dollyZ', label: 'Wózek DOLLY Z', unit: 'm', min: -1.8, max: 1.8, step: 0.05 },
  { key: 'panX', label: 'Przesuw PAN X', unit: 'm', min: -1.8, max: 1.8, step: 0.05 },
  { key: 'fovOffset', label: 'Ogniskowa ZOOM', unit: '°', min: -12, max: 14, step: 0.5 },
];

function clampVal(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function snapStep(v: number, step: number): number {
  const factor = Math.round(1 / step);
  return Math.round(v * factor) / factor;
}

function wrapDeltaDeg(delta: number): number {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

interface RotaryPotentiometerKnobProps {
  spec: KnobSpec;
  value: number;
  onChange: (nextVal: number) => void;
}

const RotaryPotentiometerKnob: React.FC<RotaryPotentiometerKnobProps> = ({
  spec,
  value,
  onChange,
}) => {
  const dragStateRef = useRef<{ startY: number; startX: number; startVal: number } | null>(
    null
  );

  const norm = (value - spec.min) / (spec.max - spec.min);
  const angleDeg = -135 + clampVal(norm, 0, 1) * 270;

  // Arc math on 80x80 SVG (center 40,40, r=30)
  const polarToXY = (deg: number, r = 30) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      x: 40 + r * Math.cos(rad),
      y: 40 + r * Math.sin(rad),
    };
  };

  const describeArc = (startDeg: number, endDeg: number) => {
    const s = polarToXY(startDeg);
    const e = polarToXY(endDeg);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = endDeg >= startDeg ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A 30 30 0 ${largeArc} ${sweep} ${e.x.toFixed(
      2
    )} ${e.y.toFixed(2)}`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      startY: e.clientY,
      startX: e.clientX,
      startVal: value,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const dy = dragStateRef.current.startY - e.clientY;
    const dx = e.clientX - dragStateRef.current.startX;
    const deltaPx = dy + dx * 0.45;
    const range = spec.max - spec.min;
    const nextRaw = dragStateRef.current.startVal + (deltaPx / 120) * range;
    onChange(snapStep(clampVal(nextRaw, spec.min, spec.max), spec.step));
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const formatNum = (v: number) => {
    const prefix = v > 0 ? '+' : '';
    const txt = spec.step < 1 ? v.toFixed(2) : Math.round(v).toString();
    return `${prefix}${txt}${spec.unit}`;
  };

  return (
    <div className="rounded-xl bg-[#090a0d] border border-white/10 p-2.5 flex flex-col items-center gap-1.5 select-none">
      <span className="text-[11px] font-medium text-[#c5bfb3] text-center truncate max-w-full">
        {spec.label}
      </span>

      <div
        role="slider"
        tabIndex={0}
        aria-label={spec.label}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => onChange(0)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            onChange(snapStep(clampVal(value + spec.step, spec.min, spec.max), spec.step));
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            onChange(snapStep(clampVal(value - spec.step, spec.min, spec.max), spec.step));
          }
        }}
        title="Przeciągnij w górę/dół, aby obracać potencjometr · Podwójne kliknięcie = 0"
        className="relative w-20 h-20 flex items-center justify-center touch-none cursor-ns-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] rounded-full"
      >
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          {/* Background track arc */}
          <path
            d={describeArc(-135, 135)}
            fill="none"
            stroke="#242938"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Zero tick at top (0 deg) */}
          <line x1="40" y1="6" x2="40" y2="13" stroke="#6d685e" strokeWidth="1.5" />
          {/* Active arc from zero center */}
          <path
            d={describeArc(0, angleDeg)}
            fill="none"
            stroke="#d4af37"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Inner rotary cap */}
          <circle
            cx="40"
            cy="40"
            r="21"
            fill="#151822"
            stroke="#32384b"
            strokeWidth="1.5"
          />
          {/* Pointer line */}
          <g transform={`rotate(${angleDeg} 40 40)`}>
            <line
              x1="40"
              y1="40"
              x2="40"
              y2="21"
              stroke="#fef08a"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="40" cy="40" r="3.5" fill="#d4af37" />
          </g>
        </svg>
      </div>

      <div className="w-full flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() =>
            onChange(snapStep(clampVal(value - spec.step * 2, spec.min, spec.max), spec.step))
          }
          className="min-h-[34px] min-w-[30px] rounded bg-[#141722] hover:bg-[#1e2334] border border-white/10 text-xs text-[#c5bfb3] cursor-pointer"
          aria-label={`Zmniejsz ${spec.label}`}
        >
          -
        </button>
        <span className="text-[11px] font-mono-tabular font-semibold text-[#e8ca64]">
          {formatNum(value)}
        </span>
        <button
          type="button"
          onClick={() =>
            onChange(snapStep(clampVal(value + spec.step * 2, spec.min, spec.max), spec.step))
          }
          className="min-h-[34px] min-w-[30px] rounded bg-[#141722] hover:bg-[#1e2334] border border-white/10 text-xs text-[#c5bfb3] cursor-pointer"
          aria-label={`Zwiększ ${spec.label}`}
        >
          +
        </button>
      </div>
    </div>
  );
};

export const CameraPotentiometerAndVRPad: React.FC<CameraPotentiometerAndVRPadProps> = ({
  rig,
  onChangeRig,
  spatialModel,
  onCaptureToState,
  allowedKnobKeys,
  compact = false,
}) => {
  const [vrGyroActive, setVrGyroActive] = useState(false);
  const [vrSimActive, setVrSimActive] = useState(false);
  const [gamepadActive, setGamepadActive] = useState(false);
  const [midiActive, setMidiActive] = useState(false);
  const [hwStatusText, setHwStatusText] = useState<string | null>(null);

  const activeModel = spatialModel || DEFAULT_CAMERA_3D_SPATIAL_MODEL;
  const activeModelRef = useRef(activeModel);
  activeModelRef.current = activeModel;

  const rigRef = useRef(rig);
  rigRef.current = rig;

  const gyroOriginRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);
  const reticleDragRef = useRef(false);

  const updateAxes = useCallback(
    (patch: Partial<LiveCameraRigState>) => {
      onChangeRig({
        ...rigRef.current,
        enabled: true,
        ...patch,
      });
    },
    [onChangeRig]
  );

  // 1. Live DeviceOrientation VR Gyroscope Steering (with Calibrated Spatial Transfer Curve & EMA)
  useEffect(() => {
    if (!vrGyroActive) {
      gyroOriginRef.current = null;
      return;
    }

    const handleOrientation = (ev: DeviceOrientationEvent) => {
      if (ev.alpha === null || ev.beta === null || ev.gamma === null) return;
      const model = activeModelRef.current;
      if (!gyroOriginRef.current) {
        gyroOriginRef.current = {
          alpha: ev.alpha,
          beta: ev.beta,
          gamma: ev.gamma,
        };
      }
      const origin = gyroOriginRef.current;
      const dAlpha = wrapDeltaDeg(ev.alpha - origin.alpha);
      const dBeta = clampVal(ev.beta - origin.beta, -45, 45);
      const dGamma = clampVal(ev.gamma - origin.gamma, -45, 45);

      const userGain = rigRef.current.vrSensitivity || 1.0;
      const effModel: SpatialControllerModel = {
        ...model,
        sensitivityMultiplier: model.sensitivityMultiplier * userGain,
      };

      const yawSign = model.axes.yawDeg?.invert ? -1 : 1;
      const pitchSign = model.axes.pitchDeg?.invert ? -1 : 1;
      const rollSign = model.axes.rollDeg?.invert ? -1 : 1;

      const targetYaw =
        model.axes.yawDeg?.enabled === false
          ? 0
          : -applySpatialTransferCurve(dAlpha, effModel, 45) * yawSign;
      const targetPitch =
        model.axes.pitchDeg?.enabled === false
          ? 0
          : applySpatialTransferCurve(dBeta, effModel, 30) * pitchSign;
      const targetRoll =
        model.axes.rollDeg?.enabled === false
          ? 0
          : applySpatialTransferCurve(dGamma, effModel, 25) * rollSign;

      const ema = clampVal(model.smoothingAlpha || 0.45, 0.1, 0.9);
      const cur = rigRef.current;
      onChangeRig({
        ...cur,
        enabled: true,
        source: 'vr_gyro',
        yawDeg: Number((cur.yawDeg * (1 - ema) + targetYaw * ema).toFixed(2)),
        pitchDeg: Number((cur.pitchDeg * (1 - ema) + targetPitch * ema).toFixed(2)),
        rollDeg: Number((cur.rollDeg * (1 - ema) + targetRoll * ema).toFixed(2)),
      });
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [vrGyroActive, onChangeRig]);

  // 2. Built-in VR Motion Simulator (Organic Hand-Held VR Camera Test Loop)
  useEffect(() => {
    if (!vrSimActive) return;
    let rafId = 0;
    const t0 = performance.now();
    let lastPush = 0;

    const tick = (now: number) => {
      if (now - lastPush >= 34) {
        lastPush = now;
        const t = (now - t0) / 1000;
        const sens = rigRef.current.vrSensitivity || 1.0;
        onChangeRig({
          ...rigRef.current,
          enabled: true,
          source: 'vr_simulator',
          yawDeg: Number((Math.sin(t * 0.95) * 18 * sens).toFixed(2)),
          pitchDeg: Number((Math.sin(t * 1.45 + 0.6) * 10 * sens).toFixed(2)),
          rollDeg: Number((Math.cos(t * 0.8) * 5.5 * sens).toFixed(2)),
          dollyZ: Number((Math.sin(t * 0.55) * 0.45).toFixed(3)),
          panX: Number((Math.cos(t * 0.72) * 0.35).toFixed(3)),
        });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [vrSimActive, onChangeRig]);

  // 3. Hardware Gamepad / Analog Potentiometer Stick Poller
  useEffect(() => {
    if (!gamepadActive) return;
    let rafId = 0;
    let lastTick = 0;

    const pollPad = (now: number) => {
      if (now - lastTick >= 40) {
        lastTick = now;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const pad = Array.from(pads).find((p) => p && p.connected);
        if (pad) {
          const dz = (v: number) => (Math.abs(v) < 0.08 ? 0 : v);
          const ax0 = dz(pad.axes[0] ?? 0);
          const ax1 = dz(pad.axes[1] ?? 0);
          const ax2 = dz(pad.axes[2] ?? 0);
          const ax3 = dz(pad.axes[3] ?? 0);
          const sens = rigRef.current.vrSensitivity || 1.0;

          if (ax0 !== 0 || ax1 !== 0 || ax2 !== 0 || ax3 !== 0) {
            onChangeRig({
              ...rigRef.current,
              enabled: true,
              source: 'hardware_gamepad',
              yawDeg: clampVal(Number((ax0 * 38 * sens).toFixed(1)), -45, 45),
              pitchDeg: clampVal(Number((-ax1 * 25 * sens).toFixed(1)), -30, 30),
              panX: clampVal(Number((ax2 * 1.4).toFixed(2)), -1.8, 1.8),
              dollyZ: clampVal(Number((-ax3 * 1.4).toFixed(2)), -1.8, 1.8),
            });
          }
        }
      }
      rafId = requestAnimationFrame(pollPad);
    };

    rafId = requestAnimationFrame(pollPad);
    return () => cancelAnimationFrame(rafId);
  }, [gamepadActive, onChangeRig]);

  const handleToggleVrGyro = async () => {
    if (vrGyroActive) {
      setVrGyroActive(false);
      setHwStatusText('Wyłączono żyroskop VR telefonu.');
      return;
    }

    setVrSimActive(false);
    try {
      const devOri = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (devOri && typeof devOri.requestPermission === 'function') {
        const perm = await devOri.requestPermission();
        if (perm !== 'granted') {
          setHwStatusText('Brak zgody na żyroskop — użyj symulatora VR poniżej.');
          return;
        }
      }
      gyroOriginRef.current = null;
      setVrGyroActive(true);
      updateAxes({ source: 'vr_gyro' });
      setHwStatusText('Żyroskop VR aktywny — poruszaj telefonem, aby obracać kamerę.');
    } catch {
      setHwStatusText(
        'To urządzenie nie ma żyroskopu sprzętowego — włącz „Symuluj Ruch VR” lub użyj tarczy gimbal.'
      );
    }
  };

  const handleToggleMidi = async () => {
    if (midiActive) {
      setMidiActive(false);
      setHwStatusText('Odłączono mapowanie potencjometrów MIDI.');
      return;
    }

    const nav = navigator as unknown as {
      requestMIDIAccess?: () => Promise<{ inputs: Map<string, any> }>;
    };
    if (!nav.requestMIDIAccess) {
      setHwStatusText(
        'Przeglądarka nie obsługuje Web MIDI — użyj potencjometrów ekranowych lub Gamepada.'
      );
      return;
    }

    try {
      const access = await nav.requestMIDIAccess();
      let inputCount = 0;
      access.inputs.forEach((input: any) => {
        inputCount += 1;
        input.onmidimessage = (msg: { data: Uint8Array }) => {
          const [status, cc, rawVal] = msg.data;
          if ((status & 0xf0) !== 0xb0) return; // Control Change CC
          const norm = (rawVal / 127) * 2 - 1; // -1 .. +1
          const cur = rigRef.current;
          const next: LiveCameraRigState = {
            ...cur,
            enabled: true,
            source: 'web_midi',
          };
          const slot = cc % 6;
          if (slot === 1) next.yawDeg = Number((norm * 45).toFixed(1));
          else if (slot === 2) next.pitchDeg = Number((norm * 30).toFixed(1));
          else if (slot === 3) next.rollDeg = Number((norm * 25).toFixed(1));
          else if (slot === 4) next.dollyZ = Number((norm * 1.8).toFixed(2));
          else if (slot === 5) next.panX = Number((norm * 1.8).toFixed(2));
          else next.fovOffset = Number((norm * 12).toFixed(1));
          onChangeRig(next);
        };
      });
      setMidiActive(true);
      setHwStatusText(
        inputCount > 0
          ? `MIDI aktywne (${inputCount} kontrolerów) — kręć fizycznymi potencjometrami CC!`
          : 'Brak podłączonych urządzeń USB-MIDI — nadal działają potencjometry dotykowe.'
      );
    } catch {
      setHwStatusText('Nie przyznano dostępu do portów MIDI.');
    }
  };

  const applyReticlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = clampVal(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    const ny = clampVal(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    const effModel: SpatialControllerModel = {
      ...activeModel,
      sensitivityMultiplier:
        activeModel.sensitivityMultiplier * (rig.vrSensitivity || 1.0),
    };
    setVrSimActive(false);
    updateAxes({
      source: 'vr_simulator',
      yawDeg: Number(
        applySpatialTransferCurve(nx * activeModel.maxTiltDeg, effModel, 45).toFixed(1)
      ),
      pitchDeg: Number(
        applySpatialTransferCurve(-ny * activeModel.maxTiltDeg, effModel, 30).toFixed(1)
      ),
    });
  };

  const resetRig = () => {
    setVrSimActive(false);
    gyroOriginRef.current = null;
    onChangeRig({
      ...rig,
      enabled: false,
      source: 'idle',
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      dollyZ: 0,
      panX: 0,
      fovOffset: 0,
    });
  };

  // Reticle marker offset percentage
  const reticleX = 50 + (rig.yawDeg / 45) * 38;
  const reticleY = 50 - (rig.pitchDeg / 30) * 38;

  return (
    <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/35 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#e8ca64]">
            <Move3d className="w-4 h-4 text-[#d4af37]" />
            <span>Sterownik Kamery 3D: Ruch VR Telefonu &amp; Bank Potencjometrów</span>
          </div>
          <p className="text-[11px] text-[#9e988c] mt-0.5">
            Obracaj telefon w dłoni jak gogle VR, symuluj ruch na tarczy horyzontu albo kręć 6 potencjometrami osiowymi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeRig({ ...rig, enabled: !rig.enabled })}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
              rig.enabled
                ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37]'
                : 'bg-[#090a0d] text-[#c5bfb3] border-white/15'
            }`}
          >
            Kamera Live: {rig.enabled ? 'WŁĄCZONA' : 'WYŁĄCZONA'}
          </button>

          <button
            type="button"
            onClick={resetRig}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-[#e5dec9] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Zeruj Osie</span>
          </button>
        </div>
      </div>

      {/* Top Row: VR Gyro / Simulator Gimbal + Action Modes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Interactive VR Horizon Gimbal Pad */}
        <div className="lg:col-span-5 flex flex-col items-center gap-2">
          <div
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              reticleDragRef.current = true;
              applyReticlePointer(e);
            }}
            onPointerMove={(e) => {
              if (!reticleDragRef.current) return;
              applyReticlePointer(e);
            }}
            onPointerUp={() => {
              reticleDragRef.current = false;
            }}
            onPointerCancel={() => {
              reticleDragRef.current = false;
            }}
            className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-[#090a0d] border-2 border-[#d4af37]/40 overflow-hidden touch-none cursor-crosshair shadow-inner"
            title="Przeciągnij palcem lub myszką, aby symulować ruch głowy / telefonu w przestrzeni VR"
          >
            {/* Crosshair & Artificial Horizon tilted by rollDeg */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ transform: `rotate(${rig.rollDeg}deg)` }}
            >
              <div className="absolute inset-x-3 top-1/2 h-px bg-[#d4af37]/30" />
              <div className="absolute inset-y-3 left-1/2 w-px bg-white/15" />
              <div className="absolute inset-6 rounded-full border border-dashed border-white/12" />
            </div>

            {/* Active Aim Target Dot */}
            <div
              className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-[#d4af37]/25 border-2 border-[#d4af37] pointer-events-none flex items-center justify-center"
              style={{ left: `${reticleX}%`, top: `${reticleY}%` }}
            >
              <div className="w-2 h-2 rounded-full bg-[#fef08a]" />
            </div>

            <div className="absolute bottom-2 inset-x-0 text-center text-[10px] font-mono-tabular text-[#9e988c] pointer-events-none">
              VR HORYZONT (DOTKNIJ)
            </div>
          </div>

          <div className="text-[11px] font-mono-tabular text-[#9e988c]">
            Y: {Math.round(rig.yawDeg)}° · P: {Math.round(rig.pitchDeg)}° · R:{' '}
            {Math.round(rig.rollDeg)}°
          </div>
        </div>

        {/* Mode Switches: Phone VR Gyro, Auto VR Simulator, Hardware Pad, MIDI */}
        <div className="lg:col-span-7 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleToggleVrGyro}
              className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                vrGyroActive
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-[#090a0d] border-white/12 text-white hover:border-[#d4af37]/60'
              }`}
            >
              <Smartphone className="w-4 h-4 text-[#d4af37]" />
              <span>
                {vrGyroActive ? 'Żyroskop VR Telefonu: WŁ.' : 'Włącz Żyroskop VR Telefonu'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setVrGyroActive(false);
                setVrSimActive((v) => !v);
              }}
              className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                vrSimActive
                  ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37]'
                  : 'bg-[#090a0d] border-white/12 text-white hover:border-[#d4af37]/60'
              }`}
            >
              {vrSimActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-[#d4af37]" />}
              <span>{vrSimActive ? 'Zatrzymaj Symulację VR' : 'Symuluj Ruch VR (Demo)'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                gyroOriginRef.current = null;
                setHwStatusText('Ustawiono bieżącą pozycję dłoni jako punkt 0° VR.');
              }}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-[#e5dec9] cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#d4af37]" />
              <span>Zeruj Punkt 0 VR</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setGamepadActive((v) => !v);
                  setHwStatusText(
                    !gamepadActive
                      ? 'Nasłuch kontrolera USB / Pada aktywny.'
                      : 'Wyłączono nasłuch kontrolera USB.'
                  );
                }}
                className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                  gamepadActive
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-[#090a0d] border-white/12 text-[#c5bfb3]'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Pad USB</span>
              </button>

              <button
                type="button"
                onClick={handleToggleMidi}
                className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                  midiActive
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-[#090a0d] border-white/12 text-[#c5bfb3]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>MIDI CC</span>
              </button>
            </div>
          </div>

          {/* VR Sensitivity + Invert */}
          <div className="rounded-xl bg-[#090a0d] border border-white/10 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[180px] space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#c5bfb3]">Czułość ruchu VR / Potencjometrów</span>
                <span className="font-mono-tabular text-[#d4af37]">
                  {rig.vrSensitivity.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.4}
                step={0.1}
                value={rig.vrSensitivity}
                onChange={(e) =>
                  onChangeRig({ ...rig, vrSensitivity: Number(e.target.value) })
                }
                className="studio-slider w-full"
              />
            </div>

            <button
              type="button"
              onClick={() => onChangeRig({ ...rig, invertAxes: !rig.invertAxes })}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                rig.invertAxes
                  ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#e8ca64]'
                  : 'bg-[#141722] border-white/10 text-[#9e988c]'
              }`}
            >
              Odwróć osie: {rig.invertAxes ? 'TAK' : 'NIE'}
            </button>
          </div>

          {hwStatusText && (
            <div className="text-[11px] text-[#e8ca64] bg-[#090a0d] border border-[#d4af37]/25 rounded-lg px-3 py-2">
              {hwStatusText}
            </div>
          )}
        </div>
      </div>

      {/* Composed Rotary Potentiometer Knobs (Filtered & Labeled by SpatialControllerModel) */}
      <div
        className={`grid gap-2.5 ${
          compact
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        }`}
      >
        {KNOB_SPECS.filter(
          (spec) =>
            activeModel.axes[spec.key]?.enabled !== false &&
            (!allowedKnobKeys || allowedKnobKeys.includes(spec.key))
        ).map(
          (spec) => {
            const customAxis = activeModel.axes[spec.key];
            const mergedSpec: KnobSpec = customAxis
              ? {
                  ...spec,
                  label: customAxis.label || spec.label,
                  unit: customAxis.unit || spec.unit,
                  min: customAxis.min ?? spec.min,
                  max: customAxis.max ?? spec.max,
                  step: customAxis.step ?? spec.step,
                }
              : spec;
            return (
              <RotaryPotentiometerKnob
                key={spec.key}
                spec={mergedSpec}
                value={rig[spec.key]}
                onChange={(nextVal) =>
                  updateAxes({
                    source: 'potentiometer',
                    [spec.key]: nextVal,
                  })
                }
              />
            );
          }
        )}
      </div>

      {/* Capture Framed VR Pose directly to 3D Camera Path State A or B */}
      {onCaptureToState && (
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => onCaptureToState('A')}
            className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-emerald-500/18 hover:bg-emerald-500/28 border border-emerald-400/50 text-xs font-semibold text-emerald-200 cursor-pointer"
          >
            Zapisz kadr VR jako Stan A (Start ścieżki 3D)
          </button>
          <button
            type="button"
            onClick={() => onCaptureToState('B')}
            className="min-h-[44px] flex-1 px-4 py-2 rounded-xl bg-amber-500/18 hover:bg-amber-500/28 border border-amber-400/50 text-xs font-semibold text-amber-200 cursor-pointer"
          >
            Zapisz kadr VR jako Stan B (Cel ścieżki 3D)
          </button>
        </div>
      )}
    </section>
  );
};

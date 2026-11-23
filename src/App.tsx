/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Film,
  ImagePlus,
  MessageSquare,
  PlugZap,
  Smartphone,
} from 'lucide-react';
import { BottomControlDock } from './components/BottomControlDock';
import { ParallaxThreeViewport } from './components/ParallaxThreeViewport';
import { StudioWorkspaceDrawer } from './components/StudioWorkspaceDrawer';
import { TabletControllerSurface } from './components/TabletControllerSurface';
import { CINEMATIC_NARRATIVE_SHOTS } from './data/cinematicShotsLibrary';
import {
  decodeCompactShareLink,
  encodeCompactShareLink,
  PRESET_SCENES,
} from './data/presetScenes';
import {
  CameraBlockingConfig,
  DrawerTabId,
  KeyframeItem,
  LiveCameraRigState,
  SceneAsset,
  SceneNarrative,
  UniversalControllerConfig,
  UscpRemoteActionType,
  VisualEffectSettings,
} from './types/studio';
import {
  DEFAULT_LIVE_CAMERA_RIG,
  DEFAULT_UNIVERSAL_CONTROLLER_CONFIG,
  useUniversalConnectorBridge,
  UscpRemoteSceneSummary,
} from './universal-controller/connectorProtocol';
import {
  createLightSceneThumbnail,
  prepareUploadedSceneAssets,
} from './utils/imageUpload';
import {
  exportCanvasToWebP,
  ExportResultInfo,
  generateInstantFourKeyframes,
  renderVideoFromFourKeyframes,
} from './utils/mediaExporter';

function resolveInitialTabletMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'tablet';
}

export default function App() {
  const [isTabletMode, setIsTabletMode] = useState<boolean>(resolveInitialTabletMode);
  const [scenes, setScenes] = useState<SceneAsset[]>(PRESET_SCENES);
  const [activeScene, setActiveScene] = useState<SceneAsset>(PRESET_SCENES[0]);
  const [settings, setSettings] = useState<VisualEffectSettings>(
    PRESET_SCENES[0].defaultSettings
  );
  const [narrative, setNarrative] = useState<SceneNarrative>(
    PRESET_SCENES[0].defaultNarrative
  );
  const [showStoryOverlay, setShowStoryOverlay] = useState<boolean>(true);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTabId>('blocking3d');

  const [universalController, setUniversalController] =
    useState<UniversalControllerConfig>(DEFAULT_UNIVERSAL_CONTROLLER_CONFIG);

  const [cameraBlocking, setCameraBlocking] = useState<CameraBlockingConfig>(() => {
    const defaultShot = CINEMATIC_NARRATIVE_SHOTS[0];
    return {
      activeShotPresetId: defaultShot.id,
      ...defaultShot.blocking,
    };
  });

  const [liveCameraRig, setLiveCameraRig] = useState<LiveCameraRigState>(
    DEFAULT_LIVE_CAMERA_RIG
  );

  const [keyframes, setKeyframes] = useState<KeyframeItem[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExportingMP4, setIsExportingMP4] = useState<boolean>(false);
  const [mp4Progress, setMp4Progress] = useState<number>(0);
  const [lastExportInfo, setLastExportInfo] = useState<ExportResultInfo | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  const handleApplyPartialSettings = useCallback(
    (partial: Partial<VisualEffectSettings>) => {
      setSettings((prev) => ({
        ...prev,
        ...partial,
      }));
    },
    []
  );

  const handleSelectScene = useCallback((scene: SceneAsset) => {
    setActiveScene(scene);
    setSettings(scene.defaultSettings);
    setNarrative(scene.defaultNarrative);
  }, []);

  const handleUploadImages = useCallback(
    async (files: FileList | File[]) => {
      const added = await prepareUploadedSceneAssets(files, activeScene);
      if (added.length === 0) return;
      setScenes((prev) => [...prev, ...added]);
      setActiveScene(added[0]);
      setNarrative(added[0].defaultNarrative);
    },
    [activeScene]
  );

  const regenerateFourKeyframes = useCallback(
    async (
      customPrompts?: string[],
      blockingOverride?: CameraBlockingConfig
    ): Promise<KeyframeItem[]> => {
      try {
        const activeBlocking = blockingOverride ?? cameraBlocking;
        const frames = await generateInstantFourKeyframes(
          activeScene.imageUrl,
          settings,
          activeScene.windowBounds,
          customPrompts,
          activeBlocking
        );
        setKeyframes(frames);
        return frames;
      } catch (err) {
        console.error('Failed to generate 4-frame sequence:', err);
        return keyframes;
      }
    },
    [activeScene, settings, cameraBlocking, keyframes]
  );

  const handleExportSingleWebP = useCallback(
    async (quality = 0.86) => {
      if (!canvasRef.current) return;
      const info = await exportCanvasToWebP(canvasRef.current, quality, activeScene.id);
      setLastExportInfo(info);
    },
    [activeScene.id]
  );

  const handleExportLightweightMP4 = useCallback(
    async (durationSec = 6, kbps = 2200) => {
      if (isExportingMP4) return;
      setIsExportingMP4(true);
      setMp4Progress(0);
      try {
        let currentFrames = keyframes;
        if (!currentFrames || currentFrames.length < 4) {
          currentFrames = await generateInstantFourKeyframes(
            activeScene.imageUrl,
            settings,
            activeScene.windowBounds,
            undefined,
            cameraBlocking
          );
          setKeyframes(currentFrames);
        }
        const info = await renderVideoFromFourKeyframes(currentFrames, {
          durationSec,
          targetKbps: kbps,
          aspectRatio: '16:9',
          transitionMode: 'smooth_camera_path',
          cameraBlocking,
          captions: narrative.frameCaptions,
          includeCaptions: showStoryOverlay,
          autoDownload: true,
          onProgress: (pct) => setMp4Progress(pct),
        });
        setLastExportInfo(info);
      } finally {
        setIsExportingMP4(false);
      }
    },
    [
      isExportingMP4,
      keyframes,
      activeScene,
      settings,
      cameraBlocking,
      narrative.frameCaptions,
      showStoryOverlay,
    ]
  );

  const handleCaptureVrToBlockingState = useCallback(
    (target: 'A' | 'B', rigOverride?: LiveCameraRigState) => {
      const r = rigOverride || liveCameraRig;
      setCameraBlocking((prev) => {
        const base = target === 'A' ? prev.startPose : prev.endPose;
        const rawX = (r.panX + (r.airX ?? 0) * 0.72) * 2.2;
        const rawY = 1.52 + (r.pitchDeg / 30) * 0.7 + (r.airY ?? 0) * 0.6;
        const rawZ = 3.6 - (r.dollyZ - (r.airZ ?? 0) * 0.65) * 1.4;
        const mappedPose = {
          ...base,
          x: Number(Math.max(-5.2, Math.min(5.2, rawX)).toFixed(2)),
          y: Number(Math.max(0.55, Math.min(3.2, rawY)).toFixed(2)),
          z: Number(Math.max(-3.2, Math.min(5.8, rawZ)).toFixed(2)),
          panDeg: Math.round(r.yawDeg),
          tiltDeg: Math.round(r.pitchDeg),
          rollDeg: Math.round(r.rollDeg),
        };
        return target === 'A'
          ? { ...prev, startPose: mappedPose }
          : { ...prev, endPose: mappedPose };
      });
    },
    [liveCameraRig]
  );

  const remoteActionRef = useRef<(action: UscpRemoteActionType, payload?: any) => void>(
    () => {}
  );
  remoteActionRef.current = (action, payload) => {
    if (isTabletMode) return; // Actions execute on desktop host
    switch (action) {
      case 'select_scene': {
        const target = scenes.find((s) => s.id === payload?.sceneId);
        if (target) handleSelectScene(target);
        break;
      }
      case 'export_webp':
        void handleExportSingleWebP(0.86);
        break;
      case 'export_mp4':
        void handleExportLightweightMP4(6, 2200);
        break;
      case 'reset_settings':
        setSettings(activeScene.defaultSettings);
        setLiveCameraRig(DEFAULT_LIVE_CAMERA_RIG);
        break;
      case 'regenerate_keyframes':
        void regenerateFourKeyframes();
        break;
      case 'open_tab':
        if (payload?.tab) {
          setActiveDrawerTab(payload.tab as DrawerTabId);
          setDrawerOpen(true);
        }
        break;
      case 'capture_vr_to_state_a':
        handleCaptureVrToBlockingState('A', payload);
        break;
      case 'capture_vr_to_state_b':
        handleCaptureVrToBlockingState('B', payload);
        break;
      case 'capture_air_shot':
        handleCaptureVrToBlockingState('B', payload);
        void handleExportSingleWebP(0.86);
        void regenerateFourKeyframes();
        break;
    }
  };

  // Register Standardized Multi-Screen & Multi-App Connector Bridge (USCP-1.0)
  const uscpState = useUniversalConnectorBridge({
    role: isTabletMode ? 'tablet' : 'host',
    controller: universalController,
    settings,
    cameraBlocking,
    liveCameraRig,
    showStoryOverlay,
    onUpdateController: setUniversalController,
    onApplySettings: handleApplyPartialSettings,
    onChangeCameraBlocking: setCameraBlocking,
    onChangeLiveCameraRig: setLiveCameraRig,
    onSetShowStoryOverlay: setShowStoryOverlay,
    onRemoteAction: (action, payload) => remoteActionRef.current(action, payload),
  });

  // Publish lightweight scene catalog + thumbnails from Host Desktop to paired Tablet / Phone screens
  useEffect(() => {
    if (isTabletMode) return;
    let cancelled = false;
    (async () => {
      const catalog: UscpRemoteSceneSummary[] = await Promise.all(
        scenes.map(async (sc) => ({
          id: sc.id,
          title: sc.title,
          subtitle: sc.subtitle,
          previewThumb: await createLightSceneThumbnail(sc.imageUrl),
        }))
      );
      if (!cancelled) {
        uscpState.publishSceneCatalog(catalog, activeScene.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenes, activeScene.id, isTabletMode, uscpState.publishSceneCatalog]);

  useEffect(() => {
    const decoded = decodeCompactShareLink(window.location.hash);
    if (decoded) {
      const found =
        PRESET_SCENES.find((s) => s.id === decoded.sceneId) || PRESET_SCENES[0];
      setActiveScene(found);
      setNarrative(found.defaultNarrative);
      if (decoded.settings) {
        setSettings({
          ...found.defaultSettings,
          ...decoded.settings,
        });
      }
    }
  }, []);

  // Global Keyboard Shortcut (H) + Instant Clipboard Image Paste (Ctrl+V)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setIsDockCollapsed((prev) => !prev);
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isTabletMode) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const f = items[i].getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void handleUploadImages(files);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [isTabletMode, handleUploadImages]);

  useEffect(() => {
    if (!isTabletMode) {
      void regenerateFourKeyframes();
    }
  }, [activeScene.id, isTabletMode]);

  const compactShareUrl = useMemo(() => {
    return encodeCompactShareLink(
      activeScene.id,
      settings,
      activeScene.curatedPrompts[0]?.id
    );
  }, [activeScene, settings]);

  const handleCopyCompactLink = () => {
    window.history.replaceState(null, '', compactShareUrl);
    navigator.clipboard.writeText(compactShareUrl);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2200);
  };

  const handleOpenTab = (tab: DrawerTabId) => {
    setActiveDrawerTab(tab);
    setDrawerOpen(true);
  };

  const switchToTabletUi = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'tablet');
    url.searchParams.set('session', universalController.sessionId);
    window.history.replaceState(null, '', url.toString());
    setIsTabletMode(true);
  };

  const exitTabletUi = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.history.replaceState(null, '', url.toString());
    setIsTabletMode(false);
  };

  if (isTabletMode) {
    return (
      <TabletControllerSurface
        controller={universalController}
        onChangeController={setUniversalController}
        settings={settings}
        onApplySettings={handleApplyPartialSettings}
        cameraBlocking={cameraBlocking}
        onChangeCameraBlocking={setCameraBlocking}
        liveCameraRig={liveCameraRig}
        onChangeLiveCameraRig={setLiveCameraRig}
        showStoryOverlay={showStoryOverlay}
        onToggleStoryOverlay={() => setShowStoryOverlay((prev) => !prev)}
        connectionStatus={uscpState.connectionStatus}
        peers={uscpState.peers}
        remoteScenes={uscpState.remoteScenes}
        remoteActiveSceneId={uscpState.remoteActiveSceneId || activeScene.id}
        lastSyncAt={uscpState.lastSyncAt}
        latencyMs={uscpState.latencyMs}
        pinCode={uscpState.pinCode}
        authRequired={uscpState.authRequired}
        authError={uscpState.authError}
        securityStatus={uscpState.securityStatus}
        spatialAnchors={uscpState.spatialAnchors}
        solvedAirPose={uscpState.solvedAirPose}
        onRegisterSpatialAnchor={uscpState.registerSpatialAnchor}
        onSendRangingSample={uscpState.sendRangingSample}
        onSendAirPose={uscpState.sendAirPose}
        onUnlockWithPin={uscpState.unlockWithPin}
        onPingServerNow={uscpState.pingServerNow}
        onSendRemoteAction={uscpState.sendRemoteAction}
        onExitTabletMode={exitTabletUi}
      />
    );
  }

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          if (!isDraggingFile) setIsDraggingFile(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDraggingFile(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          void handleUploadImages(e.dataTransfer.files);
        }
      }}
      className="relative w-screen h-[100dvh] overflow-hidden bg-[#090a0d] text-[#f4f1ea] select-none"
    >
      {/* 1. Stationary Three.js 3D Depth, Live VR/Potentiometer Camera & 3D Path Viewport */}
      <ParallaxThreeViewport
        sceneAsset={activeScene}
        settings={settings}
        cameraBlocking={cameraBlocking}
        liveCameraRig={liveCameraRig}
        showCameraPathOverlay={universalController.show3DPathOnMainViewport}
        onCanvasReady={(canvas) => {
          canvasRef.current = canvas;
        }}
      />

      {/* Global Drag & Drop Upload Visual Dropzone */}
      {isDraggingFile && (
        <div className="fixed inset-4 z-50 rounded-2xl border-2 border-dashed border-[#d4af37] bg-[#090a0d]/88 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <ImagePlus className="w-10 h-10 text-[#d4af37]" />
          <div className="text-base font-serif-display font-semibold text-white">
            Upuść obrazy tutaj, aby natychmiast wgrać do Studia 3D
          </div>
          <div className="text-xs text-[#b8b2a6]">
            Obsługa wielu plików naraz (PNG, JPG, WebP) · automatyczna optymalizacja rozdzielczości
          </div>
        </div>
      )}

      {/* 2. Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-4 md:gap-8 px-3.5 sm:px-6 py-3 bg-[#090a0d]/94 border-b border-white/10">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setDrawerOpen(false);
          }}
          className="text-base sm:text-lg font-serif-display font-semibold tracking-wide text-[#f4f1ea] whitespace-nowrap shrink-0"
        >
          Bujok Medical Studio
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#c5bfb3]">
          <button
            type="button"
            onClick={() => handleOpenTab('blocking3d')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'blocking3d'
                ? 'text-[#d4af37] underline'
                : 'text-[#e8ca64]'
            }`}
          >
            Model 3D Kamery
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('sequence')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen &&
              (activeDrawerTab === 'sequence' ||
                activeDrawerTab === 'prompts' ||
                activeDrawerTab === 'export')
                ? 'text-[#d4af37] underline'
                : ''
            }`}
          >
            4 Kadry i FX
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('mobile')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'mobile' ? 'text-[#d4af37] underline' : ''
            }`}
          >
            Grafiki Mobilne
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('controller')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'controller' ? 'text-[#d4af37] underline' : ''
            }`}
          >
            Tablet i VR
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('director')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen &&
              (activeDrawerTab === 'director' || activeDrawerTab === 'story')
                ? 'text-[#d4af37] underline'
                : ''
            }`}
          >
            Reżyser AI
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={isExportingMP4}
            onClick={() => handleExportLightweightMP4(6, 2200)}
            className="min-h-[38px] px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-[#090a0d] bg-[#d4af37] rounded-lg hover:bg-[#e3be42] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExportingMP4
              ? `Render MP4 (${mp4Progress}%)`
              : 'Wideo z 4 Kadrów (MP4)'}
          </button>
        </div>
      </header>

      {/* 3. Studio Workspace Drawer (Uncluttered Viewport: Removed Top-Left Floating Overlay) */}
      <StudioWorkspaceDrawer
        isOpen={drawerOpen}
        activeTab={activeDrawerTab}
        onChangeTab={setActiveDrawerTab}
        onClose={() => setDrawerOpen(false)}
        activeScene={activeScene}
        settings={settings}
        onApplySettings={handleApplyPartialSettings}
        onAddCustomScene={(newScene) => {
          setScenes((prev) => [...prev, newScene]);
          setActiveScene(newScene);
          setNarrative(newScene.defaultNarrative);
        }}
        onUploadImages={handleUploadImages}
        controller={universalController}
        onChangeController={setUniversalController}
        cameraBlocking={cameraBlocking}
        onChangeCameraBlocking={setCameraBlocking}
        liveCameraRig={liveCameraRig}
        onChangeLiveCameraRig={setLiveCameraRig}
        onCaptureVrToBlockingState={(target) => handleCaptureVrToBlockingState(target)}
        uscpState={uscpState}
        onSwitchToLocalTabletMode={switchToTabletUi}
        keyframes={keyframes}
        onRegenerateInstantKeyframes={regenerateFourKeyframes}
        onUpdateKeyframeImage={(index, imageUrl, prompt) => {
          setKeyframes((prev) =>
            prev.map((item, idx) =>
              idx === index ? { ...item, imageUrl, prompt, sourceType: 'ai_generated' } : item
            )
          );
        }}
        narrative={narrative}
        onUpdateNarrative={setNarrative}
        showStoryOverlayOnViewport={showStoryOverlay}
        onToggleStoryOverlay={() => setShowStoryOverlay((prev) => !prev)}
        compactShareUrl={compactShareUrl}
        onCopyCompactLink={handleCopyCompactLink}
        linkCopied={linkCopied}
        onExportSingleWebP={handleExportSingleWebP}
        onExportLightweightMP4={handleExportLightweightMP4}
        isExportingMP4={isExportingMP4}
        mp4Progress={mp4Progress}
        lastExportInfo={lastExportInfo}
      />

      {/* 4. Streamlined Bottom Control & Upload Dock */}
      <BottomControlDock
        scenes={scenes}
        activeScene={activeScene}
        onSelectScene={handleSelectScene}
        onUploadImages={(files) => {
          void handleUploadImages(files);
        }}
        settings={settings}
        onChangeSettings={setSettings}
        onResetSettings={() => {
          setSettings(activeScene.defaultSettings);
          setLiveCameraRig(DEFAULT_LIVE_CAMERA_RIG);
        }}
        controller={universalController}
        onChangeController={setUniversalController}
        cameraBlocking={cameraBlocking}
        onChangeCameraBlocking={setCameraBlocking}
        showStoryOverlay={showStoryOverlay}
        onToggleStoryOverlay={() => setShowStoryOverlay((prev) => !prev)}
        isCollapsed={isDockCollapsed}
        onToggleCollapse={() => setIsDockCollapsed((c) => !c)}
        onQuickExportWebP={() => handleExportSingleWebP(0.86)}
        onQuickExportMP4={() => handleExportLightweightMP4(6, 2200)}
        isExportingMP4={isExportingMP4}
        mp4Progress={mp4Progress}
        onOpenDrawerTab={handleOpenTab}
      />

      {/* 5. Mobile-Friendly Bottom Thumb Navigation Bar (< 768px) */}
      <nav
        aria-label="Nawigacja mobilna"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-[#090a0d]/98 border-t border-white/12 grid grid-cols-5 px-1"
      >
        {[
          { id: 'blocking3d' as DrawerTabId, label: 'Ścieżka 3D', Icon: Camera },
          { id: 'sequence' as DrawerTabId, label: '4 Kadry', Icon: Film },
          { id: 'mobile' as DrawerTabId, label: 'Mobile 9:16', Icon: Smartphone },
          { id: 'controller' as DrawerTabId, label: 'Tablet/VR', Icon: PlugZap },
          { id: 'director' as DrawerTabId, label: 'Reżyser', Icon: MessageSquare },
        ].map(({ id, label, Icon }) => {
          const active = drawerOpen && activeDrawerTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (active) {
                  setDrawerOpen(false);
                } else {
                  handleOpenTab(id);
                }
              }}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                active ? 'text-[#d4af37] font-semibold' : 'text-[#b8b2a6]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-full">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Eye,
  Film,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Play,
  Send,
  Sparkles,
  Upload,
  Video,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  GITHUB_README_MARKDOWN,
  GITHUB_SHORT_DESCRIPTION,
  GITHUB_TOPICS,
} from '../data/githubPublicationContent';
import { VISUAL_FX_PRESETS } from '../data/presetScenes';
import {
  AspectRatioOption,
  CameraBlockingConfig,
  ChatMessage,
  DrawerTabId,
  KeyframeItem,
  LiveCameraRigState,
  NarrativeToneId,
  ReadyPromptRecipe,
  SceneAsset,
  SceneNarrative,
  UniversalControllerConfig,
  VisualEffectSettings,
} from '../types/studio';
import { UniversalConnectorBridgeState } from '../universal-controller/connectorProtocol';
import {
  ExportResultInfo,
  exportFourFrameSequenceWebP,
  formatBytes,
  FourFrameTransitionMode,
  renderStyledAspectRatioImage,
  renderVideoFromFourKeyframes,
} from '../utils/mediaExporter';
import { DirectorPreviz3DModule } from './DirectorPreviz3DModule';
import { MobileGraphicsStudioModule } from './MobileGraphicsStudioModule';
import { UniversalControllerModule } from './UniversalControllerModule';

type MicTargetField = 'prompt' | 'chat' | 'story' | 'video';

interface StudioWorkspaceDrawerProps {
  isOpen: boolean;
  activeTab: DrawerTabId;
  onChangeTab: (tab: DrawerTabId) => void;
  onClose: () => void;
  activeScene: SceneAsset;
  settings: VisualEffectSettings;
  onApplySettings: (partial: Partial<VisualEffectSettings>) => void;
  onAddCustomScene: (scene: SceneAsset) => void;
  onUploadImages: (files: FileList) => Promise<void>;
  controller: UniversalControllerConfig;
  onChangeController: (next: UniversalControllerConfig) => void;
  cameraBlocking: CameraBlockingConfig;
  onChangeCameraBlocking: (next: CameraBlockingConfig) => void;
  liveCameraRig: LiveCameraRigState;
  onChangeLiveCameraRig: (next: LiveCameraRigState) => void;
  onCaptureVrToBlockingState: (target: 'A' | 'B') => void;
  uscpState: UniversalConnectorBridgeState;
  onSwitchToLocalTabletMode: () => void;
  keyframes: KeyframeItem[];
  onRegenerateInstantKeyframes: (
    customPrompts?: string[],
    blockingOverride?: CameraBlockingConfig
  ) => Promise<KeyframeItem[]>;
  onUpdateKeyframeImage: (index: number, imageUrl: string, prompt: string) => void;
  narrative: SceneNarrative;
  onUpdateNarrative: (next: SceneNarrative) => void;
  showStoryOverlayOnViewport: boolean;
  onToggleStoryOverlay: () => void;
  compactShareUrl: string;
  onCopyCompactLink: () => void;
  linkCopied: boolean;
  onExportSingleWebP: (quality: number) => Promise<void>;
  onExportLightweightMP4: (durationSec: number, kbps: number) => Promise<void>;
  isExportingMP4: boolean;
  mp4Progress: number;
  lastExportInfo: ExportResultInfo | null;
}

const ASPECT_RATIOS: AspectRatioOption[] = [
  '16:9',
  '9:16',
  '21:9',
  '4:3',
  '3:2',
  '1:1',
  '3:4',
  '2:3',
];

const NARRATIVE_TONES: { id: NarrativeToneId; label: string; desc: string }[] = [
  {
    id: 'luxury_patient',
    label: 'Luksus i Spokój Pacjenta',
    desc: 'Skupia się na poczuciu bezpieczeństwa, ciszy i prestiżu wnętrza kliniki.',
  },
  {
    id: 'warsaw_architecture',
    label: 'Architektura i Panorama Warszawy',
    desc: 'Podkreśla dialog przeszklonego lobby z panoramą Warszawy w tle.',
  },
  {
    id: 'aesthetic_innovation',
    label: 'Innowacyjna Chirurgia i Estetyka',
    desc: 'Łączy 4 podświetlone panele specjalizacji z nowoczesną precyzją medyczną.',
  },
  {
    id: 'cinematic_voiceover',
    label: 'Filmowy Scenariusz Voice-Over',
    desc: 'Krótka, rytmiczna narracja lektorska gotowa do spotu wideo z 4 kadrów.',
  },
];

const TRANSITION_MODES: {
  id: FourFrameTransitionMode;
  label: string;
  desc: string;
}[] = [
  {
    id: 'smooth_camera_path',
    label: 'Płynna Ścieżka Kamery 3D (Stan A → Stan B)',
    desc: 'Interpoluje ruch 30 kl./s, ogniskową i rotację kamery wzdłuż ścieżki zdefiniowanej na modelu 3D w 4 kadrach.',
  },
  {
    id: 'cross_dissolve',
    label: 'Płynne Przenikanie Optyczne (Cross-Dissolve)',
    desc: 'Miękkie, filmowe przejścia tonalne pomiędzy Kadrem 01 → 02 → 03 → 04.',
  },
  {
    id: 'light_sweep',
    label: 'Przejście Świetlne Złotej Godziny (Light-Sweep)',
    desc: 'Łączy kolejne kadry subtelną falą ciepłego światła słonecznego 2700K.',
  },
  {
    id: 'editorial_cut',
    label: 'Montaż Studyjny (Editorial Sequence)',
    desc: 'Precyzyjna prezentacja 4 wyrenderowanych faz oświetlenia i głębi.',
  },
];

const QUICK_VOICE_COMMANDS: string[] = [
  'Wzmocnij głębię ostrości 35mm i wyeksponuj żyłkowanie marmuru Calacatta na recepcji.',
  'Dodaj ciepłą poświatę złotej godziny 2700K, subtelną winietę optyczną i ziarno 35mm.',
  'Przygotuj 4 spójne kadry oświetlenia do płynnego wideo MP4 w formacie 16:9.',
];

export const StudioWorkspaceDrawer: React.FC<StudioWorkspaceDrawerProps> = ({
  isOpen,
  activeTab,
  onChangeTab,
  onClose,
  activeScene,
  settings,
  onApplySettings,
  onAddCustomScene,
  onUploadImages,
  controller,
  onChangeController,
  cameraBlocking,
  onChangeCameraBlocking,
  liveCameraRig,
  onChangeLiveCameraRig,
  onCaptureVrToBlockingState,
  uscpState,
  onSwitchToLocalTabletMode,
  keyframes,
  onRegenerateInstantKeyframes,
  onUpdateKeyframeImage,
  narrative,
  onUpdateNarrative,
  showStoryOverlayOnViewport,
  onToggleStoryOverlay,
  compactShareUrl,
  onCopyCompactLink,
  linkCopied,
  onExportSingleWebP,
  onExportLightweightMP4,
  isExportingMP4,
  mp4Progress,
  lastExportInfo,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customPromptInput, setCustomPromptInput] = useState<string>(
    'Dodaj trójwymiarową głębię ostrości, realistyczne odbicia PBR w marmurowej recepcji oraz przygotuj 4 spójne kadry oświetlenia do wideo.'
  );
  const [fastSuggestion, setFastSuggestion] = useState<string>('');
  const [isFastLoading, setIsFastLoading] = useState(false);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<{
    depthSummary?: string;
    lightingAndAtmosphereGuide?: string;
    cameraMotionPrompt?: string;
    photorealismPrompt?: string;
    sequencePrompts?: string[];
    recommendedSettings?: Partial<VisualEffectSettings>;
  } | null>(null);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

  const [selectedTone, setSelectedTone] = useState<NarrativeToneId>('luxury_patient');
  const [customStoryTheme, setCustomStoryTheme] = useState<string>('');
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);

  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioOption>('16:9');
  const [studioQualityMode, setStudioQualityMode] = useState(false);
  const [generatingFrameIdx, setGeneratingFrameIdx] = useState<number | null>(null);
  const [isGeneratingAllAIFrames, setIsGeneratingAllAIFrames] = useState(false);
  const [isPlayingSequencePreview, setIsPlayingSequencePreview] = useState(false);
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);

  // 4-Frame Video Compilation & Rendering State
  const [videoTransitionMode, setVideoTransitionMode] =
    useState<FourFrameTransitionMode>('smooth_camera_path');
  const [sequenceVideoDuration, setSequenceVideoDuration] = useState<number>(6);
  const [includeStoryCaptionsInVideo, setIncludeStoryCaptionsInVideo] =
    useState<boolean>(true);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoPrompt, setVideoPrompt] = useState(
    'Sekwencja 4 kadrów nowoczesnego lobby kliniki Bujok Medical: progresja naturalnego światła dziennego, głębi ostrości 35mm, odbić PBR w marmurze Calacatta oraz iluminacji złotej godziny.'
  );
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoCompileProgress, setVideoCompileProgress] = useState(0);
  const [activeCompilingFrame, setActiveCompilingFrame] = useState(1);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoSize, setGeneratedVideoSize] = useState<number | null>(null);

  const [webpQuality, setWebpQuality] = useState(86);
  const [mp4Duration, setMp4Duration] = useState(6);
  const [mp4BitrateKbps, setMp4BitrateKbps] = useState(2200);
  const [isExportingSheet, setIsExportingSheet] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Witaj w Bujok Medical Depth & 4-Frame Video Studio. Przygotowałem gotowe odpowiedzi do budowania głębi ostrości, fotorealizmu marmuru Calacatta, bibliotekę efektów wizualnych FX (rozmycie DOF, winieta, korekcja kolorów, ziarno 35mm), generator narracji oraz kompilator wideo MP4 z sekwencji 4 wyrenderowanych kadrów.\n\nRekomendowana podpowiedź reżysera: Ustaw Głębię Optyczną 3D na 80%, Fotorealizm PBR na 92%, Rozmycie Ostrości (DOF) na 20% oraz Winietę na 34%, aby uzyskać szlachetną plastykę obiektywu 35mm f/2.0 w 4 kadrach wideo.',
      modelUsed: 'gemini-4-argon',
      timestamp: 'Teraz',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState<'complex' | 'general' | 'fast'>('complex');
  const [isChatSending, setIsChatSending] = useState(false);

  // Enhanced Hybrid Microphone Dictation State (Web Speech API + MediaRecorder + Gemini Transcribe)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [activeMicTarget, setActiveMicTarget] = useState<MicTargetField | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveInterimSpeech, setLiveInterimSpeech] = useState('');
  const [micStatusMessage, setMicStatusMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const speechRecognizedFlagRef = useRef<boolean>(false);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const [videoAnalysisText, setVideoAnalysisText] = useState<string>('');
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isPlayingSequencePreview || keyframes.length === 0) return;
    const timer = window.setInterval(() => {
      setPreviewFrameIdx((prev) => (prev + 1) % keyframes.length);
    }, 850);
    return () => window.clearInterval(timer);
  }, [isPlayingSequencePreview, keyframes.length]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2200);
  };

  const appendTextToField = (targetField: MicTargetField, newText: string) => {
    const cleaned = newText.trim();
    if (!cleaned) return;
    if (targetField === 'prompt') {
      setCustomPromptInput((prev) => (prev ? `${prev.trim()} ${cleaned}` : cleaned));
    } else if (targetField === 'chat') {
      setChatInput((prev) => (prev ? `${prev.trim()} ${cleaned}` : cleaned));
    } else if (targetField === 'story') {
      setCustomStoryTheme((prev) => (prev ? `${prev.trim()} ${cleaned}` : cleaned));
    } else if (targetField === 'video') {
      setVideoPrompt((prev) => (prev ? `${prev.trim()} ${cleaned}` : cleaned));
    }
  };

  const handleApplyRecipe = (recipe: ReadyPromptRecipe) => {
    onApplySettings(recipe.recommendedSettings);
    handleCopyText(recipe.id, `${recipe.promptPL}\n\n[EN]: ${recipe.promptEN}`);
  };

  const handleGenerateNarrative = async () => {
    setIsGeneratingStory(true);
    setErrorBanner(null);
    try {
      const generatedResponsesList = [
        ...activeScene.curatedPrompts.map((p) => p.promptPL),
        fastSuggestion,
        deepAnalysisResult?.depthSummary,
      ].filter(Boolean);

      const res = await fetch('/api/gemini/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageSource: activeScene.imageUrl,
          sceneTitle: activeScene.title,
          tone: selectedTone,
          generatedResponses: generatedResponsesList,
          effectSettings: settings,
          customTheme: customStoryTheme,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd generowania narracji');

      const updatedNarrative: SceneNarrative = {
        title: data.title || narrative.title,
        toneLabel: data.toneLabel || 'Narracja AI',
        leadHook: data.leadHook || narrative.leadHook,
        storyBody: data.storyBody || narrative.storyBody,
        voiceoverTagline: data.voiceoverTagline || narrative.voiceoverTagline,
        frameCaptions:
          Array.isArray(data.frameCaptions) && data.frameCaptions.length >= 4
            ? [
                data.frameCaptions[0],
                data.frameCaptions[1],
                data.frameCaptions[2],
                data.frameCaptions[3],
              ]
            : narrative.frameCaptions,
      };
      onUpdateNarrative(updatedNarrative);
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleFastSuggest = async () => {
    setIsFastLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/gemini/fast-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrompt: customPromptInput,
          effectSettings: settings,
          sceneName: activeScene.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd szybkiej sugestii');
      setFastSuggestion(data.suggestion);
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsFastLoading(false);
    }
  };

  const handleDeepAnalyzeScene = async (imageSourceOverride?: string) => {
    setIsDeepAnalyzing(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/gemini/analyze-depth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageSource: imageSourceOverride || activeScene.imageUrl,
          sceneTitle: activeScene.title,
          customFocus: customPromptInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd analizy głębi obrazu');
      setDeepAnalysisResult(data);
      if (data.recommendedSettings) {
        onApplySettings(data.recommendedSettings);
      }
      if (Array.isArray(data.sequencePrompts) && data.sequencePrompts.length === 4) {
        await onRegenerateInstantKeyframes(data.sequencePrompts);
      }
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsDeepAnalyzing(false);
    }
  };

  const handleGenerateAIKeyframe = async (index: number) => {
    const kf = keyframes[index];
    if (!kf) return;
    setGeneratingFrameIdx(index);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: kf.prompt,
          referenceImage: activeScene.imageUrl,
          aspectRatio: selectedAspectRatio,
          studioQuality: studioQualityMode,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        onUpdateKeyframeImage(index, data.imageUrl, kf.prompt);
      } else {
        const styledUrl = await renderStyledAspectRatioImage(
          activeScene.imageUrl,
          settings,
          selectedAspectRatio,
          index
        );
        onUpdateKeyframeImage(index, styledUrl, kf.prompt);
      }
    } catch {
      const styledUrl = await renderStyledAspectRatioImage(
        activeScene.imageUrl,
        settings,
        selectedAspectRatio,
        index
      );
      onUpdateKeyframeImage(index, styledUrl, kf.prompt);
    } finally {
      setGeneratingFrameIdx(null);
    }
  };

  const handleGenerateAllFourAIFrames = async () => {
    setIsGeneratingAllAIFrames(true);
    setErrorBanner(null);
    try {
      for (let i = 0; i < keyframes.length; i++) {
        setGeneratingFrameIdx(i);
        const res = await fetch('/api/gemini/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: keyframes[i].prompt,
            referenceImage: activeScene.imageUrl,
            aspectRatio: selectedAspectRatio,
            studioQuality: studioQualityMode,
          }),
        });
        const data = await res.json();
        if (data.imageUrl) {
          onUpdateKeyframeImage(i, data.imageUrl, keyframes[i].prompt);
        } else {
          const styledUrl = await renderStyledAspectRatioImage(
            activeScene.imageUrl,
            settings,
            selectedAspectRatio,
            i
          );
          onUpdateKeyframeImage(i, styledUrl, keyframes[i].prompt);
        }
      }
    } catch {
      for (let i = 0; i < keyframes.length; i++) {
        const styledUrl = await renderStyledAspectRatioImage(
          activeScene.imageUrl,
          settings,
          selectedAspectRatio,
          i
        );
        onUpdateKeyframeImage(i, styledUrl, keyframes[i].prompt);
      }
    } finally {
      setGeneratingFrameIdx(null);
      setIsGeneratingAllAIFrames(false);
    }
  };

  const handleCreateNewSceneImage = async () => {
    setGeneratingFrameIdx(99);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: customPromptInput,
          referenceImage: activeScene.imageUrl,
          aspectRatio: selectedAspectRatio,
          studioQuality: studioQualityMode,
        }),
      });
      const data = await res.json();
      const finalImageUrl =
        data.imageUrl ||
        (await renderStyledAspectRatioImage(
          activeScene.imageUrl,
          settings,
          selectedAspectRatio,
          2
        ));
      const newScene: SceneAsset = {
        ...activeScene,
        id: `ai_scene_${Date.now()}`,
        title: `Wariant AI (${selectedAspectRatio})`,
        subtitle: customPromptInput.slice(0, 70),
        imageUrl: finalImageUrl,
      };
      onAddCustomScene(newScene);
    } catch {
      const fallbackUrl = await renderStyledAspectRatioImage(
        activeScene.imageUrl,
        settings,
        selectedAspectRatio,
        2
      );
      const newScene: SceneAsset = {
        ...activeScene,
        id: `ai_scene_${Date.now()}`,
        title: `Wariant (${selectedAspectRatio})`,
        subtitle: customPromptInput.slice(0, 70),
        imageUrl: fallbackUrl,
      };
      onAddCustomScene(newScene);
    } finally {
      setGeneratingFrameIdx(null);
    }
  };

  const handleRenderVideoFromFourFrames = async (autoDownload = false) => {
    setIsGeneratingVideo(true);
    setVideoCompileProgress(0);
    setActiveCompilingFrame(1);
    setErrorBanner(null);
    try {
      const result = await renderVideoFromFourKeyframes(keyframes, {
        durationSec: sequenceVideoDuration,
        targetKbps: mp4BitrateKbps,
        aspectRatio: videoAspectRatio,
        transitionMode: videoTransitionMode,
        cameraBlocking,
        captions: narrative.frameCaptions,
        includeCaptions: includeStoryCaptionsInVideo,
        autoDownload,
        onProgress: (pct, activeFrameNum) => {
          setVideoCompileProgress(pct);
          setActiveCompilingFrame(activeFrameNum);
        },
      });
      setGeneratedVideoUrl(result.url);
      setGeneratedVideoSize(result.sizeBytes);
    } catch (err: any) {
      setErrorBanner(err.message || 'Błąd kompilacji wideo z 4 kadrów.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleGenerateSmoothPathVideoFrom3D = async (
    fourPrompts: [string, string, string, string],
    mainPrompt: string,
    autoDownload = false
  ) => {
    const targetDuration = cameraBlocking.durationSec || sequenceVideoDuration;
    setCustomPromptInput(mainPrompt);
    setVideoPrompt(mainPrompt.slice(0, 320));
    setVideoTransitionMode('smooth_camera_path');
    setSequenceVideoDuration(targetDuration);
    setIsGeneratingVideo(true);
    setVideoCompileProgress(0);
    setActiveCompilingFrame(1);
    setErrorBanner(null);
    try {
      const freshFrames = await onRegenerateInstantKeyframes(fourPrompts, cameraBlocking);
      const framesToCompile =
        freshFrames && freshFrames.length >= 4 ? freshFrames : keyframes;
      const result = await renderVideoFromFourKeyframes(framesToCompile, {
        durationSec: targetDuration,
        targetKbps: mp4BitrateKbps,
        aspectRatio: videoAspectRatio,
        transitionMode: 'smooth_camera_path',
        cameraBlocking,
        captions: narrative.frameCaptions,
        includeCaptions: includeStoryCaptionsInVideo,
        autoDownload,
        onProgress: (pct, activeFrameNum) => {
          setVideoCompileProgress(pct);
          setActiveCompilingFrame(activeFrameNum);
        },
      });
      setGeneratedVideoUrl(result.url);
      setGeneratedVideoSize(result.sizeBytes);
    } catch (err: any) {
      setErrorBanner(
        err.message || 'Błąd kompilacji płynnej animacji ścieżki 3D w sekwencji 4 kadrów.'
      );
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleAnimateToVideoAI = async () => {
    setIsGeneratingVideo(true);
    setVideoCompileProgress(10);
    setActiveCompilingFrame(1);
    setErrorBanner(null);
    try {
      const startFrame = keyframes[0]?.imageUrl || activeScene.imageUrl;
      const endFrame = keyframes[3]?.imageUrl;
      const res = await fetch('/api/gemini/animate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageSource: startFrame,
          endImageSource: endFrame,
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
          duration: `${sequenceVideoDuration}s`,
        }),
      });
      const data = await res.json();
      if (data.videoUrl) {
        setGeneratedVideoUrl(data.videoUrl);
        setGeneratedVideoSize(null);
      } else {
        const result = await renderVideoFromFourKeyframes(keyframes, {
          durationSec: sequenceVideoDuration,
          targetKbps: mp4BitrateKbps,
          aspectRatio: videoAspectRatio,
          transitionMode: videoTransitionMode,
          cameraBlocking,
          captions: narrative.frameCaptions,
          includeCaptions: includeStoryCaptionsInVideo,
          autoDownload: false,
          onProgress: (pct, activeFrameNum) => {
            setVideoCompileProgress(pct);
            setActiveCompilingFrame(activeFrameNum);
          },
        });
        setGeneratedVideoUrl(result.url);
        setGeneratedVideoSize(result.sizeBytes);
      }
    } catch {
      const result = await renderVideoFromFourKeyframes(keyframes, {
        durationSec: sequenceVideoDuration,
        targetKbps: mp4BitrateKbps,
        aspectRatio: videoAspectRatio,
        transitionMode: videoTransitionMode,
        cameraBlocking,
        captions: narrative.frameCaptions,
        includeCaptions: includeStoryCaptionsInVideo,
        autoDownload: false,
        onProgress: (pct, activeFrameNum) => {
          setVideoCompileProgress(pct);
          setActiveCompilingFrame(activeFrameNum);
        },
      });
      setGeneratedVideoUrl(result.url);
      setGeneratedVideoSize(result.sizeBytes);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUploadImages(e.target.files);
      e.target.value = '';
    }
  };

  const handleVideoUploadForAnalysis = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingVideo(true);
    setErrorBanner(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const videoDataUrl = reader.result as string;
        const res = await fetch('/api/gemini/analyze-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoDataUrl,
            question:
              'Przeanalizuj to wideo pod kątem spójności 4 kadrów, głębi ostrości, fotorealizmu materiałów i oświetlenia.',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Błąd analizy wideo');
        setVideoAnalysisText(data.analysis);
      } catch (err: any) {
        setErrorBanner(err.message);
      } finally {
        setIsAnalyzingVideo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * Improved Hybrid Voice Input:
   * 1. Uses Browser SpeechRecognition (pl-PL) for instant live streaming dictation when available.
   * 2. Simultaneously records via MediaRecorder (with proper audio MIME detection) and falls back
   *    to /api/gemini/transcribe so voice commands work reliably across all browsers.
   */
  const stopMicrophoneRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecordingAudio(false);
  };

  const handleToggleMic = async (targetField: MicTargetField) => {
    setErrorBanner(null);

    // If already recording, stop and finalize
    if (isRecordingAudio) {
      stopMicrophoneRecording();
      return;
    }

    setActiveMicTarget(targetField);
    setRecordingSeconds(0);
    setLiveInterimSpeech('');
    speechRecognizedFlagRef.current = false;
    setMicStatusMessage('Słucham polecenia głosowego (język polski)...');

    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    // 1. Start Web Speech API (SpeechRecognition) if supported by the browser
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'pl-PL';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let interim = '';
          let finalChunk = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalChunk += transcriptPiece + ' ';
            } else {
              interim += transcriptPiece;
            }
          }
          if (finalChunk.trim()) {
            speechRecognizedFlagRef.current = true;
            appendTextToField(targetField, finalChunk.trim());
            setMicStatusMessage(`Wprowadzono głosowo: „${finalChunk.trim()}”`);
          }
          setLiveInterimSpeech(interim);
        };

        recognition.onerror = () => {
          // MediaRecorder fallback will handle transcription if Web Speech API fails
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch {
        // Continue with MediaRecorder
      }
    }

    // 2. Start MediaRecorder for server-side Gemini multimodal transcription backup
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const supportedAudioMimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      let chosenMime = '';
      for (const m of supportedAudioMimes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      }

      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setLiveInterimSpeech('');

        // If Web Speech API already transcribed the spoken command live, no server roundtrip needed
        if (speechRecognizedFlagRef.current) {
          setActiveMicTarget(null);
          window.setTimeout(() => setMicStatusMessage(null), 3500);
          return;
        }

        if (audioChunksRef.current.length === 0) {
          setActiveMicTarget(null);
          setMicStatusMessage(null);
          return;
        }

        const actualMime = recorder.mimeType || chosenMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        const reader = new FileReader();
        reader.onload = async () => {
          setIsTranscribing(true);
          setMicStatusMessage('Transkrypcja nagrania przez Gemini AI...');
          try {
            const res = await fetch('/api/gemini/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioDataUrl: reader.result }),
            });
            const data = await res.json();
            if (data.transcript) {
              appendTextToField(targetField, data.transcript);
              setMicStatusMessage(`Rozpoznano polecenie: „${data.transcript}”`);
            }
          } catch (err: any) {
            setErrorBanner(err.message || 'Błąd transkrypcji głosu');
          } finally {
            setIsTranscribing(false);
            setActiveMicTarget(null);
            window.setTimeout(() => setMicStatusMessage(null), 4000);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecordingAudio(true);
    } catch {
      // If getUserMedia failed but SpeechRecognition started, keep SpeechRecognition running
      if (speechRecognitionRef.current) {
        setIsRecordingAudio(true);
      } else {
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setActiveMicTarget(null);
        setMicStatusMessage(
          'Mikrofon jest niedostępny lub zablokowany w przeglądarce — użyj poniższych szybkich poleceń głosowych jednym kliknięciem.'
        );
      }
    }
  };

  const dispatchMessageToDirector = async (rawMessageText: string) => {
    const userText = rawMessageText.trim();
    if (!userText || isChatSending) return;
    if (isRecordingAudio) {
      stopMicrophoneRecording();
    }

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setIsChatSending(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          message: userText,
          mode: chatMode,
          sceneContext: {
            sceneTitle: activeScene.title,
            settings,
            narrativeTitle: narrative.title,
            cameraBlocking,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd czatu AI');

      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          modelUsed: data.model,
          timestamp: new Date().toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatSending) return;
    const toSend = chatInput.trim();
    setChatInput('');
    await dispatchMessageToDirector(toSend);
  };

  const latestAssistantReply =
    [...chatMessages].reverse().find((m) => m.role === 'assistant')?.text || '';

  const linkByteLength = new TextEncoder().encode(
    compactShareUrl.split('#')[1] || ''
  ).length;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-x-0 top-14 bottom-16 md:bottom-24 z-20 flex justify-center px-2 sm:px-4 pointer-events-none">
      <div className="w-[min(1180px,98vw)] sm:w-[min(1180px,96vw)] h-full rounded-2xl bg-[#0b0d13]/98 border border-white/15 shadow-2xl flex flex-col overflow-hidden pointer-events-auto text-[#f4f1ea]">
        {/* Drawer Header & Consolidated 5-Tab Navigation + Instant Multi-Image Upload */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-white/10 bg-[#10131c]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => onChangeTab('blocking3d')}
              className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'blocking3d'
                  ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                  : 'text-[#e8ca64] hover:text-white border border-[#d4af37]/30'
              }`}
            >
              Model 3D i Ujęcia
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('sequence')}
              className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'sequence' || activeTab === 'prompts' || activeTab === 'export'
                  ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                  : 'text-[#b8b2a6] hover:text-white'
              }`}
            >
              4 Kadry, FX i Eksport
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('mobile')}
              className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'mobile'
                  ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                  : 'text-[#b8b2a6] hover:text-white'
              }`}
            >
              Grafiki Mobilne 9:16
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('controller')}
              className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'controller'
                  ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                  : 'text-[#e8ca64] hover:text-white border border-[#d4af37]/30'
              }`}
            >
              Tablet, VR i Łącznik
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('director')}
              className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'director' || activeTab === 'story'
                  ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                  : 'text-[#b8b2a6] hover:text-white'
              }`}
            >
              Reżyser AI i Narracja
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="min-h-[38px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37]/16 hover:bg-[#d4af37]/26 border border-[#d4af37]/45 text-xs font-semibold text-[#e8ca64] whitespace-nowrap shrink-0 cursor-pointer">
              <ImagePlus className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="hidden sm:inline">+ Wgraj obrazy</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] sm:min-h-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-xs text-[#e5dec9] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Widok 3D</span>
            </button>
          </div>
        </div>

        {/* Live Microphone Recording / Status Banner */}
        {(isRecordingAudio || isTranscribing || micStatusMessage) && (
          <div className="px-6 py-2.5 bg-[#161924] border-b border-[#d4af37]/40 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {isRecordingAudio && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/25 border border-red-500 text-red-200 font-mono-tabular">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  REC {formatTimer(recordingSeconds)}
                </span>
              )}
              {isTranscribing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
              )}
              <span className="text-[#f4f1ea]">
                {liveInterimSpeech
                  ? `Rozpoznawanie na żywo: „${liveInterimSpeech}”`
                  : micStatusMessage}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isRecordingAudio && (
                <button
                  type="button"
                  onClick={stopMicrophoneRecording}
                  className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Zakończ i wstaw polecenie
                </button>
              )}
              {!isRecordingAudio && micStatusMessage && (
                <button
                  type="button"
                  onClick={() => setMicStatusMessage(null)}
                  className="text-[#b8b2a6] hover:text-white cursor-pointer"
                >
                  Ukryj
                </button>
              )}
            </div>
          </div>
        )}

        {errorBanner && (
          <div className="px-6 py-2.5 bg-red-950/90 border-b border-red-500/40 text-xs text-red-200 flex items-center justify-between">
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-red-300 hover:text-white ml-4 cursor-pointer"
            >
              Zamknij
            </button>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-6">
          {/* Inline Sub-Navigation when inside grouped Production/FX/Export or Director/Story section */}
          {(activeTab === 'sequence' || activeTab === 'prompts' || activeTab === 'export') && (
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#10131c] border border-white/10 w-fit">
              {[
                { id: 'sequence' as DrawerTabId, label: 'Sekwencja 4 Kadrów & MP4' },
                { id: 'prompts' as DrawerTabId, label: 'Gotowe Odpowiedzi & FX' },
                { id: 'export' as DrawerTabId, label: 'Eksport WebP, Link & GitHub' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onChangeTab(sub.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === sub.id
                      ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                      : 'text-[#b8b2a6] hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {(activeTab === 'director' || activeTab === 'story') && (
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#10131c] border border-white/10 w-fit">
              {[
                { id: 'director' as DrawerTabId, label: 'Reżyser AI (Czat i Mikrofon)' },
                { id: 'story' as DrawerTabId, label: 'Generator Narracji i Napisów' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onChangeTab(sub.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === sub.id
                      ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                      : 'text-[#b8b2a6] hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* TAB 0: 3D CAMERA BLOCKING MODEL & STANDARDIZED NARRATIVE FILM/TV SHOTS */}
          {activeTab === 'blocking3d' && (
            <DirectorPreviz3DModule
              sceneTitle={activeScene.title}
              blocking={cameraBlocking}
              onChangeBlocking={onChangeCameraBlocking}
              keyframes={keyframes}
              onApplyToFourFrames={async (fourPrompts, mainPrompt) => {
                setCustomPromptInput(mainPrompt);
                setVideoPrompt(mainPrompt.slice(0, 320));
                setVideoTransitionMode('smooth_camera_path');
                if (cameraBlocking.durationSec) {
                  setSequenceVideoDuration(cameraBlocking.durationSec);
                }
                await onRegenerateInstantKeyframes(fourPrompts, cameraBlocking);
                onChangeTab('sequence');
              }}
              onGenerateSmoothPathVideo={handleGenerateSmoothPathVideoFrom3D}
              isGeneratingPathVideo={isGeneratingVideo}
              pathVideoProgress={videoCompileProgress}
              activePathCompilingFrame={activeCompilingFrame}
              generatedPathVideoUrl={generatedVideoUrl}
              generatedPathVideoSize={generatedVideoSize}
              onSendBriefToDirectorChat={(briefText) => {
                onChangeTab('director');
                dispatchMessageToDirector(
                  `Przekazuję specyfikację ścieżki ruchu kamery (Stan A → Stan B) z makiety 3D do konsultacji reżyserskiej. Oceń to ujęcie pod kątem utrzymania uwagi widza i podaj finalne wskazówki oświetleniowo-optyczne:\n\n${briefText}`
                );
              }}
            />
          )}

          {/* TAB: MOBILE GRAPHICS GENERATOR (9:16 STORIES, WALLPAPER, 4:5, 1:1) */}
          {activeTab === 'mobile' && (
            <MobileGraphicsStudioModule
              activeScene={activeScene}
              settings={settings}
              cameraBlocking={cameraBlocking}
              narrative={narrative}
              mobileSafeZonesVisible={controller.mobileSafeZonesVisible}
              onToggleSafeZones={() =>
                onChangeController({
                  ...controller,
                  mobileSafeZonesVisible: !controller.mobileSafeZonesVisible,
                })
              }
            />
          )}

          {/* TAB: UNIVERSAL APP CONTROLLER, VR CAMERA RIG, TABLET PAIRING & USCP-1.0 CONNECTOR */}
          {activeTab === 'controller' && (
            <UniversalControllerModule
              controller={controller}
              onChangeController={onChangeController}
              settings={settings}
              onApplySettings={onApplySettings}
              cameraBlocking={cameraBlocking}
              onChangeCameraBlocking={onChangeCameraBlocking}
              liveCameraRig={liveCameraRig}
              onChangeLiveCameraRig={onChangeLiveCameraRig}
              onCaptureVrToBlockingState={onCaptureVrToBlockingState}
              showStoryOverlay={showStoryOverlayOnViewport}
              onToggleStoryOverlay={onToggleStoryOverlay}
              connectionStatus={uscpState.connectionStatus}
              peers={uscpState.peers}
              sessionToken={uscpState.sessionToken}
              pinCode={uscpState.pinCode}
              latencyMs={uscpState.latencyMs}
              securityStatus={uscpState.securityStatus}
              spatialAnchors={uscpState.spatialAnchors}
              solvedAirPose={uscpState.solvedAirPose}
              onRegisterSpatialAnchor={uscpState.registerSpatialAnchor}
              onSendRangingSample={uscpState.sendRangingSample}
              onSendAirPose={uscpState.sendAirPose}
              onTriggerAirShot={() => {
                onCaptureVrToBlockingState('B');
                void onExportSingleWebP(0.86);
              }}
              onRotateSecureSession={uscpState.rotateSecureSession}
              onPingServerNow={uscpState.pingServerNow}
              onForceSyncNow={uscpState.forceSyncNow}
              onSwitchToLocalTabletMode={onSwitchToLocalTabletMode}
            />
          )}

          {/* TAB 1: READY-MADE RESPONSES & PREDEFINED VISUAL FX LIBRARY */}
          {activeTab === 'prompts' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-serif-display font-semibold text-white">
                    Gotowe Odpowiedzi Reżyserskie, Głębia 3D i Biblioteka Efektów FX
                  </h2>
                  <p className="text-xs text-[#a9a396] mt-1">
                    Aktywny obraz: {activeScene.title} · Kliknij wybraną odpowiedź reżysera lub preset efektu wizualnego, aby go skopiować i zastosować.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#171b24] hover:bg-[#222836] border border-white/12 text-xs font-medium text-[#f4f1ea] cursor-pointer whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Wczytaj własne zdjęcie</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDeepAnalyzeScene()}
                    disabled={isDeepAnalyzing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isDeepAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Analiza Głębi 3D (Gemini 4 Argon)</span>
                  </button>
                </div>
              </div>

              {/* Predefined Visual FX Library Cards */}
              <div className="rounded-xl bg-[#12151e] border border-white/10 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Biblioteka Predefiniowanych Efektów Wizualnych (Rozmycie DOF, Winieta, Korekcja Kolorów, Ziarno 35mm)
                    </h3>
                    <p className="text-xs text-[#9e988c]">
                      Wybierz gotowy profil optyczny lub dostosuj intensywność poszczególnych efektów w czasie rzeczywistym.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {VISUAL_FX_PRESETS.map((fx) => {
                    const isActive = settings.activeFxPreset === fx.id;
                    return (
                      <button
                        key={fx.id}
                        type="button"
                        onClick={() => onApplySettings(fx.settings)}
                        className={`text-left rounded-lg p-3 border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                          isActive
                            ? 'bg-[#d4af37]/15 border-[#d4af37] text-white'
                            : 'bg-[#0c0e14] border-white/10 text-[#cbc5b8] hover:border-white/25'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold text-white">{fx.name}</div>
                          <p className="text-[11px] text-[#9e988c] mt-1 leading-snug">
                            {fx.description}
                          </p>
                        </div>
                        <div className="text-[10px] font-mono-tabular text-[#d4af37] pt-1 border-t border-white/8">
                          DOF {fx.settings.blurIntensity}% · Win {fx.settings.vignetteIntensity}% · Ziarno {fx.settings.filmGrain}%
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Curated Ready-Made Prompt Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeScene.curatedPrompts.map((recipe, index) => {
                  const isCopied = copiedId === recipe.id;
                  const isCopiedEN = copiedId === `${recipe.id}_en`;
                  return (
                    <div
                      key={recipe.id}
                      className="rounded-xl bg-[#12151e] border border-white/10 p-5 flex flex-col justify-between gap-4 hover:border-[#d4af37]/50 transition-colors"
                    >
                      <div className="space-y-2.5">
                        <div className="text-xs text-[#d4af37] font-medium">
                          0{index + 1}. {recipe.subtitle}
                        </div>
                        <h3 className="text-lg font-serif-display font-semibold text-white">
                          {recipe.title}
                        </h3>
                        <p className="text-xs text-[#dcd7cc] leading-relaxed">
                          {recipe.promptPL}
                        </p>
                        <div className="pt-2 border-t border-white/8 text-[11px] text-[#9c9689] leading-relaxed">
                          <strong className="text-[#c7c0b2]">Prompt EN:</strong> {recipe.promptEN}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/8">
                        <div className="text-[11px] text-[#9c9689] font-mono-tabular">
                          Głębia 3D: {recipe.recommendedSettings.depthIntensity}% · Fotorealizm PBR:{' '}
                          {recipe.recommendedSettings.photorealism}%
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyText(recipe.id, recipe.promptPL)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-xs text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Skopiowano PL!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                                <span>Kopiuj podpowiedź PL</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`${recipe.id}_en`, recipe.promptEN)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-xs text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isCopiedEN ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Skopiowano EN!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>EN</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyRecipe(recipe)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e2be46] text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Zastosuj</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Prompt Refiner + Improved Microphone Voice Input + Low-Latency Flash Lite */}
              <div className="rounded-xl bg-[#12151e] border border-white/10 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Kreator Własnej Podpowiedzi Reżyserskiej (Sterowanie Głosowe PL + AI)
                    </h3>
                    <p className="text-xs text-[#9e988c]">
                      Wprowadź polecenie przez mikrofon (rozpoznawanie mowy na żywo po polsku + transkrypcja Gemini) lub wygeneruj podpowiedź reżysera (`gemini-3.1-flash-lite`).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleMic('prompt')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isRecordingAudio && activeMicTarget === 'prompt'
                          ? 'bg-red-600/25 border-red-500 text-red-100'
                          : 'bg-[#181c26] border-[#d4af37]/40 text-[#f4f1ea] hover:bg-[#222836]'
                      }`}
                    >
                      {isRecordingAudio && activeMicTarget === 'prompt' ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-red-400" />
                          <span>Zatrzymaj mikrofon ({formatTimer(recordingSeconds)})</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-[#d4af37]" />
                          <span>
                            {isTranscribing && activeMicTarget === 'prompt'
                              ? 'Transkrypcja...'
                              : 'Wprowadź polecenie przez mikrofon'}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText('custom_prompt_box', customPromptInput)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedId === 'custom_prompt_box' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Skopiowano polecenie!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                          <span>Kopiuj polecenie</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleFastSuggest}
                      disabled={isFastLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isFastLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>Generuj podpowiedź reżysera (Flash Lite)</span>
                    </button>
                  </div>
                </div>

                {/* Quick Voice Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[#9e988c] mr-1">
                    Szybkie polecenia głosowe:
                  </span>
                  {QUICK_VOICE_COMMANDS.map((cmd, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCustomPromptInput(cmd)}
                      className="px-2.5 py-1 rounded-md bg-[#090a0d] hover:bg-white/10 border border-white/10 text-[11px] text-[#cbc5b8] hover:text-white transition-colors cursor-pointer"
                    >
                      „{cmd.slice(0, 52)}...”
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={customPromptInput}
                  onChange={(e) => setCustomPromptInput(e.target.value)}
                  className="w-full rounded-lg bg-[#090a0d] border border-white/12 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  placeholder="Kliknij „Wprowadź polecenie przez mikrofon” i powiedz po polsku wytyczne dotyczące głębi ostrości, oświetlenia lub 4 kadrów..."
                />

                {fastSuggestion && (
                  <div className="rounded-lg bg-[#171b26] border border-[#d4af37]/45 p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#d4af37]">
                        Podpowiedź Reżysera AI (gemini-3.1-flash-lite)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyText('fast_sug', fastSuggestion)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] cursor-pointer"
                        >
                          {copiedId === 'fast_sug' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Skopiowano podpowiedź reżysera!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Kopiuj podpowiedź reżysera</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#eae6dc] leading-relaxed">{fastSuggestion}</p>
                  </div>
                )}

                {deepAnalysisResult && (
                  <div className="rounded-lg bg-[#161a24] border border-white/12 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[#d4af37]">
                        Raport Reżysera Głębi Architektonicznej (Gemini 4 Argon · ThinkingLevel.HIGH)
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            'deep_report_copy',
                            `Rozkład planów głębi:\n${deepAnalysisResult.depthSummary}\n\nWytyczne oświetlenia i atmosfery:\n${deepAnalysisResult.lightingAndAtmosphereGuide}\n\nPrompt fotorealizmu:\n${deepAnalysisResult.photorealismPrompt || ''}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/16 text-xs font-medium text-white cursor-pointer"
                      >
                        {copiedId === 'deep_report_copy' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Skopiowano raport reżysera!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                            <span>Kopiuj raport reżysera</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#dcd7cc]">
                      <div>
                        <strong className="text-white block mb-1">Rozkład planów głębi:</strong>
                        {deepAnalysisResult.depthSummary}
                      </div>
                      <div>
                        <strong className="text-white block mb-1">Wytyczne oświetlenia i atmosfery:</strong>
                        {deepAnalysisResult.lightingAndAtmosphereGuide}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: NARRATIVE & STORYTELLING GENERATOR */}
          {activeTab === 'story' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-serif-display font-semibold text-white">
                    Generator Narracji i Historii dla Załączonych Obrazów
                  </h2>
                  <p className="text-xs text-[#a9a396] mt-1">
                    Wykorzystuje wygenerowane odpowiedzi techniczne i głębię sceny, aby stworzyć krótką, angażującą opowieść nadającą kontekst wizualizacjom i 4 kadrom wideo.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onToggleStoryOverlay}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showStoryOverlayOnViewport
                        ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#f4f1ea]'
                        : 'bg-[#171b24] border-white/12 text-[#b8b2a6] hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>
                      {showStoryOverlayOnViewport
                        ? 'Napisy narracyjne na widoku 3D: WŁ.'
                        : 'Pokaż napisy narracyjne na widoku 3D'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateNarrative}
                    disabled={isGeneratingStory}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isGeneratingStory ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Tworzenie historii AI...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Wygeneruj nową narrację AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {NARRATIVE_TONES.map((t) => {
                  const active = selectedTone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTone(t.id)}
                      className={`text-left rounded-xl p-3.5 border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#d4af37]/15 border-[#d4af37] text-white'
                          : 'bg-[#12151e] border-white/10 text-[#b8b2a6] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">{t.label}</div>
                      <p className="text-[11px] text-[#9e988c] mt-1 leading-snug">{t.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleMic('story')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-medium shrink-0 cursor-pointer ${
                    isRecordingAudio && activeMicTarget === 'story'
                      ? 'bg-red-600/25 border-red-500 text-red-200'
                      : 'bg-[#171b24] border-white/12 text-[#d4af37] hover:text-white'
                  }`}
                  title="Podyktuj motyw przewodni historii przez mikrofon"
                >
                  {isRecordingAudio && activeMicTarget === 'story' ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                      <span>Stop ({formatTimer(recordingSeconds)})</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Dyktuj motyw</span>
                    </>
                  )}
                </button>
                <input
                  type="text"
                  value={customStoryTheme}
                  onChange={(e) => setCustomStoryTheme(e.target.value)}
                  placeholder="Opcjonalny motyw przewodni (np. wieczorna konsultacja chirurgiczna, harmonia marmuru i światła zachodzącego słońca)..."
                  className="flex-1 rounded-lg bg-[#12151e] border border-white/12 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="rounded-2xl bg-[#12151e] border border-[#d4af37]/35 p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[#d4af37] font-medium">
                    {narrative.toneLabel} · {activeScene.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          'story_full',
                          `${narrative.title}\n\n${narrative.leadHook}\n\n${narrative.storyBody}\n\n${narrative.voiceoverTagline}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/16 text-xs text-white transition-colors cursor-pointer"
                    >
                      {copiedId === 'story_full' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Skopiowano historię!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                          <span>Kopiuj całą historię</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onRegenerateInstantKeyframes(narrative.frameCaptions);
                        onChangeTab('sequence');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] text-[#090a0d] text-xs font-semibold cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Przypisz narrację do 4 kadrów wideo</span>
                    </button>
                  </div>
                </div>

                <h3 className="text-3xl font-serif-display font-semibold text-white">
                  {narrative.title}
                </h3>

                <p className="text-sm font-medium text-[#e9dfc4] leading-relaxed italic">
                  „{narrative.leadHook}”
                </p>

                <p className="text-sm text-[#dcd7cc] leading-relaxed">
                  {narrative.storyBody}
                </p>

                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="text-[#9e988c]">Podsumowanie Voice-Over / Tagline:</span>
                  <span className="text-[#d4af37] font-semibold">
                    {narrative.voiceoverTagline}
                  </span>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-2.5">
                  <div className="text-xs font-semibold text-white">
                    Scenariusz narracyjny dla sekwencji 4 kadrów wideo:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {narrative.frameCaptions.map((caption, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg bg-[#090a0d] border border-white/10 p-3 text-xs text-[#d6d0c4] leading-relaxed flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="text-[11px] font-mono-tabular text-[#d4af37] mb-1">
                            KADR 0{idx + 1}
                          </div>
                          {caption}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(`cap_${idx}`, caption)}
                          className="self-end inline-flex items-center gap-1 text-[11px] text-[#b8b2a6] hover:text-white cursor-pointer"
                        >
                          {copiedId === `cap_${idx}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Skopiowano</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-[#d4af37]" />
                              <span>Kopiuj</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 4-FRAME SEQUENCE & VIDEO GENERATION FROM THE 4 RENDERED FRAMES */}
          {activeTab === 'sequence' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-serif-display font-semibold text-white">
                    Sekwencja 4 Wyrenderowanych Kadrów i Kompilator Wideo MP4
                  </h2>
                  <p className="text-xs text-[#a9a396] mt-1">
                    Krok 1: Wygeneruj i wyrenderuj 4 kadry fazowe (oświetlenie, głębia ostrości i fotorealizm PBR) · Krok 2: Skompiluj z nich gotowe wideo MP4.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRegenerateInstantKeyframes()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171b24] hover:bg-[#222836] border border-white/12 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Renderuj ponownie 4 kadry z efektów FX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPlayingSequencePreview((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171b24] hover:bg-[#222836] border border-white/12 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>
                      {isPlayingSequencePreview
                        ? 'Zatrzymaj podgląd 4 kadrów'
                        : 'Podgląd poklatkowy 4 kadrów'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateAllFourAIFrames}
                    disabled={isGeneratingAllAIFrames}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#171b24] hover:bg-[#222836] border border-[#d4af37]/50 disabled:opacity-50 text-xs font-semibold text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isGeneratingAllAIFrames ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                    )}
                    <span>Wygeneruj 4 kadry przez AI (Nano Banana 2.1)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRenderVideoFromFourFrames(false)}
                    disabled={isGeneratingVideo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isGeneratingVideo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          Render wideo: Kadr {activeCompilingFrame}/4 ({videoCompileProgress}%)
                        </span>
                      </>
                    ) : (
                      <>
                        <Film className="w-3.5 h-3.5" />
                        <span>Generuj Wideo z 4 Kadrów (MP4)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Aspect Ratio & Frame Generation Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#12151e] border border-white/10 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#b8b2a6] font-medium mr-1">
                    Format kadrów (Aspect Ratio):
                  </span>
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setSelectedAspectRatio(ratio)}
                      className={`px-2.5 py-1 rounded text-xs font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedAspectRatio === ratio
                          ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                          : 'bg-[#1a1f2b] text-[#c7c0b2] hover:text-white'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#d6d0c4] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={studioQualityMode}
                      onChange={(e) => setStudioQualityMode(e.target.checked)}
                      className="accent-[#d4af37]"
                    />
                    <span>Tryb studyjny (gemini-3-pro-image)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCreateNewSceneImage}
                    disabled={generatingFrameIdx === 99}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {generatingFrameIdx === 99 ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5 text-[#d4af37]" />
                    )}
                    <span>Utwórz nową scenę w tym formacie</span>
                  </button>
                </div>
              </div>

              {/* Active 3D Camera Path Summary Strip (Stan A -> Stan B) */}
              <div className="rounded-xl bg-[#0e1118] border border-[#d4af37]/35 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-mono-tabular text-[#d4af37]">
                    AKTYWNA ŚCIEŻKA RUCHU KAMERY 3D (STAN A → STAN B · 4 KADRY: 0% / 33% / 67% / 100%)
                  </div>
                  <div className="text-xs text-[#dfd9cc] font-mono-tabular">
                    Stan A: ({cameraBlocking.startPose.x.toFixed(1)}, {cameraBlocking.startPose.y.toFixed(1)},{' '}
                    {cameraBlocking.startPose.z.toFixed(1)})m · {cameraBlocking.focalLengthMm}mm → Stan B: (
                    {cameraBlocking.endPose.x.toFixed(1)}, {cameraBlocking.endPose.y.toFixed(1)},{' '}
                    {cameraBlocking.endPose.z.toFixed(1)})m ·{' '}
                    {cameraBlocking.endFocalLengthMm ?? cameraBlocking.focalLengthMm}mm · Łuk M:{' '}
                    {cameraBlocking.curveArcOffset.toFixed(2)}m · Smoothing:{' '}
                    {Math.round(
                      cameraBlocking.smoothingFactor ??
                        (cameraBlocking.easingStyle === 'linear_constant' ? 0 : 65)
                    )}
                    %
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRegenerateInstantKeyframes(undefined, cameraBlocking)}
                    className="px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Przelicz 4 kadry wg ścieżki 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeTab('blocking3d')}
                    className="px-3 py-1.5 rounded-lg bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/50 text-xs font-semibold text-[#e8ca64] transition-colors cursor-pointer"
                  >
                    Edytuj Ścieżkę A → B w Modelu 3D
                  </button>
                </div>
              </div>

              {isPlayingSequencePreview && keyframes[previewFrameIdx] && (
                <div className="rounded-xl bg-[#090a0d] border border-[#d4af37]/50 p-4 flex flex-col md:flex-row items-center gap-5">
                  <img
                    src={keyframes[previewFrameIdx].imageUrl}
                    alt={keyframes[previewFrameIdx].phaseTitle}
                    referrerPolicy="no-referrer"
                    className="w-full md:w-96 h-56 object-cover rounded-lg border border-white/15"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-mono-tabular text-[#d4af37]">
                      AKTYWNY KADR W SEKWENCJI: 0{previewFrameIdx + 1} / 04 ·{' '}
                      {keyframes[previewFrameIdx].cameraOffsetLabel}
                    </div>
                    <h3 className="text-xl font-serif-display font-semibold text-white">
                      {keyframes[previewFrameIdx].phaseTitle}
                    </h3>
                    <p className="text-xs text-[#cbc5b8] leading-relaxed">
                      {keyframes[previewFrameIdx].prompt}
                    </p>
                  </div>
                </div>
              )}

              {/* 4 Rendered Keyframes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {keyframes.map((kf, idx) => (
                  <div
                    key={kf.id}
                    className={`rounded-xl bg-[#12151e] border overflow-hidden flex flex-col justify-between transition-colors ${
                      isGeneratingVideo && activeCompilingFrame === idx + 1
                        ? 'border-[#d4af37] ring-1 ring-[#d4af37]'
                        : 'border-white/10'
                    }`}
                  >
                    <div>
                      <div className="relative aspect-video bg-[#090a0d] overflow-hidden">
                        <img
                          src={kf.imageUrl}
                          alt={kf.phaseTitle}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[11px] font-mono-tabular text-[#d4af37]">
                          0{idx + 1} · {kf.cameraOffsetLabel}
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono-tabular text-[#e5dec9]">
                          {kf.sourceType === 'ai_generated' ? 'Kadr AI' : 'Wyrenderowany FX'}
                        </div>
                      </div>
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-white truncate">
                            {kf.phaseTitle}
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`kf_prompt_${idx}`, kf.prompt)}
                            className="inline-flex items-center gap-1 text-[11px] text-[#d4af37] hover:underline shrink-0 cursor-pointer"
                            title="Kopiuj podpowiedź tego kadru"
                          >
                            {copiedId === `kf_prompt_${idx}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Skopiowano</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Kopiuj</span>
                              </>
                            )}
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={kf.prompt}
                          onChange={(e) =>
                            onUpdateKeyframeImage(idx, kf.imageUrl, e.target.value)
                          }
                          className="w-full rounded bg-[#090a0d] border border-white/10 p-2 text-[11px] text-[#dcd7cc] focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>
                    </div>

                    <div className="px-3.5 pb-3.5 pt-2 border-t border-white/8 flex items-center justify-between gap-2">
                      <a
                        href={kf.imageUrl}
                        download={`bujok-kadr-0${idx + 1}.webp`}
                        className="inline-flex items-center gap-1 text-xs text-[#b8b2a6] hover:text-white whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pobierz kadr</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleGenerateAIKeyframe(idx)}
                        disabled={generatingFrameIdx === idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/16 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {generatingFrameIdx === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin text-[#d4af37]" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-[#d4af37]" />
                        )}
                        <span>Renderuj kadr AI</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dedicated 4-Frame Video Studio & Compiler */}
              <div className="rounded-2xl bg-[#12151e] border border-[#d4af37]/40 p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#d4af37] mb-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>KOMPILATOR WIDEO Z SEKWENCJI 4 WYGENEROWANYCH I WYRENDEROWANYCH KADRÓW</span>
                    </div>
                    <h3 className="text-xl font-serif-display font-semibold text-white">
                      Generowanie Wideo MP4 z 4 Kadrów (Kadr 01 → Kadr 02 → Kadr 03 → Kadr 04)
                    </h3>
                    <p className="text-xs text-[#a9a396] mt-0.5">
                      Łączy wszystkie 4 wyrenderowane kadry powyżej w płynny materiał wideo MP4 z wybranym rodzajem przejścia optycznego i opcjonalną narracją.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRenderVideoFromFourFrames(false)}
                      disabled={isGeneratingVideo}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isGeneratingVideo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>
                            Kompilacja: Kadr 0{activeCompilingFrame}/04 ({videoCompileProgress}%)
                          </span>
                        </>
                      ) : (
                        <>
                          <Film className="w-4 h-4" />
                          <span>Wyrenderuj Wideo z 4 Kadrów (Podgląd MP4)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRenderVideoFromFourFrames(true)}
                      disabled={isGeneratingVideo}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/15 disabled:opacity-50 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>Renderuj i od razu pobierz MP4</span>
                    </button>
                  </div>
                </div>

                {/* Transition Mode Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {TRANSITION_MODES.map((tm) => {
                    const active = videoTransitionMode === tm.id;
                    return (
                      <button
                        key={tm.id}
                        type="button"
                        onClick={() => setVideoTransitionMode(tm.id)}
                        className={`text-left rounded-xl p-3.5 border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#d4af37]/15 border-[#d4af37] text-white'
                            : 'bg-[#0c0e14] border-white/10 text-[#b8b2a6] hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-semibold text-white">{tm.label}</div>
                        <p className="text-[11px] text-[#9e988c] mt-1 leading-snug">{tm.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Video Parameters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div className="rounded-lg bg-[#090a0d] border border-white/10 p-3">
                    <label className="block text-[11px] text-[#9e988c] mb-1.5">
                      Czas trwania wideo (4 kadry):
                    </label>
                    <select
                      value={sequenceVideoDuration}
                      onChange={(e) => setSequenceVideoDuration(Number(e.target.value))}
                      className="w-full bg-[#12151e] border border-white/12 rounded px-2.5 py-1.5 text-xs text-white font-mono-tabular"
                    >
                      <option value={4}>4 sekundy (1.0s na każdy z 4 kadrów)</option>
                      <option value={6}>6 sekund (1.5s na każdy z 4 kadrów)</option>
                      <option value={8}>8 sekund (2.0s na każdy z 4 kadrów)</option>
                      <option value={12}>12 sekund (3.0s na każdy z 4 kadrów)</option>
                    </select>
                  </div>

                  <div className="rounded-lg bg-[#090a0d] border border-white/10 p-3">
                    <label className="block text-[11px] text-[#9e988c] mb-1.5">
                      Format docelowego wideo:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVideoAspectRatio('16:9')}
                        className={`flex-1 py-1.5 rounded text-xs font-mono-tabular cursor-pointer ${
                          videoAspectRatio === '16:9'
                            ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                            : 'bg-[#12151e] text-[#b8b2a6]'
                        }`}
                      >
                        16:9 (1280×720)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoAspectRatio('9:16')}
                        className={`flex-1 py-1.5 rounded text-xs font-mono-tabular cursor-pointer ${
                          videoAspectRatio === '9:16'
                            ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                            : 'bg-[#12151e] text-[#b8b2a6]'
                        }`}
                      >
                        9:16 (720×1280)
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#090a0d] border border-white/10 p-3 flex flex-col justify-between">
                    <span className="text-[11px] text-[#9e988c]">
                      Podpisy narracyjne na kadrach 1–4:
                    </span>
                    <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer mt-1.5">
                      <input
                        type="checkbox"
                        checked={includeStoryCaptionsInVideo}
                        onChange={(e) => setIncludeStoryCaptionsInVideo(e.target.checked)}
                        className="accent-[#d4af37]"
                      />
                      <span>Wypal napisy historii na wideo</span>
                    </label>
                  </div>
                </div>

                {/* Video Prompt Bar with Microphone & Copy Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleToggleMic('video')}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium shrink-0 cursor-pointer ${
                      isRecordingAudio && activeMicTarget === 'video'
                        ? 'bg-red-600/25 border-red-500 text-red-200'
                        : 'bg-[#181c26] border-white/12 text-[#d4af37] hover:text-white'
                    }`}
                    title="Podyktuj opis wideo przez mikrofon"
                  >
                    {isRecordingAudio && activeMicTarget === 'video' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 text-red-400" />
                        <span>Stop ({formatTimer(recordingSeconds)})</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Dyktuj</span>
                      </>
                    )}
                  </button>

                  <input
                    type="text"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    className="flex-1 rounded-lg bg-[#090a0d] border border-white/12 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    placeholder="Wytyczne dla generatora wideo z 4 kadrów..."
                  />

                  <button
                    type="button"
                    onClick={() => handleCopyText('video_prompt_copy', videoPrompt)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/16 text-xs text-white shrink-0 cursor-pointer"
                  >
                    {copiedId === 'video_prompt_copy' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Skopiowano!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Kopiuj opis</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleAnimateToVideoAI}
                    disabled={isGeneratingVideo}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/16 disabled:opacity-50 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Generuj przez Interactions API (Omni 1.2)</span>
                  </button>
                </div>

                {/* Live Progress Bar during 4-frame compilation */}
                {isGeneratingVideo && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-mono-tabular text-[#d4af37]">
                      <span>
                        Renderowanie strumienia MP4 z Kadrów 01–04 (Aktywny Kadr 0{activeCompilingFrame}/04)
                      </span>
                      <span>{videoCompileProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#090a0d] overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-[#d4af37] transition-all duration-150"
                        style={{ width: `${videoCompileProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Compiled 4-Frame Video Player & Download */}
                {generatedVideoUrl && (
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-[#d4af37]">
                        Gotowe wideo wyrenderowane z sekwencji 4 kadrów ({videoAspectRatio} ·{' '}
                        {sequenceVideoDuration}s
                        {generatedVideoSize ? ` · ${formatBytes(generatedVideoSize)}` : ''})
                      </div>
                      <a
                        href={generatedVideoUrl}
                        download={`bujok-wideo-4-kadry-${sequenceVideoDuration}s-${videoAspectRatio.replace(':', 'x')}.mp4`}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-[#090a0d] text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pobierz wyrenderowane wideo (.MP4)</span>
                      </a>
                    </div>
                    <video
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      className="w-full max-h-96 rounded-xl border border-white/15 bg-black"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: WEBP, LIGHTWEIGHT MP4 FROM 4 FRAMES & ULTRA-COMPACT URL LINK */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif-display font-semibold text-white">
                  Zapis Konfiguracji w Lekkim Linku oraz Eksport WebP i Wideo MP4 z 4 Kadrów
                </h2>
                <p className="text-xs text-[#a9a396] mt-1">
                  Udostępniaj gotową konfigurację głębi i efektów wizualnych FX za pomocą ultralekkiego linku lub pobierz zoptymalizowane pliki WebP i wideo MP4 wyrenderowane z 4 kadrów.
                </p>
              </div>

              <div className="rounded-xl bg-[#12151e] border border-white/10 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      01. Zapis w Formacie Minimalnie Obciążającym Link (Compact Hash Descriptor)
                    </h3>
                    <p className="text-xs text-[#9e988c]">
                      Cała konfiguracja głębi 3D oraz efektów wizualnych FX zapisana w zaledwie{' '}
                      <strong className="text-[#d4af37] font-mono-tabular">
                        {linkByteLength} bajtach
                      </strong>
                      .
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onCopyCompactLink}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>
                      {linkCopied ? 'Skopiowano lekki link!' : 'Kopiuj lekki link konfiguracji'}
                    </span>
                  </button>
                </div>

                <div className="rounded-lg bg-[#090a0d] border border-white/10 px-4 py-3 font-mono-tabular text-xs text-[#d4af37] break-all">
                  {compactShareUrl}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-xl bg-[#12151e] border border-white/10 p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-white">
                      02. Eksport do Plików WebP (Kadr 3D lub Arkusz 4 Kadrów)
                    </h3>
                    <p className="text-xs text-[#9e988c]">
                      Format WebP zapisuje bieżący kadr 3D lub planszę 2×2 wszystkich 4 wyrenderowanych kadrów wraz z aktywnymi efektami rozmycia, winiety, korekcji barw i ziarna filmowego.
                    </p>

                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#c5bfb3]">Stopień kompresji jakości WebP</span>
                        <span className="font-mono-tabular text-[#d4af37]">{webpQuality}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={98}
                        value={webpQuality}
                        onChange={(e) => setWebpQuality(Number(e.target.value))}
                        className="studio-slider w-full"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/8">
                    <button
                      type="button"
                      onClick={() => onExportSingleWebP(webpQuality / 100)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Pobierz kadr 3D (.webp)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExportingSheet}
                      onClick={async () => {
                        setIsExportingSheet(true);
                        try {
                          await exportFourFrameSequenceWebP(keyframes, webpQuality / 100);
                        } finally {
                          setIsExportingSheet(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>Pobierz arkusz 4 kadrów (.webp)</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-[#12151e] border border-white/10 p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-white">
                      03. Eksport Wideo (.MP4) z Sekwencji 4 Wyrenderowanych Kadrów
                    </h3>
                    <p className="text-xs text-[#9e988c]">
                      Kompiluje 4 wygenerowane i wyrenderowane kadry (Kadr 01 → 02 → 03 → 04) w lekki, gotowy do publikacji plik wideo MP4.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] text-[#b8b2a6] mb-1">
                          Czas trwania sekwencji 4 kadrów:
                        </label>
                        <select
                          value={mp4Duration}
                          onChange={(e) => setMp4Duration(Number(e.target.value))}
                          className="w-full rounded-lg bg-[#090a0d] border border-white/12 px-2.5 py-1.5 text-xs text-white font-mono-tabular"
                        >
                          <option value={4}>4 sekundy (1.0s / kadr)</option>
                          <option value={6}>6 sekund (1.5s / kadr)</option>
                          <option value={8}>8 sekund (2.0s / kadr)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#b8b2a6] mb-1">
                          Docelowy bitrate (rozmiar):
                        </label>
                        <select
                          value={mp4BitrateKbps}
                          onChange={(e) => setMp4BitrateKbps(Number(e.target.value))}
                          className="w-full rounded-lg bg-[#090a0d] border border-white/12 px-2.5 py-1.5 text-xs text-white font-mono-tabular"
                        >
                          <option value={1200}>1.2 Mbps (~700 KB)</option>
                          <option value={2200}>2.2 Mbps (~1.2 MB HD)</option>
                          <option value={3200}>3.2 Mbps (Wysoka jakość)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={isExportingMP4}
                      onClick={() => onExportLightweightMP4(mp4Duration, mp4BitrateKbps)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isExportingMP4 ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Renderowanie 4 kadrów ({mp4Progress}%)...</span>
                        </>
                      ) : (
                        <>
                          <Film className="w-3.5 h-3.5" />
                          <span>Pobierz wideo z 4 kadrów (.MP4)</span>
                        </>
                      )}
                    </button>

                    {lastExportInfo && (
                      <div className="text-xs text-[#b8b2a6] font-mono-tabular">
                        Ostatni zapis: <strong className="text-white">{lastExportInfo.filename}</strong> (
                        {formatBytes(lastExportInfo.sizeBytes)})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 04. GITHUB REPOSITORY PUBLICATION DESCRIPTION & README */}
              <div className="rounded-xl bg-[#12151e] border border-[#d4af37]/35 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      04. Pakiet Publikacyjny na GitHub (Opis About, Tagi Topics &amp; Pełne README.md)
                    </h3>
                    <p className="text-xs text-[#9e988c]">
                      Gotowy opis repozytorium przygotowany do wklejenia na GitHubie (zapisany również bezpośrednio w pliku <code className="text-[#d4af37]">/README.md</code> projektu).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText('gh_about', GITHUB_SHORT_DESCRIPTION)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-white cursor-pointer"
                    >
                      {copiedId === 'gh_about' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                      )}
                      <span>
                        {copiedId === 'gh_about' ? 'Skopiowano opis About!' : 'Kopiuj opis About'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText('gh_topics', GITHUB_TOPICS.join(', '))}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-white cursor-pointer"
                    >
                      {copiedId === 'gh_topics' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                      )}
                      <span>
                        {copiedId === 'gh_topics' ? 'Skopiowano tagi!' : 'Kopiuj Topics'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText('gh_readme', GITHUB_README_MARKDOWN)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] cursor-pointer"
                    >
                      {copiedId === 'gh_readme' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedId === 'gh_readme' ? 'Skopiowano pełne README.md!' : 'Kopiuj pełne README.md'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-[#090a0d] border border-white/10 p-3.5 space-y-2">
                  <div className="text-[11px] font-semibold text-[#d4af37]">
                    GitHub Repository Description (sekcja About):
                  </div>
                  <p className="text-xs text-[#eae6dc] leading-relaxed">
                    {GITHUB_SHORT_DESCRIPTION}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {GITHUB_TOPICS.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded bg-[#141824] border border-white/10 text-[10px] font-mono-tabular text-[#d4af37]"
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI DIRECTOR CHATBOT, COPY DIRECTOR HINTS, MICROPHONE & VIDEO ANALYSIS */}
          {activeTab === 'director' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
              <div className="lg:col-span-2 rounded-xl bg-[#12151e] border border-white/10 flex flex-col h-[500px]">
                <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#d4af37]" />
                    <span className="text-sm font-semibold text-white">
                      Reżyser AI — Podpowiedzi Głębi 3D, Efektów FX i Sekwencji 4 Kadrów
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {latestAssistantReply && (
                      <button
                        type="button"
                        onClick={() => handleCopyText('latest_director_hint', latestAssistantReply)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-[11px] font-semibold text-[#090a0d] transition-colors cursor-pointer"
                      >
                        {copiedId === 'latest_director_hint' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Skopiowano podpowiedź reżysera!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Kopiuj ostatnią podpowiedź reżysera</span>
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-1 bg-[#090a0d] p-1 rounded-lg border border-white/10 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setChatMode('complex')}
                        className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap ${
                          chatMode === 'complex'
                            ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                            : 'text-[#b8b2a6]'
                        }`}
                      >
                        Argon 4
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatMode('general')}
                        className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap ${
                          chatMode === 'general'
                            ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                            : 'text-[#b8b2a6]'
                        }`}
                      >
                        Flash 3.8
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatMode('fast')}
                        className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap ${
                          chatMode === 'fast'
                            ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                            : 'text-[#b8b2a6]'
                        }`}
                      >
                        Flash Lite 3.1
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {chatMessages.map((msg) => {
                    const isCopiedMsg = copiedId === `chat_msg_${msg.id}`;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          msg.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[88%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#d4af37] text-[#090a0d] font-medium'
                              : 'bg-[#191d28] text-[#eae6dc] border border-white/10 space-y-2.5'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.text}</div>

                          {msg.role === 'assistant' && (
                            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] text-[#9e988c] font-mono-tabular">
                                Podpowiedź Reżysera AI {msg.modelUsed ? `(${msg.modelUsed})` : ''}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(`chat_msg_${msg.id}`, msg.text)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#d4af37] hover:bg-[#e3be42] text-[11px] font-semibold text-[#090a0d] transition-colors cursor-pointer"
                                >
                                  {isCopiedMsg ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Skopiowano podpowiedź!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Kopiuj podpowiedź reżysera</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomPromptInput(msg.text);
                                    setVideoPrompt(msg.text.slice(0, 260));
                                    handleCopyText(`use_msg_${msg.id}`, msg.text);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/16 text-[11px] text-white transition-colors cursor-pointer"
                                >
                                  <Wand2 className="w-3 h-3 text-[#d4af37]" />
                                  <span>
                                    {copiedId === `use_msg_${msg.id}`
                                      ? 'Przekazano do 4 kadrów!'
                                      : 'Użyj w kreatorze'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-[#7f7a6f] mt-1 px-1">
                          {msg.timestamp} {msg.modelUsed ? `· ${msg.modelUsed}` : ''}
                        </div>
                      </div>
                    );
                  })}
                  {isChatSending && (
                    <div className="text-xs text-[#d4af37] flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reżyser AI przygotowuje podpowiedź...</span>
                    </div>
                  )}
                </div>

                {/* Quick Voice Commands Strip in Chat */}
                <div className="px-3 py-1.5 bg-[#0c0f16] border-t border-white/8 flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] text-[#9e988c] shrink-0">
                    Szybkie polecenia:
                  </span>
                  {QUICK_VOICE_COMMANDS.map((cmd, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setChatInput(cmd)}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/12 text-[11px] text-[#cbc5b8] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {cmd.slice(0, 44)}...
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={handleSendChat}
                  className="p-3 border-t border-white/10 flex items-center gap-2 bg-[#0d1017]"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleMic('chat')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                      isRecordingAudio && activeMicTarget === 'chat'
                        ? 'bg-red-600/25 border-red-500 text-red-100'
                        : 'bg-[#171b24] border-[#d4af37]/40 text-[#d4af37] hover:text-white'
                    }`}
                    title="Wprowadź polecenie dla Reżysera AI przez mikrofon"
                  >
                    {isRecordingAudio && activeMicTarget === 'chat' ? (
                      <>
                        <MicOff className="w-4 h-4 text-red-400" />
                        <span>Stop ({formatTimer(recordingSeconds)})</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>Mikrofon</span>
                      </>
                    )}
                  </button>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Kliknij „Mikrofon” i podyktuj polecenie lub wpisz pytanie do Reżysera AI..."
                    className="flex-1 rounded-lg bg-[#090a0d] border border-white/12 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  />
                  <button
                    type="submit"
                    disabled={isChatSending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Wyślij</span>
                  </button>
                </form>
              </div>

              <div className="rounded-xl bg-[#12151e] border border-white/10 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    Analiza Wideo i Obrazów (Gemini 4 Argon)
                  </h3>
                  <p className="text-xs text-[#9e988c] leading-relaxed">
                    Prześlij gotowy plik wideo (.mp4/.webm) lub zdjęcie referencyjne, aby model{' '}
                    <span className="text-white font-mono-tabular">gemini-4-argon</span> ocenił głębię ostrości, oświetlenie i przygotował podpowiedzi reżyserskie.
                  </p>

                  <div className="space-y-2 pt-2">
                    <label className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-white cursor-pointer">
                      {isAnalyzingVideo ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
                      ) : (
                        <Video className="w-4 h-4 text-[#d4af37]" />
                      )}
                      <span>
                        {isAnalyzingVideo
                          ? 'Analizowanie wideo (Argon 4)...'
                          : 'Wczytaj plik wideo do analizy'}
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUploadForAnalysis}
                        className="hidden"
                      />
                    </label>

                    <label className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-white cursor-pointer">
                      <Upload className="w-4 h-4 text-[#d4af37]" />
                      <span>Wczytaj zdjęcie do analizy głębi</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {videoAnalysisText && (
                    <div className="mt-3 rounded-lg bg-[#090a0d] border border-white/10 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#d4af37]">
                          Analiza Reżysera AI:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText('vid_analysis_copy', videoAnalysisText)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/16 text-[11px] text-white cursor-pointer"
                        >
                          {copiedId === 'vid_analysis_copy' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Skopiowano!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-[#d4af37]" />
                              <span>Kopiuj analizę</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto text-xs text-[#dcd7cc] whitespace-pre-wrap leading-relaxed">
                        {videoAnalysisText}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/8 text-[11px] text-[#8d877b]">
                  Wszystkie wywołania AI działają po stronie serwera Express z obsługą modeli Argon 4, Flash 3.8, Flash Lite 3.1, Nano Banana 2.1, Omni 1.2 Flash oraz Transcribe 3.5.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

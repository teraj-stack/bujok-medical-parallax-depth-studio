import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  Eye,
  Layers,
  Loader2,
  Smartphone,
  Sparkles,
  Type,
} from 'lucide-react';
import {
  CameraBlockingConfig,
  MobileGraphicFormat,
  SceneAsset,
  SceneNarrative,
  VisualEffectSettings,
} from '../types/studio';
import { renderMobileGraphicAsset } from '../utils/mediaExporter';

interface MobileGraphicsStudioModuleProps {
  activeScene: SceneAsset;
  settings: VisualEffectSettings;
  cameraBlocking: CameraBlockingConfig;
  narrative: SceneNarrative;
  mobileSafeZonesVisible: boolean;
  onToggleSafeZones: () => void;
}

const MOBILE_FORMATS: {
  id: MobileGraphicFormat;
  label: string;
  resolution: string;
  aspectCss: string;
  geminiRatio: '9:16' | '3:4' | '1:1';
  desc: string;
}[] = [
  {
    id: '9:16_story',
    label: 'Stories / Reels 9:16',
    resolution: '1080 × 1920 px',
    aspectCss: 'aspect-[9/16] max-h-[470px]',
    geminiRatio: '9:16',
    desc: 'Pionowa grafika pełnoekranowa z typografią i przyciskiem CTA pod Instagram Stories, Reels i TikTok.',
  },
  {
    id: '9:16_wallpaper',
    label: 'Tapeta Smartfona 9:16',
    resolution: '1080 × 1920 px',
    aspectCss: 'aspect-[9/16] max-h-[470px]',
    geminiRatio: '9:16',
    desc: 'Czysty kadr pionowy bez napisów — idealny na ekran blokady telefonu lub tło aplikacji mobilnej.',
  },
  {
    id: '4:5_feed',
    label: 'Post Mobilny 4:5',
    resolution: '1080 × 1350 px',
    aspectCss: 'aspect-[4/5] max-h-[430px]',
    geminiRatio: '3:4',
    desc: 'Maksymalna powierzchnia ekspozycji w pionowym kanale aktualności na smartfonach.',
  },
  {
    id: '1:1_square',
    label: 'Karuzela Mobilna 1:1',
    resolution: '1080 × 1080 px',
    aspectCss: 'aspect-square max-h-[390px]',
    geminiRatio: '1:1',
    desc: 'Uniwersalny format kwadratowy do mobilnych kart wizytówek i postów karuzelowych.',
  },
];

export const MobileGraphicsStudioModule: React.FC<MobileGraphicsStudioModuleProps> = ({
  activeScene,
  settings,
  cameraBlocking,
  narrative,
  mobileSafeZonesVisible,
  onToggleSafeZones,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<MobileGraphicFormat>('9:16_story');
  const [pathPct, setPathPct] = useState<number>(35);
  const [includeTypography, setIncludeTypography] = useState<boolean>(true);
  const [headline, setHeadline] = useState<string>(narrative.title);
  const [subheadline, setSubheadline] = useState<string>(
    narrative.voiceoverTagline || narrative.leadHook.slice(0, 64)
  );
  const [ctaLabel, setCtaLabel] = useState<string>('Umów konsultację w Warszawie');

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [sourceBaseImage, setSourceBaseImage] = useState<string>(activeScene.imageUrl);
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [isGeneratingPack, setIsGeneratingPack] = useState<boolean>(false);
  const [storiesPack, setStoriesPack] = useState<
    Array<{ label: string; pct: number; dataUrl: string; filename: string }>
  >([]);
  const [downloadDone, setDownloadDone] = useState<boolean>(false);

  useEffect(() => {
    setSourceBaseImage(activeScene.imageUrl);
  }, [activeScene.imageUrl]);

  useEffect(() => {
    setHeadline(narrative.title);
    setSubheadline(narrative.voiceoverTagline || narrative.leadHook.slice(0, 64));
  }, [narrative.title, narrative.voiceoverTagline, narrative.leadHook]);

  useEffect(() => {
    let cancelled = false;
    setIsRenderingPreview(true);
    renderMobileGraphicAsset({
      imageUrl: sourceBaseImage,
      settings,
      format: selectedFormat,
      cameraBlocking,
      pathProgress: pathPct / 100,
      headline,
      subheadline,
      ctaLabel,
      includeTypography,
      autoDownload: false,
    })
      .then((res) => {
        if (!cancelled) {
          setPreviewUrl(res.dataUrl);
        }
      })
      .catch(() => {
        // ignore transient load error
      })
      .finally(() => {
        if (!cancelled) setIsRenderingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    sourceBaseImage,
    settings,
    selectedFormat,
    cameraBlocking,
    pathPct,
    headline,
    subheadline,
    ctaLabel,
    includeTypography,
  ]);

  const activeFormatSpec =
    MOBILE_FORMATS.find((f) => f.id === selectedFormat) || MOBILE_FORMATS[0];

  const handleDownloadHD = async () => {
    await renderMobileGraphicAsset({
      imageUrl: sourceBaseImage,
      settings,
      format: selectedFormat,
      cameraBlocking,
      pathProgress: pathPct / 100,
      headline,
      subheadline,
      ctaLabel,
      includeTypography,
      autoDownload: true,
    });
    setDownloadDone(true);
    window.setTimeout(() => setDownloadDone(false), 2000);
  };

  const handleGenerateAIMobileBase = async () => {
    setIsGeneratingAI(true);
    try {
      const mobilePrompt = `Pionowa, fotorealistyczna grafika mobilna (${activeFormatSpec.resolution}) wnętrza kliniki ${activeScene.title}: naturalne światło dzienne zza okien z panoramą Warszawy, szlachetny marmur Calacatta, głębia ostrości obiektywu ${cameraBlocking.focalLengthMm}mm, kompozycja zoptymalizowana pod ekran smartfona.`;
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: mobilePrompt,
          referenceImage: activeScene.imageUrl,
          aspectRatio: activeFormatSpec.geminiRatio,
          studioQuality: false,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setSourceBaseImage(data.imageUrl);
      }
    } catch {
      // Keeps active shader-graded base image on network error
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateFourStoriesPack = async () => {
    setIsGeneratingPack(true);
    try {
      const phases = [
        { pct: 0, label: '01 · Stan A (0%)' },
        { pct: 33, label: '02 · Faza 33%' },
        { pct: 67, label: '03 · Faza 67%' },
        { pct: 100, label: '04 · Stan B (100%)' },
      ];
      const generated: Array<{
        label: string;
        pct: number;
        dataUrl: string;
        filename: string;
      }> = [];

      for (let i = 0; i < phases.length; i++) {
        const ph = phases[i];
        const caption = narrative.frameCaptions[i] || subheadline;
        const item = await renderMobileGraphicAsset({
          imageUrl: sourceBaseImage,
          settings,
          format: '9:16_story',
          cameraBlocking,
          pathProgress: ph.pct / 100,
          headline,
          subheadline: caption,
          ctaLabel,
          includeTypography,
          autoDownload: false,
        });
        generated.push({
          label: ph.label,
          pct: ph.pct,
          dataUrl: item.dataUrl,
          filename: item.filename,
        });
      }
      setStoriesPack(generated);
    } finally {
      setIsGeneratingPack(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif-display font-semibold text-white">
            Generator Grafik na Telefony Komórkowe (Mobile-Friendly Studio)
          </h2>
          <p className="text-xs text-[#b8b2a6] mt-1 max-w-3xl leading-relaxed">
            Projektuj i pobieraj pionowe kreacje mobilne <strong className="text-[#f4f1ea]">1080×1920 (9:16)</strong>,{' '}
            <strong className="text-[#f4f1ea]">1080×1350 (4:5)</strong> oraz{' '}
            <strong className="text-[#f4f1ea]">1080×1080 (1:1)</strong> bezpośrednio ze ścieżki kamery 3D i aktywnego oświetlenia FX — ze strefami bezpiecznymi interfejsu smartfona.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleSafeZones}
            className={`min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              mobileSafeZonesVisible
                ? 'bg-[#d4af37]/15 border-[#d4af37]/50 text-[#e8ca64]'
                : 'bg-[#151821] border-white/12 text-[#b8b2a6] hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>
              {mobileSafeZonesVisible
                ? 'Strefy bezpieczne telefonu: WŁ.'
                : 'Strefy bezpieczne telefonu: WYŁ.'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadHD}
            className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors cursor-pointer"
          >
            {downloadDone ? (
              <>
                <Check className="w-4 h-4" />
                <span>Pobrano plik mobilny!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Pobierz grafikę HD ({activeFormatSpec.resolution})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Split Grid: Mobile Device Mockup (Left) + Controls (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Smartphone Live Preview Frame */}
        <div className="lg:col-span-5 rounded-2xl bg-[#11141d] border border-white/10 p-4 sm:p-5 flex flex-col items-center gap-3">
          <div className="w-full flex items-center justify-between text-[11px] text-[#9e988c]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#e5dec9]">
              <Smartphone className="w-3.5 h-3.5 text-[#d4af37]" />
              Podgląd ekranu telefonu
            </span>
            <span className="font-mono-tabular text-[#d4af37]">
              {activeFormatSpec.resolution}
            </span>
          </div>

          {/* Phone Chassis */}
          <div className="relative rounded-[28px] border-[5px] border-[#252a38] bg-[#07080c] shadow-2xl overflow-hidden w-full max-w-[276px] flex items-center justify-center">
            <div className={`relative w-full ${activeFormatSpec.aspectCss} bg-[#090a0d]`}>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Podgląd grafiki mobilnej"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-[#9e988c]">
                  Renderowanie podglądu...
                </div>
              )}

              {/* Optional Safe-Zone Guides for Mobile UI Chrome */}
              {mobileSafeZonesVisible && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Top Notch / Status Bar Safe Area */}
                  <div className="absolute top-0 inset-x-0 h-8 border-b border-dashed border-sky-400/55 bg-sky-950/25 flex items-center justify-between px-3 text-[9px] font-mono-tabular text-sky-200">
                    <span>9:41 · SAFE TOP</span>
                    <span className="w-12 h-2.5 rounded-full bg-black/80 border border-white/15" />
                    <span>5G 100%</span>
                  </div>

                  {/* Right-side Reels/TikTok Action Column Safe Guide (9:16 Story) */}
                  {selectedFormat === '9:16_story' && (
                    <div className="absolute right-1.5 bottom-12 w-9 h-32 rounded-lg border border-dashed border-amber-400/55 bg-amber-950/20 flex items-center justify-center">
                      <span className="text-[8px] font-mono-tabular text-amber-200 -rotate-90 whitespace-nowrap">
                        UI IKON
                      </span>
                    </div>
                  )}

                  {/* Bottom Home Indicator Safe Area */}
                  <div className="absolute bottom-0 inset-x-0 h-7 border-t border-dashed border-sky-400/55 bg-sky-950/25 flex flex-col items-center justify-center">
                    <div className="w-20 h-1 rounded-full bg-white/70" />
                  </div>
                </div>
              )}

              {isRenderingPreview && (
                <div className="absolute top-2 right-2 p-1 rounded-md bg-black/75">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-[#9e988c] text-center leading-relaxed">
            {activeFormatSpec.desc}
          </p>
        </div>

        {/* Right Controls Column */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Format Selector */}
          <div className="rounded-xl bg-[#12151e] border border-white/10 p-4 space-y-3">
            <div className="text-xs font-semibold text-white">
              01. Wybierz format docelowy na telefon komórkowy
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MOBILE_FORMATS.map((fmt) => {
                const active = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`min-h-[48px] text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#d4af37]/15 border-[#d4af37] text-white'
                        : 'bg-[#0b0d13] border-white/10 text-[#c5bfb3] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{fmt.label}</span>
                      <span className="text-[10px] font-mono-tabular text-[#d4af37]">
                        {fmt.resolution}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Camera Path Sampling Slider */}
          <div className="rounded-xl bg-[#12151e] border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">
                02. Kadrowanie z punktu na ścieżce kamery 3D (Stan A → Stan B)
              </span>
              <span className="text-xs font-mono-tabular text-[#d4af37] font-semibold">
                Pozycja ścieżki: {pathPct}%
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={pathPct}
              onChange={(e) => setPathPct(Number(e.target.value))}
              className="studio-slider w-full"
            />

            <div className="grid grid-cols-4 gap-2 pt-1">
              {[
                { label: 'Stan A (0%)', val: 0 },
                { label: 'Kadr 02 (33%)', val: 33 },
                { label: 'Kadr 03 (67%)', val: 67 },
                { label: 'Stan B (100%)', val: 100 },
              ].map((step) => (
                <button
                  key={step.val}
                  type="button"
                  onClick={() => setPathPct(step.val)}
                  className={`min-h-[40px] px-2 py-1.5 rounded-lg border text-[11px] font-mono-tabular transition-colors cursor-pointer ${
                    pathPct === step.val
                      ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37] font-semibold'
                      : 'bg-[#090a0d] border-white/10 text-[#c5bfb3] hover:text-white'
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Mobile Editorial Typography & CTA */}
          <div className="rounded-xl bg-[#12151e] border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <Type className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>03. Warstwa typograficzna i przycisk CTA na ekranie mobilnym</span>
              </div>
              <button
                type="button"
                onClick={() => setIncludeTypography((v) => !v)}
                className={`min-h-[38px] px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer ${
                  includeTypography && selectedFormat !== '9:16_wallpaper'
                    ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37] font-semibold'
                    : 'bg-[#090a0d] text-[#b8b2a6] border-white/12'
                }`}
              >
                {selectedFormat === '9:16_wallpaper'
                  ? 'Tryb czystej tapety (bez tekstu)'
                  : includeTypography
                    ? 'Napisy mobilne: WŁĄCZONE'
                    : 'Napisy mobilne: WYŁĄCZONE'}
              </button>
            </div>

            {includeTypography && selectedFormat !== '9:16_wallpaper' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#b8b2a6] mb-1">
                    Nagłówek główny (czytelny na ekranie 375px):
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg bg-[#090a0d] border border-white/12 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#b8b2a6] mb-1">
                    Podtytuł / hasło narracyjne:
                  </label>
                  <input
                    type="text"
                    value={subheadline}
                    onChange={(e) => setSubheadline(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg bg-[#090a0d] border border-white/12 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#b8b2a6] mb-1">
                    Przycisk akcji mobilnej (CTA):
                  </label>
                  <input
                    type="text"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg bg-[#090a0d] border border-white/12 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. AI Mobile Generation & 4-Card Stories Carousel Generator */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isGeneratingAI}
              onClick={handleGenerateAIMobileBase}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#181c26] hover:bg-[#222838] border border-[#d4af37]/40 text-xs font-semibold text-[#e8ca64] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isGeneratingAI ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
              )}
              <span>
                {isGeneratingAI
                  ? 'Generowanie natywnego kadru AI...'
                  : 'Wygeneruj natywny kadr AI na telefon'}
              </span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPack}
              onClick={handleGenerateFourStoriesPack}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isGeneratingPack ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              <span>Wygeneruj serię 4 kart Stories 9:16 (0% → 100%)</span>
            </button>

            {sourceBaseImage !== activeScene.imageUrl && (
              <button
                type="button"
                onClick={() => setSourceBaseImage(activeScene.imageUrl)}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-white/8 hover:bg-white/14 text-xs text-[#c5bfb3] cursor-pointer"
              >
                Przywróć fotografię bazową
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4-Card Vertical Stories Pack Strip */}
      {storiesPack.length > 0 && (
        <div className="rounded-2xl bg-[#11141d] border border-[#d4af37]/35 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Gotowa Seria 4 Pionowych Kart Mobilnych Stories 9:16 (1080×1920)
              </h3>
              <p className="text-xs text-[#9e988c]">
                Każda karta odpowiada kolejnej fazie interpolowanej ścieżki kamery 3D (Stan A → Stan B).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {storiesPack.map((card) => (
              <div
                key={card.pct}
                className="rounded-xl bg-[#090a0d] border border-white/10 p-2.5 flex flex-col gap-2"
              >
                <div className="aspect-[9/16] rounded-lg overflow-hidden bg-black">
                  <img
                    src={card.dataUrl}
                    alt={card.label}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="font-mono-tabular text-[#e5dec9] truncate">
                    {card.label}
                  </span>
                  <a
                    href={card.dataUrl}
                    download={card.filename}
                    className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#d4af37] text-[#090a0d] font-semibold shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    <span>Pobierz</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

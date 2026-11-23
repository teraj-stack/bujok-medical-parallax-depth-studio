import {
  CameraMotionPreset,
  SceneAsset,
  VisualEffectSettings,
  VisualFxPreset,
  VisualFxPresetId,
} from '../types/studio';

export const VISUAL_FX_PRESETS: VisualFxPreset[] = [
  {
    id: 'cinematic_gold',
    name: 'Kinowy Szampan (Domyślny)',
    description: 'Ciepła korekcja barwna złotej godziny, subtelna winieta optyczna i delikatne rozmycie krawędzi.',
    settings: {
      activeFxPreset: 'cinematic_gold',
      blurIntensity: 18,
      vignetteIntensity: 34,
      colorGrading: 62,
      filmGrain: 14,
      warmGlow: 76,
      photorealism: 90,
    },
  },
  {
    id: 'leica_soft_dof',
    name: 'Optyka Leica 35mm (Głębia DOF)',
    description: 'Wyraźne optyczne rozmycie planów skrajnych, głęboka winieta i organiczny kontrast.',
    settings: {
      activeFxPreset: 'leica_soft_dof',
      blurIntensity: 56,
      vignetteIntensity: 58,
      colorGrading: 74,
      filmGrain: 26,
      warmGlow: 68,
      photorealism: 88,
    },
  },
  {
    id: 'nordic_clean',
    name: 'Krystaliczny Modernizm',
    description: 'Neutralna korekcja barwna, maksymalna ostrość architektury i minimalna winieta.',
    settings: {
      activeFxPreset: 'nordic_clean',
      blurIntensity: 6,
      vignetteIntensity: 16,
      colorGrading: 35,
      filmGrain: 4,
      warmGlow: 42,
      photorealism: 96,
    },
  },
  {
    id: 'analog_35mm',
    name: 'Taśma Analogowa 35mm',
    description: 'Szlachetne ziarno filmowe, miękki światłocień w cieniach i kinowa korekcja barw.',
    settings: {
      activeFxPreset: 'analog_35mm',
      blurIntensity: 28,
      vignetteIntensity: 48,
      colorGrading: 82,
      filmGrain: 64,
      warmGlow: 80,
      photorealism: 82,
    },
  },
  {
    id: 'vivid_hdr',
    name: 'Studyjny Kontrast PBR',
    description: 'Wzmocnione nasycenie detali marmuru i refleksów posadzki bez rozmycia.',
    settings: {
      activeFxPreset: 'vivid_hdr',
      blurIntensity: 0,
      vignetteIntensity: 24,
      colorGrading: 88,
      filmGrain: 8,
      warmGlow: 85,
      photorealism: 98,
    },
  },
];

export const PRESET_SCENES: SceneAsset[] = [
  {
    id: 'bujok_sculpture_day',
    title: 'Lobby Bujok Medical — Wersja z Rzeźbą Studyjną',
    subtitle: 'Panorama Warszawy (Złota 44 i PKiN) · Słoneczne popołudnie · Polerowany trawertyn i marmur',
    imageUrl: '/assets/aistudio/1_1a874f8c.jpg',
    windowBounds: {
      xMin: 0.04,
      xMax: 0.51,
      yMin: 0.02,
      yMax: 0.78,
    },
    defaultSettings: {
      depthIntensity: 74,
      cameraMotion: 0,
      photorealism: 88,
      warmGlow: 72,
      windowLightIntensity: 76,
      motionPreset: 'static_studio',
      show3DProps: true,
      activeFxPreset: 'cinematic_gold',
      blurIntensity: 18,
      vignetteIntensity: 34,
      colorGrading: 62,
      filmGrain: 14,
    },
    defaultNarrative: {
      title: 'Ponad Rytmem Miasta — Chwila Spokoju w Sercu Warszawy',
      toneLabel: 'Luksus i Spokój Pacjenta',
      leadHook:
        'Wysoko nad tętniącym życiem centrum Warszawy światło zachodzącego słońca przenika przez monumentalne przeszklenia, wyciszając zgiełk metropolii.',
      storyBody:
        'Wchodząc do przestronnego lobby Bujok Medical, pacjent zostawia za szybą panoramę stolicy — smukły żagiel Złotej 44 i historyczną sylwetkę Pałacu Kultury. Wewnątrz panuje architektoniczna cisza i harmonia. Ciepły blask pierścieniowego żyrandola oświetla żyłkowany marmur Calacatta i polerowaną posadzkę, a cztery podświetlone tafle specjalizacji — od proktologii i flebologii po chirurgię i medycynę estetyczną — obiecują precyzyjną opiekę na najwyższym poziomie.',
      voiceoverTagline:
        'Bujok Medical w Warszawie — tam, gdzie zaawansowana medycyna spotyka architektoniczną ciszę i światło.',
      frameCaptions: [
        'Kadr 1: Ekspozycja otwierająca przestronne lobby skąpane w popołudniowym słońcu Warszawy.',
        'Kadr 2: Naturalne światło dzienne zza wielkoformatowych okien podkreśla optyczną głębię ostrości.',
        'Kadr 3: Wyraziste odbicia PBR wydobywają szlachetną strukturę marmurowej recepcji i rzeźby.',
        'Kadr 4: Ciepła poświata złotej godziny spaja nowoczesną chirurgię z kojącym spokojem wnętrza.',
      ],
    },
    curatedPrompts: [
      {
        id: 'bm1_depth_lighting',
        title: 'Wielopłaszczyznowa Głębia Optyczna i Światło Słoneczne',
        category: 'depth_lighting',
        subtitle: 'Wydobycie perspektywy powietrznej panoramy Warszawy oraz plastyki światła we wnętrzu',
        promptPL:
          'Nadaj scenie wyrazistą głębię przestrzenną poprzez naturalne zróżnicowanie ostrości oraz plastyki oświetlenia pomiędzy pierwszym planem lobby (sofa wypoczynkowa, donica z palmą, kamienna posadzka), bryłą marmurowej recepcji a dalekim planem panoramy Warszawy (Złota 44 i Pałac Kultury). Zachowaj autentyczne refleksy promieni słonecznych na szybach i miękki gradient złotego nieba.',
        promptEN:
          'Enhance spatial architectural depth across the luxury Bujok Medical clinic interior by balancing foreground lounge elements, the curved Calacatta marble reception desk, and the distant Warsaw skyline outside the floor-to-ceiling windows. Preserve natural glass reflections and golden hour atmospheric light.',
        recommendedSettings: {
          depthIntensity: 78,
          cameraMotion: 0,
          photorealism: 88,
          warmGlow: 76,
          windowLightIntensity: 82,
          motionPreset: 'static_studio',
        },
      },
      {
        id: 'bm1_photorealism_pbr',
        title: 'Fotorealizm PBR: Marmur Calacatta, Mosiądz i Podświetlane Szkło',
        category: 'photorealism',
        subtitle: 'Wzmocnienie mikro-kontrastu żyłkowania marmuru, odbić w posadzce i poświaty 4 paneli',
        promptPL:
          'Wzbogać fotorealizm materiałów architektonicznych wnętrza: wyostrz strukturę żyłkowania kamienia na zaoblonej ladzie recepcyjnej z podświetlanym logo BUJOK MEDICAL, pogłębij lustrzane odbicia promieni słonecznych na wielkoformatowej posadzce gresowej oraz dodaj miękką dyfuzję światła LED wokół wiszącego pierścienia sufitowego i czterech matowych tafli szkła (Proktologia, Flebologia, Chirurgia ogólna, Medycyna estetyczna).',
        promptEN:
          'Enhance architectural PBR photorealism: crisp Calacatta marble veining on the curved reception counter with warm backlit BUJOK MEDICAL emblem and sculptural silver ornament, anisotropic brushed brass reflections on the round coffee table, physically accurate sunbeam speculars across the polished stone floor, and soft warm rim glow on the suspended ring chandelier and four frosted glass specialty panels.',
        recommendedSettings: {
          depthIntensity: 80,
          cameraMotion: 0,
          photorealism: 96,
          warmGlow: 82,
          colorGrading: 72,
          vignetteIntensity: 28,
          motionPreset: 'static_studio',
        },
      },
      {
        id: 'bm1_optical_dof_fx',
        title: 'Optyka Studyjna 35mm: Selektywna Ostrość DOF, Winieta i Ziarno',
        category: 'camera_motion',
        subtitle: 'Szlachetna plastyka obiektywu stałoogniskowego z filmową korekcją barwną LUT',
        promptPL:
          'Zastosuj optyczną charakterystykę jasnego obiektywu architektonicznego 35mm f/2.0: utrzymaj krystaliczną ostrość na centralnej strefie marmurowej recepcji oraz czterech podświetlonych panelach specjalizacji, wprowadzając miękkie rozmycie optyczne (DOF) na krawędziach kadru, subtelną winietę oraz organiczną strukturę taśmy 35mm.',
        promptEN:
          'Apply a 35mm f/2.0 architectural prime lens optical profile: razor-sharp focus on the Calacatta marble reception counter and backlit medical specialty panels, creamy peripheral depth of field, subtle optical vignetting, warm golden-hour color grading, and fine 35mm film grain.',
        recommendedSettings: {
          depthIntensity: 76,
          cameraMotion: 0,
          photorealism: 90,
          warmGlow: 74,
          blurIntensity: 36,
          vignetteIntensity: 44,
          filmGrain: 22,
          motionPreset: 'static_studio',
        },
      },
      {
        id: 'bm1_sequence_4frames',
        title: 'Sekwencja 4 Wyrenderowanych Kadrów do Produkcji Wideo MP4',
        category: 'sequence_4',
        subtitle: 'Kompletny scenariusz 4 faz oświetlenia i głębi gotowych do kompilacji wideo',
        promptPL:
          'Wygeneruj i wyrenderuj spójną sekwencję 4 statycznych kadrów o progresywnej plastyce światła na potrzeby kompilacji wideo: (1) Kadr 01 — ekspozycja bazowa z pełną klarownością architektury i panoramy Warszawy; (2) Kadr 02 — wzmocnione światło dzienne w oknach i selektywna głębia ostrości DOF; (3) Kadr 03 — wyeksponowane odbicia PBR na marmurze Calacatta i kamiennej posadzce; (4) Kadr 04 — ciepła iluminacja złotej godziny 2700K z pełnym gradingiem kinowym.',
        promptEN:
          'Render a locked-architecture 4-keyframe lighting progression for video compilation: Frame 1 Crisp daylight architectural baseline; Frame 2 Enhanced window light bloom and selective optical depth of field; Frame 3 Boosted PBR specular reflections on polished floor and Calacatta marble desk; Frame 4 Golden-hour 2700K warm illumination with filmic color grading.',
        recommendedSettings: {
          depthIntensity: 84,
          cameraMotion: 0,
          photorealism: 94,
          warmGlow: 86,
          motionPreset: 'static_studio',
        },
      },
    ],
  },
  {
    id: 'bujok_floral_dusk',
    title: 'Lobby Bujok Medical — Wersja z Kompozycją Florystyczną',
    subtitle: 'Panorama Warszawy o zmierzchu · Ciepłe oświetlenie pierścieniowe · Głębokie odbicia w posadzce',
    imageUrl: '/assets/aistudio/Nowoczesne_lobby_kliniki_z_panelem_medycyny_estetycznej_da256202.png',
    windowBounds: {
      xMin: 0.05,
      xMax: 0.51,
      yMin: 0.02,
      yMax: 0.77,
    },
    defaultSettings: {
      depthIntensity: 78,
      cameraMotion: 0,
      photorealism: 92,
      warmGlow: 84,
      windowLightIntensity: 84,
      motionPreset: 'static_studio',
      show3DProps: true,
      activeFxPreset: 'cinematic_gold',
      blurIntensity: 20,
      vignetteIntensity: 38,
      colorGrading: 68,
      filmGrain: 16,
    },
    defaultNarrative: {
      title: 'Złoty Zmierzch nad Warszawą — Estetyka Zaufania i Precyzji',
      toneLabel: 'Architektura i Światło Warszawy',
      leadHook:
        'Gdy nad warszawskim śródmieściem zapada błękitny zmierzch, rozświetlone okna wieżowców tworzą szlachetne tło dla kameralnego wnętrza kliniki.',
      storyBody:
        'W miękkim świetle wieczoru lobby Bujok Medical przypomina prywatny salon sztuki współczesnej. Złoty okrąg lampy sufitowej odbija się w lustrzanej tafli kamiennej posadzki, prowadząc wzrok ku zaoblonej recepcji z naturalnego kamienia i subtelnej kompozycji florystycznej. Za wysokimi oknami lśnią światła Pałacu Kultury i wieżowców, podkreślając kontrast między energią wielkiego miasta a pełnym skupienia, kojącym komfortem wewnątrz kliniki.',
      voiceoverTagline:
        'Nowoczesna chirurgia i medycyna estetyczna w sercu Warszawy — zaprojektowana wokół Twojego spokoju.',
      frameCaptions: [
        'Kadr 1: Błękitna godzina za oknami kliniki kontrastuje z bursztynowym ciepłem recepcji.',
        'Kadr 2: Rozświetlona iglica PKiN i fasada Złotej 44 dopełniają kompozycję przeszklonej ściany.',
        'Kadr 3: Lustrzana posadzka zwielokrotnia blask pierścienia świetlnego i czterech paneli specjalizacji.',
        'Kadr 4: Harmonia detalu — kwiatowa kompozycja, ryflowane drewno i ponadczasowy marmur.',
      ],
    },
    curatedPrompts: [
      {
        id: 'bm2_depth_lighting',
        title: 'Głębia Wieczornej Panoramy Warszawy i Światłocień Wnętrza',
        category: 'depth_lighting',
        subtitle: 'Wielopłaszczyznowa ostrość i gra świateł biurowców Złotej 44 oraz Pałacu Kultury',
        promptPL:
          'Wzbogać głębię przestrzenną wieczornego ujęcia lobby. Wydobądź plastykę oświetlenia wieżowców w centrum Warszawy (Złota 44, PKiN z rozświetloną iglicą oraz budynki na linii horyzontu) z realistyczną perspektywą powietrzną i miękkim przejściem tonalnym granatowo-złotego nieba o zmierzchu.',
        promptEN:
          'Enhance the three-dimensional optical depth and atmospheric lighting of the dusk Warsaw skyline through the floor-to-ceiling windows while keeping the reception desk floral vase, beige lounge seating, and wood-slatted feature wall richly illuminated in the foreground.',
        recommendedSettings: {
          depthIntensity: 80,
          cameraMotion: 0,
          photorealism: 90,
          warmGlow: 84,
          windowLightIntensity: 88,
          motionPreset: 'static_studio',
        },
      },
      {
        id: 'bm2_photorealism_pbr',
        title: 'Lustrzana Posadzka, Ryflowane Drewno i Szklany Wazon z Kwiatami',
        category: 'photorealism',
        subtitle: 'Realistyczne odbicia pierścienia LED, głębia ryflowanej ściany i ostrość detali',
        promptPL:
          'Podkreśl kontrast pomiędzy ciepłym wnętrzem kliniki a chłodniejszym błękitem wieczornego nieba za oknem. Wzmocnij klarowność odbić świetlnych na polerowanej posadzce kamiennej, wydobądź trójwymiarowy światłocień pionowych lameli drewnianych za czterema szklanymi tablicami specjalizacji oraz dodaj subtelny blask na szklanym wazonie z kompozycją kwiatową po prawej stronie lady.',
        promptEN:
          'Maximize contrast between the warm amber interior lighting and cool twilight sky outside. Sharpen specular floor reflections, deepen ambient occlusion within the vertical walnut wood slats behind the four backlit glass medical panels, and add realistic translucency to the floral arrangement on the right edge of the marble counter.',
        recommendedSettings: {
          depthIntensity: 84,
          cameraMotion: 0,
          photorealism: 98,
          warmGlow: 88,
          colorGrading: 78,
          vignetteIntensity: 40,
          motionPreset: 'static_studio',
        },
      },
      {
        id: 'bm2_sequence_4frames',
        title: 'Sekwencja 4 Kadrów Wieczornych do Kompilacji Wideo MP4',
        category: 'sequence_4',
        subtitle: 'Cztery fazy wieczornej iluminacji gotowe do wyrenderowania wideo z sekwencji',
        promptPL:
          'Wygeneruj 4 spójne kadry wieczornej iluminacji lobby do kompilacji wideo: (1) Kadr 01 — klarowny zmierzch nad Warszawą i naturalny rysunek marmuru; (2) Kadr 02 — optyczne rozmycie tła DOF eksponujące recepcję i kompozycję kwiatową; (3) Kadr 03 — intensywne odbicia złotego pierścienia LED w kamiennej posadzce; (4) Kadr 04 — finałowa, głęboka poświata wieczorna z winietą i ziarnem 35mm.',
        promptEN:
          'Generate 4 evening illumination keyframes for video compilation: Frame 1 Crisp twilight skyline and marble detail; Frame 2 Selective optical DOF highlighting the reception and floral arrangement; Frame 3 Rich golden LED ring reflections across the stone floor; Frame 4 Deep evening amber glow with optical vignette and 35mm grain.',
        recommendedSettings: {
          depthIntensity: 82,
          cameraMotion: 0,
          photorealism: 94,
          warmGlow: 88,
          motionPreset: 'static_studio',
        },
      },
    ],
  },
];

export function encodeCompactShareLink(
  sceneId: string,
  settings: VisualEffectSettings,
  promptId?: string
): string {
  const sCode = sceneId === 'bujok_floral_dusk' ? '2' : '1';
  const mMap: Record<CameraMotionPreset, string> = {
    dolly_in: 'd',
    cinematic_pan: 'c',
    orbital_drift: 'o',
    breathing_cinema: 'b',
    static_studio: 's',
  };
  const fxMap: Record<VisualFxPresetId, string> = {
    cinematic_gold: 'c',
    leica_soft_dof: 'l',
    nordic_clean: 'n',
    analog_35mm: 'a',
    vivid_hdr: 'v',
  };

  const mCode = mMap[settings.motionPreset] || 's';
  const fxCode = fxMap[settings.activeFxPreset] || 'c';
  const pFlag = settings.show3DProps ? '1' : '0';

  const compactParams = new URLSearchParams();
  compactParams.set(
    'k',
    [
      sCode,
      Math.round(settings.depthIntensity),
      0,
      Math.round(settings.photorealism),
      Math.round(settings.warmGlow),
      mCode,
      pFlag,
      fxCode,
      Math.round(settings.blurIntensity),
      Math.round(settings.vignetteIntensity),
      Math.round(settings.colorGrading),
      Math.round(settings.filmGrain),
      Math.round(settings.windowLightIntensity),
    ].join('.')
  );
  if (promptId) {
    compactParams.set('r', promptId);
  }

  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#${compactParams.toString()}`;
}

export function decodeCompactShareLink(hash: string): {
  sceneId?: string;
  settings?: Partial<VisualEffectSettings>;
  promptId?: string;
} | null {
  if (!hash || hash.length < 3) return null;
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const k = params.get('k');
  if (!k) return null;

  const parts = k.split('.');
  if (parts.length < 7) return null;

  const sceneId = parts[0] === '2' ? 'bujok_floral_dusk' : 'bujok_sculpture_day';
  const fxRev: Record<string, VisualFxPresetId> = {
    c: 'cinematic_gold',
    l: 'leica_soft_dof',
    n: 'nordic_clean',
    a: 'analog_35mm',
    v: 'vivid_hdr',
  };

  return {
    sceneId,
    promptId: params.get('r') || undefined,
    settings: {
      depthIntensity: Number(parts[1]) ?? 75,
      cameraMotion: 0,
      photorealism: Number(parts[3]) ?? 88,
      warmGlow: Number(parts[4]) ?? 76,
      motionPreset: 'static_studio',
      show3DProps: parts[6] !== '0',
      activeFxPreset: fxRev[parts[7]] || 'cinematic_gold',
      blurIntensity: parts[8] !== undefined ? Number(parts[8]) : 18,
      vignetteIntensity: parts[9] !== undefined ? Number(parts[9]) : 34,
      colorGrading: parts[10] !== undefined ? Number(parts[10]) : 62,
      filmGrain: parts[11] !== undefined ? Number(parts[11]) : 14,
      windowLightIntensity: parts[12] !== undefined ? Number(parts[12]) : 78,
    },
  };
}

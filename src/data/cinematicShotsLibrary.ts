import {
  CameraBlockingConfig,
  CameraRigKeyframePose,
  CinematicNarrativeShotPreset,
  FocalLengthOption,
} from '../types/studio';

export const ARCHITECTURAL_ANCHOR_TARGETS: {
  id: string;
  label: string;
  point: { x: number; y: number; z: number };
}[] = [
  {
    id: 'reception_desk',
    label: 'Marmurowa recepcja Calacatta i logo Bujok Medical',
    point: { x: 1.45, y: 1.15, z: -2.1 },
  },
  {
    id: 'specialty_panels',
    label: '4 podświetlane panele specjalizacji medycznych',
    point: { x: 1.55, y: 2.15, z: -3.95 },
  },
  {
    id: 'warsaw_skyline',
    label: 'Przeszklona fasada i panorama wieżowców Warszawy',
    point: { x: -4.9, y: 2.1, z: -1.4 },
  },
  {
    id: 'ring_chandelier',
    label: 'Złoty pierścień świetlny LED i oś sufitu',
    point: { x: 1.35, y: 3.15, z: -1.8 },
  },
  {
    id: 'lounge_zone',
    label: 'Strefa wypoczynkowa z sofą i stolikiem mosiężnym',
    point: { x: -2.4, y: 0.9, z: 1.45 },
  },
];

export function focalLengthToVerticalFov(focalMm: FocalLengthOption): number {
  // Full-frame 36x24mm sensor vertical height = 24mm
  const sensorHeightMm = 24;
  const fovRad = 2 * Math.atan(sensorHeightMm / (2 * focalMm));
  return Math.round((fovRad * 180) / Math.PI);
}

export function focalLengthToHorizontalFov(focalMm: FocalLengthOption): number {
  const sensorWidthMm = 36;
  const fovRad = 2 * Math.atan(sensorWidthMm / (2 * focalMm));
  return Math.round((fovRad * 180) / Math.PI);
}

export function computeAnglesToTarget(
  from: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): { panDeg: number; tiltDeg: number } {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dz = target.z - from.z;
  const horizDist = Math.max(0.001, Math.hypot(dx, dz));
  // In Three.js camera looks down -Z when rotation.y = 0.
  // Vector (dx, dz): yaw around Y so -Z aligns with (dx, dz) => atan2(-dx, -dz)
  const yawRad = Math.atan2(-dx, -dz);
  const pitchRad = Math.atan2(dy, horizDist);
  return {
    panDeg: Math.round((yawRad * 180) / Math.PI),
    tiltDeg: Math.round((pitchRad * 180) / Math.PI),
  };
}

/**
 * Standardized library of narrative-opening shots proven in modern cinema and prestige television
 * to spark curiosity, build intrigue, and sustain viewer attention from the first second.
 */
export const CINEMATIC_NARRATIVE_SHOTS: CinematicNarrativeShotPreset[] = [
  {
    id: 'occlusion_reveal_fincher',
    code: '01 · FOREGROUND OCCLUSION REVEAL',
    titlePL: 'Odsłonięcie zza Przesłony Pierwszego Planu (Efekt Tajemnicy)',
    titleEN: 'Foreground Architectural Occlusion Reveal',
    filmGrammarCategory: 'Odsłonięcie Narracyjne',
    attentionMechanismPL:
      'Wykorzystuje psychologiczną lukę informacyjną (Loewenstein Information Gap): częściowe przesłonięcie kadru w pierwszej sekundzie zmusza wzrok widza do aktywnego wypatrywania tego, co wyłoni się zza filaru i roślinności.',
    referenceCinemaExamples:
      'Styl D. Finchera / R. Deakinsa (wprowadzenia do przestrzeni o wysokim prestiżu)',
    retentionMetricNote: 'Wysoka retencja pierwszych 3 sekund · Stopniowe odkrywanie planu',
    directorCommunicationNotePL:
      'Wózek kamerowy rusza zza lewego filaru wejściowego (X: -3.9m → -0.8m) na obiektywie 35mm, płynnie odsłaniając najpierw strefę lounge, a następnie pełną bryłę marmurowej recepcji i 4 panele.',
    promptPL:
      'Filmowe ujęcie wprowadzające typu Foreground Occlusion Reveal (obiektyw 35mm f/2.0): kamera wyłania się płynnym ruchem boczno-przednim zza nieostrego pierwszego planu strefy wejściowej, stopniowo odkrywając oświetloną złotą godziną marmurową recepcję Bujok Medical i 4 podświetlane panele specjalizacji.',
    promptEN:
      'Cinematic foreground occlusion reveal opening shot, 35mm prime lens f/2.0, smooth lateral-forward dolly emerging from behind soft-focus architectural foreground column to reveal the Calacatta marble reception desk and glowing medical panels at golden hour.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Intryga): Częściowe przesłonięcie pierwszego planu miękkim cieniem filaru i zieleni, w głębi majaczy złoty blask recepcji.',
      'Kadr 02 (33% — Wyłonienie): Kamera mija krawędź przesłony, odsłaniając panoramę Warszawy za fasadą i strefę wypoczynkową.',
      'Kadr 03 (67% — Otwarcie osi): Pełne odsłonięcie monolitycznej lady z marmuru Calacatta i złotego pierścienia sufitowego LED.',
      'Kadr 04 (100% — Domknięcie kompozycji): Czysty, zbalansowany kadr reżyserski z ostrością na logo Bujok Medical i 4 panelach specjalizacji.',
    ],
    blocking: {
      startPose: { x: -3.95, y: 1.42, z: 4.35, panDeg: -26, tiltDeg: 2, rollDeg: 0 },
      endPose: { x: -0.75, y: 1.48, z: 2.65, panDeg: -22, tiltDeg: 2, rollDeg: 0 },
      curveArcOffset: 0.45,
      focalLengthMm: 35,
      lockFramingToTarget: true,
      targetSubjectLabel: 'Marmurowa recepcja Calacatta i logo Bujok Medical',
      targetPoint: { x: 1.45, y: 1.25, z: -2.1 },
      durationSec: 6,
      easingStyle: 'slow_reveal_out',
      smoothingFactor: 72,
    },
  },
  {
    id: 'one_point_axial_push',
    code: '02 · SYMMETRIC AXIAL PUSH-IN',
    titlePL: 'Hipnotyczny Najazd Osiowy w Punkt Zbiegu (One-Point Perspective)',
    titleEN: 'Hypnotic One-Point Architectural Push-In',
    filmGrammarCategory: 'Symetria Hipnotyczna',
    attentionMechanismPL:
      'Symetria zbieżna i powolny, nieubłagany ruch do przodu wzdłuż osi optycznej wywołują efekt tunelowego skupienia uwagi — widz podświadomie oczekuje punktu kulminacyjnego w centrum kadru.',
    referenceCinemaExamples:
      'Styl P. Sorrentino (*The Young Pope*) / S. Kubricka / kampanie marek luksusowych',
    retentionMetricNote: 'Magnetyczne skupienie centralne · Autorytet i harmonia',
    directorCommunicationNotePL:
      'Idealnie prostoliniowa jazda na wprost (dolly push-in w osi Z: +4.6m → +1.3m) na ogniskowej 35mm, zero panoramowania bocznego, rygorystyczny pion i poziom (Roll 0°).',
    promptPL:
      'Hipnotyczne ujęcie otwierające One-Point Push-In (35mm): idealnie wycentrowany, powolny najazd osiowy w kierunku marmurowej recepcji pod złotym pierścieniem LED, symetryczne linie refleksów na kamiennej posadzce prowadzące wzrok widza w głąb lobby.',
    promptEN:
      'Hypnotic one-point perspective dolly push-in, 35mm cinema prime, dead-center architectural framing advancing smoothly toward the illuminated Calacatta marble reception and golden halo chandelier, floor reflections converging.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Szeroka symetria): Monumentalne ujęcie całego lobby z wyraźnymi liniami zbiegu posadzki i sufitu.',
      'Kadr 02 (33% — Zacieśnienie planu): Płynny najazd osiowy wzmacnia obecność złotego pierścienia LED nad recepcją.',
      'Kadr 03 (67% — Skupienie na bryle): Faktura marmuru Calacatta i 4 podświetlane panele wypełniają centralne pole widzenia.',
      'Kadr 04 (100% — Punkt kulminacyjny): Intymny, prestiżowy portret strefy recepcyjnej z miękką głębią ostrości 35mm.',
    ],
    blocking: {
      startPose: { x: 1.15, y: 1.52, z: 4.65, panDeg: -3, tiltDeg: 2, rollDeg: 0 },
      endPose: { x: 1.35, y: 1.44, z: 1.25, panDeg: -2, tiltDeg: 3, rollDeg: 0 },
      curveArcOffset: 0.0,
      focalLengthMm: 35,
      lockFramingToTarget: true,
      targetSubjectLabel: 'Marmurowa recepcja Calacatta i logo Bujok Medical',
      targetPoint: { x: 1.45, y: 1.35, z: -2.2 },
      durationSec: 6,
      easingStyle: 'smooth_cinema',
      smoothingFactor: 65,
    },
  },
  {
    id: 'lateral_tracking_discovery',
    code: '03 · LATERAL TRACKING DISCOVERY',
    titlePL: 'Trawers Boczny Odkrywający Panoramę i Wnętrze (Lateral Truck)',
    titleEN: 'Prestige Lateral Tracking Spatial Discovery',
    filmGrammarCategory: 'Odsłonięcie Narracyjne',
    attentionMechanismPL:
      'Ruch równoległy do sceny ze stałym kątem obserwacji stopniowo wprowadza nowe informacje wizualne z prawej krawędzi kadru — utrzymuje stałą stymulację poznawczą bez męczenia wzroku.',
    referenceCinemaExamples:
      'Współczesne kino autorskie A24 / seriale Apple TV+ (*The Morning Show*, *Severance*)',
    retentionMetricNote: 'Płynna narracja przestrzenna · Dialog miasta z wnętrzem',
    directorCommunicationNotePL:
      'Jazda boczna wózkiem (truck left-to-right z X: -2.8m do X: +1.9m) na wysokości 1.45m z jednoczesnym utrzymaniem osi kadrowania na styku okien i recepcji (ogniskowa 24mm).',
    promptPL:
      'Profesjonalny trawers boczny kamery (Lateral Tracking Shot, 24mm): płynny przejazd równoległy od strefy przeszkleń z panoramą Warszawy w stronę drewnianej ściany i czterech podświetlanych paneli specjalizacji medycznych.',
    promptEN:
      'Smooth lateral tracking shot, 24mm wide cinema lens, gliding horizontally across the luxury clinic lobby from the floor-to-ceiling Warsaw skyline windows toward the warm walnut wall and backlit specialty panels.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Kontekst stolicy): Dominacja wysokich przeszkleń i wieżowców Warszawy w ciepłym świetle popołudnia.',
      'Kadr 02 (33% — Dialog planów): W kadr wchodzi strefa wypoczynkowa oraz lewe skrzydło marmurowej lady recepcyjnej.',
      'Kadr 03 (67% — Serce kliniki): Centralna ekspozycja logo Bujok Medical pod świetlną obręczą sufitową.',
      'Kadr 04 (100% — Specjalizacje): Pełne wyeksponowanie 4 szklanych tafli specjalizacji i korytarza gabinetów.',
    ],
    blocking: {
      startPose: { x: -2.75, y: 1.45, z: 3.35, panDeg: -28, tiltDeg: 3, rollDeg: 0 },
      endPose: { x: 1.95, y: 1.45, z: 3.15, panDeg: 6, tiltDeg: 3, rollDeg: 0 },
      curveArcOffset: 0.35,
      focalLengthMm: 24,
      lockFramingToTarget: true,
      targetSubjectLabel: 'Marmurowa recepcja Calacatta i logo Bujok Medical',
      targetPoint: { x: 0.9, y: 1.55, z: -2.2 },
      durationSec: 6,
      easingStyle: 'smooth_cinema',
      smoothingFactor: 60,
    },
  },
  {
    id: 'intimate_to_monumental_pullback',
    code: '04 · PULL-BACK CONTEXT REVEAL',
    titlePL: 'Odwrócona Skala: Od Zbliżenia Detalu do Monumentu (Pull-Back)',
    titleEN: 'Intimate Detail to Monumental Pull-Back Reveal',
    filmGrammarCategory: 'Kontekst i Skala',
    attentionMechanismPL:
      'Zaczyna od intrygującej zagadki wizualnej (bliska faktura kamienia i światła na obiektywie 50mm), po czym odjazd kamery redefiniuje scenę, ukazując ogrom przeszklonego lobby ponad Warszawą.',
    referenceCinemaExamples:
      'Otwarcia odcinków HBO / D. Villeneuve — budowanie skali od mikro do makro',
    retentionMetricNote: 'Efekt „Aha!” w połowie ujęcia · Silne zaangażowanie poznawcze',
    directorCommunicationNotePL:
      'Start blisko marmurowej lady (Z: +0.35m) z lekkim kątem bocznym, odjazd tyłem (dolly out) do szerokiego planu ogólnego (Z: +4.55m, X: -1.85m) z delikatnym otwarciem panoramy na okna.',
    promptPL:
      'Intrygujące ujęcie otwierające Pull-Back Reveal (50mm): początek na bliskim detalu żyłkowania marmuru Calacatta i złotych refleksów recepcji, płynny odjazd kamery wstecz odsłaniający monumentalne lobby kliniki i panoramę Warszawy za oknem.',
    promptEN:
      'Intriguing dolly pull-back reveal shot, 50mm prime lens, starting close on the luminous Calacatta marble veins and brass reflections, smoothly pulling back to unveil the expansive glass-walled Warsaw clinic lobby.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Zagadka detalu): Bliskie skupienie na szlachetnym marmurze, rzeźbie i ciepłym świetle 2700K przy małej głębi ostrości.',
      'Kadr 02 (33% — Poszerzenie kontekstu): Odjazd kamery ujawnia pełny kształt monolitycznej recepcji i podświetlane ikony medyczne.',
      'Kadr 03 (67% — Wejście światła): Z lewej strony kadru otwiera się monumentalna przeszklona fasada ze światłem zachodu.',
      'Kadr 04 (100% — Pełna panorama): Spektakularny plan ogólny łączący architekturę wnętrza z sylwetką Warszawy.',
    ],
    blocking: {
      startPose: { x: 1.2, y: 1.32, z: 0.45, panDeg: -4, tiltDeg: 4, rollDeg: 0 },
      endPose: { x: -1.85, y: 1.62, z: 4.55, panDeg: -19, tiltDeg: 2, rollDeg: 0 },
      curveArcOffset: -0.4,
      focalLengthMm: 50,
      lockFramingToTarget: true,
      targetSubjectLabel: 'Marmurowa recepcja Calacatta i logo Bujok Medical',
      targetPoint: { x: 0.95, y: 1.4, z: -2.1 },
      durationSec: 6,
      easingStyle: 'smooth_cinema',
      smoothingFactor: 70,
    },
  },
  {
    id: 'crane_pedestal_horizon_rise',
    code: '05 · CRANE ELEVATION REVEAL',
    titlePL: 'Wzniesienie Żurawia znad Odbić Posadzki ku Panoramie (Crane Rise)',
    titleEN: 'Low-Reflection Crane Rise to Skyline Horizon',
    filmGrammarCategory: 'Perspektywa Premium TV',
    attentionMechanismPL:
      'Zmiana wysokości punktu widzenia (od niskich odbić w polerowanym kamieniu do wysokiej perspektywy architektonicznej) wywołuje fizyczne poczucie wznoszenia i prestiżu.',
    referenceCinemaExamples:
      'Sekwencje otwierające *Succession*, *Billions* oraz filmy architektoniczne',
    retentionMetricNote: 'Silny ładunek emocjonalny · Poczucie wzniosłości i spokoju',
    directorCommunicationNotePL:
      'Ruch pionowy kranu/kolumny (Pedestal/Jib Up z Y: 0.62m do Y: 2.35m) połączony z subtelnym ruchem do przodu i korektą pochylenia kamery (Tilt z +11° na -5°).',
    promptPL:
      'Ujęcie kranowe Crane Elevation Reveal (24mm): start tuż nad polerowaną posadzką pełną złotych odbić zachodzącego słońca, płynne wzniesienie kamery ku górze z pochyleniem (tilt down) ukazującym całe lobby i wieżowce Warszawy.',
    promptEN:
      'Cinematic crane jib elevation shot, 24mm lens, rising smoothly from low specular floor reflections up toward ceiling height with subtle downward tilt to encompass the entire luxury medical lobby and Warsaw skyline.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Lustro posadzki): Niska perspektywa eksponująca długie pasma słonecznych refleksów na kamiennej podłodze.',
      'Kadr 02 (33% — Wznoszenie): Kamera unosi się powyżej linii stolika i sofy, otwierając widok na bryłę recepcji.',
      'Kadr 03 (67% — Poziom wzroku): Harmonijne połączenie panoramy miasta za oknem z podświetlonymi taflami specjalizacji.',
      'Kadr 04 (100% — Perspektywa mistrzowska): Wysokie, klarowne spojrzenie z poziomu złotego pierścienia LED na całą przestrzeń kliniki.',
    ],
    blocking: {
      startPose: { x: -1.45, y: 0.62, z: 3.9, panDeg: -16, tiltDeg: 11, rollDeg: 0 },
      endPose: { x: -0.65, y: 2.35, z: 2.35, panDeg: -12, tiltDeg: -5, rollDeg: 0 },
      curveArcOffset: 0.15,
      focalLengthMm: 24,
      lockFramingToTarget: false,
      targetSubjectLabel: 'Marmurowa recepcja Calacatta i logo Bujok Medical',
      targetPoint: { x: 1.1, y: 1.5, z: -2.1 },
      durationSec: 6,
      easingStyle: 'smooth_cinema',
      smoothingFactor: 75,
    },
  },
  {
    id: 'orbital_anchor_arc_35mm',
    code: '06 · ORBITAL ANCHOR ARC',
    titlePL: 'Orbitalny Łuk Skupienia wokół Recepcji (Slow Cinema Arc)',
    titleEN: '35mm Orbital Arc Around Focal Anchor',
    filmGrammarCategory: 'Symetria Hipnotyczna',
    attentionMechanismPL:
      'Zataczanie łuku wokół nieruchomego punktu centralnego sprawia, że główny bohater sceny pozostaje stabilnie w mocnym punkcie kadru, podczas gdy tło płynnie rotuje — mózg odbiera pełną trójwymiarowość bryły.',
    referenceCinemaExamples:
      'Styl M. Ballhausa / współczesne spoty wizerunkowe klinik i architektury hi-end',
    retentionMetricNote: 'Pełna plastyka 3D bryły · Dynamiczna relacja z tłem okien',
    directorCommunicationNotePL:
      'Jazda po łuku (Arc Dolly, krzywizna +1.15m) z lewej strony (X: -2.4m, Z: 2.9m) na prawą stronę osi (X: +2.6m, Z: 2.5m) z ciągłym ryglowaniem kadrowania (Lock-On) na marmurowej recepcji.',
    promptPL:
      'Płynne ujęcie po łuku Orbital Arc (35mm): kamera okrąża po szerokim łuku strefę recepcyjną Bujok Medical, utrzymując centrum kadru na marmurowym monogramie, podczas gdy w tle zmienia się kąt padania światła z okien.',
    promptEN:
      'Slow cinematic orbital arc shot, 35mm prime lens, curving gracefully around the sculpted Calacatta marble reception desk while maintaining locked center framing as golden window light shifts across surfaces.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Profil z oknami): Ujęcie recepcji z lewego skosu z silnym kontrapunktem panoramy Warszawy.',
      'Kadr 02 (33% — Wejście w łuk): Światło zza fasady ślizga się po zaoblonym narożniku marmurowej lady.',
      'Kadr 03 (67% — Oś frontowa): Pełna prezentacja 4 podświetlanych paneli specjalizacji pod złotym pierścieniem.',
      'Kadr 04 (100% — Prawy profil): Ciepłe domknięcie łuku ukazujące głębię przeszklonego korytarza kliniki.',
    ],
    blocking: {
      startPose: { x: -2.45, y: 1.48, z: 2.95, panDeg: -36, tiltDeg: 2, rollDeg: 0 },
      endPose: { x: 2.55, y: 1.48, z: 2.55, panDeg: 14, tiltDeg: 2, rollDeg: 0 },
      curveArcOffset: 1.15,
      focalLengthMm: 35,
      lockFramingToTarget: true,
      targetSubjectLabel: 'Marmurowa recepcja Calacatta i logo Bujok Medical',
      targetPoint: { x: 1.45, y: 1.25, z: -2.1 },
      durationSec: 6,
      easingStyle: 'smooth_cinema',
      smoothingFactor: 68,
    },
  },
  {
    id: 'skyline_to_sanctuary_pan',
    code: '07 · SKYLINE TO SANCTUARY HOOK',
    titlePL: 'Panorama Narracyjna: Z Pulsującej Warszawy do Ciszy Kliniki',
    titleEN: 'City Skyline to Interior Sanctuary Pan-Reveal',
    filmGrammarCategory: 'Odsłonięcie Narracyjne',
    attentionMechanismPL:
      'Kontrast dwóch światów w jednym ciągłym ujęciu: zaczyna od intrygującej metropolii za szybą i płynnym obrotem kamery (Pan Right) przenosi widza do wyciszonego, bezpiecznego azylu medycznego.',
    referenceCinemaExamples:
      'Klasyczne otwarcie narracyjne kina miejskiego (S. Coppola *Lost in Translation*, *Drive*)',
    retentionMetricNote: 'Natychmiastowe osadzenie miejsca · Kontrast emocjonalny',
    directorCommunicationNotePL:
      'Kamera ustawiona bliżej środka sali (X: -0.9m, Z: 2.4m), obrót głowicy Pan z +48° (na wieżowce za oknem) do -24° (na recepcję i 4 panele) połączony z delikatnym ruchem w przód (0.9m).',
    promptPL:
      'Ujęcie narracyjne Skyline-to-Sanctuary Pan (35mm): otwarcie kadrem na wieżowce Warszawy w blasku zachodzącego słońca za wysokimi oknami, następnie płynna panorama kamery w prawo odkrywająca spokojne, luksusowe wnętrze kliniki Bujok Medical.',
    promptEN:
      'Narrative opening pan-and-glide shot, 35mm lens, starting framed on the golden-hour Warsaw skyscrapers outside the curtain wall, smoothly panning right into the serene luxury medical clinic interior.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Metropolia): Kadrowanie skierowane na ikoniczne wieżowce Warszawy skąpane w bursztynowym niebie.',
      'Kadr 02 (33% — Przejście przez refleksy): Obrót kamery przez szklane szprosy i strefę wypoczynkową.',
      'Kadr 03 (67% — Odkrycie wnętrza): W kadr wchodzi świetlisty pierścień sufitowy i marmurowa bryła recepcji.',
      'Kadr 04 (100% — Azyl medyczny): Stabilne zatrzymanie kadru na 4 podświetlanych panelach specjalizacji kliniki.',
    ],
    blocking: {
      startPose: { x: -0.95, y: 1.52, z: 2.55, panDeg: 46, tiltDeg: 4, rollDeg: 0 },
      endPose: { x: -0.25, y: 1.48, z: 1.65, panDeg: -22, tiltDeg: 2, rollDeg: 0 },
      curveArcOffset: 0.2,
      focalLengthMm: 35,
      lockFramingToTarget: false,
      targetSubjectLabel: 'Przeszklona fasada i panorama wieżowców Warszawy',
      targetPoint: { x: -4.9, y: 2.1, z: -1.4 },
      durationSec: 6,
      easingStyle: 'slow_reveal_out',
      smoothingFactor: 74,
    },
  },
  {
    id: 'dutch_resolve_hero_low',
    code: '08 · AXIAL ROLL RESOLVE HERO',
    titlePL: 'Niskokątowe Ujęcie Autorytetu z Wyrównaniem Osi Roll (4° → 0°)',
    titleEN: 'Low-Angle Hero Framing with Micro-Roll Resolution',
    filmGrammarCategory: 'Perspektywa Premium TV',
    attentionMechanismPL:
      'Subtelny przechył osiowy (Roll 4°) na starcie podświadomie sygnalizuje mózgowi niezwykłość chwili, a stopniowe wypoziomowanie kamery do idealnych 0° daje głębokie poczucie harmonii, precyzji i zaufania.',
    referenceCinemaExamples:
      'Współczesne kino C. Nolana / H. van Hoytemy — budowanie prestiżu i perfekcji inżynieryjnej',
    retentionMetricNote: 'Podświadome napięcie → wizualna ulga i zaufanie',
    directorCommunicationNotePL:
      'Niskie ustawienie kamery (Y: 0.92m → 1.28m) z obiektywem 24mm, pochylenie ku górze (Tilt +8° → +4°) oraz precyzyjna rotacja wokół osi obiektywu (Roll z +4.5° na starcie do idealnego 0.0° na końcu).',
    promptPL:
      'Monumentalne niskokątowe ujęcie wprowadzające z wyrównaniem osi Roll (24mm): kamera prowadzi niski najazd z minimalnego przechyłu 4.5° do perfekcyjnie wypoziomowanej, majestatycznej kompozycji eksponującej pierścień LED i marmurową recepcję.',
    promptEN:
      'Low-angle architectural hero shot with subtle 4.5-degree axial roll resolving smoothly to level 0-degree horizon, 24mm prime lens, emphasizing monumental ceiling ring light and Calacatta marble craftsmanship.',
    fourFrameBreakdownPL: [
      'Kadr 01 (Start 0% — Subtelna intryga osi): Niska perspektywa z delikatnym przechyłem osiowym 4.5° budzącym natychmiastową ciekawość.',
      'Kadr 02 (33% — Dynamika linii): Szprosy fasady i złoty pierścień sufitowy tworzą wyrazistą geometrię prowadzącą wzrok.',
      'Kadr 03 (67% — Stabilizacja): Kamera płynnie unosi się i wyrównuje horyzont, odsłaniając pełen autorytet wnętrza.',
      'Kadr 04 (100% — Perfekcyjna równowaga 0°): Idealnie wypoziomowany, monumentalny kadr budzący absolutne zaufanie.',
    ],
    blocking: {
      startPose: { x: -2.05, y: 0.92, z: 3.65, panDeg: -22, tiltDeg: 8, rollDeg: 4.5 },
      endPose: { x: -0.35, y: 1.28, z: 1.85, panDeg: -16, tiltDeg: 4, rollDeg: 0 },
      curveArcOffset: 0.25,
      focalLengthMm: 24,
      lockFramingToTarget: false,
      targetSubjectLabel: 'Złoty pierścień świetlny LED i oś sufitu',
      targetPoint: { x: 1.35, y: 3.15, z: -1.8 },
      durationSec: 6,
      easingStyle: 'smooth_cinema',
      smoothingFactor: 70,
    },
  },
];

export function evaluatePathEasing(
  rawT: number,
  style: CameraBlockingConfig['easingStyle'],
  smoothingFactor = 65
): number {
  const clamped = Math.max(0, Math.min(1, rawT));
  const sNorm = Math.max(0, Math.min(100, smoothingFactor)) / 100;

  // 0% Smoothing Factor => strictly linear constant speed between keyframe states
  if (sNorm <= 0.001) {
    return clamped;
  }

  if (style === 'slow_reveal_out') {
    const pOut = 1 + sNorm * 2.8;
    return 1 - Math.pow(1 - clamped, pOut);
  }

  // Symmetric C1-continuous ease-in-out curve with exponent controlled by Smoothing Factor
  const exponent =
    style === 'cubic_catmull'
      ? 1 + sNorm * 3.4
      : style === 'smooth_cinema'
        ? 1 + sNorm * 2.4
        : 1 + sNorm * 1.8;

  return clamped < 0.5
    ? 0.5 * Math.pow(2 * clamped, exponent)
    : 1 - 0.5 * Math.pow(2 * (1 - clamped), exponent);
}

function lerpShortestAngleDeg(startDeg: number, endDeg: number, t: number): number {
  const delta = ((((endDeg - startDeg) % 360) + 540) % 360) - 180;
  return startDeg + delta * t;
}

export function computePathControlPoint(blocking: CameraBlockingConfig): {
  x: number;
  y: number;
  z: number;
} {
  const s = blocking.startPose;
  const e = blocking.endPose;
  const midX = (s.x + e.x) * 0.5;
  const midY = (s.y + e.y) * 0.5;
  const midZ = (s.z + e.z) * 0.5;

  const dx = e.x - s.x;
  const dz = e.z - s.z;
  const len = Math.hypot(dx, dz);
  const perpX = len > 0.001 ? -dz / len : 0;
  const perpZ = len > 0.001 ? dx / len : 1;

  return {
    x: midX + perpX * blocking.curveArcOffset,
    y: midY + (blocking.pathVerticalArc ?? 0),
    z: midZ + perpZ * blocking.curveArcOffset,
  };
}

export function interpolateBlockingPose(
  blocking: CameraBlockingConfig,
  rawT: number
): CameraRigKeyframePose & { focalMm: number; easedT: number } {
  const smoothing =
    blocking.smoothingFactor ??
    (blocking.easingStyle === 'linear_constant' ? 0 : 65);
  const t = evaluatePathEasing(rawT, blocking.easingStyle, smoothing);

  const s = blocking.startPose;
  const e = blocking.endPose;
  const ctrl = computePathControlPoint(blocking);

  const inv = 1 - t;
  const x = inv * inv * s.x + 2 * inv * t * ctrl.x + t * t * e.x;
  const y = inv * inv * s.y + 2 * inv * t * ctrl.y + t * t * e.y;
  const z = inv * inv * s.z + 2 * inv * t * ctrl.z + t * t * e.z;

  let panDeg = lerpShortestAngleDeg(s.panDeg, e.panDeg, t);
  let tiltDeg = s.tiltDeg + (e.tiltDeg - s.tiltDeg) * t;
  const rollDeg = s.rollDeg + (e.rollDeg - s.rollDeg) * t;

  if (blocking.lockFramingToTarget) {
    const autoAngles = computeAnglesToTarget({ x, y, z }, blocking.targetPoint);
    panDeg = autoAngles.panDeg;
    tiltDeg = autoAngles.tiltDeg;
  }

  const startFocal = blocking.focalLengthMm;
  const endFocal = blocking.endFocalLengthMm ?? blocking.focalLengthMm;
  const focalMm = startFocal + (endFocal - startFocal) * t;

  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
    z: Number(z.toFixed(3)),
    panDeg: Number(panDeg.toFixed(2)),
    tiltDeg: Number(tiltDeg.toFixed(2)),
    rollDeg: Number(rollDeg.toFixed(2)),
    focalMm: Number(focalMm.toFixed(1)),
    easedT: Number(t.toFixed(4)),
  };
}

/**
 * Maps any continuous t in [0..1] along the 3D Camera Path (State A -> State B)
 * into a smooth, edge-safe 2D optical projection transform for the 4-frame sequence & MP4 renderer.
 */
export function computeOpticalPathProjection(
  blocking: CameraBlockingConfig,
  rawT: number
): {
  t: number;
  shiftXNorm: number;
  shiftYNorm: number;
  zoomScale: number;
  rollRad: number;
  pose: ReturnType<typeof interpolateBlockingPose>;
} {
  const pose = interpolateBlockingPose(blocking, rawT);
  const s = interpolateBlockingPose(blocking, 0);
  const e = interpolateBlockingPose(blocking, 1);

  const midX = (s.x + e.x) * 0.5;
  const midY = (s.y + e.y) * 0.5;
  const midZ = (s.z + e.z) * 0.5;
  const midPan = (s.panDeg + e.panDeg) * 0.5;
  const midTilt = (s.tiltDeg + e.tiltDeg) * 0.5;
  const baseFocal = blocking.focalLengthMm || 35;

  // Forward Z travel (-Z is moving deeper toward reception) + focal-length change -> optical zoom scale
  const dollyZoomDelta = (midZ - pose.z) * 0.032;
  const focalRatio = (pose.focalMm / baseFocal - 1) * 0.42;
  // Base overscan of 1.15 guarantees full frame coverage during pan/truck/roll
  const rawZoom = 1.16 + dollyZoomDelta + focalRatio;
  const zoomScale = Math.max(1.08, Math.min(1.42, rawZoom));

  // Lateral truck (X) + Horizontal Pan (panDeg) -> horizontal framing shift
  const truckX = -(pose.x - midX) * 0.018;
  const panX = (pose.panDeg - midPan) * 0.0014;
  const shiftXNorm = Math.max(-0.085, Math.min(0.085, truckX + panX));

  // Vertical crane/pedestal (Y) + Vertical Tilt (tiltDeg) -> vertical framing shift
  const craneY = (pose.y - midY) * 0.022;
  const tiltY = (pose.tiltDeg - midTilt) * 0.0015;
  const shiftYNorm = Math.max(-0.075, Math.min(0.075, craneY + tiltY));

  const rollRad = (pose.rollDeg * Math.PI) / 180;

  return {
    t: rawT,
    shiftXNorm,
    shiftYNorm,
    zoomScale,
    rollRad,
    pose,
  };
}

export function buildDirectorCommunicationBrief(
  blocking: CameraBlockingConfig,
  preset: CinematicNarrativeShotPreset | undefined,
  sceneTitle: string
): {
  fullBriefPL: string;
  fourFramePrompts: [string, string, string, string];
  travelDistanceMeters: number;
} {
  const s = blocking.startPose;
  const e = blocking.endPose;
  const directDist = Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z);
  const arcExtra =
    Math.hypot(blocking.curveArcOffset, blocking.pathVerticalArc ?? 0) * 0.68;
  const travelDistanceMeters = Number((directDist + arcExtra).toFixed(2));
  const startFocal = blocking.focalLengthMm;
  const endFocal = blocking.endFocalLengthMm ?? startFocal;
  const hFovStart = focalLengthToHorizontalFov(startFocal);
  const hFovEnd = focalLengthToHorizontalFov(endFocal);

  const pose0 = interpolateBlockingPose(blocking, 0);
  const pose1 = interpolateBlockingPose(blocking, 1 / 3);
  const pose2 = interpolateBlockingPose(blocking, 2 / 3);
  const pose3 = interpolateBlockingPose(blocking, 1);

  const shotTitle = preset
    ? `${preset.titlePL} (${preset.titleEN})`
    : 'Niestandardowa Ścieżka Kamery 3D (Stan A → Stan B)';

  const fourFramePrompts: [string, string, string, string] = [
    `${
      preset?.fourFrameBreakdownPL[0] ||
      'Kadr 01 (Stan A · 0% ścieżki): Otwarcie ujęcia w początkowym stanie kamery.'
    } [Ścieżka 3D 0%: X=${pose0.x.toFixed(2)}m, Y=${pose0.y.toFixed(2)}m, Z=${pose0.z.toFixed(2)}m | Pan=${pose0.panDeg.toFixed(1)}°, Tilt=${pose0.tiltDeg.toFixed(1)}°, Roll=${pose0.rollDeg.toFixed(1)}° | ${pose0.focalMm}mm]`,
    `${
      preset?.fourFrameBreakdownPL[1] ||
      'Kadr 02 (Interpolacja 33% ścieżki): Płynne rozwinięcie ruchu kamery i perspektywy.'
    } [Ścieżka 3D 33%: X=${pose1.x.toFixed(2)}m, Y=${pose1.y.toFixed(2)}m, Z=${pose1.z.toFixed(2)}m | Pan=${pose1.panDeg.toFixed(1)}°, Tilt=${pose1.tiltDeg.toFixed(1)}°, Roll=${pose1.rollDeg.toFixed(1)}° | ${pose1.focalMm}mm]`,
    `${
      preset?.fourFrameBreakdownPL[2] ||
      'Kadr 03 (Interpolacja 67% ścieżki): Zbliżenie do punktu kulminacyjnego ścieżki.'
    } [Ścieżka 3D 67%: X=${pose2.x.toFixed(2)}m, Y=${pose2.y.toFixed(2)}m, Z=${pose2.z.toFixed(2)}m | Pan=${pose2.panDeg.toFixed(1)}°, Tilt=${pose2.tiltDeg.toFixed(1)}°, Roll=${pose2.rollDeg.toFixed(1)}° | ${pose2.focalMm}mm]`,
    `${
      preset?.fourFrameBreakdownPL[3] ||
      'Kadr 04 (Stan B · 100% ścieżki): Docelowe domknięcie ruchu i ostrości w stanie końcowym.'
    } [Ścieżka 3D 100%: X=${pose3.x.toFixed(2)}m, Y=${pose3.y.toFixed(2)}m, Z=${pose3.z.toFixed(2)}m | Pan=${pose3.panDeg.toFixed(1)}°, Tilt=${pose3.tiltDeg.toFixed(1)}°, Roll=${pose3.rollDeg.toFixed(1)}° | ${pose3.focalMm}mm]`,
  ];

  const smoothingPct = Math.round(
    blocking.smoothingFactor ??
      (blocking.easingStyle === 'linear_constant' ? 0 : 65)
  );
  const easingLabel =
    blocking.easingStyle === 'smooth_cinema'
      ? 'Kinowa Krzywa S (Smoothstep Ease-In-Out)'
      : blocking.easingStyle === 'cubic_catmull'
        ? 'Płynny Splajn Filmowy (Quintic Smootherstep)'
        : blocking.easingStyle === 'slow_reveal_out'
          ? 'Intrygujące Wyhamowanie (Slow-Reveal Out)'
          : 'Stała Prędkość Wózka (Linear Dolly)';

  const fullBriefPL = `SPECYFIKACJA ŚCIEŻKI KAMERY 3D: STAN A → STAN B (KOMUNIKACJA UŻYTKOWNIK ↔ REŻYSER)
Scena: ${sceneTitle}
Standard ujęcia: ${shotTitle}
Cel narracyjny i utrzymanie uwagi: ${
    preset?.attentionMechanismPL ||
    'Płynnie interpolowana ścieżka 3D między dwoma stanami kamery (A → B) zapewniająca ciągłą, spójną animację ruchu w sekwencji 4 kadrów wideo.'
  }

1. DEFINICJA ŚCIEŻKI KAMERY (PATH: STAN A → PUNKT KONTROLNY M → STAN B):
- Stan Kamery A (0% Start): X = ${pose0.x.toFixed(2)} m, Y = ${pose0.y.toFixed(2)} m, Z = ${pose0.z.toFixed(2)} m
- Stan Kamery B (100% Koniec): X = ${pose3.x.toFixed(2)} m, Y = ${pose3.y.toFixed(2)} m, Z = ${pose3.z.toFixed(2)} m
- Wygięcie ścieżki (Punkt M): Poziome = ${blocking.curveArcOffset >= 0 ? '+' : ''}${blocking.curveArcOffset.toFixed(2)} m · Pionowe = ${(blocking.pathVerticalArc ?? 0) >= 0 ? '+' : ''}${(blocking.pathVerticalArc ?? 0).toFixed(2)} m · Dystans: ${travelDistanceMeters} m
- Profil interpolacji czasu (${blocking.durationSec} s): ${easingLabel} · Współczynnik wygładzania (Smoothing Factor): ${smoothingPct}%

2. KIERUNEK KADROWANIA, OGNISKOWA I ROTACJA GŁOWICY:
- Ogniskowa obiektywu: ${
    startFocal === endFocal
      ? `${startFocal} mm Prime (HFOV ~${hFovStart}°)`
      : `Płynna zmiana ${startFocal} mm (~${hFovStart}°) → ${endFocal} mm (~${hFovEnd}°)`
  }
- Tryb prowadzenia osi: ${
    blocking.lockFramingToTarget
      ? `Zaryglowany na obiekcie: „${blocking.targetSubjectLabel}” (X=${blocking.targetPoint.x}m, Y=${blocking.targetPoint.y}m, Z=${blocking.targetPoint.z}m)`
      : 'Płynna interpolacja kątowa głowicy 3-osiowej (A → B)'
  }
- Rotacja Pan (Obrót poziomy): ${pose0.panDeg.toFixed(1)}° → ${pose3.panDeg.toFixed(1)}°
- Rotacja Tilt (Pochylenie góra/dół): ${pose0.tiltDeg.toFixed(1)}° → ${pose3.tiltDeg.toFixed(1)}°
- Rotacja Roll (Przechył osiowy / Dutch): ${pose0.rollDeg.toFixed(1)}° → ${pose3.rollDeg.toFixed(1)}°

3. INTERPOLOWANE STANY DLA SEKWENCJI 4 KADRÓW WIDEO:
- ${fourFramePrompts[0]}
- ${fourFramePrompts[1]}
- ${fourFramePrompts[2]}
- ${fourFramePrompts[3]}

Prompt produkcyjny EN: ${
    preset?.promptEN ||
    `Smooth interpolated camera path from State A (${pose0.x.toFixed(2)}m, ${pose0.y.toFixed(2)}m, ${pose0.z.toFixed(2)}m, ${startFocal}mm) to State B (${pose3.x.toFixed(2)}m, ${pose3.y.toFixed(2)}m, ${pose3.z.toFixed(2)}m, ${endFocal}mm), pan ${pose0.panDeg.toFixed(1)} to ${pose3.panDeg.toFixed(1)} deg, tilt ${pose0.tiltDeg.toFixed(1)} to ${pose3.tiltDeg.toFixed(1)} deg, roll ${pose0.rollDeg.toFixed(1)} to ${pose3.rollDeg.toFixed(1)} deg.`
  }`;

  return {
    fullBriefPL,
    fourFramePrompts,
    travelDistanceMeters,
  };
}


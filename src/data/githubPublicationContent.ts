export const GITHUB_SHORT_DESCRIPTION =
  'Fotorealistyczne studio głębi 3D (Three.js/WebGL), makieta reżyserska ścieżki kamery A→B z wizualizacją trajektorii 3D na ekranie, generator wideo MP4 z 4 kadrów, studio grafik mobilnych 9:16 oraz uniwersalny sterownik aplikacji (USCP-1.0).';

export const GITHUB_TOPICS = [
  'threejs',
  'webgl',
  'react',
  'typescript',
  'camera-path-3d',
  'cinematography',
  'mobile-graphics-generator',
  'video-generator',
  'universal-controller',
  'gemini-api',
  'tailwindcss',
];

export const GITHUB_README_MARKDOWN = `# Bujok Medical Depth & 4-Frame Video Studio

Interaktywne studio wizualizacji głębi optycznej 3D, reżyserskiego planowania ścieżki kamery (**Stan A → Stan B**), kompilacji płynnego wideo **MP4 (30 kl./s)** z sekwencji 4 wyrenderowanych kadrów, generowania pionowych grafik na telefony komórkowe (**9:16 / 4:5 / 1:1**) oraz sterowania międzyaplikacyjnego za pomocą wystandaryzowanego łącznika **USCP-1.0 (Universal Studio Connector Protocol)**.

---

## Kluczowe Możliwości

### 1. Wizualizacja Linii Ścieżki Kamery 3D na Widoku Głównym (\`ParallaxThreeViewport\`)
- Stacjonarny widok głębi 3D oparty na **Three.js + autorskich shaderach GLSL** (głębia optyczna DOF, połysk materiałów PBR na marmurze Calacatta, światło dzienne w oknach, winieta, LUT kolorystyczny i ziarno 35mm).
- Rysowanie na ekranie w czasie rzeczywistym **trójwymiarowej krzywej ruchu kamery (\`CatmullRomCurve3\` + \`TubeGeometry\`)** bezpośrednio z danych \`cameraBlocking\`.
- Prezentacja **4 węzłów klatek kluczowych (0%, 33%, 67%, 100%)** z orientowanymi ramkami kadrowania 16:9, liniami celowania do punktu ostrości oraz **24 znacznikami prędkości (Easing Velocity Ticks)** reagującymi na suwak **Smoothing Factor**.

### 2. Makieta 3D Ruchu Kamery i Biblioteka Ujęć Filmowych (\`DirectorPreviz3DModule\`)
- Niezależna definicja **Stanu Początkowego A (0%)** oraz **Stanu Końcowego B (100%)**: pozycja \`X / Y / Z\`, panoramowanie (\`Pan\`), pochylenie (\`Tilt\`), przechył osiowy (\`Roll\`), ogniskowa obiektywu (\`18mm–85mm\`) oraz łuk ścieżki \`M\`.
- **Suwak Wygładzania Ścieżki (\`Smoothing Factor 0–100%\`)** sterujący intensywnością akceleracji i wyhamowania ruchu kamery pomiędzy klatkami kluczowymi.
- Wbudowana biblioteka wystandaryzowanych ujęć narracyjno-wprowadzających stosowanych w kinematografii i telewizji premium.

### 3. Kompilator Wideo MP4 z Sekwencji 4 Kadrów (\`mediaExporter.ts\`)
- Generowanie 4 spójnych kadrów fazowych z uwzględnieniem rzutowania optycznego wzdłuż ścieżki kamery 3D (\`0%, 33%, 67%, 100%\`).
- Kompilacja płynnego pliku **.MP4 (30 kl./s)** z interpolacją ścieżki kamery i opcjonalnymi podpisami narracyjnymi lub eksport planszy storyboardu **2×2 WebP**.

### 4. Studio Grafik Mobilnych i Responsywność Mobile-Friendly (\`MobileGraphicsStudioModule\`)
- Natywne generowanie i eksport grafik na smartfony:
  - **9:16 Stories / Reels / TikTok (\`1080 × 1920 px\`)** z warstwą typograficzną i przyciskiem CTA,
  - **9:16 Tapeta Smartfona (\`1080 × 1920 px\`)** w czystej wersji fotograficznej,
  - **4:5 Post Mobilny (\`1080 × 1350 px\`)** oraz **1:1 Karuzela (\`1080 × 1080 px\`)**,
  - **Seria 4 Kart Stories 9:16** próbkowanych wzdłuż ścieżki kamery 3D.
- Podgląd stref bezpiecznych ekranu smartfona (pasek statusu / Dynamic Island, kolumna ikon Reels, dolny pasek gestów) oraz interfejs dostosowany do ekranów dotykowych (\`375px+\`, cele dotykowe \`>= 44px\`).

### 5. Uniwersalny Sterownik Aplikacji z Łącznikiem \`USCP-1.0\` (\`UniversalControllerModule\`)
- **Izolacja Zestawów Przełączników**: możliwość włączenia *wyłącznie określonego zestawu przełączników* na potrzeby pracy nad konkretnym elementem (*Ścieżka Kamery 3D*, *Oświetlenie*, *Optyka i PBR*, *Kolor i Ziarno*, *Mobile & Narracja*). Nieaktywne zestawy są natychmiast ukrywane również na dolnej konsoli sterowania.
- **Wystandaryzowany Łącznik (\`USCP-1.0\`)**: synchronizacja poprzez \`window.UniversalAppConnector\`, zdarzenia \`CustomEvent('uscp:state-sync')\`, komunikaty \`window.postMessage\` (\`USCP_CONNECTOR_SYNC_V1\` / \`USCP_CONNECTOR_APPLY_V1\`), eksport/import JSON oraz gotowy do skopiowania adapter TypeScript dla zewnętrznych aplikacji.

---

## Stos Technologiczny

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Three.js (WebGL2, GLSL Shaders, PMREM RoomEnvironment), Lucide Icons
- **Backend**: Node.js, Express (\`server.ts\` + Vite middleware), integracja z \`@google/genai\` po stronie serwera
- **Eksport Mediów**: HTML5 Canvas 2D + WebGL Capture, \`MediaRecorder\` MP4/H.264, kompresja WebP oraz ultralekki deskryptor URL Hash

---

## Uruchomienie Lokalne

\`\`\`bash
# 1. Instalacja zależności
npm install

# 2. Konfiguracja klucza API (opcjonalnie dla funkcji AI po stronie serwera)
cp .env.example .env
# Uzupełnij GEMINI_API_KEY w pliku .env

# 3. Uruchomienie serwera deweloperskiego (port 3000)
npm run dev

# 4. Weryfikacja typów i budowanie wersji produkcyjnej
npm run lint
npm run build
\`\`\`

---

## Przykład Podłączenia Innej Aplikacji do Uniwersalnego Sterownika (\`USCP-1.0\`)

\`\`\`ts
import { createUniversalAppConnector } from './universalConnectorAdapter';

const bridge = createUniversalAppConnector('moja.aplikacja.mobilna', (packet) => {
  // Aktywuj w UI wyłącznie zestawy przełączników wybrane do pracy nad danym elementem:
  console.log('Aktywne zestawy:', packet.enabledSwitchGroups);
  console.log('Wartości parametrów:', packet.values);
});
\`\`\`
`;

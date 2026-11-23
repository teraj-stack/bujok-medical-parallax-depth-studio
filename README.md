# Bujok Medical Depth & 4-Frame Video Studio

> Fotorealistyczne studio głębi 3D (Three.js/WebGL), makieta reżyserska ścieżki kamery A→B z wizualizacją trajektorii 3D na ekranie, generator wideo MP4 z 4 kadrów, studio grafik mobilnych 9:16 oraz uniwersalny sterownik aplikacji (`USCP-1.0`).

Interaktywna aplikacja webowa i mobilna zaprojektowana do pracy nad fotorealistyczną plastyką obrazu architektonicznego, precyzyjną komunikacją na linii **użytkownik ↔ reżyser** za pomocą makiety 3D ruchu kamery, generowaniem płynnych sekwencji wideo z 4 kadrów, tworzeniem pionowych kreacji na smartfony oraz ujednoliconym sterowaniem wieloma aplikacjami za pomocą standardu **USCP-1.0**.

---

## Główne Moduły i Funkcjonalności

### 1. Linia Ścieżki Kamery 3D na Widoku Głównym (`ParallaxThreeViewport`)
- Renderuje stacjonarną scenę głębi 3D w **Three.js + GLSL** (optyczne rozmycie ostrości DOF, połysk PBR marmuru Calacatta, naturalne światło dzienne zza okien, winieta optyczna, krzywe korekcji barwnej LUT oraz organiczne ziarno 35mm).
- Na podstawie konfiguracji `cameraBlocking` rysuje bezpośrednio w przestrzeni 3D widoku głównego **interpolowaną linię ścieżki kamery (`CatmullRomCurve3` + `TubeGeometry`)** łączącą 4 klatki sekwencji (`0%`, `33%`, `67%`, `100%`).
- Wizualizuje orientację ramek kadrowania 16:9 (`Pan`, `Tilt`, `Roll`, `Focal Length`), linie celowania do ryglowanego punktu ostrości oraz **24 znaczniki prędkości (`InstancedMesh`)** zagęszczające się zgodnie z wartością suwaka **Smoothing Factor**.

### 2. Makieta 3D Blokowania Kamery i Biblioteka Ujęć Filmowych (`DirectorPreviz3DModule`)
- Precyzyjne definiowanie **Stanu Początkowego Kamery A (0%)** i **Stanu Końcowego Kamery B (100%)** wraz z krzywizną łuku `M`, ogniskową obiektywu (`18mm–85mm`) i czasem trwania ujęcia.
- **Suwak `Smoothing Factor` (0–100%)** regulujący intensywność wygładzania (easingu) interpolowanego ruchu kamery między klatkami kluczowymi z wykresem krzywej prędkości na żywo.
- Biblioteka wystandaryzowanych ujęć narracyjno-wprowadzających o potwierdzonej skuteczności utrzymania uwagi widza.

### 3. Kompilacja Wideo MP4 z Sekwencji 4 Wyrenderowanych Kadrów (`mediaExporter.ts`)
- Generowanie 4 kadrów fazowych odpowiadających kolejnym punktom na ścieżce kamery 3D (`0%`, `33%`, `67%`, `100%`).
- Wbudowany kompilator strumienia **MP4 (30 kl./s)** z płynną interpolacją optyczną pomiędzy kadrami, eksport plansz storyboardowych **2×2 WebP** oraz ultralekki zapis konfiguracji w hashu URL.

### 4. Generator Grafik na Telefony Komórkowe & UI Mobile-Friendly (`MobileGraphicsStudioModule`)
- Dedukowany moduł tworzenia grafik pionowych i społecznościowych na smartfony:
  - **Stories / Reels / TikTok `9:16` (`1080 × 1920 px`)** z kontrastową warstwą typograficzną i przyciskiem CTA,
  - **Tapeta Smartfona `9:16` (`1080 × 1920 px`)** (czysta ekspozycja bez tekstu),
  - **Post Mobilny `4:5` (`1080 × 1350 px`)** oraz **Karuzela `1:1` (`1080 × 1080 px`)**,
  - **Automatyczny Pakiet 4 Kart Stories `9:16`** wyrenderowanych wzdłuż ścieżki kamery A→B.
- Nakładka **stref bezpiecznych interfejsu telefonu** (górny pasek statusu / Dynamic Island, prawa strefa ikon Reels, dolny wskaźnik gestów) oraz pełna responsywność **Mobile-Friendly** z dolnym paskiem nawigacji kciukiem na smartfonach.

### 5. Uniwersalny Sterownik Aplikacji z Wystandaryzowanym Łącznikiem (`USCP-1.0`)
- **Praca nad konkretnym elementem (Izolacja Zestawów Przełączników)**: pozwala włączyć **jedynie wybrany zestaw przełączników** (*Tylko Ścieżka Kamery 3D*, *Tylko Oświetlenie*, *Tylko Optyka i PBR*, *Tylko Kolor i Ziarno*, *Tylko Mobile & Narracja* lub dowolną własną kombinację), ukrywając pozostałe kontrolki zarówno w sterowniku, jak i na głównym dolnym doku.
- **Wystandaryzowany Łącznik Międzyaplikacyjny (`USCP-1.0`)**:
  - Globalny most `window.UniversalAppConnector` (`getPacket()`, `applyPacket()`, `enableOnlyGroups()`),
  - Synchronizacja przez `window.postMessage` (`USCP_CONNECTOR_SYNC_V1` / `USCP_CONNECTOR_APPLY_V1`) i `CustomEvent('uscp:state-sync')`,
  - Eksport/import pakietów JSON oraz gotowy adapter TypeScript `createUniversalAppConnector` do wklejenia w dowolnej innej aplikacji użytkownika.

---

## Architektura Projektu

```text
├── server.ts                                    # Serwer Express + proxy endpointów AI (/api/gemini/*)
├── src/
│   ├── components/
│   │   ├── ParallaxThreeViewport.tsx            # Widok 3D Three.js + linia ścieżki kamery 3D na ekranie
│   │   ├── DirectorPreviz3DModule.tsx           # Makieta 3D kamery (Stan A -> B, Smoothing Factor, ujęcia)
│   │   ├── MobileGraphicsStudioModule.tsx       # Generator grafik na telefony (9:16, 4:5, 1:1 + pakiet Stories)
│   │   ├── UniversalControllerModule.tsx        # Uniwersalny sterownik i łącznik USCP-1.0
│   │   ├── BottomControlDock.tsx                # Dolna konsola reagująca na aktywne zestawy przełączników
│   │   └── StudioWorkspaceDrawer.tsx            # Wielozakładkowe środowisko produkcyjne i Reżyser AI
│   ├── universal-controller/
│   │   └── connectorProtocol.ts                 # Specyfikacja protokołu USCP-1.0 i hook mostu postMessage
│   ├── data/
│   │   ├── cinematicShotsLibrary.ts             # Biblioteka ujęć narracyjnych i matematyka interpolacji 3D
│   │   ├── presetScenes.ts                      # Sceny referencyjne, presety FX i koder lekkich linków
│   │   └── githubPublicationContent.ts          # Materiały publikacyjne repozytorium GitHub
│   └── utils/
│       └── mediaExporter.ts                     # Kompilator MP4 30fps, arkuszy WebP i grafik mobilnych HD
```

---

## Szybki Start

1. Zainstaluj pakiety:
   ```bash
   npm install
   ```
2. Skonfiguruj zmienne środowiskowe na podstawie `.env.example` (`GEMINI_API_KEY`).
3. Uruchom środowisko deweloperskie na porcie `3000`:
   ```bash
   npm run dev
   ```
4. Sprawdź poprawność typów i zbuduj paczkę produkcyjną:
   ```bash
   npm run lint
   npm run build
   ```

---

## Licencja

Apache-2.0

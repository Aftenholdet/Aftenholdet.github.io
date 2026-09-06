# Content pipeline for byggevejledninger

Pipelinen omdanner manuelt klassificerede slides fra de oprindelige byggevejledninger til ordnede WebP-filer. Originalerne under `Old Solution (Google Drive)/` læses, men ændres aldrig.

## Proof of concept: Breakdancer

Konfigurationen ligger i `content/build-guides.config.json` og beskriver både inkluderede og ekskluderede slides. Ingen slide udelades alene ud fra filnavn, position eller en automatisk heuristik.

Den manuelle klassifikation er:

| Slides | Klassifikation | Behandling |
|---|---|---|
| 1 | Cover med færdig robot | Dokumenteret, ikke eksporteret som byggetrin |
| 2 | Teknologiskolen-titel og “Breakdancer” | Dokumenteret, ikke eksporteret som byggetrin |
| 3–21 | Delmontage 1, internt trin 1–19 | Webtrin `001.webp`–`019.webp` |
| 22–36 | Delmontage 2, internt trin 1–15 | Webtrin `020.webp`–`034.webp` |

Alle inkluderede slides består af præcis ét rasterbillede og har ingen separate tekst-, form-, tabel- eller diagramlag. Derfor kan originalbilledet udtrækkes direkte fra PPTX-arkivet uden at simulere PowerPoints rendering. Det bevarer rækkefølge og detaljer bedre end en skærmbaseret eksport.

Slide 2 er derimod sammensat af et billede og et tekstlag. Pipelinen ville afvise den, hvis den blev markeret som byggetrin, fordi direkte billedudtrækning ikke ville gengive hele sliden.

## Dependencies

Pipelinen kræver Node.js 20 eller nyere samt projektets npm-pakker:

- `fflate`: læser ZIP-strukturen i PPTX-filen.
- `fast-xml-parser`: læser præsentationsrækkefølge, slideindhold og relationships som XML.
- `sharp`: begrænser dimensioner og skriver WebP.

Installér dem via projektets lockfile:

```powershell
npm install
```

Microsoft PowerPoint, LibreOffice, ImageMagick, FFmpeg og `cwebp` er ikke nødvendige for den nuværende image-backed strategi. De blev undersøgt lokalt og var ikke installeret.

Sammensatte slides kræver senere en fuld renderer. På Windows er PowerPoints slide-export mest tro mod originalen. En automatiserbar, platformsuafhængig fallback er LibreOffice headless til PDF efterfulgt af PDF-rendering. En sådan fallback skal valideres visuelt for fonte, transparens og placering, før den bruges på materialet.

## Kommandoer

Analysér den klassificerede kilde uden at skrive output:

```powershell
npm run content:analyze
```

Generér eller opdatér Breakdancer:

```powershell
npm run content:build
```

Tving en ny konvertering med samme kilde og indstillinger:

```powershell
node scripts/convert-build-guides.mjs --project breakdancer --force
```

Kør alle projekter, der findes i konfigurationen:

```powershell
node scripts/convert-build-guides.mjs
```

## Output og metadata

Breakdancer skrives til:

```text
assets/generated/build-guides/breakdancer/
├── 001.webp
├── 002.webp
├── ...
├── 034.webp
└── manifest.json
```

Manifestet indeholder projekt-id, navn, niveau, kildeplacering, kildehash, slideantal, klassifikation, konverteringsindstillinger, rækkefølge, dimensioner, filstørrelser og hash for hvert outputbillede. `buildSteps` kan bruges direkte af hjemmesidens eksisterende content-model.

## Genkørsel og fejl

Et `buildKey` beregnes fra:

- PPTX-filens SHA-256.
- Projektets slideklassifikation.
- WebP- og størrelsesindstillingerne.
- Pipelineversionen.

Hvis nøglen matcher manifestet, og alle outputfiler findes med de forventede størrelser, logges `[SKIP]` og intet skrives igen. Ny output genereres i en midlertidig mappe og erstatter først den eksisterende mappe, når alle billeder og metadata er færdige.

Pipelinen stopper med en tydelig `[ERROR]`, hvis blandt andet:

- kilden mangler;
- slideantallet har ændret sig;
- ikke alle slides er klassificeret;
- rækkefølgen ikke er stigende;
- en inkluderet slide har tekst, flere billeder eller andre grafiske lag;
- en relationship eller mediafil mangler i PPTX-arkivet.

## Tilføj næste projekt

1. Kør først en strukturanalyse af præsentationen og gennemgå potentielle cover-, titel-, materiale-, kode- og afslutningsslides visuelt.
2. Tilføj projektet til `content/build-guides.config.json` med alle slides eksplicit fordelt mellem `includeSlides` og `excludedSlides`.
3. Brug kun `extract-single-slide-image`, når alle inkluderede slides består af ét komplet rasterbillede.
4. Kør analyse, generering og tests.
5. Sammenlign stikprøver visuelt med originalen.
6. Opdatér først derefter projektets `buildSteps` i `src/content.js`.


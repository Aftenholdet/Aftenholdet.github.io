# Content pipeline for byggevejledninger

Pipelinen omdanner enten manuelt klassificerede PPTX-slides eller nummererede PNG-sekvenser til ordnede WebP-filer. Originalerne under `Old Solution (Google Drive)/` læses, men ændres aldrig. Repo-lokale rå PNG-kilder ligger i `source-assets/build-guides/` og deployes ikke.

## Klassificeret materiale

Konfigurationen ligger i `content/build-guides.config.json` og beskriver alle 20 guider. Atten bruger PPTX, og to bruger `image-sequence`. Ingen PPTX-slide udelades alene ud fra filnavn, position eller en automatisk heuristik. Breakdancer fungerer fortsat som regressionstest.

Den manuelle klassifikation er:

| Slides | Klassifikation | Behandling |
|---|---|---|
| 1 | Cover med færdig robot | Dokumenteret, ikke eksporteret som byggetrin |
| 2 | Teknologiskolen-titel og “Breakdancer” | Dokumenteret, ikke eksporteret som byggetrin |
| 3–21 | Delmontage 1, internt trin 1–19 | Webtrin `001.webp`–`019.webp` |
| 22–36 | Delmontage 2, internt trin 1–15 | Webtrin `020.webp`–`034.webp` |

Alle inkluderede slides består af præcis ét rasterbillede og har ingen separate tekst-, form-, tabel- eller diagramlag. Derfor kan originalbilledet udtrækkes direkte fra PPTX-arkivet uden at simulere PowerPoints rendering. Det bevarer rækkefølge og detaljer bedre end en skærmbaseret eksport.

Pipelinen accepterer også et komplet rasterbillede gemt som slide-background, men kun når slidet er angivet eksplicit i projektets `backgroundImageSlides`. Præcis én lokal raster-background og ingen separate billeder, tekst, shapes, diagrammer, tabeller, controls eller OLE-objekter må findes. Det kendte tilfælde er Øvet/Farvesorteringsmaskine slide 43.

## Image-sequences

Mecha-bot og Gaffeltruck bruger autoritative PNG-sekvenser. En image-sequence kræver `sourceType`, repo-lokal `source`, `numeric-filename`, et regex med sekvensnummer i første capture-gruppe, forventet antal/interval og eventuelt faste dimensioner. Ukendte filer, huller, dobbeltnumre, ugyldige PNG'er og hash-dubletter afvises.

Sorteringen bruger det udtrukne heltal, så `1`, `2`, `10` aldrig bliver `1`, `10`, `2`. Manifestet bevarer originalt filnavn, sekvensnummer, kildehash og mapping til `001.webp`, `002.webp` osv. Ældre PPTX-filer registreres som `legacySource`, men bruges ikke som runtime-build-kilde.

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

Valider kun de repo-lokale image-sequences:

```powershell
npm run content:sources:validate
```

Generér eller opdatér alle klassificerede guider:

```powershell
npm run content:build
```

Tving en ny konvertering med samme kilde og indstillinger:

```powershell
node scripts/convert-build-guides.mjs --project breakdancer --force
```

Generér ét projekt efter en samlet konvertering:

```powershell
node scripts/convert-build-guides.mjs --project breakdancer
```

## Output og metadata

Hvert projekt skrives til sin egen mappe, eksempelvis:

```text
assets/generated/build-guides/breakdancer/
├── 001.webp
├── 002.webp
├── ...
├── 034.webp
└── manifest.json
```

Manifestet indeholder projekt-id, displaynavn, niveau, `buildSource`, `legacySource`, kildehash, konverteringsindstillinger, rækkefølge, kilderepræsentation, dimensioner, filstørrelser og hash for hvert outputbillede. Efter en konvertering samles de validerede manifests i `src/generated/build-guides.js`, som bruges af den centrale content-model.

## Genkørsel og fejl

Et `buildKey` beregnes fra:

- PPTX-filens SHA-256 eller en deterministisk hash af image-sekvensens filnavne og indhold.
- Projektets slideklassifikation eller image-sequence-konfiguration.
- WebP- og størrelsesindstillingerne.
- Pipelineversionen.

Hvis nøglen matcher manifestet, og alle outputfiler findes med de forventede størrelser, logges `[SKIP]` og intet skrives igen. Ny output genereres i en midlertidig mappe og erstatter først den eksisterende mappe, når alle billeder og metadata er færdige.

Pipelinen stopper med en tydelig `[ERROR]`, hvis blandt andet:

- kilden mangler;
- slideantallet har ændret sig;
- ikke alle slides er klassificeret;
- rækkefølgen ikke er stigende;
- en inkluderet slide har tekst, flere billeder eller andre grafiske lag;
- en relationship eller mediafil mangler i PPTX-arkivet;
- en image-sequence har ukendte filer, huller, dubletter, forkerte dimensioner eller en manglende kildefil.

## Tilføj næste projekt

1. Kør først en strukturanalyse af præsentationen og gennemgå potentielle cover-, titel-, materiale-, kode- og afslutningsslides visuelt.
2. Tilføj projektet til `content/build-guides.config.json` med `sourceType: "pptx"` eller `sourceType: "image-sequence"`.
3. For PPTX fordeles alle slides eksplicit mellem `includeSlides` og `excludedSlides`. Brug kun `extract-single-slide-image`, når alle inkluderede slides består af ét komplet rasterbillede.
4. For image-sequences importeres originalfilerne urørt til `source-assets/build-guides/<projekt-id>/`, hvorefter nummermønster, interval, antal og dimensioner deklareres.
5. Kør source-validering, analyse, generering og tests.
6. Sammenlign stikprøver visuelt med originalen.
7. Kontrollér det genererede manifest og indeks. `buildSteps` må ikke vedligeholdes som manuelle fil-arrays i `src/content.js`.

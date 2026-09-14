# Lego, Robotter og Programmering

En statisk prototype til Teknologiskolens LEGO-byggevejledninger og programmeringsbibliotek. Sitet er lavet til GitHub Pages uden backend, login eller database.

Sitet indeholder alle fire niveauer og alle 20 robotprojekter fra den downloadede `Differentieret Læring`-mappe med komplette web-byggevejledninger. Forsidens kodehjælp åbner et fuldt bibliotek på `#/library` med platformvalg, billedkort, kategorier og søgning. Emner har egne sider på `#/library/<emne-id>`. Under en byggevejledning åbnes hjælpen fortsat i et sidepanel.

Alle kapitler i et kodeemne vises efter hinanden, både på emnesiden og i sidepanelet. Oversigten under platform- og kodevalget springer til et kapitel uden at skjule de øvrige. Platform- og kodevalg opdaterer hele guiden.

## Teknisk opbygning

- `index.html` er den eneste HTML-indgang.
- `src/app.js` indeholder routing og UI-adfærd.
- `src/content.js` samler projektdata og eksporterer bibliotekets model fra `src/library-content.js`.
- `src/styles.css` indeholder Teknologiskolens visuelle tokens og responsive layout.
- `src/library-page.css` indeholder layoutet til det fulde bibliotek og emnesiderne.
- `src/library-visuals.js` samler billedreferencer og korte elevtekster til bibliotekskortene.
- `src/highlight-python.js` farvelægger Python-eksempler uden at ændre kodens tekst. SPIKE bruger et lyst tema, og MINDSTORMS bruger et mørkt tema.
- `assets/brand/` indeholder Teknologiskolens originale logoer og banner. Det hvide logo bruges i headeren, farvelogoet i footeren og som favicon, og banneret til linkforhåndsvisninger på GitHub Pages.
- `assets/projects/` indeholder udtrukne thumbnails.
- `assets/generated/build-guides/` indeholder pipeline-genererede byggevejledninger og metadata.
- `assets/generated/library/` indeholder de auditerede blokkodebilleder som near-lossless WebP.
- `Old Solution (Google Drive)/` er urørt kildemateriale og udgives ikke på hjemmesiden.
- Navigationen bruger hash-routes, så direkte reload fungerer både på et brugersite og under et repository-subpath på GitHub Pages.

Hjemmesiden har ingen runtime-dependencies i browseren. Node bruges til lokal server, validering, tests, kopiering til `dist` og content-pipelinen.

Build-værktøjerne bruger små, lokale npm-dependencies til struktureret PPTX-læsning og WebP-konvertering. De indlæses ikke af hjemmesiden i browseren.

## Start lokalt

Kræver Node.js 20 eller nyere.

```powershell
npm install
npm run dev
```

Åbn derefter `http://127.0.0.1:4173`. En anden port kan vælges sådan:

```powershell
$env:PORT=4300
npm run dev
```

## Test og build

```powershell
npm run lint
npm test
npm run build
```

`npm run build` validerer først indholdsmodellen og alle refererede filer. Derefter oprettes det statiske site i `dist/`. PowerPoint-kilder og rå image-sequence-PNG'er kopieres ikke med.

## Generér byggevejledninger

Alle 20 byggevejledninger er deklareret i `content/build-guides.config.json`. Atten bruger legacy-PPTX som build-kilde, mens Mecha-bot og Gaffeltruck bruger autoritative PNG-sekvenser i `source-assets/build-guides/`.

```powershell
npm run content:analyze
npm run content:sources:validate
npm run sources:manifest
npm run content:build
```

`content:analyze` laver en fuld dry run og kræver præcis 20 guider og 1.132 byggetrin. `content:sources:validate` kontrollerer nummerering, filtype, dimensioner og hash for image-sequences. `content:build` gentager kontrollen før første output skrives. En uændret kilde og uændrede indstillinger giver `[SKIP]` og omskriver ikke outputtet. Den tekniske metode, dependencies, metadataformat og procedure for nye projekter er dokumenteret i [docs/CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md).

`npm run validate` kontrollerer kun det runtime-indhold, som et produktionsbuild behøver. Brug `npm run validate:sources` ved arbejde med source-arkivet; den ekstra kontrol kræver både legacy-PPTX-filerne og de rå image-sequences og udfører den fulde pipeline-dry-run. Source-afhængige regressionstests springes eksplicit over i et produktions-checkout uden source-arkiv.

`npm run sources:manifest` opdaterer `docs/source-archive-manifest.json` med størrelser og SHA-256 for samtlige arkiverede PPTX- og PNG-kilder. Manifestet er provenance-dokumentation og indgår ikke i det statiske site.

Bibliotekets auditerede PowerPoint-tekstlag og fire blokkodebilleder kan regenereres separat uden at berøre byggeguide-pipelinen:

```powershell
npm run library:generate
```

Kildevalget ligger i `content/library-source-map.json`. Tekstoutputtet skrives til `src/generated/library-slide-content.js`, og blokkode-assets samt metadata skrives til `assets/generated/library/`.

Med udviklingsserveren kørende kan den valgfrie Chrome-smoke-test af mobilvisning, drawer, fokus og variantvalg køres i en anden terminal:

```powershell
npm run test:browser
```

Testen finder Chrome på de almindelige installationsstier. En anden placering kan angives med miljøvariablen `CHROME_PATH`.

## Deploy til GitHub Pages

Workflowen `.github/workflows/deploy-pages.yml` tester, bygger og udgiver `dist/` ved push til `main`. I GitHub skal repositoryets Pages-kilde sættes til **GitHub Actions** under **Settings → Pages → Build and deployment**.

Workflowen kan også startes manuelt fra fanen **Actions**. Den følger GitHubs officielle Pages-model med `configure-pages`, `upload-pages-artifact` og `deploy-pages`.

## Tilføj et robotprojekt

1. Læg et weboptimeret thumbnail-billede i `assets/projects/<projekt-id>/thumbnail.webp` eller `.png`.
2. Vælg `sourceType: "pptx"` eller `sourceType: "image-sequence"` i `content/build-guides.config.json`. PPTX-slides klassificeres eksplicit; image-sequences placeres i `source-assets/build-guides/<projekt-id>/` og får et entydigt nummermønster.
3. Tilføj projektet ét sted i `projects` i `src/content.js` med `id`, `name`, `levelId`, thumbnail og kildeoplysninger. `buildSteps` genereres fra manifestet i `src/generated/build-guides.js`.
4. Bevar ældre kilder separat som `legacySource`, når en nyere build-kilde overtager.
5. Kør `npm run content:sources:validate`, `npm run content:analyze`, `npm run validate` og `npm test`.

Et byggetrin indeholder `number`, `image`, `alt` og `sourceType`. PPTX-trin har `sourceSlide`; image-sequence-trin har `sourceSequence`, `sourceFile`, `sourcePath` og kildehash.

## Tilføj et biblioteksemne

Biblioteket vedligeholdes i `src/library-content.js`. Et emne har `sections`, og hvert afsnit har sin egen `selection` og en liste af `variants`. Modellen understøtter:

- `platform`: `spike`, `mindstorms`, `shared` eller `general`.
- `codeMode`: `blocks`, `text` eller `concept`.
- `status`: `available`, `coming-soon` eller `missing`.
- `confidence`: `confirmed`, `likely` eller `unknown`.
- Redaktionel `source` med PPTX, slide-numre og mediefiler.
- `content` som rigtig kode, tekst eller et genereret billedasset.

Et `shared` blokasset kan bruges af begge platformvalg uden dublering. `general`/`concept` bruges til teori som Mapping. Selector-konfigurationen afgør eksplicit, hvilke kontroller der giver mening for afsnittet; manglende varianter må ikke falde tilbage til en anden platform automatisk.

Når nye PowerPoint-tekstslides eller blokbilleder skal udtrækkes, registreres de først i `content/library-source-map.json`, hvorefter `npm run library:generate`, `npm run validate` og `npm test` køres.

## Nuværende begrænsninger

- Alle 20 byggevejledninger med i alt 1.132 trin er gjort webklare via content-pipelinen.
- Alle robot-thumbnails er originale coverbilleder udtrukket fra de eksisterende PPTX-filer.
- 53 auditerede biblioteksslides er udtrukket som rigtig webtekst med originale linjeskift, indrykning og kommentarer.
- Fire visuelt bekræftede blokkodebilleder er tilgængelige; deres platformstilknytning er fortsat redaktionelt markeret som sandsynlig eller ukendt.
- Flere emner mangler fortsat blokkode i det downloadede materiale, og Hub Mindstorms siger selv, at kode kommer snart.
- Robot-thumbnails er stadig PNG. Alle genererede byggetrin er størrelsesbegrænset, near-lossless WebP.

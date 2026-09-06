# Lego, Robotter og Programmering

En statisk prototype til Teknologiskolens LEGO-byggevejledninger og programmeringsbibliotek. Sitet er lavet til GitHub Pages uden backend, login eller database.

Prototypen indeholder alle fire niveauer og alle 20 robotprojekter fra den downloadede `Differentieret Læring`-mappe. Kun Breakdancer er konverteret til en komplet web-byggevejledning i denne version. De øvrige projektkort viser tydeligt, at PowerPoint-kilden er registreret, men ikke webklar.

## Teknisk opbygning

- `index.html` er den eneste HTML-indgang.
- `src/app.js` indeholder routing og UI-adfærd.
- `src/content.js` er den centrale indholdsmodel for niveauer, projekter, byggetrin og bibliotek.
- `src/styles.css` indeholder Teknologiskolens visuelle tokens og responsive layout.
- `assets/projects/` indeholder udtrukne thumbnails.
- `assets/generated/build-guides/` indeholder pipeline-genererede byggevejledninger og metadata.
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

`npm run build` validerer først indholdsmodellen og alle refererede filer. Derefter oprettes det statiske site i `dist/`. PowerPoint-kilderne kopieres ikke med.

## Generér byggevejledninger

Breakdancer er content-pipelinens proof of concept. Slides analyseres og klassificeres i `content/build-guides.config.json`, før de må blive til byggetrin.

```powershell
npm run content:analyze
npm run content:build
```

En uændret kilde og uændrede indstillinger giver `[SKIP]` og omskriver ikke outputtet. Den tekniske metode, dependencies, metadataformat og procedure for nye projekter er dokumenteret i [docs/CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md).

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
2. Klassificér alle kildens slides i `content/build-guides.config.json` og kør content-pipelinen. Output navngives `001.webp`, `002.webp` osv.
3. Tilføj projektet ét sted i `projects` i `src/content.js` med `id`, `name`, `levelId`, `thumbnail`, kildeoplysninger og de genererede `buildSteps`.
4. Brug `buildStatus: 'ready'`, når alle trin er kontrolleret. Brug `source-only` eller `needs-review`, hvis de ikke er klar.
5. Kør `npm run validate` og `npm test`.

Et byggetrin indeholder aktuelt `number`, `image`, `alt` og `sourceSlide`. `sourceSlide` bevarer forbindelsen til PowerPoint-kilden.

## Tilføj et biblioteksemne

Tilføj emnet i `libraryTopics` i `src/content.js`. Angiv:

- `id`, `name`, `categoryId` og en kort beskrivelse.
- Den oprindelige PPTX-fil og dens slideantal.
- En eksplicit status for alle fire platform/kodetype-kombinationer.

De tilladte statusser i prototypen er:

- `available`: indholdet er overført og kan vises.
- `source-only`: variationen findes i PPTX, men er ikke overført endnu.
- `missing`: variationen blev ikke fundet i materialet.
- `unclear`: materialet findes, men platform eller kodetype kan ikke bekræftes.
- `coming-soon`: kilden siger selv, at indholdet kommer senere.

## Tilføj en guidevariation

Variationerne ligger som to dimensioner under samme emne:

```js
variants: {
  spike: {
    blocks: { status: 'missing', message: '...' },
    text: { status: 'available', sourceSlides: [4, 5], sections: [...] },
  },
  mindstorms: {
    blocks: { status: 'missing', message: '...' },
    text: { status: 'source-only', sourceSlides: [6, 7], message: '...' },
  },
}
```

En `available` variation kan have flere `sections`. Hver sektion kan indeholde `title`, `body` og `code`. Tilføj kun en variation som `available`, når indholdet er kontrolleret mod kilden.

## Nuværende begrænsninger

- Teknologiskolens rigtige logo er endnu ikke indsat; hero og header bruger tydelige placeholders.
- Kun Breakdancers 34 reelle byggetrin er gjort webklare via den nye content pipeline.
- Alle robot-thumbnails er originale coverbilleder udtrukket fra de eksisterende PPTX-filer.
- Afstandssensor og Motor har fungerende tekstkodeprototyper for SPIKE og MINDSTORMS.
- Andre biblioteksguides viser deres faktiske kilde-/mangelstatus, men deres indhold er ikke fuldt overført.
- Der blev ikke fundet blokkodevariationer i kildematerialet.
- Robot-thumbnails er stadig PNG. Breakdancers byggetrin er konverteret til størrelsesbegrænset, near-lossless WebP.

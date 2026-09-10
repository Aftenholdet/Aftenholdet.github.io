import {
  codeModeOptions,
  findAvailableAlternative,
  getLevel,
  getLibrarySection,
  getLibraryTopic,
  getProject,
  getProjectsForLevel,
  getSectionSelection,
  levels,
  libraryAssets,
  libraryCategories,
  libraryTopics,
  platformOptions,
  projects,
  resolveLibraryVariant,
} from './content.js';

import { highlightPython } from './highlight-python.js';
import { topicVisuals, categorySymbols } from './library-visuals.js';

const app = document.querySelector('#app');
const drawerRoot = document.querySelector('#drawer-root');
const siteContent = document.querySelector('#site-content');
const announcer = document.querySelector('#announcer');

const state = {
  route: parseRoute(),
  currentProject: null,
  buildStep: 1,
  drawerOpen: false,
  libraryView: 'index',
  libraryTopicId: null,
  librarySectionId: null,
  librarySearch: '',
  libraryCategoryId: 'all',
  selectedPlatform: readChoice('selectedPlatform', ['spike', 'mindstorms'], 'spike'),
  selectedCodeMode: readChoice('selectedCodeMode', ['blocks', 'text'], 'blocks'),
  returnFocus: null,
};

window.addEventListener('hashchange', () => {
  if (state.drawerOpen) closeDrawer({ restoreFocus: false });
  state.route = parseRoute();
  renderRoute();
});

document.addEventListener('keydown', handleGlobalKeydown);
document.addEventListener('fullscreenchange', updateFullscreenButton);
app.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-open-code-help]');
  if (trigger) openDrawer({ currentTarget: trigger });
});

renderRoute();

function parseRoute() {
  const rawHash = window.location.hash.slice(1) || '/';
  const [pathPart, queryPart = ''] = rawHash.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  return {
    page: segments[0] || 'home',
    id: segments[1] || null,
    query: new URLSearchParams(queryPart),
  };
}

function renderRoute() {
  state.currentProject = null;
  window.scrollTo(0, 0);

  if (state.route.page === 'level') {
    const level = getLevel(state.route.id);
    if (level) return renderLevel(level);
  }

  if (state.route.page === 'project') {
    const projectEntry = getProject(state.route.id);
    if (projectEntry) return renderProject(projectEntry);
  }

  if (state.route.page === 'library') {
    const topic = getLibraryTopic(state.route.id);
    if (state.route.id && !topic) return renderNotFound();
    state.libraryTopicId = topic?.id ?? null;
    state.librarySectionId = null;
    state.libraryView = topic ? 'topic' : 'index';
    const mode = state.route.query.get('mode');
    if (codeModeOptions.some(option => option.id === mode)) {
      state.selectedCodeMode = mode;
      writeStorage('selectedCodeMode', mode);
    }
    renderLibraryPage(topic);
    requestAnimationFrame(() => app.querySelector('h1')?.focus({ preventScroll: true }));
    return;
  }

  if (state.route.page !== 'home') return renderNotFound();
  renderLanding();
}

function renderLanding() {
  document.title = 'Lego, Robotter og Programmering | Teknologiskolen';
  const heroProject = getProject('breakdancer');

  app.innerHTML = `
    <div class="page landing-page">
      <header class="hero">
        <div class="hero-inner">
          <div class="brand-lockup">
            ${brandLogo('white')}
            <span>Teknologiskolen</span>
          </div>
          <div class="hero-copy">
            <p class="eyebrow">Byg. Kod. Få idéer.</p>
            <h1>Lego, Robotter og Programmering</h1>
            <p>Vælg dit niveau, find en robot og byg den trin for trin. Kodehjælpen følger med hele vejen.</p>
            <a class="button landing-code-help" href="#/library">
              <span class="code-help-icon" aria-hidden="true">&lt;/&gt;</span>
              <span>Åbn kodehjælp</span>
            </a>
          </div>
          <img class="hero-robot" src="${assetUrl(heroProject.thumbnail)}" alt="Den færdige Breakdancer-robot" />
        </div>
      </header>

      <main id="main-content" class="level-picker page-section">
        <div class="section-heading">
          <p class="eyebrow">Start her</p>
          <h2>Vælg dit niveau</h2>
        </div>
        <div class="level-grid">
          ${levels.map(levelCard).join('')}
        </div>
      </main>
      ${siteFooter()}
    </div>
  `;
}

function levelCard(level) {
  const featuredProject = getProject(level.featuredProjectId);
  const count = getProjectsForLevel(level.id).length;
  return `
    <a class="level-card" href="#/level/${level.id}">
      <div class="level-card-image">
        <img src="${assetUrl(featuredProject.thumbnail)}" alt="Eksempelrobot på niveauet ${escapeHtml(level.name)}" loading="lazy" />
      </div>
      <div class="level-card-body">
        <h3>${escapeHtml(level.name)}</h3>
        <p>${escapeHtml(level.description)}</p>
        <span class="card-action">Se ${count} ${count === 1 ? 'robot' : 'robotter'}</span>
      </div>
    </a>
  `;
}

function renderLibraryPage(topic = getLibraryTopic(state.libraryTopicId), { focusSelector } = {}) {
  document.title = `${topic ? `${topic.name} | ` : ''}Kodehjælp | Teknologiskolen`;
  app.innerHTML = `
    <div class="page library-page">
      ${pageHeader({ backHref: topic ? '#/library' : '#/', backLabel: topic ? 'Alle emner' : 'Forside' })}
      <main id="main-content" class="page-section library-main">
        ${topic ? `
          <div class="library-guide-layout">
            <aside class="library-guide-nav" aria-label="Emnets vejledninger" data-category-color="${topic.categoryId}">
              ${topicPicture(topic)}
              <p class="eyebrow">${escapeHtml(topic.name)}</p>
              <nav aria-label="Vælg hjælp">
                ${topic.sections.map(section => `<button type="button" data-library-section="${section.id}" aria-current="${getLibrarySection(topic, state.librarySectionId).id === section.id ? 'true' : 'false'}">${escapeHtml(section.name)}</button>`).join('')}
              </nav>
              <a class="library-all-link" href="#/library">Se alle kodeemner</a>
            </aside>
            <article class="library-guide-content">${libraryGuideHtml(topic, true)}</article>
          </div>
        ` : `
          <header class="library-welcome">
            <div class="library-intro">
              <p class="eyebrow">Kodehjælp</p>
              <h1 tabindex="-1">Hvad vil du kode?</h1>
              <p>Få din robot til at bevæge sig, lyse og reagere.</p>
            </div>
            <fieldset class="library-platforms">
              <legend>Vælg den app, du bruger</legend>
              ${platformOptions.map(platform => `
                <label class="library-platform" data-platform="${platform.id}">
                  <input type="radio" name="library-platform" value="${platform.id}" ${state.selectedPlatform === platform.id ? 'checked' : ''} />
                  <span class="library-platform-body">
                    <img class="platform-app-icon" src="${assetUrl(`assets/library/${platform.id}-app.webp`)}" alt="" width="56" height="56" />
                    <span><strong>${platform.label}</strong><small>${platform.id === 'spike' ? 'LEGO Education' : 'Robot Inventor'}</small></span>
                    <img class="platform-hub" src="${assetUrl(`assets/library/${platform.id}-hub.webp`)}" alt="" />
                  </span>
                </label>
              `).join('')}
            </fieldset>
          </header>
          <section class="library-explorer" aria-label="Find kodehjælp">
            <div class="library-discovery">
              <label class="search-field" for="library-search">
                <span class="sr-only">Søg i kodehjælpen</span>
                <span class="search-input-wrap"><span aria-hidden="true">⌕</span><input id="library-search" type="search" value="${escapeAttribute(state.librarySearch)}" placeholder="Find fx motor, farve eller gentag" autocomplete="off" /></span>
              </label>
              <p>Find en del. Vælg en idé. Prøv koden.</p>
            </div>
            <nav class="library-category-nav" aria-label="Filtrér efter kategori">
              ${[{ id: 'all', name: 'Alle emner' }, ...libraryCategories].map(category => `<button class="filter-button" type="button" data-category="${category.id}" data-category-color="${category.id}" aria-pressed="${state.libraryCategoryId === category.id}"><span aria-hidden="true">${categorySymbols[category.id]}</span>${escapeHtml(category.name)}</button>`).join('')}
            </nav>
            <div id="library-topic-list">${libraryCardsHtml()}</div>
          </section>
        `}
      </main>
      ${siteFooter()}
    </div>`;
  bindHelpContent();
  app.querySelectorAll('input[name="library-platform"]').forEach(input => input.addEventListener('change', () => {
    state.selectedPlatform = input.value;
    writeStorage('selectedPlatform', input.value);
    renderLibraryPage(null, { focusSelector: `input[name="library-platform"][value="${input.value}"]` });
  }));
  app.querySelectorAll('[data-library-section]').forEach(button => button.addEventListener('click', () => {
    state.librarySectionId = button.dataset.librarySection;
    renderLibraryPage(topic, { focusSelector: `[data-library-section="${button.dataset.librarySection}"]` });
  }));
  if (focusSelector) requestAnimationFrame(() => app.querySelector(focusSelector)?.focus({ preventScroll: true }));
}

function topicPicture(topic) {
  const visual = topicVisuals[topic.id];
  return `<div class="library-topic-picture ${topic.categoryId === 'programlogik' ? 'is-code-picture' : ''}" aria-hidden="true">
    ${visual.image ? `<img src="${assetUrl(visual.image)}" alt="" loading="lazy" />` : '<span class="mapping-picture"><span>0 … 100</span><span>↕</span><span>0 … 10</span></span>'}
  </div>`;
}

function libraryCardsHtml() {
  const query = state.librarySearch.trim().toLocaleLowerCase('da');
  const topics = libraryTopics.filter(topic =>
    topic.sections.some(section => !section.selection.platforms.length || section.selection.platforms.includes(state.selectedPlatform)) &&
    (state.libraryCategoryId === 'all' || topic.categoryId === state.libraryCategoryId) &&
    (!query || `${topic.name} ${topic.description} ${topicVisuals[topic.id].hint}`.toLocaleLowerCase('da').includes(query)));
  const category = libraryCategories.find(category => category.id === state.libraryCategoryId);
  return `
    <div class="library-results-heading"><h2>${query ? 'Søgeresultater' : escapeHtml(category?.name ?? 'Gå på opdagelse')}</h2><p role="status">${topics.length} ${topics.length === 1 ? 'emne' : 'emner'}</p></div>
    ${topics.length ? `<div class="library-card-grid">${topics.map(topic => {
      const modes = codeModeOptions.filter(mode => resolveLibraryVariant(topic.sections[0], state.selectedPlatform, mode.id).variant?.status === 'available');
      const concept = !topic.sections[0].selection.codeModes.length && topic.sections[0].variants.some(variant => variant.status === 'available');
      const mode = concept ? null : modes.find(mode => mode.id === state.selectedCodeMode)?.id ?? modes[0]?.id;
      const label = concept ? 'Se forklaringen' : modes.length === 2 ? 'Blokke og tekst' : modes.length ? `Se ${modes[0].id === 'text' ? 'tekstkode' : 'blokkode'}` : 'Kommer snart';
      return `<a class="library-topic-card" href="#/library/${topic.id}${mode ? `?mode=${mode}` : ''}" data-category-color="${topic.categoryId}">
        <span class="library-card-category">${escapeHtml(libraryCategories.find(category => category.id === topic.categoryId).name)}</span>
        ${topicPicture(topic)}
        <div class="library-card-copy"><h3>${escapeHtml(topic.name)}</h3><p>${escapeHtml(topicVisuals[topic.id].hint)}</p><span class="library-card-mode ${!modes.length && !concept ? 'is-coming' : ''}">${concept ? '' : '<span aria-hidden="true">&lt;/&gt;</span> '}${label}</span></div>
      </a>`;
    }).join('')}</div>` : '<div class="library-empty"><h3>Ingen emner fundet</h3><p>Prøv et andet ord, eller vælg Alle emner.</p><button class="button button-secondary" type="button" data-clear-library>Vis alle emner</button></div>'}`;
}

function renderHelp(options) {
  if (state.drawerOpen) renderDrawer(options);
  else renderLibraryPage(undefined, options);
}

function helpRoot() {
  return state.drawerOpen ? drawerRoot : app;
}

function renderLevel(level) {
  document.title = `${level.name} | Lego, Robotter og Programmering`;
  const levelProjects = getProjectsForLevel(level.id);

  app.innerHTML = `
    <div class="page">
      ${pageHeader({ backHref: '#/', backLabel: 'Forside' })}
      <main id="main-content" class="level-page page-section">
        <div class="section-heading level-heading">
          <p class="eyebrow">Niveau ${level.order} af 4</p>
          <h1>${escapeHtml(level.name)}</h1>
          <p>${escapeHtml(level.description)}</p>
        </div>
        <div class="project-grid">
          ${levelProjects.map(projectCard).join('')}
        </div>
      </main>
      ${siteFooter()}
    </div>
  `;
}

function projectCard(projectEntry) {
  const ready = projectEntry.buildStatus === 'ready';
  const incomplete = projectEntry.buildStatus === 'incomplete';
  const status = ready
    ? `${projectEntry.buildSteps.length} ${projectEntry.hasNonBuildPages ? 'sider' : 'trin'} klar`
    : incomplete
      ? 'Byggevejledningen kommer senere'
      : `${projectEntry.source.slideCount} slides registreret`;

  return `
    <a class="project-card" href="#/project/${projectEntry.id}">
      <div class="project-card-image">
        <img src="${assetUrl(projectEntry.thumbnail)}" alt="Den færdige robot ${escapeHtml(projectEntry.name)}" loading="lazy" />
      </div>
      <div class="project-card-body">
        <h2>${escapeHtml(projectEntry.name)}</h2>
        <span class="project-status ${ready ? 'is-ready' : ''}">
          ${escapeHtml(status)}
        </span>
      </div>
    </a>
  `;
}

function renderProject(projectEntry) {
  if (projectEntry.buildStatus === 'ready' && projectEntry.buildSteps.length) {
    renderBuildViewer(projectEntry);
    return;
  }

  const level = getLevel(projectEntry.levelId);
  document.title = `${projectEntry.name} | ${level.name}`;
  const incomplete = projectEntry.buildStatus === 'incomplete';
  const warning = incomplete
    ? 'Byggevejledningen kommer senere.'
    : 'Byggevejledningen findes som PowerPoint, men dens slides er endnu ikke konverteret til webformat.';

  app.innerHTML = `
    <div class="page">
      ${pageHeader({ backHref: `#/level/${level.id}`, backLabel: level.name })}
      <main id="main-content" class="project-pending page-section">
        <div class="pending-image">
          <img src="${assetUrl(projectEntry.thumbnail)}" alt="Den færdige robot ${escapeHtml(projectEntry.name)}" />
        </div>
        <div class="pending-copy">
          <p class="eyebrow">${escapeHtml(level.name)}</p>
          <h1>${escapeHtml(projectEntry.name)}</h1>
          <div class="content-status" role="status">
            <span class="status-icon" aria-hidden="true">!</span>
            <div>
              <h2>${incomplete ? 'Kommer senere' : 'Ikke webklar endnu'}</h2>
              <p>${escapeHtml(warning)}</p>
            </div>
          </div>
          ${incomplete ? '' : `<p class="source-note"><strong>Kilde:</strong> ${escapeHtml(projectEntry.source.slideCount)} PowerPoint-slides er registreret.</p>`}
          ${incomplete ? '' : projectEntry.issues.map((issue) => `<p class="source-warning"><strong>Skal kontrolleres:</strong> ${escapeHtml(issue)}</p>`).join('')}
          <a class="button button-primary" href="#/level/${level.id}"><span aria-hidden="true">←</span> Tilbage til robotterne</a>
        </div>
      </main>
      ${siteFooter()}
    </div>
  `;
}

function renderBuildViewer(projectEntry) {
  state.currentProject = projectEntry;
  const level = getLevel(projectEntry.levelId);
  const requestedStep = Number(state.route.query.get('step'));
  const storedStep = Number(readStorage(`buildStep:${projectEntry.id}`));
  const initialStep = Number.isInteger(requestedStep) && requestedStep > 0
    ? requestedStep
    : Number.isInteger(storedStep) && storedStep > 0
      ? storedStep
      : 1;
  state.buildStep = clamp(initialStep, 1, projectEntry.buildSteps.length);
  const initialPage = projectEntry.buildSteps[state.buildStep - 1];
  document.title = `${projectEntry.name}, ${initialPage.pageLabel} | Teknologiskolen`;

  app.innerHTML = `
    <div class="viewer-page">
      ${pageHeader({ backHref: `#/level/${level.id}`, backLabel: level.name, compact: true })}
      <main id="main-content" class="viewer-shell" aria-labelledby="viewer-title">
        <div class="viewer-toolbar">
          <div>
            <p class="viewer-level">${escapeHtml(level.name)}</p>
            <h1 id="viewer-title">${escapeHtml(projectEntry.name)}</h1>
          </div>
          <div class="viewer-toolbar-actions">
            <span id="step-count" class="step-count">${escapeHtml(initialPage.pageLabel)}</span>
            <button id="fullscreen-button" class="icon-button" type="button" aria-label="Vis byggevejledningen i fuld skærm" aria-pressed="false" title="Fuld skærm">
              <span aria-hidden="true">⛶</span>
            </button>
          </div>
        </div>

        <div class="viewer-workspace">
          <button id="previous-step" class="step-button step-button-previous" type="button">
            <span aria-hidden="true">←</span><span>Forrige</span>
          </button>

          <div id="build-stage" class="build-stage" aria-label="Byggetrin">
            <img id="build-image" draggable="false" />
          </div>

          <button id="next-step" class="step-button step-button-next" type="button">
            <span>Næste</span><span aria-hidden="true">→</span>
          </button>
        </div>

        <div class="step-controls">
          <label for="step-slider">${escapeHtml(projectEntry.navigationLabel)}</label>
          <input id="step-slider" type="range" min="1" max="${projectEntry.buildSteps.length}" value="${state.buildStep}" />
          <select id="step-select" aria-label="Spring til en bestemt side">
            ${projectEntry.buildSteps.map((step) => `<option value="${step.number}">${escapeHtml(step.pageLabel.replace(/^Trin /, ''))}</option>`).join('')}
          </select>
        </div>
      </main>

      <button id="code-help-trigger" class="code-help-trigger" type="button" data-open-code-help aria-label="Kodehjælp" title="Kodehjælp" aria-haspopup="dialog" aria-controls="code-help-drawer">
        <span class="code-help-icon" aria-hidden="true">&lt;/&gt;</span>
        <span class="code-help-label">Kodehjælp</span>
      </button>
    </div>
  `;

  bindViewer();
  setBuildStep(state.buildStep, { announce: false, updateUrl: !state.route.query.has('step') });
}

function bindViewer() {
  document.querySelector('#previous-step').addEventListener('click', () => setBuildStep(state.buildStep - 1));
  document.querySelector('#next-step').addEventListener('click', () => setBuildStep(state.buildStep + 1));
  document.querySelector('#step-slider').addEventListener('input', (event) => setBuildStep(Number(event.target.value)));
  document.querySelector('#step-select').addEventListener('change', (event) => setBuildStep(Number(event.target.value)));
  document.querySelector('#fullscreen-button').addEventListener('click', toggleFullscreen);

  const stage = document.querySelector('#build-stage');
  let pointerStart = null;
  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', (event) => {
    if (!pointerStart || event.pointerType === 'mouse') return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    setBuildStep(state.buildStep + (deltaX < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { pointerStart = null; });
}

function setBuildStep(nextStep, options = {}) {
  const projectEntry = state.currentProject;
  if (!projectEntry) return;
  const total = projectEntry.buildSteps.length;
  const step = clamp(Number(nextStep) || 1, 1, total);
  state.buildStep = step;
  const stepData = projectEntry.buildSteps[step - 1];

  const image = document.querySelector('#build-image');
  if (!image) return;
  image.src = assetUrl(stepData.image);
  image.alt = stepData.alt;
  document.querySelector('#step-count').textContent = stepData.pageLabel;
  document.querySelector('#previous-step').disabled = step === 1;
  document.querySelector('#next-step').disabled = step === total;
  document.querySelector('#step-slider').value = String(step);
  document.querySelector('#step-select').value = String(step);
  document.title = `${projectEntry.name}, ${stepData.pageLabel} | Teknologiskolen`;

  writeStorage(`buildStep:${projectEntry.id}`, String(step));
  if (options.updateUrl !== false) {
    const nextHash = `#/project/${projectEntry.id}?step=${step}`;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
    state.route = parseRoute();
  }
  if (options.announce !== false) announce(stepData.pageLabel);

  [projectEntry.buildSteps[step], projectEntry.buildSteps[step - 2]].filter(Boolean).forEach((neighbor) => {
    const preload = new Image();
    preload.src = assetUrl(neighbor.image);
  });
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    announce('Fuld skærm er ikke tilgængelig i denne browser.');
  }
}

function updateFullscreenButton() {
  const button = document.querySelector('#fullscreen-button');
  if (!button) return;
  const active = Boolean(document.fullscreenElement);
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', active ? 'Luk fuld skærm' : 'Vis byggevejledningen i fuld skærm');
  button.title = active ? 'Luk fuld skærm' : 'Fuld skærm';
}

function openDrawer(event) {
  state.returnFocus = event?.currentTarget ?? document.activeElement;
  state.drawerOpen = true;
  siteContent.inert = true;
  document.body.classList.add('drawer-open');
  renderDrawer({ animate: true });
}

function closeDrawer({ restoreFocus = true } = {}) {
  state.drawerOpen = false;
  drawerRoot.innerHTML = '';
  siteContent.inert = false;
  document.body.classList.remove('drawer-open');
  if (restoreFocus && state.returnFocus instanceof HTMLElement) state.returnFocus.focus();
}

function renderDrawer({ focusSelector, animate = false } = {}) {
  const content = state.libraryView === 'topic' && state.libraryTopicId
    ? libraryGuideHtml(getLibraryTopic(state.libraryTopicId))
    : libraryIndexHtml();

  drawerRoot.innerHTML = `
    <div class="drawer-layer">
      <button class="drawer-scrim" type="button" aria-label="Luk kodehjælp" data-close-drawer></button>
      <aside id="code-help-drawer" class="code-drawer ${animate ? 'is-entering' : ''}" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        ${content}
      </aside>
    </div>
  `;

  drawerRoot.querySelectorAll('[data-close-drawer]').forEach((button) => button.addEventListener('click', () => closeDrawer()));
  bindHelpContent();

  requestAnimationFrame(() => {
    const requested = focusSelector ? drawerRoot.querySelector(focusSelector) : null;
    const fallback = drawerRoot.querySelector(state.libraryView === 'index' ? '#library-search' : '[data-back-library]');
    (requested || fallback || drawerRoot.querySelector('[data-close-drawer]'))?.focus();
  });
}

function libraryIndexHtml() {
  return `
    <div class="drawer-header">
      <div>
        <p class="drawer-kicker">${state.currentProject ? 'Bliv på dit byggetrin' : 'Find hjælp til din kode'}</p>
        <h2 id="drawer-title">Kodehjælp</h2>
      </div>
      ${closeButton()}
    </div>
    <div class="drawer-body library-index">
      <label class="search-field" for="library-search">
        <span>Søg i biblioteket</span>
        <div class="search-input-wrap">
          <span aria-hidden="true">⌕</span>
          <input id="library-search" type="search" value="${escapeAttribute(state.librarySearch)}" placeholder="Fx afstand, motor eller gentag" autocomplete="off" />
        </div>
      </label>
      <div class="category-filter" aria-label="Filtrér efter kategori">
        ${categoryButton('all', 'Alle')}
        ${libraryCategories.map((category) => categoryButton(category.id, category.name)).join('')}
      </div>
      <div id="library-topic-list" class="library-topic-list">
        ${libraryTopicListHtml()}
      </div>
    </div>
  `;
}

function categoryButton(id, label) {
  const selected = state.libraryCategoryId === id;
  return `<button class="filter-button" type="button" data-category="${id}" data-category-color="${id}" aria-pressed="${selected}">${escapeHtml(label)}</button>`;
}

function libraryTopicListHtml() {
  const query = state.librarySearch.trim().toLocaleLowerCase('da');
  const filtered = libraryTopics.filter((topic) => {
    const matchesCategory = state.libraryCategoryId === 'all' || topic.categoryId === state.libraryCategoryId;
    const matchesSearch = !query || `${topic.name} ${topic.description}`.toLocaleLowerCase('da').includes(query);
    return matchesCategory && matchesSearch;
  });

  if (!filtered.length) {
    return '<p class="empty-result" role="status">Ingen emner matcher din søgning.</p>';
  }

  return libraryCategories.map((category) => {
    const topics = filtered.filter((topic) => topic.categoryId === category.id);
    if (!topics.length) return '';
    return `
      <section class="topic-group" data-category-color="${category.id}" aria-labelledby="category-${category.id}">
        <h3 id="category-${category.id}">${escapeHtml(category.name)}</h3>
        <div class="topic-buttons">
          ${topics.map((topic) => `
            <button class="topic-button" type="button" data-topic="${topic.id}">
              <span>
                <strong>${escapeHtml(topic.name)}</strong>
                <small>${escapeHtml(topic.description)}</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function libraryGuideHtml(topic, fullPage = false) {
  if (!topic) {
    state.libraryView = 'index';
    return libraryIndexHtml();
  }

  const section = getLibrarySection(topic, state.librarySectionId);
  state.librarySectionId = section.id;
  const selection = getSectionSelection(section);

  return `
    ${fullPage ? '' : `<div class="drawer-header guide-header">
      <button class="drawer-back" type="button" data-back-library><span aria-hidden="true">←</span><span>Alle emner</span></button>
      ${closeButton()}
    </div>`}
    <div class="${fullPage ? '' : 'drawer-body'} guide-body">
      <div class="guide-title" data-category-color="${topic.categoryId}">
        <p class="drawer-kicker">${escapeHtml(libraryCategories.find((category) => category.id === topic.categoryId).name)}</p>
        ${fullPage ? `<h1 tabindex="-1">${escapeHtml(topic.name)}</h1>` : `<h2 id="drawer-title">${escapeHtml(topic.name)}</h2>`}
        <p>${escapeHtml(topic.description)}</p>
      </div>

      ${fullPage ? '' : sectionPicker(topic, section)}
      <div class="guide-options">
      ${selection.platforms.length > 1 ? choiceGroup('platform', 'Platform', platformOptions.filter((option) => selection.platforms.includes(option.id)), state.selectedPlatform) : ''}
      ${selection.codeModes.length > 1 ? choiceGroup('code-mode', 'Kode', codeModeOptions.filter((option) => selection.codeModes.includes(option.id)), state.selectedCodeMode) : ''}
      </div>

      <div id="guide-variant-content" class="guide-variant-content" tabindex="-1">
        ${guideVariantHtml(topic, section)}
      </div>
    </div>
  `;
}

function sectionPicker(topic, selectedSection) {
  if (topic.sections.length < 2) return '';
  return `
    <label class="section-picker" for="library-section">
      <span>Vælg hjælp</span>
      <select id="library-section">
        ${topic.sections.map((section) => `<option value="${section.id}" ${section.id === selectedSection.id ? 'selected' : ''}>${escapeHtml(section.name)}</option>`).join('')}
      </select>
    </label>
  `;
}

function choiceGroup(name, legend, options, selected) {
  return `
    <fieldset class="choice-group">
      <legend>${legend}</legend>
      <div class="segmented-control">
        ${options.map((option) => `
          <label>
            <input type="radio" name="${name}" value="${option.id}" ${selected === option.id ? 'checked' : ''} />
            <span class="segment-body">
              <span>${escapeHtml(option.label)}</span>
            </span>
          </label>
        `).join('')}
      </div>
    </fieldset>
  `;
}

function guideVariantHtml(topic, section) {
  const resolved = resolveLibraryVariant(section, state.selectedPlatform, state.selectedCodeMode);
  const variant = resolved.variant;

  if (variant?.status === 'available') {
    const selectionLabel = resolved.match === 'general'
      ? ''
      : resolved.match === 'shared'
        ? optionLabel(codeModeOptions, resolved.codeMode)
        : [
            getSectionSelection(section).platforms.length > 1 ? optionLabel(platformOptions, resolved.platform) : '',
            getSectionSelection(section).codeModes.length ? optionLabel(codeModeOptions, resolved.codeMode) : '',
          ].filter(Boolean).join(' · ');
    return `
      ${selectionLabel ? `<p class="variant-label">${escapeHtml(selectionLabel)}</p>` : ''}
      ${variant.content.map((content) => guideContentHtml(content, resolved.platform)).join('')}
    `;
  }

  const status = variant?.status === 'coming-soon'
    ? ['Kommer snart', 'Denne hjælp er på vej.']
    : ['Ikke klar endnu', 'Den version er ikke klar endnu.'];
  const alternative = findAvailableAlternative(section, state.selectedPlatform, state.selectedCodeMode);
  return `
    <div class="variant-status status-${variant?.status || 'missing'}" role="status">
      <span class="status-icon" aria-hidden="true">${variant?.status === 'coming-soon' ? '…' : '!'}</span>
      <div>
        <h3>${status[0]}</h3>
        <p>${status[1]}</p>
        ${alternative ? alternativeButton(alternative, resolved) : ''}
      </div>
    </div>
  `;
}

function guideContentHtml(content, platform) {
  if (content.type === 'code') {
    return `
      <section class="guide-section">
        <h3>${escapeHtml(content.title)}</h3>
        <div class="code-block" data-code-platform="${escapeAttribute(platform)}">
          <div class="code-block-label">${escapeHtml(optionLabel(platformOptions, platform))} · Python</div>
          <pre tabindex="0" aria-label="${escapeAttribute(content.title)}"><code>${highlightPython(content.text)}</code></pre>
        </div>
      </section>
    `;
  }

  if (content.type === 'image') {
    const asset = libraryAssets[content.assetId];
    return `
      <figure class="guide-section guide-image">
        <img src="${assetUrl(asset.src)}" alt="${escapeAttribute(asset.alt)}" data-library-block-asset="${escapeAttribute(content.assetId)}" />
      </figure>
    `;
  }

  if (content.type === 'text') {
    return `
      <section class="guide-section guide-copy">
        <h3>${escapeHtml(content.heading)}</h3>
        ${content.text.split(/\n+/).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      </section>
    `;
  }

  return '';
}

function alternativeButton(alternative, current) {
  const platformChanged = alternative.platform !== current.platform;
  const codeModeChanged = alternative.codeMode !== current.codeMode;
  const label = platformChanged && codeModeChanged
    ? `Vis ${optionLabel(platformOptions, alternative.platform)} med ${optionLabel(codeModeOptions, alternative.codeMode).toLocaleLowerCase('da')}`
    : platformChanged
      ? `Vis ${optionLabel(platformOptions, alternative.platform)}-versionen`
      : alternative.codeMode === 'text' ? 'Vis tekstversionen' : 'Vis blokkene';
  return `<button class="variant-action button button-secondary" type="button" data-select-platform="${alternative.platform}" data-select-code-mode="${alternative.codeMode}">${escapeHtml(label)}</button>`;
}

function bindHelpContent() {
  const root = helpRoot();
  const search = root.querySelector('#library-search');
  search?.addEventListener('input', (event) => {
    state.librarySearch = event.target.value;
    const list = root.querySelector('#library-topic-list');
    if (list) {
      list.innerHTML = state.drawerOpen ? libraryTopicListHtml() : libraryCardsHtml();
      bindTopicButtons();
      bindClearLibrary();
    }
  });

  root.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.libraryCategoryId = button.dataset.category;
      renderHelp({ focusSelector: `[data-category="${button.dataset.category}"]` });
    });
  });

  bindTopicButtons();
  root.querySelector('[data-back-library]')?.addEventListener('click', () => {
    state.libraryView = 'index';
    state.librarySectionId = null;
    renderHelp();
  });

  root.querySelector('#library-section')?.addEventListener('change', (event) => {
    state.librarySectionId = event.target.value;
    renderHelp({ focusSelector: '#library-section' });
  });

  root.querySelectorAll('input[name="platform"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedPlatform = input.value;
      writeStorage('selectedPlatform', input.value);
      updateGuideVariant();
    });
  });

  root.querySelectorAll('input[name="code-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedCodeMode = input.value;
      writeStorage('selectedCodeMode', input.value);
      updateGuideVariant();
    });
  });

  bindVariantAction();
  bindClearLibrary();
}

function bindClearLibrary() {
  helpRoot().querySelector('[data-clear-library]')?.addEventListener('click', () => {
    state.librarySearch = '';
    state.libraryCategoryId = 'all';
    renderLibraryPage(null, { focusSelector: '#library-search' });
  });
}

function bindTopicButtons() {
  drawerRoot.querySelectorAll('[data-topic]').forEach((button) => {
    button.addEventListener('click', () => {
      state.libraryTopicId = button.dataset.topic;
      state.librarySectionId = null;
      state.libraryView = 'topic';
      renderDrawer();
    });
  });
}

function updateGuideVariant() {
  const topic = getLibraryTopic(state.libraryTopicId);
  const section = getLibrarySection(topic, state.librarySectionId);
  const content = helpRoot().querySelector('#guide-variant-content');
  if (topic && section && content) {
    content.innerHTML = guideVariantHtml(topic, section);
    bindVariantAction();
  }
}

function bindVariantAction() {
  const root = helpRoot();
  root.querySelector('[data-select-platform][data-select-code-mode]')?.addEventListener('click', (event) => {
    const { selectPlatform, selectCodeMode } = event.currentTarget.dataset;
    if (selectPlatform !== state.selectedPlatform) {
      state.selectedPlatform = selectPlatform;
      writeStorage('selectedPlatform', selectPlatform);
      const platformInput = root.querySelector(`input[name="platform"][value="${selectPlatform}"]`);
      if (platformInput) platformInput.checked = true;
    }
    if (selectCodeMode !== state.selectedCodeMode) {
      state.selectedCodeMode = selectCodeMode;
      writeStorage('selectedCodeMode', selectCodeMode);
      const codeModeInput = root.querySelector(`input[name="code-mode"][value="${selectCodeMode}"]`);
      if (codeModeInput) codeModeInput.checked = true;
    }
    updateGuideVariant();
    root.querySelector('#guide-variant-content')?.focus();
  });
}

function handleGlobalKeydown(event) {
  if (state.drawerOpen) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key === 'Tab') trapDrawerFocus(event);
    return;
  }

  if (!state.currentProject || isTypingTarget(event.target)) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    setBuildStep(state.buildStep - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    setBuildStep(state.buildStep + 1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    setBuildStep(1);
  } else if (event.key === 'End') {
    event.preventDefault();
    setBuildStep(state.currentProject.buildSteps.length);
  }
}

function trapDrawerFocus(event) {
  const drawer = drawerRoot.querySelector('.code-drawer');
  if (!drawer) return;
  const focusable = [...drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderNotFound() {
  document.title = 'Siden blev ikke fundet | Teknologiskolen';
  app.innerHTML = `
    <div class="page">
      ${pageHeader({ backHref: '#/', backLabel: 'Forside' })}
      <main id="main-content" class="not-found page-section">
        <p class="eyebrow">404</p>
        <h1>Siden blev ikke fundet</h1>
        <p>Linket peger ikke på et niveau eller en robot i materialet.</p>
        <a class="button button-primary" href="#/">Gå til forsiden</a>
      </main>
    </div>
  `;
}

function pageHeader({ backHref, backLabel, compact = false }) {
  return `
    <header class="site-header ${compact ? 'is-compact' : ''}">
      <div class="site-header-inner">
        <a class="back-link" href="${backHref}" aria-label="Tilbage til ${escapeAttribute(backLabel)}"><span aria-hidden="true">←</span><span>${escapeHtml(backLabel)}</span></a>
        <a class="header-brand" href="#/" aria-label="Teknologiskolen, gå til forsiden">
          ${brandLogo('white')}
          <span>Teknologiskolen</span>
        </a>
      </div>
    </header>
  `;
}

function brandLogo(variant = 'color') {
  const file = variant === 'white' ? 'logo_white_teknologiskolen.png' : 'logo_teknologiskolen.png';
  return `<img class="brand-logo" src="${assetUrl(`assets/brand/${file}`)}" alt="" width="203" height="267" />`;
}

function siteFooter() {
  return `<footer class="site-footer"><span class="footer-brand">${brandLogo()}Teknologiskolen</span><span>Lego, Robotter og Programmering</span></footer>`;
}

function closeButton() {
  return '<button class="drawer-close" type="button" data-close-drawer aria-label="Luk kodehjælp"><span aria-hidden="true">×</span></button>';
}

function optionLabel(options, id) {
  return options.find((option) => option.id === id)?.label ?? id;
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

function assetUrl(path) {
  return new URL(`../${path}`, import.meta.url).href;
}

function readChoice(key, allowed, fallback) {
  const value = readStorage(key);
  return allowed.includes(value) ? value : fallback;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The site still works when storage is unavailable.
  }
}

function announce(message) {
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = message; });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

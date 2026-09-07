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
            ${logoPlaceholder()}
            <span>Teknologiskolen</span>
          </div>
          <div class="hero-copy">
            <p class="eyebrow">Byg. Kod. Få idéer.</p>
            <h1>Lego, Robotter og Programmering</h1>
            <p>Vælg dit niveau, find en robot og byg den trin for trin. Kodehjælpen følger med hele vejen.</p>
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
        <span class="level-number" aria-hidden="true">${level.order}</span>
      </div>
      <div class="level-card-body">
        <h3>${escapeHtml(level.name)}</h3>
        <p>${escapeHtml(level.description)}</p>
        <span class="card-action">Se ${count} ${count === 1 ? 'robot' : 'robotter'} <span aria-hidden="true">→</span></span>
      </div>
    </a>
  `;
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
          <span aria-hidden="true">${ready ? '✓' : '○'}</span> ${escapeHtml(status)}
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
            ${projectEntry.buildSteps.map((step) => `<option value="${step.number}">${escapeHtml(step.pageLabel)}</option>`).join('')}
          </select>
        </div>
      </main>

      <button id="code-help-trigger" class="code-help-trigger" type="button" aria-haspopup="dialog" aria-controls="code-help-drawer">
        <span class="code-help-icon" aria-hidden="true">&lt;/&gt;</span>
        <span>Kodehjælp</span>
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
  document.querySelector('#code-help-trigger').addEventListener('click', openDrawer);

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
  bindDrawerContent();

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
        <p class="drawer-kicker">Bliv på dit byggetrin</p>
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
  return `<button class="filter-button" type="button" data-category="${id}" aria-pressed="${selected}"><span class="filter-check" aria-hidden="true">${selected ? '✓' : ''}</span>${escapeHtml(label)}</button>`;
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
      <section class="topic-group" aria-labelledby="category-${category.id}">
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

function libraryGuideHtml(topic) {
  if (!topic) {
    state.libraryView = 'index';
    return libraryIndexHtml();
  }

  const section = getLibrarySection(topic, state.librarySectionId);
  state.librarySectionId = section.id;
  const selection = getSectionSelection(section);

  return `
    <div class="drawer-header guide-header">
      <button class="drawer-back" type="button" data-back-library><span aria-hidden="true">←</span><span>Alle emner</span></button>
      ${closeButton()}
    </div>
    <div class="drawer-body guide-body">
      <div class="guide-title">
        <p class="drawer-kicker">Kodehjælp</p>
        <h2 id="drawer-title">${escapeHtml(topic.name)}</h2>
        <p>${escapeHtml(topic.description)}</p>
      </div>

      ${sectionPicker(topic, section)}
      ${selection.platforms.length > 1 ? choiceGroup('platform', 'Platform', platformOptions.filter((option) => selection.platforms.includes(option.id)), state.selectedPlatform) : ''}
      ${selection.codeModes.length > 1 ? choiceGroup('code-mode', 'Kode', codeModeOptions.filter((option) => selection.codeModes.includes(option.id)), state.selectedCodeMode) : ''}

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
              <span class="segment-check" aria-hidden="true">✓</span>
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
      ${selectionLabel ? `<p class="variant-label"><span aria-hidden="true">✓</span> ${escapeHtml(selectionLabel)}</p>` : ''}
      ${variant.content.map(guideContentHtml).join('')}
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

function guideContentHtml(content) {
  if (content.type === 'code') {
    return `
      <section class="guide-section">
        <h3>${escapeHtml(content.title)}</h3>
        <div class="code-block">
          <div class="code-block-label">Tekstkode</div>
          <pre tabindex="0"><code>${escapeHtml(content.text)}</code></pre>
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

function bindDrawerContent() {
  const search = drawerRoot.querySelector('#library-search');
  search?.addEventListener('input', (event) => {
    state.librarySearch = event.target.value;
    const list = drawerRoot.querySelector('#library-topic-list');
    if (list) {
      list.innerHTML = libraryTopicListHtml();
      bindTopicButtons();
    }
  });

  drawerRoot.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.libraryCategoryId = button.dataset.category;
      renderDrawer({ focusSelector: `[data-category="${button.dataset.category}"]` });
    });
  });

  bindTopicButtons();
  drawerRoot.querySelector('[data-back-library]')?.addEventListener('click', () => {
    state.libraryView = 'index';
    state.librarySectionId = null;
    renderDrawer();
  });

  drawerRoot.querySelector('#library-section')?.addEventListener('change', (event) => {
    state.librarySectionId = event.target.value;
    renderDrawer({ focusSelector: '#library-section' });
  });

  drawerRoot.querySelectorAll('input[name="platform"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedPlatform = input.value;
      writeStorage('selectedPlatform', input.value);
      updateGuideVariant();
    });
  });

  drawerRoot.querySelectorAll('input[name="code-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedCodeMode = input.value;
      writeStorage('selectedCodeMode', input.value);
      updateGuideVariant();
    });
  });

  bindVariantAction();
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
  const content = drawerRoot.querySelector('#guide-variant-content');
  if (topic && section && content) {
    content.innerHTML = guideVariantHtml(topic, section);
    bindVariantAction();
  }
}

function bindVariantAction() {
  drawerRoot.querySelector('[data-select-platform][data-select-code-mode]')?.addEventListener('click', (event) => {
    const { selectPlatform, selectCodeMode } = event.currentTarget.dataset;
    if (selectPlatform !== state.selectedPlatform) {
      state.selectedPlatform = selectPlatform;
      writeStorage('selectedPlatform', selectPlatform);
      const platformInput = drawerRoot.querySelector(`input[name="platform"][value="${selectPlatform}"]`);
      if (platformInput) platformInput.checked = true;
    }
    if (selectCodeMode !== state.selectedCodeMode) {
      state.selectedCodeMode = selectCodeMode;
      writeStorage('selectedCodeMode', selectCodeMode);
      const codeModeInput = drawerRoot.querySelector(`input[name="code-mode"][value="${selectCodeMode}"]`);
      if (codeModeInput) codeModeInput.checked = true;
    }
    updateGuideVariant();
    drawerRoot.querySelector('#guide-variant-content')?.focus();
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
          <span class="mini-logo" aria-hidden="true">T</span>
          <span>Teknologiskolen</span>
        </a>
      </div>
    </header>
  `;
}

function logoPlaceholder() {
  return `
    <span class="logo-placeholder" role="img" aria-label="Pladsholder for Teknologiskolens logo">
      <strong>T</strong>
      <small>Logo placeholder</small>
    </span>
  `;
}

function siteFooter() {
  return '<footer class="site-footer"><span>Teknologiskolen</span><span>Prototype: Lego, Robotter og Programmering</span></footer>';
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

import assert from 'node:assert/strict';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const siteUrl = process.env.SITE_URL || 'http://127.0.0.1:4173';
const debugPort = Number(process.env.CHROME_DEBUG_PORT) || 9400 + (process.pid % 500);
const chromePath = await findChrome();
const profile = await mkdtemp(path.join(os.tmpdir(), 'lego-browser-smoke-'));
let chromeErrors = '';
const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--disable-gpu-process-for-dx12-info-collection',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
chrome.stderr.on('data', (chunk) => {
  chromeErrors = `${chromeErrors}${chunk}`.slice(-4000);
});

let socket;

try {
  const target = await waitForDebugTarget();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => {
      const detail = chromeErrors.trim() ? `\n${chromeErrors.trim()}` : '';
      reject(new Error(`Chrome DevTools WebSocket kunne ikke åbnes.${detail}`));
    }, { once: true });
  });

  let requestId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  socket.addEventListener('close', () => {
    const detail = chromeErrors.trim() ? `\n${chromeErrors.trim()}` : '';
    for (const { reject, method } of pending.values()) {
      reject(new Error(`Chrome DevTools-forbindelsen blev lukket under ${method}.${detail}`));
    }
    pending.clear();
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++requestId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome DevTools svarede ikke på ${method}.`));
    }, 12000);
    pending.set(id, {
      method,
      resolve: (value) => { clearTimeout(timeout); resolve(value); },
      reject: (error) => { clearTimeout(timeout); reject(error); },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  const waitFor = async (expression, timeout = 6000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await delay(80);
    }
    throw new Error(`Timeout while waiting for: ${expression}`);
  };

  const navigate = async (url, readySelector) => {
    await command('Page.navigate', { url });
    await waitFor(`document.readyState === 'complete' && Boolean(document.querySelector(${JSON.stringify(readySelector)}))`);
  };

  const screenshot = async (name) => {
    const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const output = path.join(os.tmpdir(), name);
    await writeFile(output, Buffer.from(result.data, 'base64'));
    return output;
  };

  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });
  await navigate(`${siteUrl}/#/`, '.level-grid');
  assert.equal(await evaluate('window.innerWidth'), 390, 'Chrome did not create a 390px CSS viewport');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Landing page has horizontal overflow');
  assert.equal(await evaluate("Boolean(document.querySelector('.level-number, .level-card [aria-hidden]'))"), false, 'Level cards still contain numbering or arrows');
  await waitFor("[...document.querySelectorAll('.brand-logo')].every(image => image.complete && image.naturalWidth > 0)");
  const mobileLandingShot = await screenshot('lego-landing-mobile.png');
  await evaluate("document.querySelector('.landing-code-help').click()");
  await waitFor("Boolean(document.querySelector('.library-page'))");
  assert.equal(await evaluate("Boolean(document.querySelector('[role=dialog]'))"), false, 'Landing help should be a full page');
  assert.equal(await evaluate("document.querySelector('#site-content').inert"), false);
  assert.equal(await evaluate("new Set([...document.querySelectorAll('.library-topic-card')].map(card => getComputedStyle(card).getPropertyValue('--category-color'))).size"), 4, 'Categories do not have distinct colors');
  await evaluate("document.querySelector('[data-category=\"motor\"]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.library-topic-card').length"), 1);
  assert.equal(await evaluate("document.querySelector('[data-category=\"motor\"]').getAttribute('aria-pressed')"), 'true');
  await evaluate("document.querySelector('[data-category=\"all\"]').click()");
  await evaluate("document.querySelectorAll('.library-page img').forEach(image => image.loading = 'eager')");
  await waitFor("[...document.querySelectorAll('.library-page img')].every(image => image.complete && image.naturalWidth > 0)");
  const categoriesShot = await screenshot('lego-categories-mobile.png');
  await evaluate(`(() => {
    const input = document.querySelector('#library-search'); input.value = 'zzzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  assert.equal(await evaluate("Boolean(document.querySelector('.library-empty'))"), true);
  await evaluate("document.querySelector('[data-clear-library]').click()");
  assert.equal(await evaluate("document.querySelector('#library-search').value"), '');
  await evaluate("document.querySelector('input[name=library-platform][value=mindstorms]').click()");
  assert.equal(await evaluate("Boolean(document.querySelector('a[href*=\"/hub-spike-prime\"]'))"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('a[href*=\"/hub-mindstorms\"]'))"), true);
  await evaluate("document.querySelector('input[name=library-platform][value=spike]').click()");
  await evaluate("document.querySelector('a.library-topic-card[href*=\"/motor?\"]').click()");
  await waitFor("Boolean(document.querySelector('.library-guide-content .code-block'))");
  await waitFor("document.activeElement.tagName === 'H1'");
  assert.equal(await evaluate("document.querySelector('.code-block').dataset.codePlatform"), 'spike');
  assert.equal(await evaluate("document.querySelectorAll('[data-copy-code]').length === document.querySelectorAll('.code-block').length"), true, 'Every text-code window needs a copy button');
  await evaluate(`Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => { window.__copiedCode = text; } },
  })`);
  const fullPageCode = await evaluate("document.querySelector('.code-block code').textContent");
  await evaluate("document.querySelector('[data-copy-code]').click()");
  await waitFor("document.querySelector('[data-copy-code]').classList.contains('is-copied')");
  assert.equal(await evaluate("window.__copiedCode"), fullPageCode, 'Full-page copy changed the code text');
  assert.equal(await evaluate("document.querySelector('[data-copy-label]').textContent"), 'Kopieret');
  assert.equal(await evaluate("document.querySelectorAll('.guide-chapter').length"), 4, 'Motor chapters must all be present without selecting one');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.chapter-title')].map(heading => heading.textContent)"), [
    'Kør motor i retning', 'Kør motor X grader i retning', 'Kør motor til position i retning', 'Kør to motorer samtidig',
  ]);
  await evaluate("document.querySelector('[data-chapter-jump=koer-grader]').click()");
  assert.equal(await evaluate("document.activeElement.id"), 'chapter-koer-grader');
  assert.equal(await evaluate("document.querySelectorAll('.guide-chapter').length"), 4, 'Jumping to a chapter must not hide the others');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('180')"), true);
  await evaluate("document.querySelector('input[name=platform][value=mindstorms]').click()");
  assert.equal(await evaluate("document.querySelector('.code-block').dataset.codePlatform"), 'mindstorms');
  assert.equal(await evaluate("[...document.querySelectorAll('.code-block')].every(block => block.dataset.codePlatform === 'mindstorms')"), true, 'Platform selection should update every chapter');
  await evaluate("document.querySelector('[data-chapter=to-motorer] [data-select-platform=spike]').click()");
  assert.equal(await evaluate("document.activeElement.id"), 'chapter-to-motorer', 'Alternative action should retain the chapter being read');
  assert.equal(await evaluate("[...document.querySelectorAll('.code-block')].every(block => block.dataset.codePlatform === 'spike')"), true, 'Alternative action in the last chapter should update every chapter');
  await evaluate("document.querySelector('.back-link').click()");
  await waitFor("Boolean(document.querySelector('.library-card-grid'))");
  await navigate(`${siteUrl}/#/library/mapping`, '.library-guide-content');
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=platform], input[name=code-mode]'))"), false);
  await navigate(`${siteUrl}/#/library`, '.library-card-grid');

  for (const width of [320, 720, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate(`${siteUrl}/#/library`, '.library-card-grid');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `Library overflows at ${width}px`);
    if (width === 1440) {
      await evaluate("document.querySelectorAll('.library-page img').forEach(image => image.loading = 'eager')");
      await waitFor("[...document.querySelectorAll('.library-page img')].every(image => image.complete && image.naturalWidth > 0)");
      await screenshot('lego-library-desktop.png');
    }
    await navigate(`${siteUrl}/#/library/afstandssensor?mode=text`, '.library-guide-content');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `Full guide overflows at ${width}px`);
    if (width === 1440) await screenshot('lego-library-guide-desktop.png');
    await navigate(`${siteUrl}/#/library/motor?mode=text`, '.library-guide-content');
    assert.equal(await evaluate("document.querySelectorAll('.guide-chapter').length"), 4);
    assert.equal(await evaluate(`(() => {
      const overview = document.querySelector('.chapter-overview');
      const chapters = [...document.querySelectorAll('.guide-chapter')];
      return overview.scrollWidth <= overview.clientWidth &&
        overview.getBoundingClientRect().top >= document.querySelector('.guide-options').getBoundingClientRect().bottom &&
        chapters.every((chapter, index) => !index || chapter.getBoundingClientRect().top >= chapters[index - 1].getBoundingClientRect().bottom);
    })()`), true, `Chapters should form a continuous guide with a visible overview at ${width}px`);
    await screenshot(`lego-motor-chapters-${width}.png`);
  }
  await navigate(`${siteUrl}/#/library`, '.library-card-grid');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  await navigate(`${siteUrl}/#/project/breakdancer?step=3`, '#build-image');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Mobile viewer has horizontal overflow');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.code-help-label')).display"), 'none', 'Mobile help label is still visible');
  assert.equal(await evaluate("document.querySelector('#code-help-trigger').getAttribute('aria-label')"), 'Kodehjælp');
  const originalStep = await evaluate("document.querySelector('#build-image').src");

  await evaluate("document.querySelector('#code-help-trigger').click()");
  await waitFor("Boolean(document.querySelector('#code-help-drawer'))");
  await waitFor("document.activeElement.id === 'library-search'");
  assert.equal(await evaluate('document.activeElement.id'), 'library-search', 'Drawer did not move focus to search');
  await evaluate("document.querySelector('[data-topic=\"afstandssensor\"]').click()");
  await waitFor("Boolean(document.querySelector('input[name=\"platform\"]'))");
  await evaluate(`(() => {
    const platform = document.querySelector('input[name="platform"][value="mindstorms"]');
    platform.checked = true;
    platform.dispatchEvent(new Event('change', { bubbles: true }));
    const mode = document.querySelector('input[name="code-mode"][value="text"]');
    mode.checked = true;
    mode.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(await evaluate("localStorage.getItem('selectedPlatform')"), 'mindstorms');
  assert.equal(await evaluate("localStorage.getItem('selectedCodeMode')"), 'text');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('DistanceSensor')"), true);
  assert.equal(await evaluate("document.querySelectorAll('[data-copy-code]').length === document.querySelectorAll('.code-block').length"), true, 'Drawer code windows need copy buttons');
  const drawerCode = await evaluate("document.querySelector('.code-block code').textContent");
  await evaluate("document.querySelector('[data-copy-code]').click()");
  await waitFor("document.querySelector('[data-copy-code]').classList.contains('is-copied')");
  assert.equal(await evaluate("window.__copiedCode"), drawerCode, 'Drawer copy changed the code text');
  assert.equal(await evaluate("document.querySelector('pre code').textContent.includes('\\n\\n# Opret')"), true, 'Rendered code lost its PowerPoint line breaks');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.code-block')).backgroundColor"), 'rgb(30, 30, 30)', 'MINDSTORMS should use a dark editor');
  assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.syntax-keyword')).color"), await evaluate("getComputedStyle(document.querySelector('pre code')).color"), 'Python keywords lack highlighting');
  const mindstormsShot = await screenshot('lego-mindstorms-mobile.png');

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"motor\"]'))");
  await evaluate("document.querySelector('[data-topic=\"motor\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("document.querySelector('input[name=\"platform\"]:checked').value"), 'mindstorms');
  assert.equal(await evaluate("document.querySelector('input[name=\"code-mode\"]:checked').value"), 'text');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('motorA')"), true);
  assert.equal(await evaluate("document.querySelectorAll('.guide-chapter').length"), 4, 'The building drawer must also show every motor chapter');
  assert.equal(await evaluate("Boolean(document.querySelector('#library-section'))"), false, 'The hidden chapter dropdown should be removed');
  await waitFor("document.activeElement.matches('[data-back-library]')");
  await evaluate("document.querySelector('[data-chapter-jump=to-motorer]').click()");
  assert.equal(await evaluate("document.activeElement.id"), 'chapter-to-motorer');

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"hub-spike-prime\"]'))");
  await evaluate("document.querySelector('[data-topic=\"hub-spike-prime\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=\"platform\"]'))"), false, 'SPIKE-only topic showed a platform selector');
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=\"code-mode\"]'))"), true, 'SPIKE-only topic hid its meaningful code selector');
  assert.equal(await evaluate("localStorage.getItem('selectedPlatform')"), 'mindstorms', 'SPIKE-only topic changed the global platform preference');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('light_matrix')"), true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.code-block')).backgroundColor"), 'rgb(243, 244, 245)', 'SPIKE-only topic should use a light gray editor despite the global MINDSTORMS preference');
  const spikeShot = await screenshot('lego-spike-mobile.png');

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"motor\"]'))");
  await evaluate("document.querySelector('[data-topic=\"motor\"]').click()");
  await waitFor("Boolean(document.querySelector('input[name=\"platform\"]'))");
  assert.equal(await evaluate("document.querySelector('input[name=\"platform\"]:checked').value"), 'mindstorms', 'Ordinary topic did not restore the global platform preference');
  assert.equal(await evaluate("document.querySelector('input[name=\"code-mode\"]:checked').value"), 'text', 'Ordinary topic did not restore the global code preference');

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"mapping\"]'))");
  await evaluate("document.querySelector('[data-topic=\"mapping\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=\"platform\"]'))"), false, 'Concept topic showed a platform selector');
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=\"code-mode\"]'))"), false, 'Concept topic showed a code selector');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('Guitar-opgaven')"), true);

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"gentag\"]'))");
  await evaluate("document.querySelector('[data-topic=\"gentag\"]').click()");
  await waitFor("Boolean(document.querySelector('input[name=\"code-mode\"]'))");
  await evaluate(`(() => {
    const mode = document.querySelector('input[name="code-mode"][value="blocks"]');
    mode.checked = true;
    mode.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor("Boolean(document.querySelector('[data-library-block-asset=\"gentag\"]'))");
  const sharedBlockSource = await evaluate("document.querySelector('[data-library-block-asset=\"gentag\"]').src");
  await evaluate(`(() => {
    const platform = document.querySelector('input[name="platform"][value="spike"]');
    platform.checked = true;
    platform.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(await evaluate("document.querySelector('[data-library-block-asset=\"gentag\"]').src"), sharedBlockSource, 'Shared block asset was duplicated or replaced');

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"afstandssensor\"]'))");
  await evaluate("document.querySelector('[data-topic=\"afstandssensor\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('Ikke klar endnu')"), true, 'Missing block variant silently fell back');
  assert.equal(await evaluate("Boolean(document.querySelector('#guide-variant-content pre'))"), false, 'Missing block variant rendered text code');
  assert.equal(await evaluate("Boolean(document.querySelector('[data-select-code-mode=\"text\"]'))"), true, 'Missing variant did not offer an explicit alternative');

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"hub-mindstorms\"]'))");
  await evaluate("document.querySelector('[data-topic=\"hub-mindstorms\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('Kommer snart')"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=\"platform\"], input[name=\"code-mode\"]'))"), false, 'Coming-soon hub topic showed irrelevant selectors');
  const drawerRect = await evaluate(`(() => {
    const rect = document.querySelector('#code-help-drawer').getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: document.documentElement.scrollWidth };
  })()`);
  assert.equal(drawerRect.left, 0, `Mobile drawer starts at ${drawerRect.left}px instead of 0px`);
  assert.equal(drawerRect.right, 390, `Mobile drawer ends at ${drawerRect.right}px instead of 390px`);
  const mobileDrawerShot = await screenshot('lego-drawer-mobile.png');

  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await waitFor("!document.querySelector('#code-help-drawer')");
  assert.equal(await evaluate("document.querySelector('#build-image').src"), originalStep, 'Build step changed while using help');
  assert.equal(await evaluate('document.activeElement.id'), 'code-help-trigger', 'Focus did not return to the help trigger');

  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(`${siteUrl}/#/project/breakdancer?step=3`, '#next-step');
  const controlsOverlap = await evaluate(`(() => {
    const first = document.querySelector('#next-step').getBoundingClientRect();
    const second = document.querySelector('#code-help-trigger').getBoundingClientRect();
    return !(first.right <= second.left || second.right <= first.left || first.bottom <= second.top || second.bottom <= first.top);
  })()`);
  assert.equal(controlsOverlap, false, 'Code help overlaps the next-step control');
  const desktopViewerShot = await screenshot('lego-viewer-desktop-smoke.png');

  const guideCatalog = await evaluate(`(async () => {
    const { projects } = await import('/src/content.js');
    return projects.map((project) => ({
      id: project.id,
      status: project.buildStatus,
      steps: project.buildSteps.length,
      labels: project.buildSteps.map((step) => step.pageLabel),
    }));
  })()`);
  assert.equal(guideCatalog.length, 20, 'Project catalog does not contain 20 projects');
  assert.equal(guideCatalog.filter((project) => project.status === 'ready').length, 20, 'Expected 20 ready build guides');
  assert.equal(guideCatalog.reduce((sum, project) => sum + project.steps, 0), 1132, 'Expected 1132 build steps');

  for (const project of guideCatalog.filter((entry) => entry.status === 'ready')) {
    const samples = [...new Set([1, Math.ceil(project.steps / 2), project.steps])];
    for (const step of samples) {
      await navigate(`${siteUrl}/#/project/${project.id}?step=${step}`, '#build-image');
      await waitFor("document.querySelector('#build-image').complete && document.querySelector('#build-image').naturalWidth > 0", 12000);
      assert.equal(await evaluate("document.querySelector('#step-count').textContent"), project.labels[step - 1]);
    }
  }

  await navigate(`${siteUrl}/#/project/gaffeltruck?step=40`, '#build-image');
  assert.equal(await evaluate("localStorage.getItem('buildStep:gaffeltruck')"), '40');
  await navigate(`${siteUrl}/#/project/gaffeltruck`, '#build-image');
  assert.equal(await evaluate("document.querySelector('#step-count').textContent"), 'Trin 40 af 79');
  assert.equal(await evaluate("location.hash.endsWith('/project/gaffeltruck?step=40')"), true);

  await navigate(`${siteUrl}/#/project/stor-robot-arm?step=88`, '#build-image');
  assert.equal(await evaluate("document.querySelectorAll('#step-select option').length"), 175, 'Stor Robot Arm does not expose 175 compact step options');
  assert.equal(await evaluate("localStorage.getItem('buildStep:stor-robot-arm')"), '88', 'Stor Robot Arm did not keep its own latest step');
  assert.notEqual(await evaluate("localStorage.getItem('buildStep:breakdancer')"), '88', 'Project build-step state leaked between projects');

  for (const width of [320, 520, 600, 720, 1000, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate(`${siteUrl}/#/`, '.level-grid');
    assert.equal(await evaluate("document.querySelector('.hero-copy h1').scrollWidth <= document.querySelector('.hero-copy h1').clientWidth"), true, `Landing heading clips at ${width}px`);
    for (const project of ['stor-robot-arm', 'mecha-bot']) {
      await navigate(`${siteUrl}/#/project/${project}`, '#step-select');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `Viewer overflows at ${width}px`);
      const labelsFit = await evaluate(`(() => {
        const select = document.querySelector('#step-select');
        const style = getComputedStyle(select);
        const context = document.createElement('canvas').getContext('2d');
        context.font = style.font;
        const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 24;
        return [...select.options].every(option => !option.text.startsWith('Trin ') && context.measureText(option.text).width <= available);
      })()`);
      assert.equal(labelsFit, true, `${project} step labels truncate at ${width}px`);
    }
  }

  await navigate(`${siteUrl}/#/`, '.level-grid');
  const desktopLandingShot = await screenshot('lego-landing-desktop.png');

  await navigate(`${siteUrl}/#/project/mecha-bot?step=6`, '#build-image');
  assert.equal(await evaluate("document.querySelector('#step-count').textContent"), 'Materialer · 5 af 5');
  await evaluate("document.querySelector('#next-step').click()");
  await waitFor("location.hash.endsWith('/project/mecha-bot?step=7')");
  assert.equal(await evaluate("document.querySelector('#step-count').textContent"), 'Trin 1 af 82');
  assert.equal(await evaluate("localStorage.getItem('buildStep:mecha-bot')"), '7');

  await navigate(`${siteUrl}/#/project/mecha-bot?step=45`, '#build-image');
  assert.equal(await evaluate("document.querySelector('#step-count').textContent"), 'Trin 39 af 82');
  assert.equal(await evaluate("localStorage.getItem('buildStep:mecha-bot')"), '45');
  await navigate(`${siteUrl}/#/project/mecha-bot`, '#build-image');
  assert.equal(await evaluate("document.querySelector('#step-count').textContent"), 'Trin 39 af 82');
  assert.equal(await evaluate("location.hash.endsWith('/project/mecha-bot?step=45')"), true);

  await navigate(`${siteUrl}/#/project/mecha-bot?step=89`, '#build-image');
  assert.equal(await evaluate("document.querySelector('#step-count').textContent"), 'Færdig');
  assert.equal(await evaluate("document.querySelector('#build-image').src.endsWith('/mecha-bot/089.webp')"), true);

  for (const [width, height] of [[390, 844], [1920, 900], [1920, 1440]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 720 });
    await navigate(`${siteUrl}/#/`, '.site-footer');
    await evaluate("window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })");
    assert.equal(await evaluate("Math.abs(document.querySelector('.site-footer').getBoundingClientRect().bottom - innerHeight) < 1"), true, `Landing footer floats at ${width} x ${height}`);
    assert.equal(await evaluate("document.querySelector('.site-footer').getBoundingClientRect().top >= document.querySelector('main').getBoundingClientRect().bottom - 1"), true, 'Footer overlaps the level cards');
  }
  await command('Runtime.evaluate', { expression: 'document.documentElement.requestFullscreen()', awaitPromise: true, userGesture: true });
  await waitFor('Boolean(document.fullscreenElement)');
  await evaluate("window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })");
  assert.equal(await evaluate("Math.abs(document.querySelector('.site-footer').getBoundingClientRect().bottom - innerHeight) < 1"), true, 'Landing footer floats in fullscreen');
  await screenshot('lego-landing-fullscreen-footer.png');
  await evaluate('document.exitFullscreen()');
  await waitFor('!document.fullscreenElement');

  console.log('Browser-smoke-test OK');
  console.log(`- Mobil drawer: ${mobileDrawerShot}`);
  console.log(`- Desktop viewer: ${desktopViewerShot}`);
  for (const shot of [mobileLandingShot, desktopLandingShot, categoriesShot, mindstormsShot, spikeShot]) console.log(`- Feedback: ${shot}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  chrome.kill();
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }
  throw new Error('Chrome blev ikke fundet. Sæt CHROME_PATH for at køre browser-smoke-testen.');
}

async function waitForDebugTarget() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return page;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error('Chrome DevTools kunne ikke startes.');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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

  await navigate(`${siteUrl}/#/project/breakdancer?step=3`, '#build-image');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Mobile viewer has horizontal overflow');
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
  assert.equal(await evaluate("document.querySelector('pre code').textContent.includes('\\n\\n# Opret')"), true, 'Rendered code lost its PowerPoint line breaks');

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"motor\"]'))");
  await evaluate("document.querySelector('[data-topic=\"motor\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("document.querySelector('input[name=\"platform\"]:checked').value"), 'mindstorms');
  assert.equal(await evaluate("document.querySelector('input[name=\"code-mode\"]:checked').value"), 'text');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('motorA')"), true);

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"hub-spike-prime\"]'))");
  await evaluate("document.querySelector('[data-topic=\"hub-spike-prime\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=\"platform\"]'))"), false, 'SPIKE-only topic showed a platform selector');
  assert.equal(await evaluate("Boolean(document.querySelector('input[name=\"code-mode\"]'))"), true, 'SPIKE-only topic hid its meaningful code selector');
  assert.equal(await evaluate("localStorage.getItem('selectedPlatform')"), 'mindstorms', 'SPIKE-only topic changed the global platform preference');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('light_matrix')"), true);

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

  console.log('Browser-smoke-test OK');
  console.log(`- Mobil drawer: ${mobileDrawerShot}`);
  console.log(`- Desktop viewer: ${desktopViewerShot}`);
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

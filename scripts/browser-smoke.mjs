import assert from 'node:assert/strict';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const siteUrl = process.env.SITE_URL || 'http://127.0.0.1:4173';
const debugPort = 9339;
const chromePath = await findChrome();
const profile = await mkdtemp(path.join(os.tmpdir(), 'lego-browser-smoke-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

let socket;

try {
  const target = await waitForDebugTarget();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
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

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { resolve, reject });
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

  await evaluate("document.querySelector('[data-back-library]').click()");
  await waitFor("Boolean(document.querySelector('[data-topic=\"motor\"]'))");
  await evaluate("document.querySelector('[data-topic=\"motor\"]').click()");
  await waitFor("Boolean(document.querySelector('#guide-variant-content'))");
  assert.equal(await evaluate("document.querySelector('input[name=\"platform\"]:checked').value"), 'mindstorms');
  assert.equal(await evaluate("document.querySelector('input[name=\"code-mode\"]:checked').value"), 'text');
  assert.equal(await evaluate("document.querySelector('#guide-variant-content').textContent.includes('motorA')"), true);
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

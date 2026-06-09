const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '..');

let tmpDir;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teh-test-'));
  // ignoreDefaultArgs: true is required because Puppeteer 24.x adds --disable-extensions
  // by default, which prevents --load-extension from working in Chrome 148+.
  global.browser = await puppeteer.launch({
    headless: false,
    userDataDir: tmpDir,
    ignoreDefaultArgs: true,
    args: [
      '--no-first-run',
      '--no-sandbox',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      'about:blank'
    ]
  });

  // Discover the actual extension ID (Chrome 148+ derives it from the path,
  // not from the manifest key field, when loaded via --load-extension).
  const idPage = await global.browser.newPage();
  await idPage.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
  const extensions = await idPage.evaluate(() =>
    new Promise(resolve => chrome.management.getAll(resolve))
  );
  await idPage.close();
  const ext = extensions.find(e => e.name === 'Taiwan Ebookstore Helper');
  global.EXTENSION_ID = ext ? ext.id : null;
  if (!global.EXTENSION_ID) throw new Error('Extension failed to load');
});

afterAll(async () => {
  if (global.browser) {
    await global.browser.close();
  }
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

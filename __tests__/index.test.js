import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
} from '@jest/globals';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import nock from 'nock';
import loadPage, { getAssetFileName } from '../src';

let tmpDir;

const basePath = 'https://ru.hexlet.io';

const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);

const readFile = (filename) => fs.readFile(filename, 'utf-8');

const getAssetsFolderPath = (filepath) => {
  const { dir } = path.parse(filepath);

  const assetsFolderName = path.basename(filepath, '.html');
  const assetsFolderPath = path.join(dir, `${assetsFolderName}_files`);

  return assetsFolderPath;
};

const files = [
  { filename: 'nodejs.png', url: '/assets/professions', contentType: 'image/png' },
  { filename: 'application.css', url: '/assets', contentType: 'text/css' },
  { filename: 'runtime.js', url: '/packs/js', contentType: 'text/javascript' },
];

const mockFiles = () => files.forEach((file) => {
  nock(basePath)
    .get(`${file.url}/${file.filename}`)
    .replyWithFile(200, getFixturePath(file.filename), {
      'Content-Type': file.contentType,
    });
});

const pageErrors = [404, 500];

describe('page-loader', () => {
  afterAll(() => {
    nock.restore();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));

    mockFiles();
  });

  test('Downloads page from the network, saves it to the defined folder and returns absolute path to the saved file.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    const filepath = await loadPage(`${basePath}/courses`, tmpDir);

    await expect(fs.access(filepath)).resolves.toBe(undefined);
    expect(path.isAbsolute(filepath)).toBeTruthy();
  });

  test.each(pageErrors)('Handles a %d error during page downloading.', async (status) => {
    nock(basePath)
      .get('/courses')
      .reply(status);

    await expect(loadPage(`${basePath}/courses`, tmpDir)).rejects.toThrow(`Error: Request failed with status code ${status}`);
  });

  test('Handles an error during page saving.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    await expect(loadPage(`${basePath}/courses`, 'non-existing-folder')).rejects.toThrow(/ENOENT/);
  });

  test('Downloads page images, saves it to the asset folder and updates images links in html file.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));
    const expectedPage = await readFile(getFixturePath(path.join('expected', 'ru-hexlet-io-courses-with-image.html')));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    const filepath = await loadPage(`${basePath}/courses`, tmpDir);

    const assetsFolderPath = getAssetsFolderPath(filepath);
    const assetFilePath = path.join(assetsFolderPath, 'ru-hexlet-io-assets-professions-nodejs.png');
    const processedPage = await readFile(filepath);

    await expect(fs.access(assetsFolderPath)).resolves.toBe(undefined);
    await expect(fs.access(assetFilePath)).resolves.toBe(undefined);
    expect(processedPage).toBe(expectedPage);
  });

  test('Handles an error during assets folder creation.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    await expect(loadPage(`${basePath}/courses`, 'non-existing-folder')).rejects.toThrow(/ENOENT/);
  });

  test('Handles an error during assets saving.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    await expect(loadPage(`${basePath}/courses`, '/sys')).rejects.toThrow();
  });

  test.each(files)('Downloads page assets, saves it to the asset folder and updates assets links in html file.', async (file) => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-assets.html'));
    const expectedPage = await readFile(getFixturePath(path.join('expected', 'ru-hexlet-io-courses-with-assets.html')));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    nock(basePath)
      .get('/courses')
      .replyWithFile(200, getFixturePath('ru-hexlet-io-courses-with-assets.html'), {
        'Content-Type': 'text/html',
      });

    const filepath = await loadPage(`${basePath}/courses`, tmpDir);
    const assetsFolderPath = getAssetsFolderPath(filepath);

    const assetName = getAssetFileName(`${file.url}/${file.filename}`, basePath);
    const assetPath = path.join(assetsFolderPath, assetName);
    const processedPage = await readFile(filepath);

    await expect(fs.access(assetsFolderPath)).resolves.toBe(undefined);
    await expect(fs.access(assetPath)).resolves.toBe(undefined);

    expect(processedPage).toBe(expectedPage);
  });
});

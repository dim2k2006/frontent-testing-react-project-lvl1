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
import loadPage from '../src';

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

describe('page-loader', () => {
  afterAll(() => {
    nock.restore();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  test('Downloads page from the network, saves it to the defined folder and returns absolute path to the saved file.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    nock(basePath)
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    const filepath = await loadPage(`${basePath}/courses`, tmpDir);

    await expect(fs.access(filepath)).resolves.toBe(undefined);
    expect(path.isAbsolute(filepath)).toBeTruthy();
  });

  test('Handles an error during page downloading.', async () => {
    nock(basePath)
      .get('/courses')
      .reply(404);

    await expect(loadPage(`${basePath}/courses`, tmpDir)).rejects.toThrow('Error: Request failed with status code 404');
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

    nock(basePath)
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

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

    nock(basePath)
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    await expect(loadPage(`${basePath}/courses`, 'non-existing-folder')).rejects.toThrow(/ENOENT/);
  });

  test('Handles an error during assets downloading.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    nock(basePath)
      .get('/assets/professions/nodejs.png')
      .replyWithFile(404, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    await expect(loadPage(`${basePath}/courses`, tmpDir)).rejects.toThrow('Error: Request failed with status code 404');
  });

  test('Handles an error during assets saving.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock(basePath)
      .get('/courses')
      .reply(200, page);

    nock(basePath)
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    await expect(loadPage(`${basePath}/courses`, '/sys')).rejects.toThrow();
  });

  test('Downloads page assets, saves it to the asset folder and updates assets links in html file.', async () => {
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

    nock(basePath)
      .get('/assets/application.css')
      .replyWithFile(200, getFixturePath('application.css'), {
        'Content-Type': 'text/css',
      });

    nock(basePath)
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    nock(basePath)
      .get('/packs/js/runtime.js')
      .replyWithFile(200, getFixturePath('runtime.js'), {
        'Content-Type': 'text/javascript',
      });

    const filepath = await loadPage(`${basePath}/courses`, tmpDir);

    const assetsFolderPath = getAssetsFolderPath(filepath);
    const assetsPaths = [
      path.join(assetsFolderPath, 'ru-hexlet-io-assets-application.css'),
      path.join(assetsFolderPath, 'ru-hexlet-io-courses.html'),
      path.join(assetsFolderPath, 'ru-hexlet-io-assets-professions-nodejs.png'),
      path.join(assetsFolderPath, 'ru-hexlet-io-packs-js-runtime.js'),
    ];

    const requests = assetsPaths.map((assetPath) => fs.access(assetPath));

    const processedPage = await readFile(filepath);

    await expect(fs.access(assetsFolderPath)).resolves.toBe(undefined);
    await expect(Promise.all(requests)).resolves.toEqual(expect.arrayContaining([undefined]));
    expect(processedPage).toBe(expectedPage);
  });
});

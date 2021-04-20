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
import cheerio from 'cheerio';
import mockFs from 'mock-fs';
import loadPage from '../src';

let tmpDir;

const mockFsDefaultConfig = {
  __tests__: mockFs.load(path.resolve('__tests__')),
  __fixtures__: mockFs.load(path.resolve('__fixtures__')),
};

const getFixturePath = (filename) => path.join('__fixtures__', filename);

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
    mockFs.restore();
  });

  beforeEach(async () => {
    mockFs(mockFsDefaultConfig);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  test('Downloads page from the network, saves it to the defined folder and returns absolute path to the saved file.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, page);

    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    const filepath = await loadPage('https://ru.hexlet.io/courses', tmpDir);

    await expect(fs.access(filepath)).resolves.toBe(undefined);
    expect(path.isAbsolute(filepath)).toBeTruthy();
  });

  test('Handles an error during page downloading.', async () => {
    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(404);

    await expect(loadPage('https://ru.hexlet.io/courses', tmpDir)).rejects.toThrow('Error: Request failed with status code 404');
  });

  test('Handles an error during page saving.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, page);

    await expect(loadPage('https://ru.hexlet.io/courses', 'non-existing-folder')).rejects.toThrow('Error: ENOENT, no such file or directory \'non-existing-folder/ru-hexlet-io-courses_files\'');
  });

  test('Downloads page images, saves it to the asset folder and updates images links in html file.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));
    const expectedPage = await readFile(getFixturePath('ru-hexlet-io-courses-with-image-expected.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, page);

    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    const filepath = await loadPage('https://ru.hexlet.io/courses', tmpDir);

    const assetsFolderPath = getAssetsFolderPath(filepath);
    const assetFilePath = path.join(assetsFolderPath, 'ru-hexlet-io-assets-professions-nodejs.png');
    const processedPage = await readFile(filepath);

    await expect(fs.access(assetsFolderPath)).resolves.toBe(undefined);
    await expect(fs.access(assetFilePath)).resolves.toBe(undefined);
    expect(processedPage).toBe(cheerio.load(expectedPage).html());
  });

  test('Handles an error during assets folder creation.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, page);

    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    await expect(loadPage('https://ru.hexlet.io/courses', 'non-existing-folder')).rejects.toThrow('Error: ENOENT, no such file or directory \'non-existing-folder/ru-hexlet-io-courses_files\'');
  });

  test('Handles an error during assets downloading.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, page);

    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .replyWithFile(404, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    await expect(loadPage('https://ru.hexlet.io/courses', tmpDir)).rejects.toThrow('Error: Request failed with status code 404');
  });

  test('Handles an error during assets saving.', async () => {
    const mockFsConfig = {
      ...mockFsDefaultConfig,
      tmp: {
        'ru-hexlet-io-courses_files': mockFs.directory({ mode: 444 }),
      },
    };

    mockFs(mockFsConfig);

    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-image.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, page);

    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    await expect(loadPage('https://ru.hexlet.io/courses', 'tmp')).rejects.toThrow('Error: EACCES, permission denied \'tmp/ru-hexlet-io-courses_files/ru-hexlet-io-assets-professions-nodejs.png\'');
  });

  test('Downloads page assets, saves it to the asset folder and updates assets links in html file.', async () => {
    const page = await readFile(getFixturePath('ru-hexlet-io-courses-with-assets.html'));
    const expectedPage = await readFile(getFixturePath('ru-hexlet-io-courses-with-assets-expected.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, page);

    nock('https://ru.hexlet.io')
      .get('/assets/application.css')
      .replyWithFile(200, getFixturePath('application.css'), {
        'Content-Type': 'text/css',
      });

    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      });

    nock('https://ru.hexlet.io')
      .get('/packs/js/runtime.js')
      .replyWithFile(200, getFixturePath('runtime.js'), {
        'Content-Type': 'text/javascript',
      });

    const filepath = await loadPage('https://ru.hexlet.io/courses', tmpDir);

    const assetsFolderPath = getAssetsFolderPath(filepath);
    const assetsPaths = [
      path.join(assetsFolderPath, 'ru-hexlet-io-assets-application.css'),
      // path.join(assetsFolderPath, 'ru-hexlet-io-courses.html'),
      path.join(assetsFolderPath, 'ru-hexlet-io-assets-professions-nodejs.png'),
      path.join(assetsFolderPath, 'ru-hexlet-io-packs-js-runtime.js'),
    ];

    const requests = assetsPaths.map((assetPath) => fs.access(assetPath));

    const processedPage = await readFile(filepath);

    await expect(fs.access(assetsFolderPath)).resolves.toBe(undefined);
    await expect(Promise.all(requests)).resolves.toEqual([undefined, undefined]);
    expect(processedPage).toBe(cheerio.load(expectedPage).html());
  });
});

import { beforeEach, describe, expect } from '@jest/globals';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import nock from 'nock';
import cheerio from 'cheerio';
import loadPage from '../src';

let tmpDir;

const getFixturePath = (filename) => path.join('__tests__', '__fixtures__', filename);

const readFile = (filename) => fs.readFile(filename, 'utf-8');

const getAssetsFolderPath = (filepath) => {
  const { dir } = path.parse(filepath);

  const assetsFolderName = path.basename(filepath, '.html');
  const assetsFolderPath = path.join(dir, `${assetsFolderName}_files`);

  return assetsFolderPath;
};

describe('page-loader', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  test('Downloads page from the network, saves it to the defined folder and returns absolute path to the saved file.', async () => {
    const response = await readFile(getFixturePath('ru-hexlet-io-courses.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, response);

    const filepath = await loadPage('https://ru.hexlet.io/courses', tmpDir);

    await expect(fs.access(filepath)).resolves.toBe(undefined);
    expect(path.isAbsolute(filepath)).toBeTruthy();
  });

  test('Handles an error during page downloading.', async () => {
    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(404);

    await expect(loadPage('https://ru.hexlet.io/courses', tmpDir)).rejects.toThrow('Error during page downloading');
  });

  test('Handles an error during file saving.', async () => {
    const response = await readFile(getFixturePath('ru-hexlet-io-courses.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, response);

    await expect(loadPage('https://ru.hexlet.io/courses', 'non-existing-folder')).rejects.toThrow('Error during page saving');
  });

  // прямой тест на функциональность - сохранение картинки
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

    const filepath = await loadPage('https://ru.hexlet.io/courses', tmpDir); // вот этот фалй должен содержать измененные ссылки

    const assetsFolderPath = getAssetsFolderPath(filepath);
    const assetFilePath = path.join(assetsFolderPath, 'ru-hexlet-io-assets-professions-nodejs.png');
    const processedPage = await readFile(filepath);

    await expect(fs.access(assetsFolderPath)).resolves.toBe(undefined);
    await expect(fs.access(assetFilePath)).resolves.toBe(undefined);
    expect(processedPage).toBe(cheerio.load(expectedPage).html());
  });

  // обработать ошибку создания папки для ассетов

  // обработка ошибки скачивания файла

  // обработка ошибки сохранения файла
});

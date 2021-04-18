import { beforeEach, describe, expect } from '@jest/globals';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import nock from 'nock';
import loadPage from '../src';

let tmpDir;

const getFixturePath = (filename) => path.join('__tests__', '__fixtures__', filename);
const readFile = (filename) => fs.readFile(filename, 'utf-8');

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

    await expect(loadPage('https://ru.hexlet.io/courses', 'non-existing-folder')).rejects.toThrow('Error during file saving');
  });
});

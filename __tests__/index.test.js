import { beforeEach, describe, expect } from '@jest/globals';
import os from 'os';
import path from 'path';
import * as fs from 'fs/promises';
import nock from 'nock';
import pageLoader from '../src';

let tmpDir;

const getFixturePath = (filename) => path.join('__tests__', '__fixtures__', filename);
const readFile = (filename) => fs.readFile(filename, 'utf-8');

describe('page-loader', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  test('Downloads page from the network and saves it to the defined folder.', async () => {
    const response = await readFile(getFixturePath('ru-hexlet-io-courses.html'));

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, response);

    const filepath = await pageLoader('https://ru.hexlet.io/courses', tmpDir);

    await expect(fs.access(filepath)).resolves.toBe(undefined);
  });
});

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import cheerio from 'cheerio';

const isLocalAsset = (assetUrl, pageUrl) => {
  if (assetUrl.startsWith('/')) return true;

  const asset = new URL(assetUrl);
  const page = new URL(pageUrl);

  return asset.hostname === page.hostname;
};

const getBaseUrl = (pageUrl) => {
  const url = new URL(pageUrl);

  return `${url.protocol}${url.host}`;
};

const getUrlWithoutProtocol = (resourceUrl) => {
  const url = new URL(resourceUrl);

  // https://url.spec.whatwg.org/#url-serializing
  url.toString = () => {
    let result = `${url.host}`;

    if (url.port) {
      result = `${result}:${url.port}`;
    }

    if (url.pathname !== '/') {
      result = `${result}${url.pathname}`;
    }

    if (url.search) {
      result = `${result}${url.search}`;
    }

    return result;
  };

  return url.toString();
};

const isLetter = (char) => RegExp(/[a-z]/, 'i').test(char);

const isDigit = (char) => RegExp(/[0-9]/).test(char);

const transformString = (string) => {
  const result = string
    .split('')
    .map((char) => {
      if (isLetter(char)) return char;

      if (isDigit(char)) return char;

      return '-';
    })
    .join('');

  return result;
};

const getAssetFileName = (assetUrl, baseUrl) => {
  const absoluteAssetUrl = new URL(assetUrl, baseUrl).pathname; // /assets/professions/nodejs.png
  const { dir, base } = path.parse(absoluteAssetUrl);
  const result = `${transformString(`${getUrlWithoutProtocol(baseUrl)}${dir}`)}-${base}`; // ru-hexlet-io-assets-professions-nodejs.png

  return result;
};

const loadPage = (pageUrl, destPath = process.cwd()) => {
  const baseUrl = getBaseUrl(pageUrl);
  const fullUrl = getUrlWithoutProtocol(pageUrl);

  const pageFileName = `${transformString(fullUrl)}.html`;
  const assetsFolderName = `${transformString(fullUrl)}_files`;

  const pageFilePath = path.join(destPath, pageFileName);
  const assetsFolderPath = path.join(destPath, assetsFolderName);

  return axios
    .get(pageUrl)
    .then((response) => response.data)
    .catch((error) => {
      throw new Error(`Error during page downloading. ${error}`);
    })
    .then((data) => {
      const $ = cheerio.load(data);
      const images = Array
        .from($('img'))
        .map((element) => $(element))
        .filter(($element) => {
          const assetUrl = $element.attr('src');

          return isLocalAsset(assetUrl, pageUrl);
        });

      const assetsLinks = images.map(($element) => $element.attr('src'));

      images.forEach(($element) => {
        // assetUrl - /assets/professions/nodejs.png
        // assetUrl - https://ru.hexlet.io/assets/professions/nodejs.png
        const assetUrl = $element.attr('src');
        const assetFileName = getAssetFileName(assetUrl, baseUrl);
        const assetFilePath = path.join(assetsFolderName, assetFileName);

        $element.attr('src', assetFilePath);
      });

      const newData = $.html();

      return { data: newData, assetsLinks };
    })
    .then(({ data, assetsLinks }) => new Promise((resolve, reject) => {
      if (assetsLinks.length === 0) {
        resolve({ data });

        return;
      }

      fs.mkdir(assetsFolderPath)
        .then(() => resolve({ data, assetsLinks }))
        .catch((error) => reject(error));
    }))
    // скачать ассеты
    // обработать ошибки скачивания ассетов (должна ли ошибка скачивания ресурса прерывать весь процесс??)
    .then(({ data }) => fs.writeFile(pageFilePath, data, 'utf-8'))
    .catch((error) => {
      throw new Error(`Error during file saving. ${error}`);
    })
    .then(() => path.resolve(pageFilePath));
};

export default loadPage;

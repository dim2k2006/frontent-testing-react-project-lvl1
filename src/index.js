import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import debug from 'debug';
import 'axios-debug-log';

const log = debug('page-loader');

const sources = {
  img: 'src',
  link: 'href',
  script: 'src',
};

const getSrcAttrName = (tagName) => {
  const attrName = sources[tagName];

  if (!attrName) {
    throw new Error(`Can not retrieve attribute name for tag "${tagName}".`);
  }

  return attrName;
};

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
  const { dir, name, ext } = path.parse(absoluteAssetUrl);

  const newExt = !ext ? '.html' : ext;

  const newDir = dir.length > 1 ? `${dir}/` : dir;

  const result = `${transformString(`${getUrlWithoutProtocol(baseUrl)}${newDir}`)}${name}${newExt}`; // ru-hexlet-io-assets-professions-nodejs.png

  return result;
};

const loadPage = (pageUrl, destPath = process.cwd()) => {
  const baseUrl = getBaseUrl(pageUrl);
  const fullUrl = getUrlWithoutProtocol(pageUrl);

  const pageFileName = `${transformString(fullUrl)}.html`;
  const assetsFolderName = `${transformString(fullUrl)}_files`;

  const pageFilePath = path.join(destPath, pageFileName);
  const assetsFolderPath = path.join(destPath, assetsFolderName);

  log(`Fetching page ${pageUrl}`);

  return axios
    // Download the page
    .get(pageUrl)
    .then((response) => response.data)
    // Process html
    .then((data) => {
      log(`Processing page ${pageUrl}`);

      const $ = cheerio.load(data);
      const assets = Array
        .from($('img, script[src], link'))
        .map((element) => $(element))
        .filter(($element) => {
          const tagName = $element[0].name;
          const assetUrl = new URL($element.attr(getSrcAttrName(tagName)), baseUrl)
            .toString();

          return isLocalAsset(assetUrl, pageUrl);
        });

      const assetsLinks = assets.map(($element) => {
        const tagName = $element[0].name;
        const result = new URL($element.attr(getSrcAttrName(tagName)), baseUrl).toString();

        return result;
      });

      assets.forEach(($element) => {
        // assetUrl - /assets/professions/nodejs.png
        // or
        // assetUrl - https://ru.hexlet.io/assets/professions/nodejs.png
        const tagName = $element[0].name;
        const assetUrl = $element.attr(getSrcAttrName(tagName));
        const assetFileName = getAssetFileName(assetUrl, baseUrl);
        const assetFilePath = path.join(assetsFolderName, assetFileName);

        $element.attr(getSrcAttrName(tagName), assetFilePath);
      });

      const newData = $.html();

      return { data: newData, assetsLinks };
    })
    // Create assets folder
    .then(({ data, assetsLinks }) => new Promise((resolve, reject) => {
      if (assetsLinks.length === 0) {
        resolve({ data, assetsLinks: [] });

        return;
      }

      log('Creating assets folder');

      fs.access(assetsFolderPath)
        .then(() => resolve({ data, assetsLinks }))
        .catch(() => {
          fs.mkdir(assetsFolderPath)
            .then(() => resolve({ data, assetsLinks }))
            .catch((error) => reject(error));
        });
    }))
    // Download assets
    .then(({ data, assetsLinks }) => new Promise((resolve, reject) => {
      log('Fetching assets');

      const requests = assetsLinks.map((assetLink) => axios.get(assetLink, { responseType: 'arraybuffer' }));

      Promise.all(requests)
        .catch((error) => reject(error))
        .then((responses) => resolve({ data, assetsResponses: responses }));
    }))
    // Save assets
    .then(({ data, assetsResponses }) => new Promise((resolve, reject) => {
      log('Saving assets to the fs');

      const requests = assetsResponses.map((assetResponse) => {
        const buffer = assetResponse.data;
        const url = new URL(assetResponse.config.url);
        const { pathname } = url;
        const assetFileName = getAssetFileName(pathname, baseUrl);
        const assetFilePath = path.join(assetsFolderPath, assetFileName);

        return fs.writeFile(assetFilePath, buffer);
      });

      Promise.all(requests)
        .catch((error) => reject(error))
        .then(() => resolve({ data }));
    }))
    // Save page
    .then(({ data }) => {
      log('Saving page to the fs');

      return fs.writeFile(pageFilePath, data, 'utf-8');
    })
    // Return path to the saved page
    .then(() => path.resolve(pageFilePath))
    .catch((error) => {
      throw new Error(error);
    });
};

export default loadPage;

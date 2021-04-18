import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';

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

const genPageFilename = (pageUrl) => {
  const newUrl = getUrlWithoutProtocol(pageUrl);

  const filename = newUrl
    .split('')
    .map((char) => {
      if (isLetter(char)) return char;

      if (isDigit(char)) return char;

      return '-';
    })
    .join('');

  return `${filename}.html`;
};

const pageLoader = (pageUrl, destPath = process.cwd()) => {
  const filename = genPageFilename(pageUrl);
  const filepath = path.join(destPath, filename);

  return axios
    .get(pageUrl)
    .then((response) => response.data)
    .catch((error) => {
      throw new Error(`Error during page downloading. ${error}`);
    })
    .then((data) => fs.writeFile(filepath, data, 'utf-8'))
    .catch((error) => {
      throw new Error(`Error during file saving. ${error}`);
    })
    .then(() => path.resolve(filepath));
};

export default pageLoader;

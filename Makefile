install: install-deps

run:
	bin/pageLoader.js

install-deps:
	npm install

test-watch:
	npm run test:watch

test:
	npm test

test-coverage:
	npm test -- --coverage --coverageProvider=v8

lint:
	npx eslint .

publish:
	npm publish

.PHONY: test
install: install-deps

run:
	bin/page-loader.js

install-deps:
	npm install

test:
	npm test

test-coverage:
	npm test -- --coverage --coverageProvider=v8

lint:
	npx eslint .

publish:
	npm publish

.PHONY: test
SHELL := /usr/bin/env bash

# make p=../testUtils.js n=testUtils bundle

bundle:
	$(shell NODE_PATH=~/fsbc/node_modules browserify $(p) -s $(n) > ./bundles/$(n).js)
	ls bundles
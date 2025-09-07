
# --- ファイルリスト定義 ---
SRC_TS   := $(wildcard src/*.ts)
TEST_TS  := $(wildcard tests/*.ts)

JS_SRC   := $(patsubst src/%.ts,build/src/%.js,$(SRC_TS))
JS_TEST  := $(patsubst tests/%.ts,build/tests/%.js,$(TEST_TS))

COVERAGE_SRC   := $(patsubst src/%.ts,build/coverage/src/%.js,$(SRC_TS))
COVERAGE_TEST  := $(patsubst tests/%.ts,build/coverage/tests/%.js,$(TEST_TS))

.PHONY: build-FunctionCreateAccount
build-FunctionCreateAccount: clean $(JS_SRC)
	npm ci --omit=dev
	find node_modules -depth -type d -empty -exec rm -v -r {} \;
	cp package.json $(ARTIFACTS_DIR)
	cp -r ./build/src/ $(ARTIFACTS_DIR)/src/
	cp -r node_modules/ $(ARTIFACTS_DIR)/node_modules/

build/.npm_ci.lock: package.json package-lock.json
	npm ci
	@mkdir -p $(dir $@)
	@touch $@

# --- ビルド本体（ソース＋テスト） ---
.PHONY: build
build: $(JS_SRC) $(JS_TEST)

# --- src/*.ts → build/src/*.js ---
build/src/%.js: src/%.ts esbuild.js build/.npm_ci.lock
	@mkdir -p $(dir $@)
	node esbuild.js --entry=$< --outfile=$@

# --- tests/*.ts → build/tests/*.js ---
build/tests/%.js: tests/%.ts esbuild.js build/.npm_ci.lock
	@mkdir -p $(dir $@)
	node esbuild.js --entry=$< --outfile=$@


# --- coverageビルド本体（ソース＋テスト） ---
.PHONY: build_coverage
build_coverage: $(COVERAGE_SRC) $(COVERAGE_TEST)

# --- src/*.ts → build/coverage/src/*.js ---
build/coverage/src/%.js: src/%.ts esbuild.js build/.npm_ci.lock
	@mkdir -p $(dir $@)
	node esbuild.js --entry=$< --outfile=$@ --coverage

# --- tests/*.ts → build/coverage/tests/*.js ---
build/coverage/tests/%.js: tests/%.ts esbuild.js build/.npm_ci.lock
	@mkdir -p $(dir $@)
	node esbuild.js --entry=$< --outfile=$@ --coverage

# --- テスト実行 ---
.PHONY: test
test: build
	npm run test -- --roots build/tests

.PHONY: coverage
coverage: build_coverage
	npm run test -- --roots build/coverage/tests --coverage

# --- クリーン ---
.PHONY: clean
clean:
	rm -rf build

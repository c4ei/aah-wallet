VERSION ?= 0.0.9.1
WORKFLOW ?= wallet-build.yml

.PHONY: wallet-check wallet-ubuntu wallet-windows wallet-android wallet-all

wallet-check:
	npm ci
	npm run build
	npm test
	cd src-tauri && cargo fmt --all --check
	cd src-tauri && cargo test --locked

wallet-ubuntu:
	npm ci
	npm run build:ubuntu

wallet-windows:
	@echo "Windows 빌드는 Windows 환경에서 실행해야 합니다. GitHub Actions는 make wallet-all을 사용하세요."

wallet-android:
	npm ci
	@if [ ! -d src-tauri/gen/android ]; then npm run tauri -- android init --ci; fi
	npm run build:android

wallet-all:
	@test "$(VERSION)" = "0.0.9.1" || (echo "현재 릴리스 버전은 0.0.9.1입니다." && exit 1)
	gh workflow run $(WORKFLOW) --ref main -f version=$(VERSION)
	@echo "GitHub Actions 실행을 요청했습니다: IEUM Wallet $(VERSION)"

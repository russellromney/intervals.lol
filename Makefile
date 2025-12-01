.PHONY: clean dev build test

clean:
	@echo "Cleaning up build artifacts and local files..."
	rm -f backend/server
	rm -f backend/intervals.db
	rm -rf backend/vendor
	rm -rf dist
	rm -rf node_modules
	rm -rf backend/node_modules
	find . -name ".DS_Store" -delete
	@echo "Clean complete!"

dev:
	vite

build:
	vite build

test:
	npx playwright test

backend-dev:
	cd backend && go run ./cmd/server

.DEFAULT_GOAL := help

help:
	@echo "Available targets:"
	@echo "  make clean       - Remove build artifacts and local files"
	@echo "  make dev         - Start frontend dev server"
	@echo "  make build       - Build frontend for production"
	@echo "  make test        - Run e2e tests"
	@echo "  make backend-dev - Run backend dev server"

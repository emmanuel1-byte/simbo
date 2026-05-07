include ../../.env
export

DB_URL ?= $(DATABASE_URL)

check-db:
	@if [ -z "$(DB_URL)" ]; then echo "DATABASE_URL is not set"; exit 1; fi

migrate-up: check-db
	migrate -path migrations -database "$(DB_URL)" up

migrate-down: check-db
	migrate -path migrations -database "$(DB_URL)" down 1

migrate-create:
	@if [ -z "$(name)" ]; then echo "Usage: make migrate-create name=your_migration"; exit 1; fi
	migrate create -ext sql -dir migrations -seq $(name)

schema: check-db
	pg_dump --schema-only --no-owner --no-privileges "$(DB_URL)" > schema.sql

sqlc:
	sqlc generate
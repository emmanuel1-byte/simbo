package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/middlewares"
	"simbo-api-service/internal/modules/apikey"
	"simbo-api-service/internal/modules/auth"
	"simbo-api-service/internal/modules/connection"
	"simbo-api-service/internal/modules/conversation"
	"simbo-api-service/internal/modules/profile"
	"simbo-api-service/internal/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env for local development (backend/.env, two levels up from cmd/api/).
	// In production/Docker the file won't exist and env vars come from the runtime.
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("No .env file found, reading configuration from environment")
	}

	// Use gin release mode in production to suppress debug output.
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// In Docker, DB_HOST is set to the service name ("db"). Replace localhost in
	// the DATABASE_URL from backend/.env so credentials stay in one place.
	dbURL := os.Getenv("DATABASE_URL")
	if dbHost := os.Getenv("DB_HOST"); dbHost != "" {
		dbURL = strings.NewReplacer(
			"@localhost:", "@"+dbHost+":",
			"@127.0.0.1:", "@"+dbHost+":",
		).Replace(dbURL)
	}

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatal("Error connecting to database: ", err)
	}
	defer pool.Close()

	queries := store.New(pool)

	// MIGRATIONS_PATH is set by the Dockerfile (/app/migrations).
	// Locally, fall back to the path relative to cmd/api/.
	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "../../internal/database/migrations"
	}

	m, err := migrate.New("file://"+migrationsPath, dbURL)
	if err != nil {
		log.Fatal(err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(err)
	} else if err == migrate.ErrNoChange {
		log.Println("No new migrations to run")
	}

	// Detect schema drift: schema_migrations may record a version while the
	// actual tables were dropped manually. If the sentinel "users" table is
	// missing, reset the migration version and re-run from scratch.
	var usersExists bool
	_ = pool.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'users'
	)`).Scan(&usersExists)
	if !usersExists {
		log.Println("Schema drift detected: tables missing — resetting migration version and re-running")
		if err := m.Force(-1); err != nil {
			log.Fatal("migration force reset failed: ", err)
		}
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatal("re-migration failed: ", err)
		}
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// ── Router ────────────────────────────────────────────────────────────────
	router := gin.New()
	router.SetTrustedProxies(nil)

	// Security & observability middleware applied to every request.
	router.Use(middlewares.SecurityHeaders())
	router.Use(middlewares.ErrorMiddleware())
	router.Use(middlewares.SlogMiddleware(logger))
	router.Use(gin.Recovery())

	// Limit request body to 10 MB — prevents memory exhaustion from large payloads.
	router.MaxMultipartMemory = 10 << 20

	// CORS_ORIGINS: comma-separated list, e.g. "https://app.example.com"
	corsOrigins := []string{"http://localhost:3000"}
	if raw := os.Getenv("CORS_ORIGINS"); raw != "" {
		corsOrigins = strings.Split(raw, ",")
	}
	router.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check — no rate limit, no auth.
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, utils.Response{Success: true, Data: gin.H{"status": "ok"}})
	})

	api := router.Group("/api")

	// Auth routes get a tighter rate limit (brute-force protection).
	authGroup := api.Group("/")
	authGroup.Use(middlewares.AuthLimiter.Middleware())
	auth.RegisterAuthRoutes(authGroup, queries, pool)

	// All other routes share the general API limiter.
	appGroup := api.Group("/")
	appGroup.Use(middlewares.APILimiter.Middleware())
	profile.RegisterProfileRoutes(appGroup, queries, pool)
	connection.RegisterConnectionRoutes(appGroup, queries, pool)
	apikey.RegisterAPIKeyRoutes(appGroup, queries, pool)

	// Query/stream routes get their own stricter limiter (AI calls are expensive).
	queryGroup := api.Group("/")
	queryGroup.Use(middlewares.QueryLimiter.Middleware())
	conversation.RegisterConversationRoutes(queryGroup, queries, pool)

	// ── HTTP server ───────────────────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router.Handler(),

		// Conservative timeouts to resist slow-loris and resource exhaustion.
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		// WriteTimeout must be long enough for SSE query streams (~2 min max).
		WriteTimeout: 3 * time.Minute,
		IdleTimeout:  90 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown Server ...")

	shutCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Println("Server forced shutdown:", err)
	}
	log.Println("Server exiting")
}

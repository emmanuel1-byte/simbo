package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/middlewares"
	"simbo-api-service/internal/modules/auth"
	"simbo-api-service/internal/utils"

	"os"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load("../../.env")
	if err != nil {
		log.Fatal("Error loading .env")
	}

	//Init database connection
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal("Error connecting to database")
	}

	defer conn.Close(ctx)
	queries := store.New(conn)

	//Database migration
	m, err := migrate.New("file://../../internal/database/migrations", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	if err := m.Up(); err != nil {
		if err != migrate.ErrNoChange {
			log.Fatal(err)
		}
		log.Println("No new migration to run")
	}

	router := gin.Default()
	router.SetTrustedProxies(nil)
	router.GET("healthz", func(c *gin.Context) {
		time.Sleep(5 * time.Second)
		c.JSON(http.StatusOK, utils.Response{
			Success: true,
			Data:    gin.H{"status": "ok"},
		})
	})

	//Register middlewares
	router.Use(middlewares.ErrorMiddleware())

	//Register routes
	api := router.Group("/api/v1")
	auth.RegisterAuthRoutes(api, queries, *conn)

	//Server set-up
	srv := &http.Server{
		Addr:    ":8080",
		Handler: router.Handler(),
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Listen %s\n", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with
	// a timeout of 5 seconds.
	quit := make(chan os.Signal, 1)
	// kill (no params) by default sends syscall.SIGTERM
	// kill -2 is syscall.SIGINT
	// kill -9 is syscall.SIGKILL but can't be caught, so don't need add it
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown Server ...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Println("Server Shutdown:", err)
	}
	log.Println("Server exiting")

}

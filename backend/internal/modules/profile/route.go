package profile

import (
	"os"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterProfileRoutes(rg *gin.RouterGroup, queries *store.Queries, _ *pgxpool.Pool) {
	secret := []byte(os.Getenv("JWT_ACCESS_SECRET"))
	h := NewHandler(queries)

	r := rg.Group("/profile")
	r.Use(middlewares.AuthMiddleware(secret))
	{
		r.GET("/", h.GetProfile)
		r.PUT("/", h.UpdateProfile)
	}
}

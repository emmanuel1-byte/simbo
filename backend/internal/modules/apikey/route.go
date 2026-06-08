package apikey

import (
	"os"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/middlewares"
	"simbo-api-service/internal/modules/connection"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterAPIKeyRoutes(rg *gin.RouterGroup, queries *store.Queries, _ *pgxpool.Pool) {
	secret := []byte(os.Getenv("JWT_ACCESS_SECRET"))
	h := NewHandler(queries, connection.AESEncryptor{})

	r := rg.Group("/settings/api-key")
	r.Use(middlewares.AuthMiddleware(secret))
	{
		r.GET("", h.GetActiveKey)
		r.POST("", h.AddKey)
		r.POST("/test", h.TestKey)
		r.PUT("/rotate", h.RotateKey)
		r.DELETE("", h.RevokeKey)
	}
}

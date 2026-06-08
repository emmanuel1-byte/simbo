package connection

import (
	"os"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterConnectionRoutes(rg *gin.RouterGroup, queries *store.Queries, _ *pgxpool.Pool) {
	secret := []byte(os.Getenv("JWT_ACCESS_SECRET"))
	h := NewHandler(queries, AESEncryptor{}, LiveTester{})

	r := rg.Group("/connections")
	r.Use(middlewares.AuthMiddleware(secret))
	{
		r.GET("", h.ListConnections)
		r.POST("", h.AddConnection)
		r.POST("/probe", h.ProbeConnection)
		r.POST("/:id/test", h.TestConnection)
		r.GET("/:id/tables", h.GetTables)
		r.GET("/:id/schema", h.GetSchema)
		r.DELETE("/:id", h.RemoveConnection)
	}
}

package conversation

import (
	"os"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/middlewares"
	"simbo-api-service/internal/modules/connection"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterConversationRoutes(rg *gin.RouterGroup, queries *store.Queries, _ *pgxpool.Pool) {
	secret := []byte(os.Getenv("JWT_ACCESS_SECRET"))

	pipeline := NewPipeline(
		queries,
		connection.AESEncryptor{},
		LiveExecutor{},
		LiveIntrospector{},
	)

	h := NewHandler(queries, connection.AESEncryptor{}, pipeline)

	r := rg.Group("/conversations")
	r.Use(middlewares.AuthMiddleware(secret))
	{
		r.GET("", h.ListConversations)
		r.POST("", h.CreateConversation)
		r.GET("/:id", h.GetConversation)
		r.DELETE("/:id", h.DeleteConversation)

		// Messages
		r.GET("/:id/messages", h.ListMessages)

		// Query endpoints (SSE streaming)
		r.POST("/:id/query", h.Query)
		r.POST("/:id/query/voice", h.VoiceQuery)
	}
}

package auth

import (
	"context"
	"os"
	"time"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/integration"
	"simbo-api-service/internal/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterAuthRoutes(rg *gin.RouterGroup, queries *store.Queries, db *pgxpool.Pool) {
	secret := []byte(os.Getenv("JWT_ACCESS_SECRET"))

	mailer := SendMailFunc(func(to, template string, data map[string]interface{}) {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			integration.SendEmail(ctx, to, template, integration.EmailData(data))
		}()
	})

	h := NewHandler(
		queries,
		db,
		func(tx pgx.Tx) Querier { return queries.WithTx(tx) },
		mailer,
	)

	r := rg.Group("/auth")
	{
		r.POST("/signup", h.Signup)
		r.POST("/request-otp", h.RequestOtp)
		r.POST("/login", h.Login)
		r.POST("/verify-otp", h.VerifyOtp)
		r.POST("/request-password-reset", h.RequestPasswordReset)
		r.PATCH("/reset-password", h.ResetPassword)
		r.POST("/refresh-token", middlewares.AuthMiddleware(secret), h.RefreshToken)
	}
}

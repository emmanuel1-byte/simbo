package auth

import (
	"simbo-api-service/internal/database/store"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func RegisterAuthRoutes(rg *gin.RouterGroup, queries *store.Queries, db pgx.Conn) {
	auth := rg.Group("/auth")
	{
		auth.POST("/signup", Signup(&db, queries))
		auth.POST("/request-otp", RequestOtp(&db, queries))
		auth.POST("/login", Login)
		auth.POST("/verify-otp", VerifyOtp)
		auth.POST("/request-password-reset", RequestPasswordReset)
		auth.PATCH("/reset-password", ResetPassword)
	}
}

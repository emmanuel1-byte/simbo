package auth

import (
	"simbo-api-service/internal/database/store"

	"github.com/gin-gonic/gin"
)

func RegisterAuthRoutes(rg *gin.RouterGroup, db *store.Queries) {
	auth := rg.Group("/auth")
	{
		auth.POST("/signup", Signup(db))
		auth.POST("/login", Login)
		auth.POST("/verify-otp", VerifyOtp)
		auth.POST("/request-password-reset", RequestPasswordReset)
		auth.PATCH("/reset-password", ResetPassword)
	}
}

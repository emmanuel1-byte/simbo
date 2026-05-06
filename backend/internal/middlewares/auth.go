package middlewares

import (
	"net/http"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("your_secret_key")

type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, utils.Response{
				Success: false,
				Error: &utils.ErrorInfo{
					Code:    "UNAUTHORIZED",
					Message: "Missing authorization token",
				},
			})
			c.Abort()
			return
		}

		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		}

		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, utils.Response{
				Success: false,
				Error: &utils.ErrorInfo{
					Code:    "UNAUTHORIZED",
					Message: "Invalid token",
				},
			})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(*Claims); ok {
			c.Set("userId", claims.UserID)
			c.Next()
		}
	}
}

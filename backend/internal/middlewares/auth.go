package middlewares

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type Claims struct {
	jwt.RegisteredClaims
}

func UnauthorizedError(c *gin.Context, msg string) {
	c.AbortWithStatusJSON(401, gin.H{"error": msg})
}

func AuthMiddleware(secret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			UnauthorizedError(c, "Missing authorization token")
			return
		}

		tokenString, ok := strings.CutPrefix(header, "Bearer ")
		if !ok {
			UnauthorizedError(c, "Invalid authorization scheme")
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return secret, nil
		})

		if err != nil || !token.Valid {
			slog.Error("JWT error",
				"err", err,
			)
			switch {
			case errors.Is(err, jwt.ErrTokenExpired):
				UnauthorizedError(c, "Token expired")
			default:
				UnauthorizedError(c, "Invalid token")
			}
			return
		}

		var uid pgtype.UUID
		err = uid.Scan(claims.Subject)
		if err != nil {
			UnauthorizedError(c, "Invalid token")
			return
		}

		c.Set("sub", uid)
		c.Next()
	}
}

package utils

import (
	"github.com/golang-jwt/jwt/v5"
	"os"
	"time"
)

func CreateAccessToken(userID string) (string, error) {
	secret := []byte(os.Getenv("JWT_ACCESS_SECRET"))
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID,
		"iat": now.Unix(),
		"nbf": now.Unix(),
		"exp": now.Add(7 * 24 * time.Hour).Unix(),
	})

	return token.SignedString(secret)
}

func CreateRefreshToken(userID string) (string, error) {
	secret := []byte(os.Getenv("JWT_REFRESH_SECRET"))
	now := time.Now()
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID,
		"iat": now.Unix(),
		"nbf": now.Unix(),
		"exp": now.Add(30 * 24 * time.Hour).Unix(),
	})

	return refreshToken.SignedString(secret)

}

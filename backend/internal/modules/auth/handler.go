package auth

import (
	"context"
	"errors"
	"net/http"
	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/utils"
	"strings"
	"time"

	"simbo-api-service/internal/integration"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

func Signup(db *pgx.Conn, queries *store.Queries) gin.HandlerFunc {
	return func(c *gin.Context) {
		var json SignupSchema
		if err := c.ShouldBindJSON(&json); err != nil {
			utils.BadRequestError(c, err.Error())
			return
		}

		_, err := queries.GetUserByEmail(c, json.Email)
		if err == nil {
			utils.ConflictError(c, "User already exist")
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			utils.InternalServerError(c)
			return
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(json.Password), bcrypt.DefaultCost)
		if err != nil {
			utils.InternalServerError(c)
			return
		}

		tx, err := db.Begin(c)
		if err != nil {
			utils.InternalServerError(c)
			return

		}
		defer tx.Rollback(c)

		qtx := queries.WithTx(tx)

		newUser, err := qtx.CreateUser(c, store.CreateUserParams{
			Fullname:     json.FullName,
			Email:        json.Email,
			PasswordHash: string(passwordHash),
		})
		if err != nil {
			var pgError *pgconn.PgError
			if errors.As(err, &pgError) && pgError.Code == "23505" {
				utils.ConflictError(c, "User already exist")
				return
			}
			utils.InternalServerError(c)
			return
		}

		otp, err := utils.GenerateSecureOtp(c)
		if err != nil {
			utils.InternalServerError(c)
			return
		}

		otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), bcrypt.DefaultCost)
		if err != nil {
			utils.InternalServerError(c)
			return
		}

		_, err = qtx.CreateOtp(c, store.CreateOtpParams{
			UserID:  newUser.ID,
			OtpHash: string(otpHash),
			Type:    "email_verification",
			ExpiresAt: pgtype.Timestamptz{
				Time:  time.Now().Add(5 * time.Minute),
				Valid: true,
			},
		})
		if err != nil {
			utils.InternalServerError(c)
			return
		}

		err = tx.Commit(c)
		if err != nil {
			utils.InternalServerError(c)
			return
		}

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			integration.SendEmail(ctx, json.Email, "sign-up", integration.EmailData{
				"firstName": strings.Split(json.FullName, " ")[0],
				"otp":      otp,
			})
		}()

		c.JSON(http.StatusCreated, utils.Response{
			Success: true,
			Data: gin.H{
				"user": newUser,
			},
		})
	}
}

func RequestOtp(db *pgx.Conn, queries *store.Queries) gin.HandlerFunc {
	return func(c *gin.Context) {
		var json SignupSchema
		if err := c.ShouldBind(json); err != nil {
			utils.BadRequestError(c, err.Error())
			return
		}

		c.JSON(http.StatusOK, utils.Response{
			Success: true,
			Data:    gin.H{},
		})
	}
}

func Login(c *gin.Context) {
	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{},
	})
}

func VerifyOtp(c *gin.Context) {
	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{},
	})
}

func RequestPasswordReset(c *gin.Context) {
	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{},
	})
}

func ResetPassword(c *gin.Context) {
	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{},
	})
}

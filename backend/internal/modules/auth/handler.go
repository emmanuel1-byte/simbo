package auth

import (
	"net/http"
	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
)

func Signup(db *store.Queries) gin.HandlerFunc {
	return func(c *gin.Context) {
		var json SignupSchema
		if err := c.ShouldBindJSON(&json); err != nil {
			c.JSON(http.StatusBadRequest, utils.Response{
				Success: false,
				Error: &utils.ErrorInfo{
					Code:    "BAD_REQUEST",
					Message: err.Error(),
				},
			})
		}
		_, err := db.GetUserByEmail(c, json.Email)
		if err == nil {
			c.JSON(http.StatusConflict, utils.Response{
				Success: false,
				Error: &utils.ErrorInfo{
					Code:    "CONFLICT",
					Message: "User already exist",
				},
			})
		}

		newUser, err := db.CreateUser(c, store.CreateUserParams{
			Email:        json.Email,
			PasswordHash: json.Password,
		})
		//Send verification emai

		c.JSON(http.StatusCreated, utils.Response{
			Success: true,
			Data: gin.H{
				"user": newUser,
			},
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

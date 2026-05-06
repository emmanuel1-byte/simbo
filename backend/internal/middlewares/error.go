package middlewares

import (
	"net/http"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
)

func ErrorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err

			c.JSON(http.StatusInternalServerError, utils.Response{
				Success: false,
				Error: &utils.ErrorInfo{
					Code:    "NTERNAL_SERVER_ERROR",
					Message: err.Error(),
				},
			})
		}
	}
}

package utils

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

func InternalServerError(c *gin.Context, err error) {
	slog.Error("internal server error",
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
		"err", err,
	)
	c.JSON(http.StatusInternalServerError, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "INTERNAL_SERVER",
			Message: "Something went wrong",
		},
	})
}

func ConflictError(c *gin.Context, msg string) {
	slog.Warn("conflict",
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
		"msg", msg,
	)
	c.JSON(http.StatusConflict, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "CONFLICT",
			Message: msg,
		},
	})
}

func BadRequestError(c *gin.Context, msg string) {
	slog.Warn("bad request",
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
		"msg", msg,
	)
	c.JSON(http.StatusBadRequest, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "BAD_REQUEST",
			Message: msg,
		},
	})
}

func NotFoundError(c *gin.Context, msg string) {
	slog.Warn("not found",
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
		"msg", msg,
	)
	c.JSON(http.StatusNotFound, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "NOT_FOUND",
			Message: msg,
		},
	})
}

func UnauthorizedError(c *gin.Context, msg string) {
	slog.Warn("not found",
		"path", c.Request.URL.Path,
		"method", c.Request.Method,
		"msg", msg,
	)
	c.JSON(http.StatusUnauthorized, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "UNAUTHORIZED",
			Message: msg,
		},
	})
}

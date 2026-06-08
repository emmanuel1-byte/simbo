package auth

type SignupSchema struct {
	FullName string `json:"fullname" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=20"`
}

type RequestOtpSchema struct {
	Email string `json:"email" binding:"required"`
}

type LoginSchema struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=20"`
}

type VerifyOtpSchema struct {
	Email string `json:"email" binding:"required"`
	Otp   string `json:"otp" binding:"required,len=6"`
}

type RequestPasswordResetSchema struct {
	Email string `json:"email" binding:"required"`
}

type ResetPasswordSchema struct {
	Email           string `json:"email" binding:"required"`
	Otp             string `json:"otp" binding:"required,len=6"`
	Password        string `json:"password" binding:"required,min=8,max=20"`
	ConfirmPassword string `json:"confirmPassword" binding:"required,eqfield=Password,min=8,max=20"`
}
type RefreshTokenSchema struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

package apikey

const (
	ProviderOpenAI    = "openai"
	ProviderAnthropic = "anthropic"
)

type AddKeySchema struct {
	Provider string `json:"provider" binding:"required,oneof=openai anthropic"`
	Model    string `json:"model" binding:"required"`
	Key      string `json:"key" binding:"required"`
}

type RotateKeySchema struct {
	Key   string `json:"key" binding:"required"`
	Model string `json:"model" binding:"required"`
}

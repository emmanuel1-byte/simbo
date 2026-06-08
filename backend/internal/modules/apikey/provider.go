package apikey

import (
	"context"
	"fmt"
	"io"
	"net/http"
)

// pingProvider makes a lightweight, token-free call to verify the key is accepted.
func pingProvider(ctx context.Context, provider, key string) error {
	switch provider {
	case ProviderOpenAI:
		return pingOpenAI(ctx, key)
	case ProviderAnthropic:
		return pingAnthropic(ctx, key)
	default:
		return fmt.Errorf("unknown provider: %s", provider)
	}
}

func pingOpenAI(ctx context.Context, key string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.openai.com/v1/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("could not reach OpenAI: %w", err)
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK:
		return nil
	case http.StatusUnauthorized:
		return fmt.Errorf("invalid API key — check your key in the OpenAI dashboard")
	case http.StatusForbidden:
		return fmt.Errorf("key is valid but lacks permission — check your OpenAI org settings")
	case http.StatusTooManyRequests:
		return fmt.Errorf("rate limited — wait a moment and try again")
	default:
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("OpenAI returned %d: %s", resp.StatusCode, body)
	}
}

// pingAnthropic uses GET /v1/models — no tokens consumed, no model-tier restrictions.
func pingAnthropic(ctx context.Context, key string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.anthropic.com/v1/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", key)
	req.Header.Set("anthropic-version", "2023-06-01")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("could not reach Anthropic: %w", err)
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK:
		return nil
	case http.StatusUnauthorized:
		return fmt.Errorf("invalid API key — check your key in the Anthropic console")
	case http.StatusForbidden:
		return fmt.Errorf("key is valid but lacks permission — check your Anthropic account")
	case http.StatusTooManyRequests:
		return fmt.Errorf("rate limited — wait a moment and try again")
	default:
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Anthropic returned %d: %s", resp.StatusCode, body)
	}
}

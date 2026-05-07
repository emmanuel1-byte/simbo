package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

type EmailData map[string]interface{}

func SendEmail(c context.Context, email, event string, data EmailData) error {
	var (
		plunkKey  = os.Getenv("USEPLUNK_PUBLIC_KEY")
		httpClent = &http.Client{Timeout: 10 * time.Second}
	)
	url := "https://next-api.useplunk.com/v1/track"

	payload := map[string]interface{}{
		"email": email,
		"event": event,
		"data":  data,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+plunkKey)

	client := httpClent
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusOK {
		log.Println("Email sent successfully")
		return nil
	}

	bodyBytes, _ := io.ReadAll(res.Body)
	return fmt.Errorf("Failed to send email: %s", string(bodyBytes))
}

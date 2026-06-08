package conversation

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
)

// LLM is the provider-agnostic interface used by the pipeline.
type LLM interface {
	// GenerateSQL returns a structured SQL + interpretation from the user's question.
	GenerateSQL(ctx context.Context, schema string, history []HistoryMsg, question string) (*SQLGenResult, error)
	// StreamSummary writes a natural-language summary token-by-token into out.
	StreamSummary(ctx context.Context, question, resultJSON string, out chan<- string) error
}

const (
	openAIBaseURL = "https://api.openai.com/v1"
	geminiBaseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
)

// NewLLM returns the right LLM implementation for a provider string.
func NewLLM(provider, model, apiKey string) (LLM, error) {
	switch strings.ToLower(provider) {
	case "openai":
		return &openAILLM{model: model, key: apiKey, baseURL: openAIBaseURL}, nil
	case "gemini", "google":
		return &openAILLM{model: model, key: apiKey, baseURL: geminiBaseURL}, nil
	case "anthropic":
		return &anthropicLLM{model: model, key: apiKey}, nil
	default:
		return nil, fmt.Errorf("unsupported LLM provider: %q", provider)
	}
}

const headerContentType = "Content-Type"

// ─── Audio transcription ─────────────────────────────────────────────────────

// TranscribeAudio sends an audio recording to OpenAI Whisper and returns the
// transcribed text. Only available for users with an OpenAI API key.
func TranscribeAudio(ctx context.Context, apiKey string, audio io.Reader, filename string) (string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err = io.Copy(fw, audio); err != nil {
		return "", err
	}
	if err = w.WriteField("model", "whisper-1"); err != nil {
		return "", err
	}
	w.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.openai.com/v1/audio/transcriptions", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set(headerContentType, w.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("whisper %d: %s", resp.StatusCode, raw)
	}

	var result struct {
		Text string `json:"text"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return strings.TrimSpace(result.Text), nil
}

// ─── System prompts ──────────────────────────────────────────────────────────

const sqlSystemPrompt = `You are an expert SQL analyst with READ-ONLY access to a database.

STRICT RULES — never break these:
1. Generate ONLY SELECT statements. Never INSERT, UPDATE, DELETE, DROP, CREATE, ALTER or any write operation.
2. Start the SQL with the comment: -- read-only · validated · safe-mode
3. Return ONLY valid JSON — no markdown fences, no explanation, no preamble.

Database schema:
%s

Return this EXACT JSON structure (include only relevant tags):
{
  "interpretation": {
    "summary": "one clear sentence describing what is being queried",
    "tags": [
      {"type": "table",  "value": "table_name"},
      {"type": "filter", "value": "filter description"},
      {"type": "agg",    "value": "aggregation type"},
      {"type": "range",  "value": "time range"},
      {"type": "group",  "value": "grouping field"},
      {"type": "join",   "value": "join description"},
      {"type": "sort",   "value": "sort description"},
      {"type": "limit",  "value": "limit value"}
    ]
  },
  "sql": "SELECT ..."
}`

const summarySystemPrompt = `You are a concise data analyst. Summarize the query result in 1-3 sentences.
Rules:
- Use *italic* (single asterisks) for key numbers and percentages.
- Mention the strongest insight first.
- Never describe the SQL — describe what the data means.
- Be specific: use actual values from the result.`

// ─── OpenAI ──────────────────────────────────────────────────────────────────

type openAILLM struct {
	model   string
	key     string
	baseURL string
}

func (o *openAILLM) GenerateSQL(ctx context.Context, schema string, history []HistoryMsg, question string) (*SQLGenResult, error) {
	messages := buildOpenAIMessages(schema, history, question)

	reqBody := map[string]any{
		"model":       o.model,
		"messages":    messages,
		"temperature": 0,
		"max_tokens":  2048,
	}
	// Enable JSON mode for providers that reliably honour it.
	if o.baseURL == openAIBaseURL || o.baseURL == geminiBaseURL {
		reqBody["response_format"] = map[string]string{"type": "json_object"}
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	resp, err := openAIPost(ctx, o.baseURL, o.key, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("llm api %d: %s", resp.StatusCode, raw)
	}

	content, err := extractOpenAIContent(raw)
	if err != nil {
		return nil, err
	}

	// Some models (e.g. DeepSeek) wrap JSON in markdown code fences despite
	// being instructed not to. Strip them before parsing.
	content = stripCodeFences(content)

	var result SQLGenResult
	if err = json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("parse sql-gen response: %w — raw: %.200s", err, content)
	}
	return &result, nil
}

func (o *openAILLM) StreamSummary(ctx context.Context, question, resultJSON string, out chan<- string) error {
	messages := []map[string]string{
		{"role": "system", "content": summarySystemPrompt},
		{"role": "user", "content": fmt.Sprintf("Question: %s\n\nQuery result (JSON):\n%s", question, resultJSON)},
	}

	body, err := json.Marshal(map[string]any{
		"model":       o.model,
		"messages":    messages,
		"stream":      true,
		"temperature": 0.3,
		"max_tokens":  500,
	})
	if err != nil {
		return err
	}

	resp, err := openAIPost(ctx, o.baseURL, o.key, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("openai stream %d: %s", resp.StatusCode, raw)
	}

	return parseOpenAIStream(ctx, resp.Body, out)
}

func buildOpenAIMessages(schema string, history []HistoryMsg, question string) []map[string]string {
	msgs := []map[string]string{
		{"role": "system", "content": fmt.Sprintf(sqlSystemPrompt, schema)},
	}
	for _, h := range history {
		msgs = append(msgs, map[string]string{"role": h.Role, "content": h.Content})
	}
	msgs = append(msgs, map[string]string{"role": "user", "content": question})
	return msgs
}

func openAIPost(ctx context.Context, baseURL, key string, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set(headerContentType, "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	return http.DefaultClient.Do(req)
}

// stripCodeFences removes markdown code fences (```json ... ``` or ``` ... ```)
// that some models add despite being instructed to return plain JSON.
func stripCodeFences(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}
	// Drop the opening fence line (e.g. "```json\n")
	if nl := strings.Index(s, "\n"); nl >= 0 {
		s = s[nl+1:]
	}
	// Drop the closing fence
	if i := strings.LastIndex(s, "```"); i >= 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}

func extractOpenAIContent(raw []byte) (string, error) {
	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return "", err
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no choices in OpenAI response")
	}
	return resp.Choices[0].Message.Content, nil
}

func parseOpenAIStream(ctx context.Context, body io.Reader, out chan<- string) error {
	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			return nil
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			out <- chunk.Choices[0].Delta.Content
		}
	}
	return scanner.Err()
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

type anthropicLLM struct {
	model string
	key   string
}

func (a *anthropicLLM) GenerateSQL(ctx context.Context, schema string, history []HistoryMsg, question string) (*SQLGenResult, error) {
	msgs := buildAnthropicMessages(history, question)

	// Schema is injected via the system prompt with prompt-caching enabled.
	body, err := json.Marshal(map[string]any{
		"model":      a.model,
		"max_tokens": 2048,
		"system": []map[string]any{
			{
				"type": "text",
				"text": fmt.Sprintf(sqlSystemPrompt, schema),
				"cache_control": map[string]string{"type": "ephemeral"},
			},
		},
		"messages": msgs,
	})
	if err != nil {
		return nil, err
	}

	resp, err := anthropicPost(ctx, a.key, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anthropic %d: %s", resp.StatusCode, raw)
	}

	content, err := extractAnthropicContent(raw)
	if err != nil {
		return nil, err
	}

	content = stripCodeFences(content)

	var result SQLGenResult
	if err = json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("parse sql-gen response: %w — raw: %.200s", err, content)
	}
	return &result, nil
}

func (a *anthropicLLM) StreamSummary(ctx context.Context, question, resultJSON string, out chan<- string) error {
	body, err := json.Marshal(map[string]any{
		"model":      a.model,
		"max_tokens": 500,
		"stream":     true,
		"system":     summarySystemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": fmt.Sprintf("Question: %s\n\nQuery result (JSON):\n%s", question, resultJSON)},
		},
	})
	if err != nil {
		return err
	}

	resp, err := anthropicPost(ctx, a.key, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("anthropic stream %d: %s", resp.StatusCode, raw)
	}

	return parseAnthropicStream(ctx, resp.Body, out)
}

func buildAnthropicMessages(history []HistoryMsg, question string) []map[string]string {
	var msgs []map[string]string
	for _, h := range history {
		msgs = append(msgs, map[string]string{"role": h.Role, "content": h.Content})
	}
	msgs = append(msgs, map[string]string{"role": "user", "content": question})
	return msgs
}

func anthropicPost(ctx context.Context, key string, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set(headerContentType, "application/json")
	req.Header.Set("x-api-key", key)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("anthropic-beta", "prompt-caching-2024-07-31")
	return http.DefaultClient.Do(req)
}

func extractAnthropicContent(raw []byte) (string, error) {
	var resp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return "", err
	}
	for _, c := range resp.Content {
		if c.Type == "text" {
			return c.Text, nil
		}
	}
	return "", fmt.Errorf("no text content in Anthropic response")
}

func parseAnthropicStream(ctx context.Context, body io.Reader, out chan<- string) error {
	scanner := bufio.NewScanner(body)
	var eventType string
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		line := scanner.Text()
		if strings.HasPrefix(line, "event: ") {
			eventType = strings.TrimPrefix(line, "event: ")
			continue
		}
		if !strings.HasPrefix(line, "data: ") || eventType != "content_block_delta" {
			continue
		}
		var delta struct {
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &delta); err != nil {
			continue
		}
		if delta.Delta.Type == "text_delta" && delta.Delta.Text != "" {
			out <- delta.Delta.Text
		}
	}
	return scanner.Err()
}

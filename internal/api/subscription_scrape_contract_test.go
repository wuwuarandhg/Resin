package api

import (
	"net/http"
	"testing"
)

func TestAPIContract_SubscriptionScrapeCreateValidation(t *testing.T) {
	srv, _, _ := newControlPlaneTestServer(t)

	createRec := doJSONRequest(t, srv, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"name":            "sub-scrape",
		"source_type":     "scrape",
		"update_interval": "1h",
	}, true)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create scrape subscription status: got %d, want %d, body=%s", createRec.Code, http.StatusCreated, createRec.Body.String())
	}
	body := decodeJSONMap(t, createRec)
	if got, _ := body["source_type"].(string); got != "scrape" {
		t.Fatalf("create scrape source_type: got %q, want %q", got, "scrape")
	}
	if got, _ := body["url"].(string); got != "" {
		t.Fatalf("create scrape url: got %q, want empty", got)
	}
	if got, _ := body["content"].(string); got != "" {
		t.Fatalf("create scrape content: got %q, want empty", got)
	}

	rec := doJSONRequest(t, srv, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"name":        "sub-scrape-url",
		"source_type": "scrape",
		"url":         "https://example.com/sub",
	}, true)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("create scrape with url status: got %d, want %d, body=%s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	assertErrorCode(t, rec, "INVALID_ARGUMENT")

	rec = doJSONRequest(t, srv, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"name":        "sub-scrape-content",
		"source_type": "scrape",
		"content":     "vmess://example",
	}, true)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("create scrape with content status: got %d, want %d, body=%s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	assertErrorCode(t, rec, "INVALID_ARGUMENT")
}


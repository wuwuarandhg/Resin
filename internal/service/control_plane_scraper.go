package service

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Resinat/Resin/internal/model"
	"github.com/Resinat/Resin/internal/state"
)

// ------------------------------------------------------------------
// Scraper Sources
// ------------------------------------------------------------------

var validFormats = map[string]bool{
	"txt":            true,
	"json_geonode":   true,
	"json_sockslist": true,
	"json_pubproxy":  true,
	"json_proxifly":  true,
}

var validProtocols = map[string]bool{
	"http":   true,
	"socks5": true,
	"socks4": true,
}

// ScraperSourceResponse is the API response for a scraper source.
type ScraperSourceResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Protocol  string `json:"protocol"`
	Format    string `json:"format"`
	Enabled   bool   `json:"enabled"`
	CreatedAt string `json:"created_at"`
}

func scraperSourceToResponse(s model.ScraperSource) ScraperSourceResponse {
	createdAt := ""
	if s.CreatedAtNs > 0 {
		createdAt = time.Unix(0, s.CreatedAtNs).UTC().Format(time.RFC3339Nano)
	}
	return ScraperSourceResponse{
		ID:        s.ID,
		Name:      s.Name,
		URL:       s.URL,
		Protocol:  s.Protocol,
		Format:    s.Format,
		Enabled:   s.Enabled,
		CreatedAt: createdAt,
	}
}

// ListScraperSources returns all scraper sources.
func (s *ControlPlaneService) ListScraperSources() ([]ScraperSourceResponse, error) {
	sources, err := s.Engine.ListScraperSources()
	if err != nil {
		return nil, internal("list scraper sources", err)
	}
	result := make([]ScraperSourceResponse, len(sources))
	for i, src := range sources {
		result[i] = scraperSourceToResponse(src)
	}
	return result, nil
}

// CreateScraperSourceRequest holds parameters for creating a scraper source.
type CreateScraperSourceRequest struct {
	Name     *string `json:"name"`
	URL      *string `json:"url"`
	Protocol *string `json:"protocol"`
	Format   *string `json:"format"`
	Enabled  *bool   `json:"enabled"`
}

// CreateScraperSource creates a new scraper source.
func (s *ControlPlaneService) CreateScraperSource(req CreateScraperSourceRequest) (*ScraperSourceResponse, error) {
	if req.Name == nil || strings.TrimSpace(*req.Name) == "" {
		return nil, invalidArg("name is required")
	}
	if req.URL == nil || strings.TrimSpace(*req.URL) == "" {
		return nil, invalidArg("url is required")
	}
	if _, verr := parseHTTPAbsoluteURL("url", strings.TrimSpace(*req.URL)); verr != nil {
		return nil, verr
	}

	protocol := "socks5"
	if req.Protocol != nil {
		protocol = strings.ToLower(strings.TrimSpace(*req.Protocol))
	}
	if !validProtocols[protocol] {
		return nil, invalidArg("protocol: must be http, socks5, or socks4")
	}

	format := "txt"
	if req.Format != nil {
		format = strings.ToLower(strings.TrimSpace(*req.Format))
	}
	if !validFormats[format] {
		return nil, invalidArg("format: must be txt, json_geonode, json_sockslist, json_pubproxy, or json_proxifly")
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	src := model.ScraperSource{
		ID:          uuid.New().String(),
		Name:        strings.TrimSpace(*req.Name),
		URL:         strings.TrimSpace(*req.URL),
		Protocol:    protocol,
		Format:      format,
		Enabled:     enabled,
		CreatedAtNs: time.Now().UnixNano(),
	}
	if err := s.Engine.UpsertScraperSource(src); err != nil {
		return nil, internal("persist scraper source", err)
	}
	resp := scraperSourceToResponse(src)
	return &resp, nil
}

// UpdateScraperSourceRequest holds parameters for patching a scraper source.
type UpdateScraperSourceRequest struct {
	Name     *string `json:"name"`
	URL      *string `json:"url"`
	Protocol *string `json:"protocol"`
	Format   *string `json:"format"`
	Enabled  *bool   `json:"enabled"`
}

// UpdateScraperSource applies a partial update to a scraper source.
func (s *ControlPlaneService) UpdateScraperSource(id string, req UpdateScraperSourceRequest) (*ScraperSourceResponse, error) {
	sources, err := s.Engine.ListScraperSources()
	if err != nil {
		return nil, internal("load scraper sources", err)
	}
	var found *model.ScraperSource
	for i := range sources {
		if sources[i].ID == id {
			found = &sources[i]
			break
		}
	}
	if found == nil {
		return nil, notFound("scraper source not found")
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, invalidArg("name must not be empty")
		}
		found.Name = name
	}
	if req.URL != nil {
		u := strings.TrimSpace(*req.URL)
		if u == "" {
			return nil, invalidArg("url must not be empty")
		}
		if _, verr := parseHTTPAbsoluteURL("url", u); verr != nil {
			return nil, verr
		}
		found.URL = u
	}
	if req.Protocol != nil {
		p := strings.ToLower(strings.TrimSpace(*req.Protocol))
		if !validProtocols[p] {
			return nil, invalidArg("protocol: must be http, socks5, or socks4")
		}
		found.Protocol = p
	}
	if req.Format != nil {
		f := strings.ToLower(strings.TrimSpace(*req.Format))
		if !validFormats[f] {
			return nil, invalidArg("format: must be txt, json_geonode, json_sockslist, json_pubproxy, or json_proxifly")
		}
		found.Format = f
	}
	if req.Enabled != nil {
		found.Enabled = *req.Enabled
	}

	if err := s.Engine.UpsertScraperSource(*found); err != nil {
		return nil, internal("persist scraper source", err)
	}
	resp := scraperSourceToResponse(*found)
	return &resp, nil
}

// DeleteScraperSource deletes a scraper source by ID.
func (s *ControlPlaneService) DeleteScraperSource(id string) error {
	err := s.Engine.DeleteScraperSource(id)
	if err == state.ErrNotFound {
		return notFound("scraper source not found")
	}
	if err != nil {
		return internal("delete scraper source", err)
	}
	return nil
}

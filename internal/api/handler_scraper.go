package api

import (
	"net/http"

	"github.com/Resinat/Resin/internal/service"
)

// HandleListScraperSources returns a handler for GET /api/v1/scraper/sources.
func HandleListScraperSources(cp *service.ControlPlaneService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sources, err := cp.ListScraperSources()
		if err != nil {
			writeServiceError(w, err)
			return
		}
		pg, ok := parsePaginationOrWriteInvalid(w, r)
		if !ok {
			return
		}
		WritePage(w, http.StatusOK, sources, pg)
	}
}

// HandleCreateScraperSource returns a handler for POST /api/v1/scraper/sources.
func HandleCreateScraperSource(cp *service.ControlPlaneService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req service.CreateScraperSourceRequest
		if err := DecodeBody(r, &req); err != nil {
			writeDecodeBodyError(w, err)
			return
		}
		src, err := cp.CreateScraperSource(req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		WriteJSON(w, http.StatusCreated, src)
	}
}

// HandleUpdateScraperSource returns a handler for PATCH /api/v1/scraper/sources/{id}.
func HandleUpdateScraperSource(cp *service.ControlPlaneService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := requireUUIDPathParam(w, r, "id", "scraper_source_id")
		if !ok {
			return
		}
		var req service.UpdateScraperSourceRequest
		if err := DecodeBody(r, &req); err != nil {
			writeDecodeBodyError(w, err)
			return
		}
		src, err := cp.UpdateScraperSource(id, req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		WriteJSON(w, http.StatusOK, src)
	}
}

// HandleDeleteScraperSource returns a handler for DELETE /api/v1/scraper/sources/{id}.
func HandleDeleteScraperSource(cp *service.ControlPlaneService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := requireUUIDPathParam(w, r, "id", "scraper_source_id")
		if !ok {
			return
		}
		if err := cp.DeleteScraperSource(id); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

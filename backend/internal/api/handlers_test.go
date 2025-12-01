package api

import (
	"bytes"
	"encoding/json"
	"intervals-sync/internal/models"
	"intervals-sync/internal/store"
	"net/http"
	"net/http/httptest"
	"testing"
)

func setupTestHandler(t *testing.T) (*Handler, func()) {
	cfg := &store.Config{SQLitePath: ":memory:"}
	s, err := store.NewSQLiteStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	rl := NewRateLimiter()
	h := NewHandler(s, rl)

	cleanup := func() {
		s.Close()
	}

	return h, cleanup
}

func TestHealthCheck(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	w := httptest.NewRecorder()

	h.HealthCheck(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "ok" {
		t.Errorf("expected status 'ok', got '%s'", resp["status"])
	}
}

func TestAuthInit(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	// Valid passphrase hash (64 char hex)
	body := `{"passphrase_hash":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/init", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.AuthInit(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp models.AuthResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Token == "" {
		t.Error("expected token in response")
	}
	if len(resp.Token) != 64 {
		t.Errorf("expected 64 char token, got %d chars", len(resp.Token))
	}
}

func TestAuthInitInvalidHash(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	// Invalid passphrase hash (too short)
	body := `{"passphrase_hash":"tooshort"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/init", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.AuthInit(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestSyncWithAuth(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	// First, authenticate
	authBody := `{"passphrase_hash":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}`
	authReq := httptest.NewRequest(http.MethodPost, "/api/auth/init", bytes.NewBufferString(authBody))
	authReq.Header.Set("Content-Type", "application/json")
	authW := httptest.NewRecorder()
	h.AuthInit(authW, authReq)

	if authW.Code != http.StatusOK {
		t.Fatalf("auth failed: %d %s", authW.Code, authW.Body.String())
	}

	var authResp models.AuthResponse
	json.Unmarshal(authW.Body.Bytes(), &authResp)
	token := authResp.Token

	// Now sync with a workout
	syncPayload := models.SyncPayload{
		LastSyncedAt: 0,
		Workouts: []models.Workout{
			{
				ID:     "workout-1",
				Name:   "Test Workout",
				Rounds: 2,
				Intervals: []models.Interval{
					{ID: "int-1", Name: "Work", Duration: 30, Color: "#ff0000", Position: 0},
				},
			},
		},
	}
	syncBody, _ := json.Marshal(syncPayload)
	syncReq := httptest.NewRequest(http.MethodPost, "/api/sync", bytes.NewBuffer(syncBody))
	syncReq.Header.Set("Content-Type", "application/json")
	syncReq.Header.Set("Authorization", "Bearer "+token)
	syncW := httptest.NewRecorder()

	h.Sync(syncW, syncReq)

	if syncW.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", syncW.Code, syncW.Body.String())
	}

	var syncResp models.SyncPayload
	json.Unmarshal(syncW.Body.Bytes(), &syncResp)
	if syncResp.LastSyncedAt == 0 {
		t.Error("expected lastSyncedAt to be set")
	}
}

func TestSyncWithoutAuth(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	syncPayload := models.SyncPayload{LastSyncedAt: 0}
	syncBody, _ := json.Marshal(syncPayload)
	syncReq := httptest.NewRequest(http.MethodPost, "/api/sync", bytes.NewBuffer(syncBody))
	syncReq.Header.Set("Content-Type", "application/json")
	syncW := httptest.NewRecorder()

	h.Sync(syncW, syncReq)

	if syncW.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", syncW.Code)
	}
}

func TestLogout(t *testing.T) {
	h, cleanup := setupTestHandler(t)
	defer cleanup()

	// First, authenticate
	authBody := `{"passphrase_hash":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}`
	authReq := httptest.NewRequest(http.MethodPost, "/api/auth/init", bytes.NewBufferString(authBody))
	authReq.Header.Set("Content-Type", "application/json")
	authW := httptest.NewRecorder()
	h.AuthInit(authW, authReq)

	var authResp models.AuthResponse
	json.Unmarshal(authW.Body.Bytes(), &authResp)
	token := authResp.Token

	// Logout
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.Header.Set("Authorization", "Bearer "+token)
	logoutW := httptest.NewRecorder()

	h.Logout(logoutW, logoutReq)

	if logoutW.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", logoutW.Code)
	}

	// Try to sync with old token - should fail
	syncPayload := models.SyncPayload{LastSyncedAt: 0}
	syncBody, _ := json.Marshal(syncPayload)
	syncReq := httptest.NewRequest(http.MethodPost, "/api/sync", bytes.NewBuffer(syncBody))
	syncReq.Header.Set("Content-Type", "application/json")
	syncReq.Header.Set("Authorization", "Bearer "+token)
	syncW := httptest.NewRecorder()

	h.Sync(syncW, syncReq)

	if syncW.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 after logout, got %d", syncW.Code)
	}
}

func TestExtractToken(t *testing.T) {
	tests := []struct {
		name     string
		header   string
		query    string
		expected string
	}{
		{"Bearer token", "Bearer abc123", "", "abc123"},
		{"Query param", "", "abc123", "abc123"},
		{"Bearer takes precedence", "Bearer header-token", "query-token", "header-token"},
		{"Empty", "", "", ""},
		{"Invalid format", "Basic abc123", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/sync"
			if tt.query != "" {
				url += "?token=" + tt.query
			}
			req := httptest.NewRequest(http.MethodGet, url, nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			result := extractToken(req)
			if result != tt.expected {
				t.Errorf("expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

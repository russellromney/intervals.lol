package api

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"intervals-sync/internal/models"
	"intervals-sync/internal/store"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Handler holds dependencies for HTTP handlers
type Handler struct {
	store            store.Store
	rl               *RateLimiter
	syncPasswordHash string // SHA-256 hash of the password
}

// NewHandler creates a new handler
func NewHandler(s store.Store, rl *RateLimiter, syncPassword string) *Handler {
	var passwordHash string
	if syncPassword != "" {
		// Hash the password for comparison
		passwordHash = hashPassphrase(syncPassword)
	}
	return &Handler{
		store:            s,
		rl:               rl,
		syncPasswordHash: passwordHash,
	}
}

// TestConnection handles POST /api/auth/test
// Checks if password hash is correct (if required) and returns connection status
func (h *Handler) TestConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Rate limit test attempts
	clientIP := r.RemoteAddr
	if !h.rl.Allow(clientIP, "login") {
		http.Error(w, "Too many attempts", http.StatusTooManyRequests)
		return
	}

	var req struct {
		PasswordHash string `json:"password_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request"})
		return
	}

	// If no password is set on the server, any password (or empty) works
	if h.syncPasswordHash == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":           true,
			"password_required": false,
		})
		return
	}

	// Check if password hash matches
	if req.PasswordHash != h.syncPasswordHash {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid password"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":           true,
		"password_required": true,
	})
}

// AuthInit handles POST /api/auth/init
// Takes a passphrase hash and returns a session token
func (h *Handler) AuthInit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Rate limit login attempts
	clientIP := r.RemoteAddr
	if !h.rl.Allow(clientIP, "login") {
		http.Error(w, "Too many login attempts", http.StatusTooManyRequests)
		return
	}

	var req models.AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request"})
		return
	}

	// Check password hash if required
	if h.syncPasswordHash != "" && req.PasswordHash != h.syncPasswordHash {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid password"})
		return
	}

	// Validate profile name (plaintext, not hashed)
	if req.ProfileName == "" {
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{Error: "Profile name is required"})
		return
	}

	// Generate session token: 2x UUID concatenated, hyphens removed
	token1 := uuid.New().String()
	token2 := uuid.New().String()
	sessionToken := strings.ReplaceAll(token1+token2, "-", "")

	// Create session with profile name as user ID
	session, err := h.store.CreateSession(sessionToken, req.ProfileName)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to create session"})
		return
	}

	writeJSON(w, http.StatusOK, models.AuthResponse{Token: session.Token})
}

// Logout handles POST /api/auth/logout
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := extractToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Missing token"})
		return
	}

	if err := h.store.DeleteSession(token); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to logout"})
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
}

// Sync handles POST /api/sync
// Accepts client data and returns server changes since lastSyncedAt
func (h *Handler) Sync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := extractToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Missing token"})
		return
	}

	session, err := h.store.VerifySession(token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid token"})
		return
	}

	var payload models.SyncPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request"})
		return
	}

	// Store client data
	for _, workout := range payload.Workouts {
		workout.UserID = session.UserID
		if err := h.store.UpsertWorkout(&workout); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to save workout"})
			return
		}
	}

	for _, completion := range payload.Completions {
		completion.UserID = session.UserID
		if err := h.store.UpsertCompletion(&completion); err != nil {
			writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to save completion"})
			return
		}
	}

	// Get server changes since lastSyncedAt
	workouts, err := h.store.GetWorkoutsModifiedSince(session.UserID, payload.LastSyncedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch workouts"})
		return
	}

	completions, err := h.store.GetCompletionsModifiedSince(session.UserID, payload.LastSyncedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch completions"})
		return
	}

	// Update sync metadata
	now := time.Now().UnixMilli()
	if err := h.store.UpdateLastSyncTime(session.UserID, now); err != nil {
		// Log but don't fail the sync
		fmt.Println("Failed to update sync time:", err)
	}

	response := models.SyncPayload{
		LastSyncedAt:  now,
		Workouts:      workouts,
		Completions:   completions,
	}

	writeJSON(w, http.StatusOK, response)
}

// GetWorkout handles GET /api/workouts/:id
func (h *Handler) GetWorkout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := extractToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Missing token"})
		return
	}

	session, err := h.store.VerifySession(token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid token"})
		return
	}

	workoutID := strings.TrimPrefix(r.URL.Path, "/api/workouts/")
	workout, err := h.store.GetWorkout(session.UserID, workoutID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, models.ErrorResponse{Error: "Workout not found"})
		return
	}

	writeJSON(w, http.StatusOK, workout)
}

// DeleteWorkout handles DELETE /api/workouts/:id
func (h *Handler) DeleteWorkout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := extractToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Missing token"})
		return
	}

	session, err := h.store.VerifySession(token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid token"})
		return
	}

	workoutID := strings.TrimPrefix(r.URL.Path, "/api/workouts/")
	if err := h.store.DeleteWorkout(session.UserID, workoutID); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to delete workout"})
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
}

// DeleteCompletion handles DELETE /api/completions/:id
func (h *Handler) DeleteCompletion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := extractToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Missing token"})
		return
	}

	session, err := h.store.VerifySession(token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid token"})
		return
	}

	completionID := strings.TrimPrefix(r.URL.Path, "/api/completions/")
	if err := h.store.DeleteCompletion(session.UserID, completionID); err != nil {
		writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to delete completion"})
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
}

// HealthCheck handles GET /api/health
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// GetProfiles handles POST /api/profiles
// Returns a list of all profile names on the server (requires password if set)
func (h *Handler) GetProfiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Rate limit profile list requests
	clientIP := r.RemoteAddr
	if !h.rl.Allow(clientIP, "login") {
		http.Error(w, "Too many attempts", http.StatusTooManyRequests)
		return
	}

	var req struct {
		PasswordHash string `json:"password_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request"})
		return
	}

	// Check password hash if required
	if h.syncPasswordHash != "" && req.PasswordHash != h.syncPasswordHash {
		writeJSON(w, http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid password"})
		return
	}

	profiles, err := h.store.GetProfiles()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch profiles"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"profiles": profiles,
	})
}

// Helper functions

func extractToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		// Try query parameter as fallback
		return r.URL.Query().Get("token")
	}

	// Extract Bearer token
	parts := strings.Split(auth, " ")
	if len(parts) == 2 && parts[0] == "Bearer" {
		return parts[1]
	}

	return ""
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Helper to compute SHA256 of a string (for testing/validation)
func hashPassphrase(passphrase string) string {
	hash := sha256.Sum256([]byte(passphrase))
	return fmt.Sprintf("%x", hash)
}

package models

import "time"

// Session represents an authenticated session
type Session struct {
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"` // profile name hash
	CreatedAt time.Time `json:"created_at"`
}

// Workout represents a workout/interval timer configuration
type Workout struct {
	ID        string      `json:"id"`
	UserID    string      `json:"user_id"` // profile name hash
	Name      string      `json:"name"`
	Rounds    int         `json:"rounds"`
	Intervals []Interval  `json:"intervals"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
	DeletedAt *time.Time  `json:"deleted_at,omitempty"`
}

// Interval represents a single interval within a workout
type Interval struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Duration int    `json:"duration"` // seconds
	Color    string `json:"color"`
	Position int    `json:"position"` // 0-indexed order
}

// Completion represents a completed workout
type Completion struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"` // profile name hash
	WorkoutID       string     `json:"workout_id"`
	WorkoutName     string     `json:"workout_name"`
	TotalDuration   int        `json:"total_duration"`   // seconds
	ElapsedDuration int        `json:"elapsed_duration"` // seconds
	Completed       bool       `json:"completed"`
	StartedAt       time.Time  `json:"started_at"`
	CompletedAt     *time.Time `json:"completed_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

// SyncPayload is the request/response for sync operations
type SyncPayload struct {
	LastSyncedAt int64        `json:"last_synced_at"`
	Workouts     []Workout    `json:"workouts"`
	Completions  []Completion `json:"completions"`
}

// AuthRequest is used to initialize a session
type AuthRequest struct {
	ProfileName  string `json:"profile_name"`            // plaintext profile name
	PasswordHash string `json:"password_hash,omitempty"` // hash of backend password
}

// AuthResponse is returned after successful authentication
type AuthResponse struct {
	Token string `json:"token"`
}

// ErrorResponse is returned for errors
type ErrorResponse struct {
	Error string `json:"error"`
}

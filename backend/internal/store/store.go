package store

import (
	"intervals-sync/internal/models"
)

// Store defines the database abstraction interface
type Store interface {
	// Lifecycle
	Close() error
	Migrate() error

	// Session management
	CreateSession(token string, userID string) (*models.Session, error)
	VerifySession(token string) (*models.Session, error)
	DeleteSession(token string) error

	// Workout operations
	UpsertWorkout(workout *models.Workout) error
	GetWorkoutsModifiedSince(userID string, since int64) ([]models.Workout, error)
	GetWorkout(userID string, workoutID string) (*models.Workout, error)
	DeleteWorkout(userID string, workoutID string) error

	// Completion operations
	UpsertCompletion(completion *models.Completion) error
	GetCompletionsModifiedSince(userID string, since int64) ([]models.Completion, error)
	DeleteCompletion(userID string, completionID string) error

	// Utility
	GetLastSyncTime(userID string) (int64, error)
	UpdateLastSyncTime(userID string, syncTime int64) error

	// Profiles
	GetProfiles() ([]string, error)
}

// Config holds configuration for store initialization
type Config struct {
	// SQLite file path
	SQLitePath string
	// Turso connection URL
	TursoURL string
	// Turso auth token
	TursoAuthToken string
}

// NewStore creates a new store instance based on config
func NewStore(cfg *Config) (Store, error) {
	if cfg.TursoURL != "" {
		return NewTursoStore(cfg)
	}
	return NewSQLiteStore(cfg)
}

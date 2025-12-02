package store

import (
	"database/sql"
	"errors"
	"fmt"
	"intervals-sync/internal/models"
	"strings"
	"time"

	_ "github.com/tursodatabase/go-libsql"
)

// parseTime parses a timestamp string from SQLite into time.Time
// Handles multiple formats used by libsql driver
func parseTime(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	// Try RFC3339 first (Go's default format)
	t, err := time.Parse(time.RFC3339Nano, s)
	if err == nil {
		return t, nil
	}
	// Try RFC3339 without nanos
	t, err = time.Parse(time.RFC3339, s)
	if err == nil {
		return t, nil
	}
	// Try SQLite datetime format
	t, err = time.Parse("2006-01-02 15:04:05", s)
	if err == nil {
		return t, nil
	}
	// Try another common format
	t, err = time.Parse("2006-01-02T15:04:05Z07:00", s)
	if err == nil {
		return t, nil
	}
	return time.Time{}, err
}

// parseNullTime parses a nullable timestamp string
func parseNullTime(s sql.NullString) (*time.Time, error) {
	if !s.Valid || s.String == "" {
		return nil, nil
	}
	t, err := parseTime(s.String)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// SQLiteStore implements Store using SQLite
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore creates a new SQLite store
func NewSQLiteStore(cfg *Config) (*SQLiteStore, error) {
	// Use file: prefix for local SQLite files with libsql driver
	connStr := "file:" + cfg.SQLitePath + "?_foreign_keys=on"
	db, err := sql.Open("libsql", connStr)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Configure for better concurrency (file-based only)
	if !strings.Contains(cfg.SQLitePath, ":memory:") {
		// Busy timeout - retry for up to 1 second if locked
		if _, err := db.Exec("PRAGMA busy_timeout = 1000"); err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to set busy_timeout: %w", err)
		}
		// WAL mode allows concurrent readers while writing
		if _, err := db.Exec("PRAGMA journal_mode = WAL"); err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
		}
	}

	// Limit max open connections to prevent contention
	db.SetMaxOpenConns(1)

	store := &SQLiteStore{db: db}

	// Run migrations
	if err := store.Migrate(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

// Migrate creates the database schema
func (s *SQLiteStore) Migrate() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			created_at DATETIME NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
		`CREATE TABLE IF NOT EXISTS workouts (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			rounds INTEGER NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_workouts_updated_at ON workouts(updated_at)`,
		`CREATE INDEX IF NOT EXISTS idx_workouts_deleted_at ON workouts(deleted_at)`,
		`CREATE TABLE IF NOT EXISTS workout_intervals (
			id TEXT PRIMARY KEY,
			workout_id TEXT NOT NULL,
			name TEXT NOT NULL,
			duration INTEGER NOT NULL,
			color TEXT NOT NULL,
			position INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_workout_intervals_workout_id ON workout_intervals(workout_id)`,
		`CREATE TABLE IF NOT EXISTS completions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			workout_id TEXT NOT NULL,
			workout_name TEXT NOT NULL,
			total_duration INTEGER NOT NULL,
			elapsed_duration INTEGER NOT NULL,
			completed BOOLEAN NOT NULL,
			started_at DATETIME NOT NULL,
			completed_at DATETIME,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE INDEX IF NOT EXISTS idx_completions_user_id ON completions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_completions_updated_at ON completions(updated_at)`,
		`CREATE INDEX IF NOT EXISTS idx_completions_deleted_at ON completions(deleted_at)`,
		`CREATE TABLE IF NOT EXISTS sync_metadata (
			user_id TEXT PRIMARY KEY,
			last_sync_time INTEGER NOT NULL
		)`,
	}

	for _, stmt := range statements {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the database connection
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// CreateSession creates a new session
func (s *SQLiteStore) CreateSession(token string, userID string) (*models.Session, error) {
	now := time.Now()
	_, err := s.db.Exec(
		"INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
		token, userID, now,
	)
	if err != nil {
		return nil, err
	}

	return &models.Session{
		Token:     token,
		UserID:    userID,
		CreatedAt: now,
	}, nil
}

// VerifySession checks if a session token is valid
func (s *SQLiteStore) VerifySession(token string) (*models.Session, error) {
	var session models.Session
	var createdAtStr string
	err := s.db.QueryRow(
		"SELECT token, user_id, created_at FROM sessions WHERE token = ?",
		token,
	).Scan(&session.Token, &session.UserID, &createdAtStr)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid session token")
		}
		return nil, err
	}

	session.CreatedAt, _ = parseTime(createdAtStr)
	return &session, nil
}

// DeleteSession deletes a session
func (s *SQLiteStore) DeleteSession(token string) error {
	_, err := s.db.Exec("DELETE FROM sessions WHERE token = ?", token)
	return err
}

// UpsertWorkout inserts or updates a workout
func (s *SQLiteStore) UpsertWorkout(workout *models.Workout) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Ensure timestamps are set
	now := time.Now()
	createdAt := workout.CreatedAt
	if createdAt.IsZero() {
		createdAt = now
	}
	updatedAt := workout.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = now
	}

	// Upsert workout with soft delete support
	_, err = tx.Exec(`
		INSERT INTO workouts (id, user_id, name, rounds, created_at, updated_at, deleted_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			rounds = excluded.rounds,
			updated_at = excluded.updated_at,
			deleted_at = excluded.deleted_at
	`, workout.ID, workout.UserID, workout.Name, workout.Rounds,
		createdAt, updatedAt, workout.DeletedAt)
	if err != nil {
		return err
	}

	// Delete existing intervals
	_, err = tx.Exec("DELETE FROM workout_intervals WHERE workout_id = ?", workout.ID)
	if err != nil {
		return err
	}

	// Insert new intervals with position
	for i, interval := range workout.Intervals {
		position := interval.Position
		if position == 0 && i > 0 {
			position = i // Use index as position if not set
		}
		_, err = tx.Exec(`
			INSERT INTO workout_intervals (id, workout_id, name, duration, color, position)
			VALUES (?, ?, ?, ?, ?, ?)
		`, interval.ID, workout.ID, interval.Name, interval.Duration, interval.Color, position)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetWorkoutsModifiedSince returns workouts modified after a timestamp (including soft-deleted)
func (s *SQLiteStore) GetWorkoutsModifiedSince(userID string, since int64) ([]models.Workout, error) {
	sinceTime := time.UnixMilli(since)
	rows, err := s.db.Query(`
		SELECT id, user_id, name, rounds, created_at, updated_at, deleted_at
		FROM workouts
		WHERE user_id = ? AND updated_at > ?
		ORDER BY updated_at DESC
	`, userID, sinceTime)
	if err != nil {
		return nil, err
	}

	// First, collect all workouts without intervals
	var workouts []models.Workout
	for rows.Next() {
		var w models.Workout
		var createdAtStr, updatedAtStr string
		var deletedAtStr sql.NullString
		err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.Rounds, &createdAtStr, &updatedAtStr, &deletedAtStr)
		if err != nil {
			rows.Close()
			return nil, err
		}
		// Parse timestamp strings
		w.CreatedAt, _ = parseTime(createdAtStr)
		w.UpdatedAt, _ = parseTime(updatedAtStr)
		w.DeletedAt, _ = parseNullTime(deletedAtStr)
		workouts = append(workouts, w)
	}
	rows.Close()

	// Now load intervals for each workout (after closing the first result set)
	for i := range workouts {
		intervals, err := s.getIntervals(workouts[i].ID)
		if err != nil {
			return nil, err
		}
		workouts[i].Intervals = intervals
	}

	return workouts, nil
}

// GetWorkout returns a single workout by ID (excludes soft-deleted)
func (s *SQLiteStore) GetWorkout(userID string, workoutID string) (*models.Workout, error) {
	var w models.Workout
	var createdAtStr, updatedAtStr string
	var deletedAtStr sql.NullString
	err := s.db.QueryRow(`
		SELECT id, user_id, name, rounds, created_at, updated_at, deleted_at
		FROM workouts
		WHERE id = ? AND user_id = ? AND deleted_at IS NULL
	`, workoutID, userID).Scan(&w.ID, &w.UserID, &w.Name, &w.Rounds, &createdAtStr, &updatedAtStr, &deletedAtStr)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("workout not found")
		}
		return nil, err
	}

	// Parse timestamp strings
	w.CreatedAt, _ = parseTime(createdAtStr)
	w.UpdatedAt, _ = parseTime(updatedAtStr)
	w.DeletedAt, _ = parseNullTime(deletedAtStr)

	intervals, err := s.getIntervals(w.ID)
	if err != nil {
		return nil, err
	}
	w.Intervals = intervals

	return &w, nil
}

// DeleteWorkout soft-deletes a workout
func (s *SQLiteStore) DeleteWorkout(userID string, workoutID string) error {
	now := time.Now()
	_, err := s.db.Exec(`
		UPDATE workouts
		SET deleted_at = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`, now, now, workoutID, userID)
	return err
}

// getIntervals helper to load intervals for a workout
func (s *SQLiteStore) getIntervals(workoutID string) ([]models.Interval, error) {
	rows, err := s.db.Query(`
		SELECT id, name, duration, color, position
		FROM workout_intervals
		WHERE workout_id = ?
		ORDER BY position ASC
	`, workoutID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var intervals []models.Interval
	for rows.Next() {
		var i models.Interval
		err := rows.Scan(&i.ID, &i.Name, &i.Duration, &i.Color, &i.Position)
		if err != nil {
			return nil, err
		}
		intervals = append(intervals, i)
	}

	return intervals, rows.Err()
}

// UpsertCompletion inserts or updates a completion record
func (s *SQLiteStore) UpsertCompletion(completion *models.Completion) error {
	// Ensure timestamps are set
	now := time.Now()
	startedAt := completion.StartedAt
	if startedAt.IsZero() {
		startedAt = now
	}
	updatedAt := completion.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = now
	}

	_, err := s.db.Exec(`
		INSERT INTO completions
		(id, user_id, workout_id, workout_name, total_duration, elapsed_duration, completed, started_at, completed_at, updated_at, deleted_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			elapsed_duration = excluded.elapsed_duration,
			completed = excluded.completed,
			completed_at = excluded.completed_at,
			updated_at = excluded.updated_at,
			deleted_at = excluded.deleted_at
	`, completion.ID, completion.UserID, completion.WorkoutID, completion.WorkoutName,
		completion.TotalDuration, completion.ElapsedDuration, completion.Completed,
		startedAt, completion.CompletedAt, updatedAt, completion.DeletedAt)
	return err
}

// GetCompletionsModifiedSince returns completions modified after a timestamp (including soft-deleted)
func (s *SQLiteStore) GetCompletionsModifiedSince(userID string, since int64) ([]models.Completion, error) {
	sinceTime := time.UnixMilli(since)
	rows, err := s.db.Query(`
		SELECT id, user_id, workout_id, workout_name, total_duration, elapsed_duration,
		       completed, started_at, completed_at, updated_at, deleted_at
		FROM completions
		WHERE user_id = ? AND updated_at > ?
		ORDER BY updated_at DESC
	`, userID, sinceTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var completions []models.Completion
	for rows.Next() {
		var c models.Completion
		var startedAtStr, updatedAtStr string
		var completedAtStr, deletedAtStr sql.NullString
		err := rows.Scan(&c.ID, &c.UserID, &c.WorkoutID, &c.WorkoutName,
			&c.TotalDuration, &c.ElapsedDuration, &c.Completed,
			&startedAtStr, &completedAtStr, &updatedAtStr, &deletedAtStr)
		if err != nil {
			return nil, err
		}
		// Parse timestamp strings
		c.StartedAt, _ = parseTime(startedAtStr)
		c.UpdatedAt, _ = parseTime(updatedAtStr)
		c.CompletedAt, _ = parseNullTime(completedAtStr)
		c.DeletedAt, _ = parseNullTime(deletedAtStr)
		completions = append(completions, c)
	}

	return completions, rows.Err()
}

// DeleteCompletion soft-deletes a completion record
func (s *SQLiteStore) DeleteCompletion(userID string, completionID string) error {
	now := time.Now()
	_, err := s.db.Exec(`
		UPDATE completions
		SET deleted_at = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`, now, now, completionID, userID)
	return err
}

// GetLastSyncTime returns the last sync timestamp for a user
func (s *SQLiteStore) GetLastSyncTime(userID string) (int64, error) {
	var syncTime int64
	err := s.db.QueryRow(
		"SELECT last_sync_time FROM sync_metadata WHERE user_id = ?",
		userID,
	).Scan(&syncTime)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}

	return syncTime, nil
}

// UpdateLastSyncTime updates the sync timestamp for a user
func (s *SQLiteStore) UpdateLastSyncTime(userID string, syncTime int64) error {
	_, err := s.db.Exec(`
		INSERT INTO sync_metadata (user_id, last_sync_time)
		VALUES (?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			last_sync_time = excluded.last_sync_time
	`, userID, syncTime)
	return err
}

// GetProfiles returns all unique profile names (user_ids) from the database
func (s *SQLiteStore) GetProfiles() ([]string, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT user_id FROM (
			SELECT user_id FROM workouts
			UNION
			SELECT user_id FROM completions
			UNION
			SELECT user_id FROM sync_metadata
		) ORDER BY user_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var profiles []string
	for rows.Next() {
		var profile string
		if err := rows.Scan(&profile); err != nil {
			return nil, err
		}
		profiles = append(profiles, profile)
	}

	return profiles, rows.Err()
}

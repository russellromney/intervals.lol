package store

import (
	"database/sql"
	"errors"
	"intervals-sync/internal/models"
	"time"

	_ "github.com/tursodatabase/go-libsql"
)

// TursoStore implements Store using Turso (libSQL)
type TursoStore struct {
	db *sql.DB
}

// NewTursoStore creates a new Turso store
func NewTursoStore(cfg *Config) (*TursoStore, error) {
	// Build connection string for Turso
	// Format: libsql://[database-name]-[org].turso.io?authToken=[token]
	connStr := cfg.TursoURL
	if cfg.TursoAuthToken != "" {
		connStr += "?authToken=" + cfg.TursoAuthToken
	}

	db, err := sql.Open("libsql", connStr)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	store := &TursoStore{db: db}

	// Run migrations
	if err := store.Migrate(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

// Migrate creates the database schema
func (s *TursoStore) Migrate() error {
	// Turso/libSQL uses same SQL syntax as SQLite
	schema := `
	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		created_at TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

	CREATE TABLE IF NOT EXISTS workouts (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		name TEXT NOT NULL,
		rounds INTEGER NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		deleted_at TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
	CREATE INDEX IF NOT EXISTS idx_workouts_updated_at ON workouts(updated_at);
	CREATE INDEX IF NOT EXISTS idx_workouts_deleted_at ON workouts(deleted_at);

	CREATE TABLE IF NOT EXISTS workout_intervals (
		id TEXT PRIMARY KEY,
		workout_id TEXT NOT NULL,
		name TEXT NOT NULL,
		duration INTEGER NOT NULL,
		color TEXT NOT NULL,
		position INTEGER NOT NULL DEFAULT 0,
		FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_workout_intervals_workout_id ON workout_intervals(workout_id);

	CREATE TABLE IF NOT EXISTS completions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		workout_id TEXT NOT NULL,
		workout_name TEXT NOT NULL,
		total_duration INTEGER NOT NULL,
		elapsed_duration INTEGER NOT NULL,
		completed INTEGER NOT NULL,
		started_at TEXT NOT NULL,
		completed_at TEXT,
		updated_at TEXT NOT NULL,
		deleted_at TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_completions_user_id ON completions(user_id);
	CREATE INDEX IF NOT EXISTS idx_completions_updated_at ON completions(updated_at);
	CREATE INDEX IF NOT EXISTS idx_completions_deleted_at ON completions(deleted_at);

	CREATE TABLE IF NOT EXISTS sync_metadata (
		user_id TEXT PRIMARY KEY,
		last_sync_time INTEGER NOT NULL
	);
	`

	_, err := s.db.Exec(schema)
	return err
}

// Close closes the database connection
func (s *TursoStore) Close() error {
	return s.db.Close()
}

// CreateSession creates a new session
func (s *TursoStore) CreateSession(token string, userID string) (*models.Session, error) {
	now := time.Now()
	_, err := s.db.Exec(
		"INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
		token, userID, now.Format(time.RFC3339),
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
func (s *TursoStore) VerifySession(token string) (*models.Session, error) {
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

	createdAt, _ := time.Parse(time.RFC3339, createdAtStr)
	session.CreatedAt = createdAt

	return &session, nil
}

// DeleteSession deletes a session
func (s *TursoStore) DeleteSession(token string) error {
	_, err := s.db.Exec("DELETE FROM sessions WHERE token = ?", token)
	return err
}

// UpsertWorkout inserts or updates a workout
func (s *TursoStore) UpsertWorkout(workout *models.Workout) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var deletedAtStr *string
	if workout.DeletedAt != nil {
		s := workout.DeletedAt.Format(time.RFC3339)
		deletedAtStr = &s
	}

	// Upsert workout
	_, err = tx.Exec(`
		INSERT INTO workouts (id, user_id, name, rounds, created_at, updated_at, deleted_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			rounds = excluded.rounds,
			updated_at = excluded.updated_at,
			deleted_at = excluded.deleted_at
	`, workout.ID, workout.UserID, workout.Name, workout.Rounds,
		workout.CreatedAt.Format(time.RFC3339),
		workout.UpdatedAt.Format(time.RFC3339),
		deletedAtStr)
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
			position = i
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

// GetWorkoutsModifiedSince returns workouts modified after a timestamp
func (s *TursoStore) GetWorkoutsModifiedSince(userID string, since int64) ([]models.Workout, error) {
	sinceTime := time.UnixMilli(since).Format(time.RFC3339)
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
		var deletedAtStr *string
		err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.Rounds, &createdAtStr, &updatedAtStr, &deletedAtStr)
		if err != nil {
			rows.Close()
			return nil, err
		}

		w.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		w.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
		if deletedAtStr != nil {
			deletedAt, _ := time.Parse(time.RFC3339, *deletedAtStr)
			w.DeletedAt = &deletedAt
		}

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

// GetWorkout returns a single workout by ID
func (s *TursoStore) GetWorkout(userID string, workoutID string) (*models.Workout, error) {
	var w models.Workout
	var createdAtStr, updatedAtStr string
	var deletedAtStr *string
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

	w.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	w.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)

	intervals, err := s.getIntervals(w.ID)
	if err != nil {
		return nil, err
	}
	w.Intervals = intervals

	return &w, nil
}

// DeleteWorkout soft-deletes a workout
func (s *TursoStore) DeleteWorkout(userID string, workoutID string) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(`
		UPDATE workouts
		SET deleted_at = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`, now, now, workoutID, userID)
	return err
}

// getIntervals helper to load intervals for a workout
func (s *TursoStore) getIntervals(workoutID string) ([]models.Interval, error) {
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
func (s *TursoStore) UpsertCompletion(completion *models.Completion) error {
	var completedAtStr, deletedAtStr *string
	if completion.CompletedAt != nil {
		s := completion.CompletedAt.Format(time.RFC3339)
		completedAtStr = &s
	}
	if completion.DeletedAt != nil {
		s := completion.DeletedAt.Format(time.RFC3339)
		deletedAtStr = &s
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
		completion.StartedAt.Format(time.RFC3339), completedAtStr,
		completion.UpdatedAt.Format(time.RFC3339), deletedAtStr)
	return err
}

// GetCompletionsModifiedSince returns completions modified after a timestamp
func (s *TursoStore) GetCompletionsModifiedSince(userID string, since int64) ([]models.Completion, error) {
	sinceTime := time.UnixMilli(since).Format(time.RFC3339)
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
		var completedAtStr, deletedAtStr *string
		err := rows.Scan(&c.ID, &c.UserID, &c.WorkoutID, &c.WorkoutName,
			&c.TotalDuration, &c.ElapsedDuration, &c.Completed,
			&startedAtStr, &completedAtStr, &updatedAtStr, &deletedAtStr)
		if err != nil {
			return nil, err
		}

		c.StartedAt, _ = time.Parse(time.RFC3339, startedAtStr)
		c.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
		if completedAtStr != nil {
			completedAt, _ := time.Parse(time.RFC3339, *completedAtStr)
			c.CompletedAt = &completedAt
		}
		if deletedAtStr != nil {
			deletedAt, _ := time.Parse(time.RFC3339, *deletedAtStr)
			c.DeletedAt = &deletedAt
		}

		completions = append(completions, c)
	}

	return completions, rows.Err()
}

// DeleteCompletion soft-deletes a completion record
func (s *TursoStore) DeleteCompletion(userID string, completionID string) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(`
		UPDATE completions
		SET deleted_at = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`, now, now, completionID, userID)
	return err
}

// GetLastSyncTime returns the last sync timestamp for a user
func (s *TursoStore) GetLastSyncTime(userID string) (int64, error) {
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
func (s *TursoStore) UpdateLastSyncTime(userID string, syncTime int64) error {
	_, err := s.db.Exec(`
		INSERT INTO sync_metadata (user_id, last_sync_time)
		VALUES (?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			last_sync_time = excluded.last_sync_time
	`, userID, syncTime)
	return err
}

// GetProfiles returns all unique profile names (user_ids) from the database
func (s *TursoStore) GetProfiles() ([]string, error) {
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

package store

import (
	"intervals-sync/internal/models"
	"testing"
	"time"
)

func setupTestStore(t *testing.T) (*SQLiteStore, func()) {
	// Use in-memory database for tests
	cfg := &Config{SQLitePath: ":memory:"}
	store, err := NewSQLiteStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	cleanup := func() {
		store.Close()
	}

	return store, cleanup
}

func TestNewSQLiteStore(t *testing.T) {
	store, cleanup := setupTestStore(t)
	defer cleanup()

	if store == nil {
		t.Fatal("expected store to be created")
	}
}

func TestSession(t *testing.T) {
	store, cleanup := setupTestStore(t)
	defer cleanup()

	// Create session
	session, err := store.CreateSession("test-token", "user-123")
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	if session.Token != "test-token" {
		t.Errorf("expected token 'test-token', got '%s'", session.Token)
	}
	if session.UserID != "user-123" {
		t.Errorf("expected user ID 'user-123', got '%s'", session.UserID)
	}

	// Verify session
	verified, err := store.VerifySession("test-token")
	if err != nil {
		t.Fatalf("failed to verify session: %v", err)
	}
	if verified.UserID != "user-123" {
		t.Errorf("expected user ID 'user-123', got '%s'", verified.UserID)
	}

	// Verify invalid session
	_, err = store.VerifySession("invalid-token")
	if err == nil {
		t.Error("expected error for invalid token")
	}

	// Delete session
	err = store.DeleteSession("test-token")
	if err != nil {
		t.Fatalf("failed to delete session: %v", err)
	}

	// Verify deleted session
	_, err = store.VerifySession("test-token")
	if err == nil {
		t.Error("expected error for deleted token")
	}
}

func TestWorkoutCRUD(t *testing.T) {
	store, cleanup := setupTestStore(t)
	defer cleanup()

	now := time.Now()
	workout := &models.Workout{
		ID:        "workout-1",
		UserID:    "user-123",
		Name:      "Test Workout",
		Rounds:    3,
		CreatedAt: now,
		UpdatedAt: now,
		Intervals: []models.Interval{
			{ID: "int-1", Name: "Work", Duration: 30, Color: "#ff0000", Position: 0},
			{ID: "int-2", Name: "Rest", Duration: 10, Color: "#00ff00", Position: 1},
		},
	}

	// Upsert (create)
	err := store.UpsertWorkout(workout)
	if err != nil {
		t.Fatalf("failed to upsert workout: %v", err)
	}

	// Get workout
	retrieved, err := store.GetWorkout("user-123", "workout-1")
	if err != nil {
		t.Fatalf("failed to get workout: %v", err)
	}
	if retrieved.Name != "Test Workout" {
		t.Errorf("expected name 'Test Workout', got '%s'", retrieved.Name)
	}
	if len(retrieved.Intervals) != 2 {
		t.Errorf("expected 2 intervals, got %d", len(retrieved.Intervals))
	}
	if retrieved.Intervals[0].Position != 0 {
		t.Errorf("expected first interval position 0, got %d", retrieved.Intervals[0].Position)
	}

	// Update workout
	workout.Name = "Updated Workout"
	workout.UpdatedAt = time.Now()
	err = store.UpsertWorkout(workout)
	if err != nil {
		t.Fatalf("failed to update workout: %v", err)
	}

	retrieved, _ = store.GetWorkout("user-123", "workout-1")
	if retrieved.Name != "Updated Workout" {
		t.Errorf("expected name 'Updated Workout', got '%s'", retrieved.Name)
	}

	// Soft delete
	err = store.DeleteWorkout("user-123", "workout-1")
	if err != nil {
		t.Fatalf("failed to delete workout: %v", err)
	}

	// Get should fail for soft-deleted workout
	_, err = store.GetWorkout("user-123", "workout-1")
	if err == nil {
		t.Error("expected error for deleted workout")
	}
}

func TestGetWorkoutsModifiedSince(t *testing.T) {
	store, cleanup := setupTestStore(t)
	defer cleanup()

	baseTime := time.Now().Add(-time.Hour)

	// Create some workouts
	for i := 0; i < 3; i++ {
		workout := &models.Workout{
			ID:        "workout-" + string(rune('a'+i)),
			UserID:    "user-123",
			Name:      "Workout " + string(rune('A'+i)),
			Rounds:    1,
			CreatedAt: baseTime,
			UpdatedAt: baseTime.Add(time.Duration(i) * time.Minute),
			Intervals: []models.Interval{
				{ID: "int-" + string(rune('a'+i)), Name: "Work", Duration: 30, Color: "#ff0000", Position: 0},
			},
		}
		store.UpsertWorkout(workout)
	}

	// Get workouts modified since a time before all workouts
	workouts, err := store.GetWorkoutsModifiedSince("user-123", baseTime.Add(-time.Minute).UnixMilli())
	if err != nil {
		t.Fatalf("failed to get workouts: %v", err)
	}
	if len(workouts) != 3 {
		t.Errorf("expected 3 workouts, got %d", len(workouts))
	}

	// Get workouts modified since middle time
	workouts, err = store.GetWorkoutsModifiedSince("user-123", baseTime.Add(30*time.Second).UnixMilli())
	if err != nil {
		t.Fatalf("failed to get workouts: %v", err)
	}
	if len(workouts) != 2 {
		t.Errorf("expected 2 workouts modified after first one, got %d", len(workouts))
	}
}

func TestCompletionCRUD(t *testing.T) {
	store, cleanup := setupTestStore(t)
	defer cleanup()

	now := time.Now()
	completion := &models.Completion{
		ID:              "comp-1",
		UserID:          "user-123",
		WorkoutID:       "workout-1",
		WorkoutName:     "Test Workout",
		TotalDuration:   120,
		ElapsedDuration: 100,
		Completed:       true,
		StartedAt:       now.Add(-2 * time.Minute),
		CompletedAt:     &now,
		UpdatedAt:       now,
	}

	// Upsert (create)
	err := store.UpsertCompletion(completion)
	if err != nil {
		t.Fatalf("failed to upsert completion: %v", err)
	}

	// Get completions
	completions, err := store.GetCompletionsModifiedSince("user-123", now.Add(-time.Hour).UnixMilli())
	if err != nil {
		t.Fatalf("failed to get completions: %v", err)
	}
	if len(completions) != 1 {
		t.Fatalf("expected 1 completion, got %d", len(completions))
	}
	if completions[0].WorkoutName != "Test Workout" {
		t.Errorf("expected workout name 'Test Workout', got '%s'", completions[0].WorkoutName)
	}

	// Soft delete
	err = store.DeleteCompletion("user-123", "comp-1")
	if err != nil {
		t.Fatalf("failed to delete completion: %v", err)
	}

	// Should still appear in modified since (for sync purposes)
	completions, err = store.GetCompletionsModifiedSince("user-123", now.Add(-time.Hour).UnixMilli())
	if err != nil {
		t.Fatalf("failed to get completions: %v", err)
	}
	if len(completions) != 1 {
		t.Fatalf("expected 1 completion (soft deleted), got %d", len(completions))
	}
	if completions[0].DeletedAt == nil {
		t.Error("expected completion to have deleted_at set")
	}
}

func TestSyncMetadata(t *testing.T) {
	store, cleanup := setupTestStore(t)
	defer cleanup()

	// Get non-existent sync time
	syncTime, err := store.GetLastSyncTime("user-123")
	if err != nil {
		t.Fatalf("failed to get sync time: %v", err)
	}
	if syncTime != 0 {
		t.Errorf("expected 0 for non-existent user, got %d", syncTime)
	}

	// Update sync time
	now := time.Now().UnixMilli()
	err = store.UpdateLastSyncTime("user-123", now)
	if err != nil {
		t.Fatalf("failed to update sync time: %v", err)
	}

	// Get updated sync time
	syncTime, err = store.GetLastSyncTime("user-123")
	if err != nil {
		t.Fatalf("failed to get sync time: %v", err)
	}
	if syncTime != now {
		t.Errorf("expected %d, got %d", now, syncTime)
	}
}

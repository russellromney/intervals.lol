import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkout, getBasePath } from "./WorkoutContext";

const IntervalLibrary = () => {
  const navigate = useNavigate();
  const basePath = getBasePath();
  const {
    workouts,
    createWorkout,
    deleteWorkout,
    copyWorkout,
    importWorkoutFromClipboard,
    getTotalWorkoutDuration,
    formatTime,
  } = useWorkout();

  const createNewWorkout = () => {
    const workout = createWorkout();
    navigate(`${basePath}/edit/${workout.id}`);
  };

  const deleteWorkoutAction = (id) => {
    if (window.confirm("Are you sure you want to delete this workout?")) {
      deleteWorkout(id);
    }
  };

  return (
    <div className="view active" style={{ display: "block" }}>
      <div className="container">
        <header className="page-header">
          <h1>My Timers</h1>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={importWorkoutFromClipboard}
            >
              Import
            </button>
            <button className="btn btn-primary" onClick={createNewWorkout}>
              + New Timer
            </button>
          </div>
        </header>

        <div className="workouts-grid">
          {workouts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h2>No timers yet</h2>
              <p>Create your first interval timer to get started</p>
              <button
                className="btn btn-primary"
                onClick={createNewWorkout}
              >
                Create First Timer
              </button>
            </div>
          ) : (
            workouts.map((workout) => {
              const totalDuration = getTotalWorkoutDuration(workout);
              const intervalDuration = workout.intervals.length
                ? workout.intervals.reduce((sum, i) => sum + (i.duration || 0), 0)
                : 0;
              return (
                <div key={workout.id} className="workout-card">
                  <Link
                    to={`${basePath}/edit/${workout.id}`}
                    className="workout-card-link"
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div className="workout-card-header">
                      <div className="workout-card-name">
                        {workout.name}
                      </div>
                      <div className="workout-card-info">
                        <span>
                          {workout.intervals.length} intervals x {formatTime(intervalDuration)}
                        </span>
                        <span>{workout.rounds} rounds</span>
                        <span style={{ fontWeight: 600, color: "var(--primary)" }}>
                          Total: {formatTime(totalDuration)}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="workout-card-actions">
                    <button
                      className="btn btn-secondary"
                      title="Copy timer"
                      onClick={() => copyWorkout(workout.id)}
                    >
                      Copy
                    </button>
                    <button
                      className="btn btn-danger"
                      title="Delete timer"
                      onClick={() => deleteWorkoutAction(workout.id)}
                    >
                      Delete
                    </button>
                    <Link
                      to={`${basePath}/run/${workout.id}`}
                      className="btn btn-primary workout-card-start"
                    >
                      Start
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default IntervalLibrary;

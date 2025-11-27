import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useWorkout, getBasePath } from "./WorkoutContext";

const IntervalEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = getBasePath();
  const {
    getWorkout,
    updateWorkout,
    deleteWorkout,
    addInterval,
    updateInterval,
    updateRounds,
    deleteInterval,
    duplicateInterval,
    moveInterval,
    getTotalWorkoutDuration,
    formatTime,
    parseTimeInput,
    saveMessage,
    setSaveMessage,
  } = useWorkout();

  const workout = getWorkout(id);

  if (!workout) {
    return (
      <div className="view active" style={{ display: "block" }}>
        <div className="container">
          <div className="empty-state">
            <h2>Timer not found</h2>
            <Link to={basePath || '/'} className="btn btn-primary">
              Back to Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalDuration = getTotalWorkoutDuration(workout);

  const saveWorkout = () => {
    const nameInput = document.getElementById("workoutNameInput");
    const roundsInput = document.getElementById("roundsInput");
    const updates = {
      name: nameInput.value || "Unnamed Timer",
      rounds: Math.max(1, parseInt(roundsInput.value, 10) || 1),
    };
    updateWorkout(id, updates);
    setSaveMessage("Saved!");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleDelete = () => {
    if (window.confirm("Delete this timer?")) {
      deleteWorkout(id);
      navigate(basePath || '/');
    }
  };

  return (
    <div className="view active" style={{ display: "block" }}>
      <div className="container">
        <header className="page-header">
          <Link to={basePath || '/'} className="btn-icon">
            &larr;
          </Link>
          <input
            type="text"
            id="workoutNameInput"
            className="workout-name-input"
            placeholder="Enter timer name"
            defaultValue={workout.name}
            autoFocus
          />
          <div></div>
        </header>

        <div className="editor-content">
          <div className="intervals-section">
            <h2>Intervals</h2>
            <div className="intervals-list">
              {workout.intervals.map((interval, idx) => (
                <div key={interval.id}>
                  <div
                    className="interval-row"
                    style={{ borderLeft: `4px solid ${interval.color}` }}
                  >
                    <div
                      className="interval-color"
                      style={{ backgroundColor: interval.color }}
                      onClick={() => {
                        const color = prompt("Choose color (hex code):", interval.color);
                        if (color) {
                          updateInterval(id, interval.id, { color });
                        }
                      }}
                    ></div>
                    <input
                      type="text"
                      className="interval-name"
                      defaultValue={interval.name}
                      onChange={(e) =>
                        updateInterval(id, interval.id, { name: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      className="interval-duration"
                      defaultValue={formatTime(interval.duration)}
                      onChange={(e) => {
                        const parsed = parseTimeInput(e.target.value);
                        if (parsed > 0) {
                          updateInterval(id, interval.id, {
                            duration: parsed,
                          });
                        }
                      }}
                    />
                    <div className="interval-actions">
                      <button
                        className="interval-btn"
                        onClick={() => moveInterval(id, idx, Math.max(0, idx - 1))}
                        title="Move up"
                      >
                        ^
                      </button>
                      <button
                        className="interval-btn"
                        onClick={() =>
                          moveInterval(
                            id,
                            idx,
                            Math.min(workout.intervals.length - 1, idx + 1)
                          )
                        }
                        title="Move down"
                      >
                        v
                      </button>
                      <button
                        className="interval-btn"
                        onClick={() => duplicateInterval(id, interval.id)}
                        title="Duplicate"
                      >
                        Copy
                      </button>
                      <button
                        className="interval-btn"
                        onClick={() => deleteInterval(id, interval.id)}
                        title="Delete"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              id="addIntervalBtn"
              className="btn btn-secondary"
              onClick={() => addInterval(id)}
            >
              + Add Interval
            </button>
          </div>

          <div className="rounds-section">
            <label htmlFor="roundsInput">Rounds</label>
            <div className="rounds-control">
              <button className="btn-small" onClick={() => updateRounds(id, workout.rounds - 1)}>
                -
              </button>
              <input
                type="number"
                id="roundsInput"
                min="1"
                value={workout.rounds}
                onChange={(e) => updateRounds(id, parseInt(e.target.value) || 1)}
              />
              <button className="btn-small" onClick={() => updateRounds(id, workout.rounds + 1)}>
                +
              </button>
            </div>
          </div>

          <div className="total-duration">
            <div>
              <span>Per Round: </span>
              <strong>{formatTime(workout.intervals.reduce((sum, i) => sum + (i.duration || 0), 0))}</strong>
            </div>
            <div>
              <span>Total: </span>
              <strong>{formatTime(totalDuration)}</strong>
              <span style={{ color: "var(--text-secondary)", marginLeft: "8px" }}>
                ({workout.rounds} round{workout.rounds !== 1 ? "s" : ""})
              </span>
            </div>
          </div>
        </div>

        <footer className="editor-footer">
          <Link to={basePath || '/'} className="btn btn-secondary">
            &larr; Back
          </Link>
          <div className="save-button-wrapper">
            <button className="btn btn-primary" onClick={saveWorkout}>
              Save
            </button>
            {saveMessage && <span className="save-message">{saveMessage}</span>}
          </div>
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </footer>
      </div>
    </div>
  );
};

export default IntervalEditor;

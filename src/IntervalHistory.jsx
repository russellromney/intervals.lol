import React from "react";
import { Link } from "react-router-dom";
import { useWorkout, getBasePath } from "./WorkoutContext";

const IntervalHistory = () => {
  const basePath = getBasePath();
  const {
    completions,
    workouts,
    getWorkoutStats,
    getCompletionWorkoutName,
    formatTime,
  } = useWorkout();

  const stats = getWorkoutStats();

  return (
    <div className="view active" style={{ display: "block" }}>
      <div className="container">
        <header className="page-header">
          <h1>History</h1>
        </header>

        {completions.length > 0 ? (
          <>
            <div style={{
              background: "var(--bg-secondary)",
              padding: "24px",
              borderRadius: "var(--radius)",
              marginBottom: "30px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "24px",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--primary)" }}>
                  {stats.completedWorkouts} / {stats.totalWorkouts}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
                  Completed / Started
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--primary)" }}>
                  {formatTime(stats.totalTime)}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
                  Total Time
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--success)" }}>
                  {stats.streak}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
                  Day Streak
                </div>
              </div>
            </div>

            <div className="histories-list">
              {[...completions]
                .sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt))
                .map((completion) => {
                  const date = new Date(completion.completedAt || completion.startedAt);
                  const dateStr =
                    date.toLocaleDateString() +
                    " " +
                    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  const workoutName = getCompletionWorkoutName(completion);
                  const isComplete = completion.completed;
                  const elapsed = completion.elapsedDuration || 0;
                  const total = completion.totalDuration;
                  const percentComplete = total > 0 ? Math.round((elapsed / total) * 100) : 0;
                  const workoutExists = workouts.find(w => w.id === completion.workoutId);
                  return (
                    <div key={completion.id} className="history-item">
                      {workoutExists ? (
                        <Link
                          to={`${basePath}/edit/${completion.workoutId}`}
                          style={{ textDecoration: "none", color: "inherit", flex: 1 }}
                        >
                          <div className="history-item-info">
                            <h3>
                              {workoutName}
                              {!isComplete && (
                                <span style={{
                                  color: "var(--warning, #f59e0b)",
                                  fontSize: "12px",
                                  marginLeft: "8px",
                                  fontWeight: "normal"
                                }}>
                                  (partial)
                                </span>
                              )}
                            </h3>
                            <div className="history-item-date">{dateStr}</div>
                          </div>
                        </Link>
                      ) : (
                        <div className="history-item-info">
                          <h3>
                            {workoutName}
                            {!isComplete && (
                              <span style={{
                                color: "var(--warning, #f59e0b)",
                                fontSize: "12px",
                                marginLeft: "8px",
                                fontWeight: "normal"
                              }}>
                                (partial)
                              </span>
                            )}
                          </h3>
                          <div className="history-item-date">{dateStr}</div>
                        </div>
                      )}
                      <div className="history-item-duration" style={{ textAlign: "right" }}>
                        {isComplete ? (
                          formatTime(total)
                        ) : (
                          <>
                            <div>{formatTime(elapsed)} / {formatTime(total)}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                              {percentComplete}%
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">Target</div>
            <h2>No completed timers</h2>
            <p>Start a timer and complete it to see it here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntervalHistory;

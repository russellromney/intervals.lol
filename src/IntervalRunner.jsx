import React, { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useWorkout, getBasePath } from "./WorkoutContext";

const IntervalRunner = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = getBasePath();
  const {
    getWorkout,
    timerState,
    setTimerState,
    setCompletions,
    getTotalWorkoutDuration,
    formatTime,
    speak,
    generateId,
    calculateElapsedSeconds,
  } = useWorkout();

  const workout = getWorkout(id);

  // Initialize timer when component mounts or when workout ID changes
  useEffect(() => {
    if (!workout || !workout.intervals.length) return;

    // Only initialize if we don't have an active timer for this workout
    if (timerState.currentWorkout?.id !== workout.id) {
      const completionId = generateId();
      const completion = {
        id: completionId,
        workoutId: workout.id,
        workoutName: workout.name,
        totalDuration: getTotalWorkoutDuration(workout),
        elapsedDuration: 0,
        completed: false,
        startedAt: Date.now(),
        completedAt: null,
      };
      setCompletions(prev => [completion, ...prev]);

      setTimerState({
        isRunning: true,
        currentWorkout: JSON.parse(JSON.stringify(workout)),
        currentIntervalIndex: 0,
        currentRound: 0,
        remainingSeconds: workout.intervals[0].duration,
        totalSeconds: getTotalWorkoutDuration(workout),
        timerInterval: null,
        currentCompletionId: completionId,
      });

      speak(
        `Starting ${workout.name}. ${workout.intervals[0].name} for ${workout.intervals[0].duration} seconds.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Timer tick effect
  useEffect(() => {
    if (!timerState.isRunning || !timerState.currentWorkout) return;

    const interval = setInterval(() => {
      setTimerState(prev => {
        if (!prev.currentWorkout) return prev;

        const newRemaining = prev.remainingSeconds - 1;

        // Countdown voice warnings
        if (newRemaining === 3 || newRemaining === 2 || newRemaining === 1) {
          speak(String(newRemaining));
        }

        // Time's up for current interval
        if (newRemaining <= 0) {
          const w = prev.currentWorkout;
          const nextIntervalIndex = prev.currentIntervalIndex + 1;

          // Check if there are more intervals in this round
          if (nextIntervalIndex < w.intervals.length) {
            const nextInterval = w.intervals[nextIntervalIndex];
            speak(`${nextInterval.name} for ${nextInterval.duration} seconds`);
            return {
              ...prev,
              currentIntervalIndex: nextIntervalIndex,
              remainingSeconds: nextInterval.duration,
            };
          }

          // Check if there are more rounds
          const nextRound = prev.currentRound + 1;
          if (nextRound < w.rounds) {
            const firstInterval = w.intervals[0];
            speak(`Round ${nextRound + 1} of ${w.rounds}. ${firstInterval.name} for ${firstInterval.duration} seconds`);
            return {
              ...prev,
              currentIntervalIndex: 0,
              currentRound: nextRound,
              remainingSeconds: firstInterval.duration,
            };
          }

          // Workout complete
          clearInterval(interval);
          return { ...prev, isRunning: false, remainingSeconds: 0 };
        }

        return { ...prev, remainingSeconds: newRemaining };
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState.isRunning, timerState.currentWorkout]);

  // Check for workout completion
  useEffect(() => {
    if (
      timerState.currentWorkout &&
      !timerState.isRunning &&
      timerState.remainingSeconds === 0 &&
      timerState.currentIntervalIndex === timerState.currentWorkout.intervals.length - 1 &&
      timerState.currentRound === timerState.currentWorkout.rounds - 1
    ) {
      completeWorkout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState.isRunning, timerState.remainingSeconds]);

  const toggleTimer = () => {
    setTimerState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const stopTimer = () => {
    if (timerState.currentCompletionId && timerState.currentWorkout) {
      const elapsed = calculateElapsedSeconds();
      setCompletions(prev => prev.map(c =>
        c.id === timerState.currentCompletionId
          ? { ...c, elapsedDuration: elapsed, completedAt: Date.now() }
          : c
      ));
    }

    setTimerState({
      isRunning: false,
      currentWorkout: null,
      currentIntervalIndex: 0,
      currentRound: 0,
      remainingSeconds: 0,
      totalSeconds: 0,
      timerInterval: null,
      currentCompletionId: null,
    });
    navigate(basePath || '/');
  };

  const completeWorkout = () => {
    if (timerState.currentCompletionId) {
      setCompletions(prev => prev.map(c =>
        c.id === timerState.currentCompletionId
          ? {
              ...c,
              elapsedDuration: c.totalDuration,
              completed: true,
              completedAt: Date.now(),
            }
          : c
      ));
      speak("Timer complete! Great job!");
    }
    setTimerState({
      isRunning: false,
      currentWorkout: null,
      currentIntervalIndex: 0,
      currentRound: 0,
      remainingSeconds: 0,
      totalSeconds: 0,
      timerInterval: null,
      currentCompletionId: null,
    });
    navigate(basePath || '/');
  };

  if (!workout || !workout.intervals.length) {
    return (
      <div className="view active" style={{ display: "block" }}>
        <div className="container">
          <div className="empty-state">
            <h2>Timer not found or has no intervals</h2>
            <Link to={basePath || '/'} className="btn btn-primary">
              Back to Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!timerState.currentWorkout) {
    return (
      <div className="view active" style={{ display: "block" }}>
        <div className="container">
          <div className="empty-state">
            <h2>Loading timer...</h2>
          </div>
        </div>
      </div>
    );
  }

  const currentInterval = timerState.currentWorkout.intervals[timerState.currentIntervalIndex];
  const totalIntervalTime = currentInterval.duration;
  const progress = ((totalIntervalTime - timerState.remainingSeconds) / totalIntervalTime) * 100;

  // Calculate total elapsed time
  let elapsedSeconds = 0;
  for (let r = 0; r < timerState.currentRound; r++) {
    elapsedSeconds += timerState.currentWorkout.intervals.reduce((sum, i) => sum + i.duration, 0);
  }
  for (let i = 0; i < timerState.currentIntervalIndex; i++) {
    elapsedSeconds += timerState.currentWorkout.intervals[i].duration;
  }
  elapsedSeconds += totalIntervalTime - timerState.remainingSeconds;

  const totalProgress = (elapsedSeconds / timerState.totalSeconds) * 100;

  return (
    <div className="view active" style={{ display: "block" }}>
      <div className="container timer-container">
        <div
          className="timer-display"
          style={{
            backgroundColor: currentInterval.color,
            borderRadius: "var(--radius)",
            padding: "40px",
            textAlign: "center",
            color: "#fff",
            marginBottom: "30px",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "10px", opacity: 0.9 }}>
            {currentInterval.name}
          </div>
          <div style={{ fontSize: "96px", fontWeight: "700", lineHeight: 1 }}>
            {formatTime(timerState.remainingSeconds)}
          </div>
          <div style={{ marginTop: "20px", opacity: 0.8 }}>
            Round {timerState.currentRound + 1} of {timerState.currentWorkout.rounds}
          </div>
          <div
            style={{
              marginTop: "20px",
              height: "8px",
              backgroundColor: "rgba(255,255,255,0.3)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                backgroundColor: "#fff",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
            Overall Progress
          </div>
          <div
            style={{
              height: "12px",
              backgroundColor: "var(--bg-secondary)",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${totalProgress}%`,
                height: "100%",
                backgroundColor: "var(--primary)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
            {formatTime(elapsedSeconds)} / {formatTime(timerState.totalSeconds)}
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
          <button
            className="btn btn-secondary"
            onClick={stopTimer}
            style={{ padding: "15px 30px", fontSize: "18px" }}
          >
            Stop
          </button>
          <button
            className="btn btn-primary"
            onClick={toggleTimer}
            style={{ padding: "15px 40px", fontSize: "18px" }}
          >
            {timerState.isRunning ? "Pause" : "Start"}
          </button>
        </div>

        {/* Upcoming intervals */}
        <div style={{ marginTop: "40px" }}>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "15px" }}>
            Coming Up
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {timerState.currentWorkout.intervals.slice(timerState.currentIntervalIndex + 1).map((interval) => (
              <div
                key={interval.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "var(--radius)",
                  borderLeft: `4px solid ${interval.color}`,
                }}
              >
                <span style={{ flex: 1 }}>{interval.name}</span>
                <span style={{ color: "var(--text-secondary)" }}>{formatTime(interval.duration)}</span>
              </div>
            ))}
            {timerState.currentRound + 1 < timerState.currentWorkout.rounds && (
              <div
                style={{
                  padding: "10px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "var(--radius)",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                + {timerState.currentWorkout.rounds - timerState.currentRound - 1} more round{timerState.currentWorkout.rounds - timerState.currentRound - 1 > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntervalRunner;

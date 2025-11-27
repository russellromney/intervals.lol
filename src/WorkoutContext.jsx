import React, { createContext, useContext, useState, useEffect } from "react";

const WorkoutContext = createContext();

// Check if we're on intervals.lol domain
export const isIntervalsLol = () => {
  const hostname = window.location.hostname;
  return hostname === 'intervals.lol' || hostname === 'www.intervals.lol';
};

// Get base path for routes
export const getBasePath = () => isIntervalsLol() ? '' : '/tools/interval-timer';

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error("useWorkout must be used within a WorkoutProvider");
  }
  return context;
};

export const WorkoutProvider = ({ children }) => {
  const [workouts, setWorkouts] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [voiceEnabled] = useState(true);
  const [timerState, setTimerState] = useState({
    isRunning: false,
    currentWorkout: null,
    currentIntervalIndex: 0,
    currentRound: 0,
    remainingSeconds: 0,
    totalSeconds: 0,
    timerInterval: null,
    currentCompletionId: null,
  });
  const [saveMessage, setSaveMessage] = useState(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedWorkouts = localStorage.getItem("workouts");
    const savedCompletions = localStorage.getItem("completions");
    if (savedWorkouts) setWorkouts(JSON.parse(savedWorkouts));
    if (savedCompletions) setCompletions(JSON.parse(savedCompletions));
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("workouts", JSON.stringify(workouts));
  }, [workouts]);

  useEffect(() => {
    localStorage.setItem("completions", JSON.stringify(completions));
  }, [completions]);

  // Helper functions
  const generateId = () => crypto.randomUUID();

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const parseTimeInput = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return 0;

    if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      if (parts.length !== 2) return 0;
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (isNaN(mins) || isNaN(secs)) return 0;
      if (mins < 0 || secs < 0) return 0;
      if (secs >= 60) return 0;
      return mins * 60 + secs;
    } else {
      const num = parseInt(trimmed, 10);
      if (isNaN(num)) return 0;
      if (num < 0) return 0;
      return num;
    }
  };

  const getTotalWorkoutDuration = (workout) => {
    if (!workout || !workout.intervals || !workout.intervals.length) return 0;
    const intervalTotal = workout.intervals.reduce(
      (sum, i) => sum + (i.duration || 0),
      0
    );
    return intervalTotal * workout.rounds;
  };

  const getCompletionWorkoutName = (completion) => {
    const workout = workouts.find((w) => w.id === completion.workoutId);
    return workout ? workout.name : completion.workoutName;
  };

  const speak = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  // Workout CRUD
  const createWorkout = (name = "New Workout") => {
    const workout = {
      id: generateId(),
      name,
      intervals: [],
      rounds: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setWorkouts([...workouts, workout]);
    return workout;
  };

  const getWorkout = (id) => workouts.find((w) => w.id === id);

  const updateWorkout = (id, updates) => {
    setWorkouts(
      workouts.map((w) =>
        w.id === id
          ? { ...w, ...updates, updatedAt: Date.now() }
          : w
      )
    );
  };

  const deleteWorkout = (id) => {
    setWorkouts(workouts.filter((w) => w.id !== id));
  };

  // Interval operations
  const addInterval = (workoutId) => {
    const workout = getWorkout(workoutId);
    if (!workout) return;
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#f9ca24",
      "#6c5ce7",
      "#a29bfe",
      "#fd79a8",
      "#74b9ff",
    ];
    const interval = {
      id: generateId(),
      name: `Interval ${workout.intervals.length + 1}`,
      duration: 45,
      color: colors[workout.intervals.length % colors.length],
    };
    workout.intervals.push(interval);
    updateWorkout(workoutId, workout);
  };

  const updateInterval = (workoutId, intervalId, updates) => {
    const workout = getWorkout(workoutId);
    if (!workout) return;
    const newIntervals = workout.intervals.map((i) =>
      i.id === intervalId ? { ...i, ...updates } : i
    );
    updateWorkout(workoutId, { intervals: newIntervals });
  };

  const updateRounds = (workoutId, rounds) => {
    updateWorkout(workoutId, { rounds: Math.max(1, rounds) });
  };

  const deleteInterval = (workoutId, intervalId) => {
    const workout = getWorkout(workoutId);
    if (workout && workout.intervals.length === 1) {
      alert("A workout must have at least one interval.");
      return;
    }
    const updated = getWorkout(workoutId);
    if (!updated) return;
    updated.intervals = updated.intervals.filter((i) => i.id !== intervalId);
    updateWorkout(workoutId, updated);
  };

  const duplicateInterval = (workoutId, intervalId) => {
    const workout = getWorkout(workoutId);
    if (!workout) return;
    const original = workout.intervals.find((i) => i.id === intervalId);
    if (!original) return;
    const duplicate = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId(),
    };
    const match = duplicate.name.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      duplicate.name = duplicate.name.replace(/\d+$/, num + 1);
    }
    const index = workout.intervals.indexOf(original);
    workout.intervals.splice(index + 1, 0, duplicate);
    updateWorkout(workoutId, workout);
  };

  const moveInterval = (workoutId, fromIndex, toIndex) => {
    const workout = getWorkout(workoutId);
    if (!workout || fromIndex === toIndex) return;
    const interval = workout.intervals.splice(fromIndex, 1)[0];
    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
    workout.intervals.splice(adjustedToIndex, 0, interval);
    updateWorkout(workoutId, workout);
  };

  // Helper to calculate elapsed seconds
  const calculateElapsedSeconds = () => {
    if (!timerState.currentWorkout) return 0;
    const workout = timerState.currentWorkout;
    let elapsed = 0;
    for (let r = 0; r < timerState.currentRound; r++) {
      elapsed += workout.intervals.reduce((sum, i) => sum + i.duration, 0);
    }
    for (let i = 0; i < timerState.currentIntervalIndex; i++) {
      elapsed += workout.intervals[i].duration;
    }
    const currentInterval = workout.intervals[timerState.currentIntervalIndex];
    if (currentInterval) {
      elapsed += currentInterval.duration - timerState.remainingSeconds;
    }
    return elapsed;
  };

  // Import/Export
  const exportWorkout = (workoutId) => {
    const workout = getWorkout(workoutId);
    if (!workout) return null;
    return JSON.stringify(workout, null, 2);
  };

  const copyWorkout = (workoutId) => {
    const json = exportWorkout(workoutId);
    if (!json) return;
    navigator.clipboard.writeText(json).then(() => {
      alert("Workout copied to clipboard! Share it with a friend.");
    }).catch(() => {
      alert("Copy failed. Here's the JSON:\n\n" + json);
    });
  };

  const importWorkoutFromClipboard = () => {
    const jsonString = prompt("Paste the workout JSON here:");
    if (!jsonString) return;
    try {
      const data = JSON.parse(jsonString);
      if (!data.name || !data.intervals || !data.rounds) {
        alert("Import failed: Invalid workout format");
        return;
      }
      data.id = generateId();
      data.intervals = data.intervals.map((i) => ({
        ...i,
        id: generateId(),
      }));
      data.createdAt = Date.now();
      data.updatedAt = Date.now();
      setWorkouts([...workouts, data]);
      alert("Workout imported successfully!");
    } catch (error) {
      alert("Import failed: Invalid JSON format");
    }
  };

  // Full data backup/restore
  const exportAllData = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts,
      completions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intervals-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importAllData = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.workouts || !Array.isArray(data.workouts)) {
            reject(new Error("Invalid backup file: missing workouts"));
            return;
          }
          // Merge or replace - we'll merge by default
          const existingIds = new Set(workouts.map(w => w.id));
          const newWorkouts = data.workouts.filter(w => !existingIds.has(w.id));
          const existingCompletionIds = new Set(completions.map(c => c.id));
          const newCompletions = (data.completions || []).filter(c => !existingCompletionIds.has(c.id));

          setWorkouts([...workouts, ...newWorkouts]);
          setCompletions([...completions, ...newCompletions]);
          resolve({
            workoutsImported: newWorkouts.length,
            completionsImported: newCompletions.length,
            workoutsSkipped: data.workouts.length - newWorkouts.length,
            completionsSkipped: (data.completions || []).length - newCompletions.length,
          });
        } catch (error) {
          reject(new Error("Invalid backup file format"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  // Stats
  const getWorkoutStats = () => {
    if (completions.length === 0) {
      return { totalWorkouts: 0, completedWorkouts: 0, totalTime: 0, streak: 0, lastWorkout: null };
    }
    const totalTime = completions.reduce((sum, c) => sum + (c.elapsedDuration || c.totalDuration || 0), 0);
    const completedWorkouts = completions.filter(c => c.completed).length;
    const lastWorkout = completions[0];
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const completionsByDate = {};
    completions.forEach((c) => {
      const date = new Date(c.completedAt || c.startedAt);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split("T")[0];
      completionsByDate[dateStr] = true;
    });
    while (completionsByDate[currentDate.toISOString().split("T")[0]]) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    return { totalWorkouts: completions.length, completedWorkouts, totalTime, streak, lastWorkout };
  };

  const value = {
    workouts,
    setWorkouts,
    completions,
    setCompletions,
    timerState,
    setTimerState,
    saveMessage,
    setSaveMessage,
    voiceEnabled,
    // Helpers
    generateId,
    formatTime,
    parseTimeInput,
    getTotalWorkoutDuration,
    getCompletionWorkoutName,
    speak,
    calculateElapsedSeconds,
    // CRUD
    createWorkout,
    getWorkout,
    updateWorkout,
    deleteWorkout,
    // Intervals
    addInterval,
    updateInterval,
    updateRounds,
    deleteInterval,
    duplicateInterval,
    moveInterval,
    // Import/Export
    exportWorkout,
    copyWorkout,
    importWorkoutFromClipboard,
    exportAllData,
    importAllData,
    // Stats
    getWorkoutStats,
  };

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
};

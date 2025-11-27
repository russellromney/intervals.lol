import React, { useEffect } from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import { WorkoutProvider, isIntervalsLol, getBasePath } from "./WorkoutContext";
import IntervalLibrary from "./IntervalLibrary";
import IntervalEditor from "./IntervalEditor";
import IntervalHistory from "./IntervalHistory";
import IntervalRunner from "./IntervalRunner";
import IntervalAbout from "./IntervalAbout";
import "./IntervalTimer.css";

const IntervalTimerContent = () => {
  const basePath = getBasePath();
  const onIntervalsLol = isIntervalsLol();

  // Set page title
  useEffect(() => {
    const originalTitle = document.title;
    document.title = onIntervalsLol ? "intervals.lol" : "Interval Timer";
    return () => { document.title = originalTitle; };
  }, [onIntervalsLol]);

  return (
    <div className="workout-timer-app">
      {!onIntervalsLol && (
        <div className="timer-home-link">
          <a href="/">Back to russellromney.com</a>
        </div>
      )}
      <nav className="view-tabs">
        {onIntervalsLol && (
          <Link to={basePath || '/'} className="brand-logo">
            intervals.lol
          </Link>
        )}
        <div className="nav-tabs">
          <NavLink
            to={basePath || '/'}
            end
            className={({ isActive }) => `tab-btn ${isActive ? "active" : ""}`}
          >
            Timers
          </NavLink>
          <NavLink
            to={`${basePath}/history`}
            className={({ isActive }) => `tab-btn ${isActive ? "active" : ""}`}
          >
            History
          </NavLink>
          <NavLink
            to={`${basePath}/about`}
            className={({ isActive }) => `tab-btn ${isActive ? "active" : ""}`}
          >
            About
          </NavLink>
        </div>
      </nav>

      <Routes>
        <Route index element={<IntervalLibrary />} />
        <Route path="edit/:id" element={<IntervalEditor />} />
        <Route path="history" element={<IntervalHistory />} />
        <Route path="run/:id" element={<IntervalRunner />} />
        <Route path="about" element={<IntervalAbout />} />
      </Routes>

      {onIntervalsLol && (
        <footer className="intervals-footer">
          Made with ❤️ in NYC by <a href="https://russellromney.com" target="_blank" rel="noopener noreferrer">Russell Romney</a>
        </footer>
      )}
    </div>
  );
};

const IntervalTimer = () => {
  return (
    <WorkoutProvider>
      <IntervalTimerContent />
    </WorkoutProvider>
  );
};

export default IntervalTimer;

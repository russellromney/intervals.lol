import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { getBasePath, useWorkout } from "./WorkoutContext";

const IntervalAbout = () => {
  const basePath = getBasePath();
  const { exportAllData, importAllData, workouts, completions } = useWorkout();
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleExport = () => {
    exportAllData();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importAllData(file);
      setImportStatus({
        success: true,
        message: `Imported ${result.workoutsImported} timers and ${result.completionsImported} history entries. Skipped ${result.workoutsSkipped} duplicate timers.`,
      });
    } catch (error) {
      setImportStatus({
        success: false,
        message: error.message,
      });
    }

    // Reset file input
    e.target.value = "";
  };

  return (
    <div className="view active" style={{ display: "block" }}>
      <div className="container">
        <header className="page-header">
          <h1>About</h1>
        </header>

        <div className="about-content">
          <section className="about-section">
            <h2>What is intervals.lol?</h2>
            <p>
              A simple, free interval timer for workouts, pomodoro sessions, meditation,
              cooking, and anything else that needs timed intervals. No account required,
              no ads, no tracking. All data is stored locally in your browser.
            </p>
          </section>

          <section className="about-section">
            <h2>Use Cases</h2>
            <div className="use-cases-grid">
              <div className="use-case">
                <div className="use-case-icon">💪</div>
                <h3>Workouts</h3>
                <p>HIIT, Tabata, circuit training, stretching routines, and more.</p>
              </div>
              <div className="use-case">
                <div className="use-case-icon">🍅</div>
                <h3>Pomodoro</h3>
                <p>25 minutes of focus, 5 minutes of break. Repeat for productivity.</p>
              </div>
              <div className="use-case">
                <div className="use-case-icon">🧘</div>
                <h3>Meditation</h3>
                <p>Guided breathing intervals, meditation sessions, or yoga flows.</p>
              </div>
              <div className="use-case">
                <div className="use-case-icon">🍳</div>
                <h3>Cooking</h3>
                <p>Multi-step recipes with different cooking times for each step.</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Features</h2>
            <ul className="features-list">
              <li><strong>Custom timers:</strong> Create unlimited timers with any number of intervals</li>
              <li><strong>Rounds:</strong> Repeat your intervals multiple times automatically</li>
              <li><strong>Voice announcements:</strong> Hear interval names and countdown warnings</li>
              <li><strong>Color coding:</strong> Assign colors to intervals for easy visual tracking</li>
              <li><strong>History tracking:</strong> See your completed sessions and stats</li>
              <li><strong>Works offline:</strong> Once loaded, works without internet</li>
            </ul>
          </section>

          <section className="about-section">
            <h2>Where is my data saved?</h2>
            <p>
              All your timers and history are saved <strong>locally in your browser</strong> using
              localStorage. This means:
            </p>
            <ul className="features-list">
              <li>Your data never leaves your device</li>
              <li>No account or sign-up required</li>
              <li>Data persists between sessions</li>
              <li>Clearing browser data will delete your timers</li>
              <li>Data is specific to this browser/device</li>
            </ul>
          </section>

          <section className="about-section">
            <h2>Backup & Restore</h2>
            <p>
              Download all your data as a backup file, or restore from a previous backup.
              This lets you transfer your timers to another device or keep a safe copy.
            </p>
            <p className="data-summary">
              You currently have <strong>{workouts.length} timer{workouts.length !== 1 ? 's' : ''}</strong> and{' '}
              <strong>{completions.length} history entr{completions.length !== 1 ? 'ies' : 'y'}</strong>.
            </p>
            <div className="backup-buttons">
              <button onClick={handleExport} className="btn btn-primary">
                Download Backup
              </button>
              <button onClick={handleImportClick} className="btn btn-secondary">
                Restore from File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
            {importStatus && (
              <div className={`import-status ${importStatus.success ? 'success' : 'error'}`}>
                {importStatus.message}
              </div>
            )}
          </section>

          <section className="about-section">
            <h2>How to Use</h2>
            <ol className="how-to-list">
              <li>
                <strong>Create a timer:</strong> Click "New Timer" on the Timers page
              </li>
              <li>
                <strong>Add intervals:</strong> Give each interval a name, duration, and color
              </li>
              <li>
                <strong>Set rounds:</strong> Choose how many times to repeat all intervals
              </li>
              <li>
                <strong>Save and start:</strong> Save your timer, then click "Start" to begin
              </li>
              <li>
                <strong>Track progress:</strong> View your completed sessions in History
              </li>
            </ol>
          </section>

          <section className="about-section">
            <h2>Quick Start Templates</h2>
            <p>
              Don't know where to start? Here are some common timer setups:
            </p>
            <div className="templates-grid">
              <div className="template-card">
                <h4>Classic Pomodoro</h4>
                <p>25 min work, 5 min break × 4 rounds</p>
              </div>
              <div className="template-card">
                <h4>Tabata</h4>
                <p>20 sec work, 10 sec rest × 8 rounds</p>
              </div>
              <div className="template-card">
                <h4>HIIT</h4>
                <p>40 sec work, 20 sec rest × 10 rounds</p>
              </div>
              <div className="template-card">
                <h4>5-4-3-2-1 Grounding</h4>
                <p>5 intervals decreasing from 60 to 20 seconds</p>
              </div>
            </div>
          </section>

          <div className="about-cta">
            <Link to={basePath || '/'} className="btn btn-primary btn-large">
              Create Your First Timer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntervalAbout;

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getBasePath, useWorkout } from "./WorkoutContext";

const IntervalAbout = () => {
  const basePath = getBasePath();
  const { workouts } = useWorkout();
  const hasTimers = workouts && workouts.length > 0;
  const [activeSection, setActiveSection] = useState("");

  const sections = [
    { id: "what-is", title: "What is intervals.lol?" },
    { id: "use-cases", title: "Use Cases" },
    { id: "features", title: "Features" },
    { id: "data-storage", title: "Where is my data saved?" },
    { id: "how-to-use", title: "How to Use" },
    { id: "templates", title: "Quick Start Templates" },
    { id: "backend", title: "Deploying Your Own Backend" },
  ];

  const handleSectionClick = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = element.offsetTop - 60; // Small offset for comfortable spacing
      window.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  // Track which section is in view
  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      }));

      for (let section of sectionElements) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom > 200) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="view active" style={{ display: "block" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", paddingLeft: "240px", position: "relative" }}>
        {/* Sidebar */}
        <nav
          style={{
            position: "fixed",
            top: "80px",
            left: "max(20px, calc((100vw - 1200px) / 2))",
            width: "200px",
            fontSize: "14px",
          }}
        >
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sections.map((section) => (
              <li key={section.id} style={{ marginBottom: "12px" }}>
                <button
                  onClick={() => handleSectionClick(section.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: activeSection === section.id ? "#4ade80" : "#999",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "14px",
                    padding: 0,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (activeSection !== section.id) e.target.style.color = "#ccc";
                  }}
                  onMouseLeave={(e) => {
                    if (activeSection !== section.id) e.target.style.color = "#999";
                  }}
                >
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content */}
        <div>
        <header className="page-header">
          <h1>About</h1>
        </header>

        <div className="about-content">
          <section className="about-section" id="what-is">
            <h2>What is intervals.lol?</h2>
            <p>
              A simple, free interval timer for workouts, pomodoro sessions, meditation,
              cooking, and anything else that needs timed intervals. No account required,
              no ads, no tracking. All data is stored locally in your browser. Optionally
              self-deploy a backend for cross-device sync.
            </p>
          </section>

          <section className="about-section" id="use-cases">
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

          <section className="about-section" id="features">
            <h2>Features</h2>
            <ul className="features-list">
              <li><strong>Custom timers:</strong> Create unlimited timers with any number of intervals</li>
              <li><strong>Rounds:</strong> Repeat your intervals multiple times automatically</li>
              <li><strong>Voice announcements:</strong> Hear interval names and countdown warnings</li>
              <li><strong>Color coding:</strong> Assign colors to intervals for easy visual tracking</li>
              <li><strong>History tracking:</strong> See your completed sessions and stats</li>
              <li><strong>Works offline:</strong> Once loaded, works without internet</li>
              <li><strong>Cloud sync:</strong> Optionally sync across devices with your own backend</li>
            </ul>
          </section>

          <section className="about-section" id="data-storage">
            <h2>Where is my data saved?</h2>
            <p>
              All your timers and history are saved <strong>locally in your browser</strong> using
              localStorage. This means:
            </p>
            <ul className="features-list">
              <li>Your data never leaves your device (unless you enable cloud sync)</li>
              <li>No account or sign-up required</li>
              <li>Data persists between sessions</li>
              <li>Clearing browser data will delete your timers</li>
              <li>Data is specific to this browser/device</li>
            </ul>
            <p>
              Want to backup your data or sync across devices? Check out the{' '}
              <Link to={`${basePath}/settings`}>Settings</Link> page.
            </p>
          </section>

          <section className="about-section" id="how-to-use">
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

          <section className="about-section" id="templates">
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

          <section className="about-section" id="backend">
            <h2>Deploying Your Own Backend</h2>
            <p>
              Want to self-host the backend for cloud sync? It's easy! The backend is a simple Go server
              that can be deployed for free on Fly.io (or any cloud provider).
            </p>

            <h3>Quick Start (Fly.io)</h3>
            <ol className="how-to-list">
              <li>
                <strong>Clone the repository:</strong>
                <code className="code-block">git clone https://github.com/russellromney/intervals.lol
cd intervals.lol/backend</code>
              </li>
              <li>
                <strong>Install Fly CLI:</strong>
                <a href="https://fly.io/docs/hands-on/install-flyctl/" target="_blank" rel="noopener noreferrer">
                  Download flyctl
                </a>
              </li>
              <li>
                <strong>Create a Fly app:</strong>
                <code className="code-block">fly launch</code>
                <small>Choose a name like <code>intervals-backend</code></small>
              </li>
              <li>
                <strong>Deploy:</strong>
                <code className="code-block">fly deploy</code>
              </li>
              <li>
                <strong>Get your backend URL:</strong>
                <code className="code-block">fly status</code>
                <small>Look for the public URL (e.g., <code>https://intervals-backend.fly.dev</code>)</small>
              </li>
            </ol>

            <h3>Using Your Backend</h3>
            <ol className="how-to-list">
              <li>
                Go to the <Link to={`${basePath}/settings`}>Settings</Link> tab
              </li>
              <li>
                Scroll to the <strong>"Cloud Sync"</strong> section
              </li>
              <li>
                Enter your backend URL (e.g., <code>https://your-app.fly.dev</code>)
              </li>
              <li>
                If you set <code>SYNC_PASSWORD</code>, enter the password
              </li>
              <li>
                Click <strong>"Test Connection"</strong> to verify
              </li>
              <li>
                Select an existing profile or create a new one
              </li>
              <li>
                Click <strong>"Enable Cloud Sync"</strong>
              </li>
            </ol>

            <h3>How It Works</h3>
            <ul className="features-list">
              <li>
                <strong>Local-first:</strong> All your data is always stored in your browser first
              </li>
              <li>
                <strong>Profile-based:</strong> Each profile has its own set of timers and history
              </li>
              <li>
                <strong>Optional password:</strong> Set <code>SYNC_PASSWORD</code> to restrict access (recommended for public backends)
              </li>
              <li>
                <strong>Multiple profiles:</strong> Create different profiles for different users or use cases
              </li>
              <li>
                <strong>Automatic sync:</strong> Changes sync every 5 seconds (with debouncing)
              </li>
              <li>
                <strong>Cross-device:</strong> Use the same profile name on any device to sync
              </li>
              <li>
                <strong>Works offline:</strong> Syncing is optional—use locally without a backend
              </li>
            </ul>

            <h3>Environment Variables</h3>
            <ul className="features-list">
              <li><code>PORT</code> - Server port (default: 8080)</li>
              <li><code>SYNC_PASSWORD</code> - Optional password to protect your backend (if not set, backend works without password)</li>
              <li><code>SQLITE_PATH</code> - Path to SQLite database (default: ./intervals.db)</li>
              <li><code>TURSO_URL</code> - Turso database URL (optional, overrides SQLite)</li>
              <li><code>TURSO_AUTH_TOKEN</code> - Turso auth token (if using Turso)</li>
            </ul>

            <h3>Securing Your Backend (Optional)</h3>
            <p>
              To require a password to connect to your backend, set the <code>SYNC_PASSWORD</code> secret:
            </p>
            <code className="code-block">fly secrets set SYNC_PASSWORD=your-secret-password</code>
            <p style={{ marginTop: '10px' }}>
              <small>If you don't set a password, anyone can connect to your backend without authentication. We recommend setting one if your backend is publicly accessible.</small>
            </p>
          </section>

          <div className="about-cta">
            <Link to={basePath || '/'} className="btn btn-primary btn-large">
              {hasTimers ? 'Go to Timers' : 'Create Your First Timer'}
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default IntervalAbout;

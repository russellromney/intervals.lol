import React, { useState, useRef, useEffect } from "react";
import { useWorkout } from "./WorkoutContext";

const CloudSyncSection = () => {
  const { initializeSync, logoutSync, switchProfile, getSyncStatus, testConnection, getProfiles } = useWorkout();
  const [profileName, setProfileName] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [existingProfiles, setExistingProfiles] = useState([]);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [syncPassword, setSyncPassword] = useState("");
  const [passwordHash, setPasswordHash] = useState("");
  const syncStatus = getSyncStatus();
  const [backendURL, setBackendURL] = useState(syncStatus.backendURL || "");
  const [syncMessage, setSyncMessage] = useState(null);
  const [connectionTested, setConnectionTested] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [testing, setTesting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [switchToProfile, setSwitchToProfile] = useState("");

  const handleTestConnection = async () => {
    if (!backendURL) {
      setSyncMessage({
        success: false,
        message: "Please enter a backend URL first",
      });
      return;
    }

    setTesting(true);
    setSyncMessage(null);

    const result = await testConnection(backendURL, syncPassword);
    setTesting(false);

    if (result.success) {
      setConnectionTested(true);
      setPasswordRequired(result.passwordRequired);
      setPasswordHash(result.passwordHash || "");

      // Fetch existing profiles
      const profilesResult = await getProfiles(backendURL, result.passwordHash || "");
      if (profilesResult.success) {
        setExistingProfiles(profilesResult.profiles || []);
        // If no profiles exist, default to showing new profile input
        if (!profilesResult.profiles || profilesResult.profiles.length === 0) {
          setShowNewProfile(true);
        }
      }

      setSyncMessage({
        success: true,
        message: result.passwordRequired
          ? "Connection successful! Password verified."
          : "Connection successful! No password required.",
      });
    } else {
      setConnectionTested(false);
      if (result.passwordRequired) {
        setPasswordRequired(true);
        setSyncMessage({
          success: false,
          message: "Password required. Please enter the correct password.",
        });
      } else {
        setSyncMessage({
          success: false,
          message: result.error,
        });
      }
    }
  };

  const handleInitializeSync = async () => {
    const selectedProfile = showNewProfile ? newProfileName : profileName;

    if (!selectedProfile || !backendURL) {
      setSyncMessage({
        success: false,
        message: "Please select or enter a profile name",
      });
      return;
    }

    if (!connectionTested) {
      setSyncMessage({
        success: false,
        message: "Please test the connection first",
      });
      return;
    }

    const result = await initializeSync(selectedProfile, backendURL, syncPassword);
    if (result.success) {
      setSyncMessage({
        success: true,
        message: "Cloud sync enabled! Your data will now sync automatically.",
      });
      setProfileName("");
      setNewProfileName("");
      setSyncPassword("");
    } else {
      setSyncMessage({
        success: false,
        message: result.error,
      });
    }
  };

  const handleLogout = async () => {
    await logoutSync();
    setConnectionTested(false);
    setPasswordRequired(false);
    setExistingProfiles([]);
    setProfileName("");
    setNewProfileName("");
    setShowNewProfile(false);
    setShowProfileSwitcher(false);
    setSyncMessage({
      success: true,
      message: "Cloud sync disabled. Your data is still stored locally.",
    });
  };

  const handleShowProfileSwitcher = async () => {
    setSyncMessage(null);
    // Fetch profiles for the current backend
    const profilesResult = await getProfiles(syncStatus.backendURL, localStorage.getItem('syncPasswordHash') || '');
    if (profilesResult.success) {
      setExistingProfiles(profilesResult.profiles || []);
    }
    setShowProfileSwitcher(true);
  };

  const handleSwitchProfile = async () => {
    const targetProfile = switchToProfile || newProfileName;
    if (!targetProfile) {
      setSyncMessage({
        success: false,
        message: "Please select or enter a profile name",
      });
      return;
    }

    if (targetProfile === syncStatus.profileName) {
      setSyncMessage({
        success: false,
        message: "You are already using this profile",
      });
      return;
    }

    setSwitching(true);
    setSyncMessage(null);

    const result = await switchProfile(targetProfile);
    setSwitching(false);

    if (result.success) {
      setSyncMessage({
        success: true,
        message: `Switched to profile "${targetProfile}". Your data has been updated.`,
      });
      setShowProfileSwitcher(false);
      setSwitchToProfile("");
      setNewProfileName("");
    } else {
      setSyncMessage({
        success: false,
        message: result.error || "Failed to switch profile",
      });
    }
  };

  return (
    <section className="settings-section" id="cloud-sync">
      <h2>Cloud Sync</h2>
      <p>
        Keep your timers in sync across devices by backing them up to your private cloud backend.
      </p>

      {syncStatus.authenticated ? (
        <div className="sync-enabled">
          <div className="sync-status-badge">✓ Cloud sync enabled</div>
          {syncStatus.profileName && (
            <div className="sync-profile-name">
              Profile: <strong>{syncStatus.profileName}</strong>
            </div>
          )}
          {syncStatus.backendURL && (
            <div className="sync-backend-url">
              Server: <code>{syncStatus.backendURL}</code>
            </div>
          )}
          {syncStatus.syncing && <div className="sync-spinner">Syncing...</div>}
          {syncStatus.lastError && (
            <div className="sync-error">Error: {syncStatus.lastError}</div>
          )}
          {syncStatus.lastSyncTime > 0 && (
            <div className="sync-time">
              Last synced: {new Date(syncStatus.lastSyncTime).toLocaleString()}
            </div>
          )}

          {showProfileSwitcher ? (
            <div className="profile-switcher" style={{ marginTop: '16px', padding: '16px', background: 'var(--color-surface)', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 12px 0' }}>Switch Profile</h4>

              <div className="form-group">
                <label htmlFor="switch-profile-select">Select profile:</label>
                <select
                  id="switch-profile-select"
                  value={switchToProfile}
                  onChange={(e) => {
                    setSwitchToProfile(e.target.value);
                    setNewProfileName("");
                    setShowNewProfile(false);
                  }}
                  className="form-input"
                >
                  <option value="">Choose a profile...</option>
                  {existingProfiles.filter(p => p !== syncStatus.profileName).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {!showNewProfile ? (
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => setShowNewProfile(true)}
                  style={{ marginTop: '8px', padding: '4px 0' }}
                >
                  + Create new profile
                </button>
              ) : (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label htmlFor="new-profile-switch">New profile name:</label>
                  <input
                    id="new-profile-switch"
                    type="text"
                    placeholder="Enter new profile name"
                    value={newProfileName}
                    onChange={(e) => {
                      setNewProfileName(e.target.value);
                      setSwitchToProfile("");
                    }}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => {
                      setShowNewProfile(false);
                      setNewProfileName("");
                    }}
                    style={{ marginTop: '8px', padding: '4px 0' }}
                  >
                    Select existing profile
                  </button>
                </div>
              )}

              <div className="button-group" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSwitchProfile}
                  className="btn btn-primary"
                  disabled={switching || (!switchToProfile && !newProfileName)}
                >
                  {switching ? 'Switching...' : 'Switch Profile'}
                </button>
                <button
                  onClick={() => {
                    setShowProfileSwitcher(false);
                    setSwitchToProfile("");
                    setNewProfileName("");
                    setShowNewProfile(false);
                    setSyncMessage(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="button-group" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button onClick={handleShowProfileSwitcher} className="btn btn-secondary">
                Switch Profile
              </button>
              <button onClick={handleLogout} className="btn btn-secondary">
                Disable Cloud Sync
              </button>
            </div>
          )}

          {syncMessage && (
            <div className={`sync-message ${syncMessage.success ? 'success' : 'error'}`} style={{ marginTop: '12px' }}>
              {syncMessage.message}
            </div>
          )}
        </div>
      ) : (
        <div className="sync-setup">
          <p className="sync-note">
            <strong>How it works:</strong> All changes are stored locally first. With cloud sync enabled,
            they automatically sync to your private backend (every 5 seconds).
          </p>

          <div className="sync-form">
            <div className="form-group">
              <label htmlFor="backend-url">Backend URL:</label>
              <input
                id="backend-url"
                type="url"
                placeholder="https://your-backend.fly.dev"
                value={backendURL}
                onChange={(e) => {
                  setBackendURL(e.target.value);
                  setConnectionTested(false);
                }}
                className="form-input"
              />
              <small>
                Don't have a backend? Deploy one for free on{' '}
                <a href="https://fly.io" target="_blank" rel="noopener noreferrer">
                  Fly.io
                </a>
                . See the About page for deployment instructions.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="sync-password">Backend Password (if required):</label>
              <input
                id="sync-password"
                type="password"
                placeholder="Enter backend password"
                value={syncPassword}
                onChange={(e) => {
                  setSyncPassword(e.target.value);
                  setConnectionTested(false);
                }}
                className="form-input"
              />
              <small>
                If your backend has SYNC_PASSWORD set, enter it here.
              </small>
            </div>

            <button
              onClick={handleTestConnection}
              className={`btn ${connectionTested ? 'btn-success' : 'btn-secondary'}`}
              disabled={testing}
            >
              {testing ? 'Testing...' : connectionTested ? '✓ Connected' : 'Test Connection'}
            </button>

            {connectionTested && (
              <>
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label htmlFor="profile-select">Profile:</label>

                  {existingProfiles.length > 0 && !showNewProfile ? (
                    <>
                      <select
                        id="profile-select"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select a profile...</option>
                        {existingProfiles.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => setShowNewProfile(true)}
                        style={{ marginTop: '8px', padding: '4px 0' }}
                      >
                        + Create new profile
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        id="profile-name"
                        type="text"
                        placeholder="Enter a new profile name"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        className="form-input"
                      />
                      {existingProfiles.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={() => {
                            setShowNewProfile(false);
                            setNewProfileName("");
                          }}
                          style={{ marginTop: '8px', padding: '4px 0' }}
                        >
                          Select existing profile
                        </button>
                      )}
                    </>
                  )}

                  <small style={{ display: 'block', marginTop: '8px' }}>
                    {existingProfiles.length > 0
                      ? "Select an existing profile or create a new one. Use the same profile on all your devices."
                      : "Enter a name for your profile. Use the same name on all your devices to keep your timers in sync."}
                  </small>
                </div>

                <button onClick={handleInitializeSync} className="btn btn-primary">
                  Enable Cloud Sync
                </button>
              </>
            )}
          </div>

          {syncMessage && (
            <div className={`sync-message ${syncMessage.success ? 'success' : 'error'}`}>
              {syncMessage.message}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const BackupRestoreSection = () => {
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

    e.target.value = "";
  };

  return (
    <section className="settings-section" id="backup-restore">
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
  );
};

const IntervalSettings = () => {
  const { darkMode, setDarkMode, voiceEnabled, setVoiceEnabled } = useWorkout();
  const [activeSection, setActiveSection] = useState("appearance");

  const sections = [
    { id: "appearance", title: "Appearance" },
    { id: "backup-restore", title: "Backup & Restore" },
    { id: "cloud-sync", title: "Cloud Sync" },
  ];

  const handleSectionClick = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = element.offsetTop - 60; // Small offset for comfortable spacing
      window.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

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
      <div style={{ display: "flex", gap: "40px", maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
        {/* Sidebar */}
        <nav
          style={{
            position: "sticky",
            top: "20px",
            width: "200px",
            height: "fit-content",
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
        <div style={{ flex: 1 }}>
          <header className="page-header">
            <h1>Settings</h1>
          </header>

          <div className="settings-content">
            <section className="settings-section" id="appearance">
              <h2>Appearance</h2>
            <div className="setting-row">
              <div className="setting-info">
                <label>Dark Mode</label>
                <small>Switch between light and dark themes</small>
              </div>
              <button
                className={`toggle-btn ${darkMode ? 'active' : ''}`}
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? 'On' : 'Off'}
              </button>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <label>Voice Announcements</label>
                <small>Enable or disable voice announcements during workouts</small>
              </div>
              <button
                className={`toggle-btn ${voiceEnabled ? 'active' : ''}`}
                onClick={() => setVoiceEnabled(!voiceEnabled)}
              >
                {voiceEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </section>

            <BackupRestoreSection />
            <CloudSyncSection />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntervalSettings;

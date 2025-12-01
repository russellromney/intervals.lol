// SyncService handles cloud sync for intervals.lol
// Implements local-first sync with optional cloud persistence

class SyncService {
  constructor(backendURL = null) {
    // Load backend URL from localStorage if not provided
    this.backendURL = backendURL || localStorage.getItem('syncBackendURL') || null;
    this.passwordHash = localStorage.getItem('syncPasswordHash') || null;
    this.token = null;
    this.userId = null;
    this.profileName = null;
    this.syncing = false;
    this.syncScheduled = false;
    this.lastSyncTime = 0;
    this.syncTimeout = null;
    this.onAuthExpired = null; // Callback for auth expiry
  }

  // Hash a string using SHA-256
  async hashString(str) {
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Test connection to backend with optional password
  async testConnection(backendURL, password = '') {
    try {
      // Hash password before sending (empty string hashes to a known value)
      const passwordHash = password ? await this.hashString(password) : '';

      const response = await fetch(`${backendURL}/api/auth/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_hash: passwordHash }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid password', passwordRequired: true };
        }
        const error = await response.json();
        return { success: false, error: error.error || 'Connection failed' };
      }

      const data = await response.json();
      return {
        success: true,
        passwordRequired: data.password_required,
        passwordHash: passwordHash, // Return hash so it can be stored
      };
    } catch (error) {
      return { success: false, error: 'Could not connect to server' };
    }
  }

  // Get list of profiles from backend
  async getProfiles(backendURL, passwordHash = '') {
    try {
      const response = await fetch(`${backendURL}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_hash: passwordHash }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid password', profiles: [] };
        }
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to fetch profiles', profiles: [] };
      }

      const data = await response.json();
      return { success: true, profiles: data.profiles || [] };
    } catch (error) {
      return { success: false, error: 'Could not connect to server', profiles: [] };
    }
  }

  // Initialize session with profile name and optional password
  async initialize(profileName, backendURL = null, passwordHash = null) {
    // Update backend URL if provided
    if (backendURL) {
      this.backendURL = backendURL;
      localStorage.setItem('syncBackendURL', backendURL);
    }

    // Store password hash if provided
    if (passwordHash) {
      this.passwordHash = passwordHash;
      localStorage.setItem('syncPasswordHash', passwordHash);
    }

    if (!this.backendURL) {
      throw new Error('Backend URL not configured');
    }

    try {
      // Send profile name as plaintext (not hashed)
      const response = await fetch(`${this.backendURL}/api/auth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_name: profileName,
          password_hash: this.passwordHash || '',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const data = await response.json();
      this.token = data.token;
      this.userId = profileName;

      // Store session in localStorage
      localStorage.setItem('syncToken', this.token);
      localStorage.setItem('syncUserId', this.userId);
      localStorage.setItem('syncProfileName', profileName);

      return { success: true, token: this.token };
    } catch (error) {
      console.error('Auth error:', error);
      throw error;
    }
  }

  // Load stored session from localStorage
  loadSession() {
    this.backendURL = localStorage.getItem('syncBackendURL') || this.backendURL;
    this.token = localStorage.getItem('syncToken');
    this.userId = localStorage.getItem('syncUserId');
    this.profileName = localStorage.getItem('syncProfileName');
    this.lastSyncTime = parseInt(localStorage.getItem('syncLastSyncTime') || '0', 10);
    return this.token && this.userId && this.backendURL;
  }

  // Handle auth expiry - clears session and calls callback
  handleAuthExpired() {
    this.token = null;
    this.userId = null;
    this.profileName = null;
    localStorage.removeItem('syncToken');
    localStorage.removeItem('syncUserId');
    localStorage.removeItem('syncProfileName');
    localStorage.removeItem('syncLastSyncTime');
    // Keep backendURL so user can re-authenticate easily

    if (this.onAuthExpired) {
      this.onAuthExpired();
    }
  }

  // Sync workouts and completions with backend
  async sync(workouts = [], completions = []) {
    if (!this.backendURL || !this.token) {
      return { success: false, error: 'Not authenticated' };
    }

    if (this.syncing) {
      // Schedule another sync after current one completes
      if (!this.syncScheduled) {
        this.syncScheduled = true;
      }
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      this.syncing = true;
      this.syncScheduled = false;

      // Send client data and get server changes
      const response = await fetch(`${this.backendURL}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          last_synced_at: this.lastSyncTime,
          workouts,
          completions,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.handleAuthExpired();
          return { success: false, error: 'Session expired', authExpired: true };
        }
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }

      const data = await response.json();

      // Update sync time
      this.lastSyncTime = data.last_synced_at || Date.now();
      localStorage.setItem('syncLastSyncTime', this.lastSyncTime.toString());

      return {
        success: true,
        workouts: data.workouts || [],
        completions: data.completions || [],
        lastSyncTime: this.lastSyncTime,
      };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncing = false;

      // If sync was scheduled during this sync, run it again
      if (this.syncScheduled) {
        this.scheduleSyncDebounced(workouts, completions, 0);
      }
    }
  }

  // Debounced sync - waits 5 seconds before syncing to batch changes
  scheduleSyncDebounced(workouts = [], completions = [], delayMs = 5000) {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.sync(workouts, completions);
    }, delayMs);
  }

  // Logout and clear session
  async logout() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    if (!this.backendURL || !this.token) {
      // Clear local state anyway
      this.token = null;
      this.userId = null;
      this.profileName = null;
      localStorage.removeItem('syncToken');
      localStorage.removeItem('syncUserId');
      localStorage.removeItem('syncProfileName');
      localStorage.removeItem('syncLastSyncTime');
      localStorage.removeItem('syncBackendURL');
      return { success: true };
    }

    try {
      const response = await fetch(`${this.backendURL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        console.warn('Logout warning:', response.statusText);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local session
      this.token = null;
      this.userId = null;
      this.profileName = null;
      this.backendURL = null;
      localStorage.removeItem('syncToken');
      localStorage.removeItem('syncUserId');
      localStorage.removeItem('syncProfileName');
      localStorage.removeItem('syncLastSyncTime');
      localStorage.removeItem('syncBackendURL');
    }

    return { success: true };
  }

  // Check if synced to a backend
  isConfigured() {
    return !!this.backendURL;
  }

  // Check if authenticated
  isAuthenticated() {
    return !!this.token && !!this.backendURL;
  }

  // Get sync status
  getStatus() {
    return {
      configured: this.isConfigured(),
      authenticated: this.isAuthenticated(),
      syncing: this.syncing,
      lastSyncTime: this.lastSyncTime,
      backendURL: this.backendURL,
      profileName: this.profileName || localStorage.getItem('syncProfileName'),
    };
  }

  // Get the stored backend URL
  getBackendURL() {
    return this.backendURL || localStorage.getItem('syncBackendURL');
  }
}

export default SyncService;

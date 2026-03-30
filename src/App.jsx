import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';
import { getProfile, signOut } from './utils/db';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import DayDetail from './pages/DayDetail';
import './index.css';

const TABS = {
  DASHBOARD: 'dashboard',
  CALENDAR: 'calendar',
  SETTINGS: 'settings',
  DAY_DETAIL: 'day_detail',
};

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth state on mount and listen for changes
  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
      }
    });

    // Handle "session only" (don't stay logged in) - clear on tab close
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem('kcal_session_only') === 'true') {
        supabase.auth.signOut();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Load profile when user is set
  useEffect(() => {
    if (!user) return;

    getProfile()
      .then((p) => {
        if (p) setProfile(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setProfile(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Chargement...</p>
      </div>
    );
  }

  // Step 1: Not logged in -> show Login
  if (!user) {
    return <Login onAuth={(u) => setUser(u)} />;
  }

  // Step 2: Logged in but no profile -> show Setup
  if (!profile) {
    return <Setup onComplete={(p) => setProfile(p)} />;
  }

  // Step 3: Logged in + profile -> show App
  const handleViewDay = (dateStr) => {
    setSelectedDate(dateStr);
    setActiveTab(TABS.DAY_DETAIL);
  };

  const handleBackFromDay = () => {
    setActiveTab(TABS.CALENDAR);
    setSelectedDate(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bonjour {profile.firstName}</h1>
      </header>

      <main className="app-main">
        {activeTab === TABS.DASHBOARD && (
          <Dashboard profile={profile} />
        )}
        {activeTab === TABS.CALENDAR && (
          <Calendar profile={profile} onViewDay={handleViewDay} />
        )}
        {activeTab === TABS.DAY_DETAIL && selectedDate && (
          <DayDetail
            profile={profile}
            dateStr={selectedDate}
            onBack={handleBackFromDay}
          />
        )}
        {activeTab === TABS.SETTINGS && (
          <Settings
            profile={profile}
            onUpdate={(p) => setProfile(p)}
            onLogout={handleLogout}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={activeTab === TABS.DASHBOARD ? 'active' : ''}
          onClick={() => setActiveTab(TABS.DASHBOARD)}
        >
          <span className="nav-icon">📊</span>
          <span>Aujourd'hui</span>
        </button>
        <button
          className={activeTab === TABS.CALENDAR ? 'active' : ''}
          onClick={() => setActiveTab(TABS.CALENDAR)}
        >
          <span className="nav-icon">📅</span>
          <span>Historique</span>
        </button>
        <button
          className={activeTab === TABS.SETTINGS ? 'active' : ''}
          onClick={() => setActiveTab(TABS.SETTINGS)}
        >
          <span className="nav-icon">⚙️</span>
          <span>Paramètres</span>
        </button>
      </nav>
    </div>
  );
}

export default App;

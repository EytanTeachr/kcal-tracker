import { useState, useEffect } from 'react';
import { getProfile } from './utils/db';
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
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) setProfile(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Chargement...</p>
      </div>
    );
  }

  if (!profile) {
    return <Setup onComplete={(p) => setProfile(p)} />;
  }

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

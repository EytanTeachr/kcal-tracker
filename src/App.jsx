import { useState, useEffect } from 'react';
import { getUserProfile } from './utils/storage';
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = getUserProfile();
    if (saved) setProfile(saved);
    setLoaded(true);
  }, []);

  if (!loaded) return null;

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
          <DayDetail profile={profile} dateStr={selectedDate} onBack={handleBackFromDay} />
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

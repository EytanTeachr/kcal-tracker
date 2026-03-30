import { useState, useMemo } from 'react';
import { getDailyLogs } from '../utils/storage';
import { getDailyTarget, getDayBalance, getDayStatus, formatDate, formatDateFR, kcalToKgFat } from '../utils/kcal';

export default function Calendar({ profile, onViewDay }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const logs = getDailyLogs();
  const target = getDailyTarget(profile);

  const daysInMonth = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Monday start
    const days = [];

    // Padding for days before month start
    for (let i = 0; i < startPad; i++) {
      days.push(null);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLog = logs[dateStr];
      let status = null;
      let balance = null;

      if (dayLog && (dayLog.totalIn > 0 || dayLog.totalOut > 0)) {
        balance = getDayBalance(dayLog, profile.basalMetabolism);
        if (target) {
          status = getDayStatus(balance.deficit, target.dailyDeficit);
        }
      }

      days.push({ day: d, dateStr, status, balance, hasData: !!dayLog });
    }

    return days;
  }, [currentMonth, logs, profile, target]);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  // Weekly summary
  const weekSummary = useMemo(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);

    let totalDeficit = 0;
    let daysWithData = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatDate(d);
      const dayLog = logs[dateStr];
      if (dayLog && (dayLog.totalIn > 0 || dayLog.totalOut > 0)) {
        const balance = getDayBalance(dayLog, profile.basalMetabolism);
        totalDeficit += balance.deficit;
        daysWithData++;
      }
    }

    return { totalDeficit, daysWithData, kgFat: kcalToKgFat(totalDeficit) };
  }, [logs, profile]);

  const todayStr = formatDate(new Date());
  const statusColors = { green: '#4ade80', yellow: '#facc15', red: '#f87171' };

  return (
    <div className="calendar-page">
      {/* Weekly summary */}
      <div className="week-summary">
        <h3>Cette semaine</h3>
        <div className="week-stats">
          <div>
            <span className="stat-value">{weekSummary.totalDeficit}</span>
            <span className="stat-label">kcal déficit</span>
          </div>
          <div>
            <span className="stat-value">{weekSummary.kgFat > 0 ? '−' : '+'}{Math.abs(weekSummary.kgFat)}</span>
            <span className="stat-label">kg de gras</span>
          </div>
          <div>
            <span className="stat-value">{weekSummary.daysWithData}/7</span>
            <span className="stat-label">jours trackés</span>
          </div>
        </div>
      </div>

      {/* Month navigation */}
      <div className="month-nav">
        <button onClick={prevMonth}>◀</button>
        <h3>{monthNames[currentMonth.month]} {currentMonth.year}</h3>
        <button onClick={nextMonth}>▶</button>
      </div>

      {/* Calendar grid */}
      <div className="calendar-grid">
        {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
          <div key={d} className="cal-header">{d}</div>
        ))}
        {daysInMonth.map((item, i) => (
          <div
            key={i}
            className={`cal-day ${!item ? 'empty' : ''} ${item?.dateStr === todayStr ? 'today' : ''} ${item?.hasData ? 'has-data' : ''}`}
            onClick={() => item?.hasData && onViewDay(item.dateStr)}
          >
            {item && (
              <>
                <span className="day-num">{item.day}</span>
                {item.status && (
                  <span
                    className="day-dot"
                    style={{ backgroundColor: statusColors[item.status] }}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

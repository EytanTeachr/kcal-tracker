import { useState, useEffect, useMemo } from 'react';
import { getEntriesForMonth, getEntriesForWeek } from '../utils/db';
import { getDailyTarget, getDayStatus, formatDate, kcalToKgFat } from '../utils/kcal';

export default function Calendar({ profile, onViewDay }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [monthData, setMonthData] = useState({});
  const [weekData, setWeekData] = useState({});
  const [loadingMonth, setLoadingMonth] = useState(true);

  const target = getDailyTarget(profile);

  // Load month data
  useEffect(() => {
    let cancelled = false;
    setLoadingMonth(true);
    getEntriesForMonth(profile.id, currentMonth.year, currentMonth.month)
      .then((data) => {
        if (!cancelled) setMonthData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingMonth(false);
      });
    return () => { cancelled = true; };
  }, [profile.id, currentMonth.year, currentMonth.month]);

  // Load week data
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    getEntriesForWeek(profile.id, formatDate(monday), formatDate(sunday))
      .then(setWeekData)
      .catch(() => {});
  }, [profile.id]);

  const weekSummary = useMemo(() => {
    let totalDeficit = 0;
    let daysWithData = 0;

    for (const dateStr of Object.keys(weekData)) {
      const day = weekData[dateStr];
      if (day.totalIn > 0 || day.totalOut > 0) {
        const totalOut = day.totalOut + profile.basalMetabolism;
        totalDeficit += totalOut - day.totalIn;
        daysWithData++;
      }
    }

    return { totalDeficit, daysWithData, kgFat: kcalToKgFat(totalDeficit) };
  }, [weekData, profile.basalMetabolism]);

  const daysInMonth = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const days = [];

    for (let i = 0; i < startPad; i++) {
      days.push(null);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = monthData[dateStr];
      let status = null;
      let balance = null;

      if (dayData && (dayData.totalIn > 0 || dayData.totalOut > 0)) {
        const totalOut = dayData.totalOut + profile.basalMetabolism;
        const deficit = totalOut - dayData.totalIn;
        balance = { totalIn: dayData.totalIn, totalOut, deficit, kgFat: kcalToKgFat(deficit) };
        if (target) {
          status = getDayStatus(deficit, target.dailyDeficit);
        }
      }

      days.push({ day: d, dateStr, status, balance, hasData: !!dayData });
    }

    return days;
  }, [currentMonth, monthData, profile, target]);

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
      {loadingMonth ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" />
        </div>
      ) : (
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
      )}
    </div>
  );
}

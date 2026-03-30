import { useState, useEffect } from 'react';
import { getEntriesForDate } from '../utils/db';
import { getDailyTarget, getDayBalance, getDayStatus, formatDateFR } from '../utils/kcal';

export default function DayDetail({ profile, dateStr, onBack }) {
  const [dayLog, setDayLog] = useState({ meals: [], activities: [], totalIn: 0, totalOut: 0 });
  const [loading, setLoading] = useState(true);

  const target = getDailyTarget(profile);
  const balance = getDayBalance(dayLog, profile.basalMetabolism);
  const status = target ? getDayStatus(balance.deficit, target.dailyDeficit) : 'green';

  useEffect(() => {
    setLoading(true);
    getEntriesForDate(profile.id, dateStr)
      .then(setDayLog)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile.id, dateStr]);

  const statusColors = { green: '#4ade80', yellow: '#facc15', red: '#f87171' };
  const statusLabels = {
    green: 'Objectif dépassé !',
    yellow: 'Objectif atteint',
    red: 'Objectif non atteint',
  };

  if (loading) {
    return (
      <div className="day-detail">
        <button className="btn-back" onClick={onBack}>← Retour au calendrier</button>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="day-detail">
      <button className="btn-back" onClick={onBack}>← Retour au calendrier</button>

      <h2>{formatDateFR(dateStr)}</h2>

      <div className="day-status-badge" style={{ backgroundColor: statusColors[status] }}>
        {statusLabels[status]}
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-label">Consommé</div>
          <div className="card-value">{balance.totalIn} <small>kcal</small></div>
        </div>
        <div className="summary-card">
          <div className="card-label">Dépensé</div>
          <div className="card-value">{balance.totalOut} <small>kcal</small></div>
        </div>
        <div className="summary-card highlight" style={{ borderColor: statusColors[status] }}>
          <div className="card-label">Déficit</div>
          <div className="card-value" style={{ color: statusColors[status] }}>
            {balance.deficit > 0 ? '+' : ''}{balance.deficit} <small>kcal</small>
          </div>
          <div className="card-sub">
            {balance.kgFat > 0 ? '−' : '+'}{Math.abs(balance.kgFat)} kg de gras
          </div>
        </div>
      </div>

      {target && (
        <div className="target-info">
          <div className="target-row">
            <span>Objectif du jour :</span>
            <strong style={{ color: statusColors[status] }}>−{target.dailyDeficit} kcal</strong>
          </div>
        </div>
      )}

      <div className="entries-section">
        {dayLog.meals?.length > 0 && (
          <div className="entries-group">
            <h3>🍽️ Repas</h3>
            {dayLog.meals.map((m, i) => (
              <div key={m.id || i} className="entry-item">
                <span className="entry-time">{m.time}</span>
                <span className="entry-desc">{m.description}</span>
                <span className="entry-kcal">+{m.kcal} kcal</span>
              </div>
            ))}
            <div className="entry-total">
              Total : {dayLog.meals.reduce((s, m) => s + m.kcal, 0)} kcal
            </div>
          </div>
        )}
        {dayLog.activities?.length > 0 && (
          <div className="entries-group">
            <h3>🏃 Activités</h3>
            {dayLog.activities.map((a, i) => (
              <div key={a.id || i} className="entry-item">
                <span className="entry-time">{a.time}</span>
                <span className="entry-desc">{a.description}</span>
                <span className="entry-kcal">−{a.kcal} kcal</span>
              </div>
            ))}
            <div className="entry-total">
              Total : {dayLog.activities.reduce((s, a) => s + a.kcal, 0)} kcal
            </div>
          </div>
        )}
        {(!dayLog.meals?.length && !dayLog.activities?.length) && (
          <p className="no-data">Aucune donnée pour ce jour.</p>
        )}
      </div>
    </div>
  );
}

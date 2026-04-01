import { useState, useEffect } from 'react';
import {
  getFriendDayLog,
  addEntry,
  sendEncouragement,
  getEncouragements,
} from '../utils/db';
import {
  getDailyTarget,
  getDayBalance,
  getDayStatus,
  kcalToKgFat,
  formatDate,
  formatDateFR,
} from '../utils/kcal';

export default function FriendProfile({ friend, currentProfile, permission, onBack }) {
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayLog, setDayLog] = useState({ meals: [], activities: [], totalIn: 0, totalOut: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [encouragements, setEncouragements] = useState([]);
  const [encouragementText, setEncouragementText] = useState('');
  const [sendingEncouragement, setSendingEncouragement] = useState(false);

  // For write mode: add entry
  const [addType, setAddType] = useState(null); // 'meal' or 'activity'
  const [newDesc, setNewDesc] = useState('');
  const [newKcal, setNewKcal] = useState('');
  const [addingEntry, setAddingEntry] = useState(false);

  const target = getDailyTarget(friend);
  const balance = getDayBalance(dayLog, friend.basalMetabolism);
  const status = target ? getDayStatus(balance.deficit, target.dailyDeficit) : 'green';
  const remaining = target ? target.dailyDeficit - balance.deficit : balance.deficit;
  const remainingKcalToEat = (friend.basalMetabolism + dayLog.totalOut) - dayLog.totalIn - (target ? target.dailyDeficit : 0);

  const loadDayData = async () => {
    setDataLoading(true);
    try {
      const data = await getFriendDayLog(friend.id, selectedDate);
      setDayLog(data);
    } catch {
      setDayLog({ meals: [], activities: [], totalIn: 0, totalOut: 0 });
    } finally {
      setDataLoading(false);
    }
  };

  const loadEncouragements = async () => {
    try {
      const data = await getEncouragements(friend.id);
      setEncouragements(data);
    } catch {
      setEncouragements([]);
    }
  };

  useEffect(() => {
    loadDayData();
  }, [friend.id, selectedDate]);

  useEffect(() => {
    loadEncouragements();
  }, [friend.id]);

  const handleSendEncouragement = async () => {
    if (!encouragementText.trim()) return;
    setSendingEncouragement(true);
    try {
      await sendEncouragement(currentProfile.id, friend.id, encouragementText.trim());
      setEncouragementText('');
      await loadEncouragements();
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setSendingEncouragement(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newDesc.trim() || !newKcal) return;
    setAddingEntry(true);
    try {
      await addEntry(friend.id, selectedDate, addType, {
        description: newDesc.trim(),
        kcal: parseInt(newKcal, 10),
      });
      setNewDesc('');
      setNewKcal('');
      setAddType(null);
      await loadDayData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setAddingEntry(false);
    }
  };

  // Date navigation
  const changeDate = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatDate(d));
  };

  const statusColor =
    status === 'green' ? 'var(--green)' : status === 'yellow' ? 'var(--yellow)' : 'var(--red)';

  return (
    <div className="friend-profile">
      <button className="btn-back" onClick={onBack}>
        &larr; Retour aux amis
      </button>

      <h2>{friend.firstName}</h2>
      <p className="friend-profile-email">{friend.email}</p>

      {/* Date selector */}
      <div className="date-selector">
        <button className="date-tab" onClick={() => changeDate(-1)}>
          &larr;
        </button>
        <span className="date-tab active" style={{ textAlign: 'center', flex: 3 }}>
          {selectedDate === today ? "Aujourd'hui" : formatDateFR(selectedDate)}
        </span>
        <button
          className="date-tab"
          onClick={() => changeDate(1)}
          disabled={selectedDate === today}
        >
          &rarr;
        </button>
      </div>

      {dataLoading ? (
        <div className="no-data">
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Remaining kcal display */}
          <div className="remaining-display">
            <div className="remaining-number" style={{ color: statusColor }}>
              {Math.max(0, Math.round(remainingKcalToEat))}
            </div>
            <div className="remaining-unit">kcal restantes</div>
            <div className="remaining-label">
              {friend.firstName} peut encore manger
            </div>
          </div>

          {/* Summary cards */}
          <div className="summary-cards secondary">
            <div className="summary-card">
              <div className="card-label">Consomme</div>
              <div className="card-value">{dayLog.totalIn} <small>kcal</small></div>
            </div>
            <div className="summary-card">
              <div className="card-label">Depense</div>
              <div className="card-value">{dayLog.totalOut + friend.basalMetabolism} <small>kcal</small></div>
            </div>
            <div className="summary-card highlight">
              <div className="card-label">Deficit</div>
              <div className="card-value" style={{ color: statusColor }}>
                {Math.round(balance.deficit)} <small>kcal</small>
              </div>
              {target && (
                <div className="card-sub">
                  Objectif : {target.dailyDeficit} kcal
                </div>
              )}
            </div>
          </div>

          {/* Entries list */}
          <div className="entries-section">
            <div className="entries-group">
              <h3>Repas</h3>
              {dayLog.meals.length === 0 ? (
                <p className="no-data">Aucun repas</p>
              ) : (
                dayLog.meals.map((m) => (
                  <div key={m.id} className="entry-item">
                    <span className="entry-time">{m.time || '--:--'}</span>
                    <span className="entry-desc">{m.description}</span>
                    <span className="entry-kcal">+{m.kcal}</span>
                  </div>
                ))
              )}
            </div>
            <div className="entries-group">
              <h3>Activites</h3>
              {dayLog.activities.length === 0 ? (
                <p className="no-data">Aucune activite</p>
              ) : (
                dayLog.activities.map((a) => (
                  <div key={a.id} className="entry-item">
                    <span className="entry-time">{a.time || '--:--'}</span>
                    <span className="entry-desc">{a.description}</span>
                    <span className="entry-kcal">-{a.kcal}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Write permission: add entries */}
          {permission === 'write' && (
            <div className="friend-add-entry">
              {!addType ? (
                <div className="friend-add-buttons">
                  <button className="btn-secondary btn-small" onClick={() => setAddType('meal')}>
                    + Repas
                  </button>
                  <button className="btn-secondary btn-small" onClick={() => setAddType('activity')}>
                    + Activite
                  </button>
                </div>
              ) : (
                <div className="friend-add-form">
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Ajouter {addType === 'meal' ? 'un repas' : 'une activite'} pour {friend.firstName}
                  </p>
                  <input
                    type="text"
                    placeholder="Description"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Kcal"
                    value={newKcal}
                    onChange={(e) => setNewKcal(e.target.value)}
                  />
                  <div className="friend-add-actions">
                    <button
                      className="btn-primary btn-small"
                      onClick={handleAddEntry}
                      disabled={addingEntry}
                    >
                      {addingEntry ? 'Ajout...' : 'Ajouter'}
                    </button>
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => {
                        setAddType(null);
                        setNewDesc('');
                        setNewKcal('');
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Encouragements */}
          <div className="encouragement-section">
            <h3>Encouragements</h3>
            <div className="encouragement-input">
              <input
                type="text"
                placeholder="Envoyer un message d'encouragement..."
                value={encouragementText}
                onChange={(e) => setEncouragementText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendEncouragement()}
              />
              <button
                className="btn-primary btn-small"
                onClick={handleSendEncouragement}
                disabled={sendingEncouragement || !encouragementText.trim()}
              >
                Envoyer
              </button>
            </div>
            {encouragements.length === 0 ? (
              <p className="no-data">Aucun encouragement pour le moment.</p>
            ) : (
              encouragements.map((enc) => (
                <div key={enc.id} className="encouragement-item">
                  <span className="encouragement-sender">{enc.senderName}</span>
                  <span className="encouragement-message">{enc.message}</span>
                  <span className="encouragement-time">
                    {new Date(enc.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

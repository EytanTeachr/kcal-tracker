import { useState, useEffect, useRef } from 'react';
import { getDayLog, saveDayLog } from '../utils/storage';
import { getDailyTarget, getDayBalance, getDayStatus, kcalToKgFat, formatDate, formatDateFR } from '../utils/kcal';
import { chatWithAI } from '../utils/ai';
import BarcodeScanner from '../components/BarcodeScanner';

export default function Dashboard({ profile }) {
  const today = formatDate(new Date());
  const [dayLog, setDayLog] = useState(getDayLog(today));
  const [chatMode, setChatMode] = useState(null); // 'meal', 'activity', or 'barcode'
  const [messages, setMessages] = useState([]); // displayed messages
  const [apiHistory, setApiHistory] = useState([]); // full API conversation history
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingItems, setPendingItems] = useState(null); // items waiting to be added
  const [editing, setEditing] = useState(null);
  const [editKcal, setEditKcal] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const messagesEndRef = useRef(null);

  const target = getDailyTarget(profile);
  const balance = getDayBalance(dayLog, profile.basalMetabolism);
  const status = target ? getDayStatus(balance.deficit, target.dailyDeficit) : 'green';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const recalcTotals = (log) => {
    log.totalIn = (log.meals || []).reduce((sum, m) => sum + m.kcal, 0);
    log.totalOut = (log.activities || []).reduce((sum, a) => sum + a.kcal, 0);
    return log;
  };

  const closeChat = () => {
    setChatMode(null);
    setMessages([]);
    setApiHistory([]);
    setPendingItems(null);
  };

  const addItemsToLog = (items, detail) => {
    const updatedLog = { ...dayLog };
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    for (const item of items) {
      const entry = {
        description: item.description,
        kcal: item.kcal,
        detail: detail || '',
        time,
      };

      if (chatMode === 'meal') {
        updatedLog.meals = [...(updatedLog.meals || []), entry];
      } else {
        updatedLog.activities = [...(updatedLog.activities || []), entry];
      }
    }

    recalcTotals(updatedLog);
    saveDayLog(today, updatedLog);
    setDayLog(updatedLog);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');

    // Add to displayed messages
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    // Add to API history
    const newHistory = [...apiHistory, { role: 'user', content: userMsg }];
    setApiHistory(newHistory);
    setLoading(true);

    try {
      const result = await chatWithAI(profile.apiKey, newHistory, chatMode);

      if (result.type === 'final') {
        // AI confirmed with final result - add items to log
        const emoji = chatMode === 'meal' ? '🍽️' : '🏃';
        const summary = result.items
          .map((it) => `${emoji} **${it.description}** — ${it.kcal} kcal`)
          .join('\n');
        const displayMsg = summary + (result.detail ? `\n${result.detail}` : '');

        setMessages((prev) => [...prev, { role: 'assistant', content: displayMsg }]);

        // Add to API history
        const assistantContent = result.displayText || summary;
        setApiHistory((prev) => [...prev, { role: 'assistant', content: assistantContent }]);

        // Add items to the day log
        addItemsToLog(result.items, result.detail);
        setPendingItems(result.items);

        // Show confirmation message
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: `Ajouté ! Tu peux continuer à ajouter ou fermer le chat.` },
          ]);
        }, 500);
      } else {
        // Regular conversational message
        setMessages((prev) => [...prev, { role: 'assistant', content: result.content }]);
        setApiHistory((prev) => [...prev, { role: 'assistant', content: result.content }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Erreur : ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeAdd = (item) => {
    const updatedLog = { ...dayLog };
    updatedLog.meals = [...(updatedLog.meals || []), item];
    updatedLog.totalIn = (updatedLog.totalIn || 0) + item.kcal;
    saveDayLog(today, updatedLog);
    setDayLog(updatedLog);
  };

  const handleStartEdit = (type, index) => {
    const item = type === 'meal' ? dayLog.meals[index] : dayLog.activities[index];
    setEditing({ type, index });
    setEditKcal(String(item.kcal));
    setEditDesc(item.description);
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    const updatedLog = { ...dayLog };
    const list = editing.type === 'meal' ? [...(updatedLog.meals || [])] : [...(updatedLog.activities || [])];
    list[editing.index] = {
      ...list[editing.index],
      kcal: parseInt(editKcal, 10) || 0,
      description: editDesc,
    };
    if (editing.type === 'meal') {
      updatedLog.meals = list;
    } else {
      updatedLog.activities = list;
    }
    recalcTotals(updatedLog);
    saveDayLog(today, updatedLog);
    setDayLog(updatedLog);
    setEditing(null);
  };

  const handleDelete = (type, index) => {
    const updatedLog = { ...dayLog };
    if (type === 'meal') {
      updatedLog.meals = [...(updatedLog.meals || [])];
      updatedLog.meals.splice(index, 1);
    } else {
      updatedLog.activities = [...(updatedLog.activities || [])];
      updatedLog.activities.splice(index, 1);
    }
    recalcTotals(updatedLog);
    saveDayLog(today, updatedLog);
    setDayLog(updatedLog);
    setEditing(null);
  };

  const statusColor = { green: '#4ade80', yellow: '#facc15', red: '#f87171' };

  const isEditing = (type, index) =>
    editing && editing.type === type && editing.index === index;

  return (
    <div className="dashboard">
      <div className="date-header">{formatDateFR(today)}</div>

      {/* Summary cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-label">Consommé</div>
          <div className="card-value">{balance.totalIn} <small>kcal</small></div>
        </div>
        <div className="summary-card">
          <div className="card-label">Dépensé</div>
          <div className="card-value">{balance.totalOut} <small>kcal</small></div>
        </div>
        <div className="summary-card highlight" style={{ borderColor: statusColor[status] }}>
          <div className="card-label">Déficit</div>
          <div className="card-value" style={{ color: statusColor[status] }}>
            {balance.deficit > 0 ? '+' : ''}{balance.deficit} <small>kcal</small>
          </div>
          <div className="card-sub">
            {balance.kgFat > 0 ? '−' : '+'}{Math.abs(balance.kgFat)} kg de gras
          </div>
        </div>
      </div>

      {/* Target info */}
      {target && (
        <div className="target-info">
          <div className="target-row">
            <span>Objectif journalier :</span>
            <strong>−{target.dailyDeficit} kcal</strong>
            <small>(−{target.dailyKgFat} kg/jour)</small>
          </div>
          <div className="target-row">
            <span>Jours restants :</span>
            <strong>{target.daysRemaining}</strong>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{
                width: `${Math.min(100, (balance.deficit / target.dailyDeficit) * 100)}%`,
                backgroundColor: statusColor[status],
              }}
            />
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="entries-section">
        {dayLog.meals?.length > 0 && (
          <div className="entries-group">
            <h3>🍽️ Repas</h3>
            {dayLog.meals.map((m, i) =>
              isEditing('meal', i) ? (
                <div key={i} className="entry-edit">
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="edit-desc"
                  />
                  <div className="edit-kcal-row">
                    <input
                      type="number"
                      value={editKcal}
                      onChange={(e) => setEditKcal(e.target.value)}
                      className="edit-kcal"
                    />
                    <span>kcal</span>
                  </div>
                  <div className="edit-actions">
                    <button className="btn-save" onClick={handleSaveEdit}>Sauver</button>
                    <button className="btn-cancel" onClick={() => setEditing(null)}>Annuler</button>
                    <button className="btn-delete" onClick={() => handleDelete('meal', i)}>Supprimer</button>
                  </div>
                </div>
              ) : (
                <div key={i} className="entry-item clickable" onClick={() => handleStartEdit('meal', i)}>
                  <span className="entry-time">{m.time}</span>
                  <span className="entry-desc">{m.description}</span>
                  <span className="entry-kcal">+{m.kcal} kcal</span>
                  <span className="entry-edit-icon">✏️</span>
                </div>
              )
            )}
          </div>
        )}
        {dayLog.activities?.length > 0 && (
          <div className="entries-group">
            <h3>🏃 Activités</h3>
            {dayLog.activities.map((a, i) =>
              isEditing('activity', i) ? (
                <div key={i} className="entry-edit">
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="edit-desc"
                  />
                  <div className="edit-kcal-row">
                    <input
                      type="number"
                      value={editKcal}
                      onChange={(e) => setEditKcal(e.target.value)}
                      className="edit-kcal"
                    />
                    <span>kcal</span>
                  </div>
                  <div className="edit-actions">
                    <button className="btn-save" onClick={handleSaveEdit}>Sauver</button>
                    <button className="btn-cancel" onClick={() => setEditing(null)}>Annuler</button>
                    <button className="btn-delete" onClick={() => handleDelete('activity', i)}>Supprimer</button>
                  </div>
                </div>
              ) : (
                <div key={i} className="entry-item clickable" onClick={() => handleStartEdit('activity', i)}>
                  <span className="entry-time">{a.time}</span>
                  <span className="entry-desc">{a.description}</span>
                  <span className="entry-kcal">−{a.kcal} kcal</span>
                  <span className="entry-edit-icon">✏️</span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Barcode scanner */}
      {chatMode === 'barcode' && (
        <BarcodeScanner
          onAdd={(item) => {
            handleBarcodeAdd(item);
          }}
          onClose={() => setChatMode(null)}
        />
      )}

      {/* Chat area */}
      {chatMode && chatMode !== 'barcode' ? (
        <div className="chat-area">
          <div className="chat-header">
            <button className="btn-back" onClick={closeChat}>
              ← Retour
            </button>
            <span>{chatMode === 'meal' ? '🍽️ Ajouter un repas' : '🏃 Ajouter une activité'}</span>
          </div>
          <div className="chat-messages">
            <div className="message assistant">
              {chatMode === 'meal'
                ? 'Dis-moi ce que tu as mangé ! Je vais te poser des questions si besoin pour estimer au mieux les calories.'
                : 'Dis-moi quelle activité tu as faite ! Je vais te poser des questions si besoin pour estimer les calories brûlées.'}
            </div>
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="message assistant loading">
                <span className="dots">...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={chatMode === 'meal' ? 'Décris ton repas...' : 'Décris ton activité...'}
              autoFocus
            />
            <button className="btn-send" onClick={handleSend} disabled={loading || !input.trim()}>
              ➤
            </button>
          </div>
        </div>
      ) : chatMode !== 'barcode' && (
        <div className="add-buttons-grid">
          <button className="btn-add meal" onClick={() => setChatMode('meal')}>
            🍽️ Ajouter un repas
          </button>
          <button className="btn-add activity" onClick={() => setChatMode('activity')}>
            🏃 Ajouter une activité
          </button>
          <button className="btn-add barcode" onClick={() => setChatMode('barcode')}>
            📷 Scanner un code-barres
          </button>
        </div>
      )}
    </div>
  );
}

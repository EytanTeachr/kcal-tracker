import { useState, useEffect, useRef } from 'react';
import { getEntriesForDate, addEntry, addMultipleEntries, updateEntry, deleteEntry } from '../utils/db';
import { getDailyTarget, getDayBalance, getDayStatus, kcalToKgFat, formatDate, formatDateFR } from '../utils/kcal';
import { chatWithAI, getMotivationMessage } from '../utils/ai';
import BarcodeScanner from '../components/BarcodeScanner';

export default function Dashboard({ profile }) {
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayLog, setDayLog] = useState({ meals: [], activities: [], totalIn: 0, totalOut: 0 });
  const [chatMode, setChatMode] = useState(null); // 'meal', 'activity', 'barcode', 'photo'
  const [messages, setMessages] = useState([]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editKcal, setEditKcal] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [motivation, setMotivation] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const target = getDailyTarget(profile);
  const balance = getDayBalance(dayLog, profile.basalMetabolism);
  const status = target ? getDayStatus(balance.deficit, target.dailyDeficit) : 'green';

  // Load entries for selected date
  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    getEntriesForDate(profile.id, selectedDate)
      .then((data) => {
        if (!cancelled) setDayLog(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => { cancelled = true; };
  }, [profile.id, selectedDate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load motivation message
  useEffect(() => {
    if (!target || !profile.apiKey || selectedDate !== today) return;
    const deficit = balance.deficit;
    getMotivationMessage(profile.apiKey, profile, deficit, target.dailyDeficit)
      .then((msg) => { if (msg) setMotivation(msg); })
      .catch(() => {});
  }, [dayLog]);

  // Date navigation - show yesterday/today buttons
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  const isToday = selectedDate === today;
  const isYesterday = selectedDate === yesterday;

  const closeChat = () => {
    setChatMode(null);
    setMessages([]);
    setApiHistory([]);
  };

  const reloadEntries = async () => {
    try {
      const data = await getEntriesForDate(profile.id, selectedDate);
      setDayLog(data);
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');

    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    const newHistory = [...apiHistory, { role: 'user', content: userMsg }];
    setApiHistory(newHistory);
    setLoading(true);

    try {
      const result = await chatWithAI(profile.apiKey, newHistory, chatMode);

      if (result.type === 'final') {
        const emoji = chatMode === 'meal' ? '🍽️' : '🏃';
        const summary = result.items
          .map((it) => `${emoji} ${it.description} — ${it.kcal} kcal`)
          .join('\n');

        setMessages((prev) => [...prev, { role: 'assistant', content: summary }]);

        const assistantContent = result.displayText || summary;
        setApiHistory((prev) => [...prev, { role: 'assistant', content: assistantContent }]);

        // Add items to Supabase
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const entries = result.items.map((item) => ({
          description: item.description,
          kcal: item.kcal,
          proteins: item.proteins || 0,
          lipids: item.lipids || 0,
          carbs: item.carbs || 0,
          detail: result.detail || '',
          time,
        }));

        const type = chatMode === 'meal' ? 'meal' : 'activity';
        await addMultipleEntries(profile.id, selectedDate, type, entries, result.advice);
        await reloadEntries();

        // Show advice if available
        if (result.advice) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { role: 'advice', content: result.advice },
              { role: 'system', content: 'Ajouté ! Tu peux continuer ou fermer le chat.' },
            ]);
          }, 300);
        } else {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { role: 'system', content: 'Ajouté ! Tu peux continuer ou fermer le chat.' },
            ]);
          }, 500);
        }
      } else {
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

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const imageUrl = `data:${file.type};base64,${base64}`;

      // Start photo chat mode
      setChatMode('photo');
      setMessages([{ role: 'assistant', content: 'Je regarde ta photo...' }]);

      const photoMessage = {
        role: 'user',
        content: [
          { type: 'text', text: "Voici la photo de ce que j'ai mangé. Identifie les aliments et estime les calories." },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
        ],
      };

      setApiHistory([photoMessage]);
      setLoading(true);

      try {
        const result = await chatWithAI(profile.apiKey, [photoMessage], 'photo');

        if (result.type === 'final') {
          const summary = result.items.map((it) => `🍽️ ${it.description} — ${it.kcal} kcal`).join('\n');
          setMessages([{ role: 'assistant', content: summary }]);
          const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const entries = result.items.map((item) => ({
            description: item.description, kcal: item.kcal,
            proteins: item.proteins || 0, lipids: item.lipids || 0, carbs: item.carbs || 0,
            detail: result.detail || '', time,
          }));
          await addMultipleEntries(profile.id, selectedDate, 'meal', entries, result.advice);
          await reloadEntries();
          if (result.advice) {
            setTimeout(() => {
              setMessages((prev) => [...prev, { role: 'advice', content: result.advice }, { role: 'system', content: 'Ajouté !' }]);
            }, 300);
          } else {
            setTimeout(() => {
              setMessages((prev) => [...prev, { role: 'system', content: 'Ajouté !' }]);
            }, 500);
          }
        } else {
          setMessages([{ role: 'assistant', content: result.content }]);
          setApiHistory((prev) => [...prev, { role: 'assistant', content: result.content }]);
        }
      } catch (err) {
        setMessages([{ role: 'assistant', content: `Erreur : ${err.message}` }]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBarcodeAdd = async (item) => {
    await addEntry(profile.id, selectedDate, 'meal', item);
    await reloadEntries();
  };

  const handleStartEdit = (type, index) => {
    const item = type === 'meal' ? dayLog.meals[index] : dayLog.activities[index];
    setEditing({ type, index, id: item.id });
    setEditKcal(String(item.kcal));
    setEditDesc(item.description);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    await updateEntry(editing.id, {
      kcal: parseInt(editKcal, 10) || 0,
      description: editDesc,
    });
    await reloadEntries();
    setEditing(null);
  };

  const handleDelete = async (type, index) => {
    const item = type === 'meal' ? dayLog.meals[index] : dayLog.activities[index];
    await deleteEntry(item.id);
    await reloadEntries();
    setEditing(null);
  };

  // Parse numbered choices from AI message (e.g. "1. Option A\n2. Option B")
  const parseChoices = (content) => {
    const lines = content.split('\n');
    const choices = [];
    const textLines = [];
    for (const line of lines) {
      const match = line.match(/^(\d+)\.\s+(.+)/);
      if (match) {
        choices.push({ num: match[1], label: match[2].trim() });
      } else {
        textLines.push(line);
      }
    }
    return { text: textLines.join('\n').trim(), choices };
  };

  // Check if message ends with a confirmation question
  const needsConfirmation = (content) => {
    const lower = content.toLowerCase();
    return lower.includes('on valide') || lower.includes('ok ?') || lower.includes('ça te va ?') || lower.includes('c\'est bon ?');
  };

  // Handle quick reply (choice button or yes/no)
  const handleQuickReply = (text) => {
    setInput(text);
    setTimeout(() => {
      const fakeEvent = { key: 'Enter' };
      // Directly call send with this text
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      const newHistory = [...apiHistory, { role: 'user', content: text }];
      setApiHistory(newHistory);
      setLoading(true);

      chatWithAI(profile.apiKey, newHistory, chatMode)
        .then(async (result) => {
          if (result.type === 'final') {
            const emoji = chatMode === 'meal' || chatMode === 'photo' ? '🍽️' : '🏃';
            const summary = result.items
              .map((it) => `${emoji} ${it.description} — ${it.kcal} kcal`)
              .join('\n');
            setMessages((prev) => [...prev, { role: 'assistant', content: summary }]);
            setApiHistory((prev) => [...prev, { role: 'assistant', content: result.displayText || summary }]);

            const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const entries = result.items.map((item) => ({
              description: item.description, kcal: item.kcal,
              proteins: item.proteins || 0, lipids: item.lipids || 0, carbs: item.carbs || 0,
              detail: result.detail || '', time,
            }));
            const type = chatMode === 'activity' ? 'activity' : 'meal';
            await addMultipleEntries(profile.id, selectedDate, type, entries, result.advice);
            await reloadEntries();

            if (result.advice) {
              setTimeout(() => {
                setMessages((prev) => [...prev, { role: 'advice', content: result.advice }, { role: 'system', content: 'Ajouté ! Tu peux continuer ou fermer le chat.' }]);
              }, 300);
            } else {
              setTimeout(() => {
                setMessages((prev) => [...prev, { role: 'system', content: 'Ajouté ! Tu peux continuer ou fermer le chat.' }]);
              }, 500);
            }
          } else {
            setMessages((prev) => [...prev, { role: 'assistant', content: result.content }]);
            setApiHistory((prev) => [...prev, { role: 'assistant', content: result.content }]);
          }
        })
        .catch((err) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: `Erreur : ${err.message}` }]);
        })
        .finally(() => setLoading(false));
    }, 0);
  };

  const statusColor = { green: '#4ade80', yellow: '#facc15', red: '#f87171' };

  const isEditing = (type, index) =>
    editing && editing.type === type && editing.index === index;

  // Color for deficit based on progress toward target
  const getDeficitColor = () => {
    if (!target) return statusColor.green;
    return statusColor[status];
  };

  return (
    <div className="dashboard">
      {/* Date selector */}
      <div className="date-selector">
        <button
          className={`date-tab ${isYesterday ? 'active' : ''}`}
          onClick={() => setSelectedDate(yesterday)}
        >
          Hier
        </button>
        <button
          className={`date-tab ${isToday ? 'active' : ''}`}
          onClick={() => setSelectedDate(today)}
        >
          Aujourd'hui
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={today}
          className="date-picker-input"
        />
      </div>

      <div className="date-header">{formatDateFR(selectedDate)}</div>

      {dataLoading ? (
        <div className="loading-screen" style={{ padding: '2rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
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
            <div className="summary-card highlight" style={{ borderColor: getDeficitColor() }}>
              <div className="card-label">Déficit</div>
              <div className="card-value" style={{ color: getDeficitColor() }}>
                {balance.deficit > 0 ? '+' : ''}{balance.deficit} <small>kcal</small>
              </div>
              <div className="card-sub">
                {balance.kgFat > 0 ? '−' : '+'}{Math.abs(balance.kgFat)} kg de gras
              </div>
              {target && (
                <div className="card-target" style={{ color: getDeficitColor() }}>
                  Objectif : −{target.dailyDeficit} kcal
                </div>
              )}
            </div>
          </div>

          {/* Macros overview */}
          {dayLog.totalProteins > 0 && (
            <div className="macros-card">
              <div className="macros-row">
                <div className="macro-item">
                  <span className="macro-label">Prot.</span>
                  <span className="macro-value prot">{Math.round(dayLog.totalProteins)}g</span>
                  {profile.dailyProteinGoal > 0 && (
                    <span className="macro-goal">/ {profile.dailyProteinGoal}g</span>
                  )}
                </div>
                <div className="macro-item">
                  <span className="macro-label">Lip.</span>
                  <span className="macro-value lip">{Math.round(dayLog.totalLipids)}g</span>
                </div>
                <div className="macro-item">
                  <span className="macro-label">Gluc.</span>
                  <span className="macro-value carb">{Math.round(dayLog.totalCarbs)}g</span>
                </div>
              </div>
              {profile.dailyProteinGoal > 0 && (
                <div className="progress-bar-container" style={{ marginTop: '0.5rem' }}>
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.min(100, (dayLog.totalProteins / profile.dailyProteinGoal) * 100)}%`,
                      backgroundColor: dayLog.totalProteins >= profile.dailyProteinGoal ? '#4ade80' : '#6366f1',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Target progress bar */}
          {target && (
            <div className="target-info">
              <div className="target-row">
                <span>Progression du jour</span>
                <strong style={{ color: getDeficitColor() }}>
                  {balance.deficit}/{target.dailyDeficit} kcal
                </strong>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(0, (balance.deficit / target.dailyDeficit) * 100))}%`,
                    backgroundColor: getDeficitColor(),
                  }}
                />
              </div>
              <div className="target-row" style={{ marginTop: '0.5rem' }}>
                <span>Jours restants :</span>
                <strong>{target.daysRemaining}</strong>
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
                    <div key={m.id || i} className="entry-edit">
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
                    <div key={m.id || i} className="entry-item-wrapper">
                      <div className="entry-item clickable" onClick={() => handleStartEdit('meal', i)}>
                        <span className="entry-time">{m.time}</span>
                        <span className="entry-desc">{m.description}</span>
                        <span className="entry-kcal">+{m.kcal} kcal</span>
                        <span className="entry-edit-icon">✏️</span>
                      </div>
                      {m.proteins > 0 && (
                        <div className="entry-macros">
                          <span className="em-prot">P:{Math.round(m.proteins)}g</span>
                          <span className="em-lip">L:{Math.round(m.lipids)}g</span>
                          <span className="em-carb">G:{Math.round(m.carbs)}g</span>
                        </div>
                      )}
                      {m.advice && (
                        <div className="entry-advice">{m.advice}</div>
                      )}
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
                    <div key={a.id || i} className="entry-edit">
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
                    <div key={a.id || i} className="entry-item clickable" onClick={() => handleStartEdit('activity', i)}>
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
              onAdd={handleBarcodeAdd}
              onClose={() => setChatMode(null)}
            />
          )}

          {/* Hidden file input for photo */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handlePhotoCapture}
          />

          {/* Motivation message */}
          {motivation && selectedDate === today && (
            <div className="motivation-banner">
              {motivation}
            </div>
          )}

          {/* Chat area */}
          {chatMode && chatMode !== 'barcode' ? (
            <div className="chat-area">
              <div className="chat-header">
                <button className="btn-back" onClick={closeChat}>
                  ← Retour
                </button>
                <span>
                  {chatMode === 'meal' ? '🍽️ Ajouter un repas' : chatMode === 'photo' ? '📸 Photo du plat' : '🏃 Ajouter une activité'}
                </span>
              </div>
              <div className="chat-messages">
                <div className="message assistant">
                  {chatMode === 'meal'
                    ? 'Dis-moi ce que tu as mangé ! Je vais te poser des questions si besoin pour estimer au mieux les calories.'
                    : 'Dis-moi quelle activité tu as faite ! Je vais te poser des questions si besoin pour estimer les calories brûlées.'}
                </div>
                {messages.map((msg, i) => {
                  if (msg.role === 'assistant') {
                    const { text, choices } = parseChoices(msg.content);
                    const showConfirm = choices.length === 0 && needsConfirmation(msg.content);
                    const isLastAssistant = i === messages.length - 1 ||
                      messages.slice(i + 1).every((m) => m.role !== 'user');
                    return (
                      <div key={i}>
                        <div className="message assistant">
                          {choices.length > 0 ? text : msg.content}
                        </div>
                        {choices.length > 0 && isLastAssistant && !loading && (
                          <div className="quick-replies">
                            {choices.map((c) => (
                              <button
                                key={c.num}
                                className="quick-reply-btn"
                                onClick={() => handleQuickReply(c.num)}
                              >
                                {c.num}. {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {showConfirm && isLastAssistant && !loading && (
                          <div className="quick-replies">
                            <button className="quick-reply-btn confirm" onClick={() => handleQuickReply('Oui')}>
                              Oui, valide !
                            </button>
                            <button className="quick-reply-btn adjust" onClick={() => handleQuickReply('Non, ajuste')}>
                              Modifier
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`message ${msg.role}`}>
                      {msg.content}
                    </div>
                  );
                })}
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
            <div className="add-buttons-container">
              <div className="add-buttons-grid">
                <button className="btn-add meal" onClick={() => setChatMode('meal')}>
                  🍽️ Ajouter un repas
                </button>
                <button className="btn-add activity" onClick={() => setChatMode('activity')}>
                  🏃 Ajouter une activité
                </button>
                <button className="btn-add photo" onClick={() => fileInputRef.current?.click()}>
                  📸 Photo du plat
                </button>
                <button className="btn-add barcode" onClick={() => setChatMode('barcode')}>
                  📷 Scanner un code-barres
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

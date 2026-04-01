import { useState, useEffect } from 'react';
import { getFavorites, deleteFavorite } from '../utils/db';

export default function FavoritePicker({ profileId, selectedDate, onAdd, onClose }) {
  const [favorites, setFavorites] = useState([]);
  const [loadingFavs, setLoadingFavs] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [customMultiplier, setCustomMultiplier] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingFavs(true);
    getFavorites(profileId)
      .then((data) => {
        if (!cancelled) setFavorites(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingFavs(false);
      });
    return () => { cancelled = true; };
  }, [profileId]);

  const handleDelete = async (e, favId) => {
    e.stopPropagation();
    try {
      await deleteFavorite(favId);
      setFavorites((prev) => prev.filter((f) => f.id !== favId));
      if (selectedId === favId) setSelectedId(null);
    } catch {}
  };

  const handleAdd = () => {
    const fav = favorites.find((f) => f.id === selectedId);
    if (!fav) return;

    const mult = customMultiplier ? parseFloat(customMultiplier) : multiplier;
    if (!mult || mult <= 0) return;

    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const entries = fav.items.map((item) => ({
      description: item.description,
      kcal: Math.round(item.kcal * mult),
      proteins: Math.round((item.proteins || 0) * mult),
      lipids: Math.round((item.lipids || 0) * mult),
      carbs: Math.round((item.carbs || 0) * mult),
      detail: item.detail || '',
      time,
    }));

    onAdd(entries);
  };

  const getTotalKcal = (items) => items.reduce((sum, it) => sum + (it.kcal || 0), 0);

  const activeMultiplier = customMultiplier ? parseFloat(customMultiplier) : multiplier;
  const selectedFav = favorites.find((f) => f.id === selectedId);

  return (
    <div className="chat-area" style={{ maxHeight: '450px' }}>
      <div className="chat-header">
        <button className="btn-back" onClick={onClose}>
          ← Retour
        </button>
        <span>Favoris</span>
      </div>

      <div className="favorite-list">
        {loadingFavs ? (
          <div className="loading-screen" style={{ padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="no-data">Pas encore de favoris</div>
        ) : (
          favorites.map((fav) => (
            <div
              key={fav.id}
              className={`favorite-item ${selectedId === fav.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedId(fav.id === selectedId ? null : fav.id);
                setMultiplier(1);
                setCustomMultiplier('');
              }}
            >
              <div className="favorite-item-info">
                <span className="favorite-item-name">{fav.name}</span>
                <span className="favorite-item-meta">
                  {fav.items.length} aliment{fav.items.length > 1 ? 's' : ''} — {getTotalKcal(fav.items)} kcal
                </span>
              </div>
              <button
                className="photo-editor-remove"
                onClick={(e) => handleDelete(e, fav.id)}
                title="Supprimer"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {selectedFav && (
        <div className="favorite-multiplier">
          <div className="favorite-multiplier-label">Quantité :</div>
          <div className="favorite-multiplier-buttons">
            {[0.5, 1, 1.5, 2].map((m) => (
              <button
                key={m}
                className={`quick-reply-btn ${!customMultiplier && multiplier === m ? 'confirm' : ''}`}
                onClick={() => { setMultiplier(m); setCustomMultiplier(''); }}
              >
                {m}x
              </button>
            ))}
            <input
              type="number"
              value={customMultiplier}
              onChange={(e) => setCustomMultiplier(e.target.value)}
              placeholder="Autre"
              min="0.1"
              step="0.1"
              className="favorite-multiplier-input"
            />
          </div>
          <div className="favorite-multiplier-total">
            Total : {Math.round(getTotalKcal(selectedFav.items) * (activeMultiplier || 1))} kcal
          </div>
          <button className="btn-primary" onClick={handleAdd} style={{ width: '100%', marginTop: '0.5rem' }}>
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

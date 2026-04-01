import { useState } from 'react';

export default function PhotoFoodEditor({ items, onConfirm, onCancel, loading }) {
  const [editItems, setEditItems] = useState(
    items.map((it) => ({ ...it }))
  );

  const updateItem = (index, field, value) => {
    setEditItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeItem = (index) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setEditItems((prev) => [
      ...prev,
      { name: '', quantity: 100, unit: 'g', state: 'cuit' },
    ]);
  };

  const toggleState = (index) => {
    setEditItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        state: copy[index].state === 'cru' ? 'cuit' : 'cru',
      };
      return copy;
    });
  };

  const validItems = editItems.filter((it) => it.name.trim() && it.quantity > 0);

  return (
    <div className="photo-editor">
      <div className="photo-editor-header">
        <button className="btn-back" onClick={onCancel}>
          ← Retour
        </button>
        <span>Aliments détectés</span>
      </div>

      <div className="photo-editor-list">
        {editItems.map((item, i) => (
          <div key={i} className="photo-editor-item">
            <div className="photo-editor-item-top">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(i, 'name', e.target.value)}
                placeholder="Nom de l'aliment"
                className="photo-editor-name"
              />
              <button
                className="photo-editor-remove"
                onClick={() => removeItem(i)}
                title="Supprimer"
              >
                ✕
              </button>
            </div>
            <div className="photo-editor-item-bottom">
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value, 10) || 0)}
                min="0"
                className="photo-editor-qty"
              />
              <select
                value={item.unit}
                onChange={(e) => updateItem(i, 'unit', e.target.value)}
                className="photo-editor-unit"
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="pièce">pièce</option>
              </select>
              <button
                className={`state-toggle ${item.state === 'cuit' ? 'cooked' : 'raw'}`}
                onClick={() => toggleState(i)}
              >
                {item.state === 'cru' ? 'Cru' : 'Cuit'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="photo-editor-actions">
        <button className="btn-secondary" onClick={addItem}>
          + Ajouter un aliment
        </button>
        <button
          className="btn-primary"
          onClick={() => onConfirm(validItems)}
          disabled={loading || validItems.length === 0}
        >
          {loading ? 'Calcul en cours...' : 'Calculer les calories'}
        </button>
      </div>
    </div>
  );
}

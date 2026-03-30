import { useState } from 'react';
import { saveUserProfile, clearAllData } from '../utils/storage';

export default function Settings({ profile, onUpdate }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [basalMetabolism, setBasalMetabolism] = useState(profile.basalMetabolism);
  const [targetWeightLoss, setTargetWeightLoss] = useState(profile.targetWeightLoss);
  const [targetDate, setTargetDate] = useState(profile.targetDate);
  const [apiKey, setApiKey] = useState(profile.apiKey || '');
  const [saved, setSaved] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleSave = () => {
    const updated = {
      ...profile,
      firstName,
      basalMetabolism: parseInt(basalMetabolism, 10),
      targetWeightLoss: parseFloat(targetWeightLoss),
      targetDate,
      apiKey,
    };
    saveUserProfile(updated);
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    clearAllData();
    window.location.reload();
  };

  return (
    <div className="settings-page">
      <h2>Paramètres</h2>

      <div className="settings-form">
        <div className="form-group">
          <label>Prénom</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Métabolisme de base (kcal/jour)</label>
          <input
            type="number"
            value={basalMetabolism}
            onChange={(e) => setBasalMetabolism(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Objectif perte de gras (kg)</label>
          <input
            type="number"
            step="0.1"
            value={targetWeightLoss}
            onChange={(e) => setTargetWeightLoss(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Date objectif</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Clé API OpenAI</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <button className="btn-primary" onClick={handleSave}>
          {saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
        </button>

        <div className="danger-zone">
          <h3>Zone dangereuse</h3>
          {!showConfirmReset ? (
            <button className="btn-danger" onClick={() => setShowConfirmReset(true)}>
              Réinitialiser toutes les données
            </button>
          ) : (
            <div className="confirm-reset">
              <p>Es-tu sûr ? Toutes tes données seront supprimées.</p>
              <div className="confirm-buttons">
                <button className="btn-danger" onClick={handleReset}>
                  Oui, tout supprimer
                </button>
                <button className="btn-secondary" onClick={() => setShowConfirmReset(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

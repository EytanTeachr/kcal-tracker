import { useState } from 'react';
import { updateProfile, deleteAllData, updateProfilePin } from '../utils/db';

export default function Settings({ profile, onUpdate, onLogout }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [basalMetabolism, setBasalMetabolism] = useState(profile.basalMetabolism);
  const [targetWeightLoss, setTargetWeightLoss] = useState(profile.targetWeightLoss);
  const [targetDate, setTargetDate] = useState(profile.targetDate);
  const [occasion, setOccasion] = useState(profile.occasion || '');
  const [dailyProteinGoal, setDailyProteinGoal] = useState(profile.dailyProteinGoal || '');
  const [apiKey, setApiKey] = useState(profile.apiKey || '');
  const [friendPin, setFriendPin] = useState(profile.friendPin || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = {
        ...profile,
        firstName,
        basalMetabolism: parseInt(basalMetabolism, 10),
        targetWeightLoss: parseFloat(targetWeightLoss),
        targetDate,
        occasion,
        dailyProteinGoal: parseInt(dailyProteinGoal, 10) || 0,
        apiKey,
        friendPin,
      };
      await updateProfile(updated);
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await deleteAllData();
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
          <label>Objectif protéines par jour (g)</label>
          <input
            type="number"
            value={dailyProteinGoal}
            onChange={(e) => setDailyProteinGoal(e.target.value)}
            placeholder="Ex: 130"
          />
        </div>

        <div className="form-group">
          <label>Occasion / Motivation</label>
          <input
            type="text"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="Ex: Mariage en juillet (optionnel)"
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

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={profile.email || ''}
            readOnly
            style={{ opacity: 0.6 }}
          />
        </div>

        <div className="form-group">
          <label>Code PIN ami</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={friendPin}
            onChange={(e) => setFriendPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="4 a 6 chiffres"
          />
          <p className="hint-text">Partage ce code avec tes amis pour qu'ils puissent t'ajouter</p>
        </div>

        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saved ? '✓ Sauvegardé !' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>

        <div className="logout-section">
          <button className="btn-secondary" onClick={onLogout} style={{ width: '100%' }}>
            Se déconnecter
          </button>
        </div>

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

import { useState } from 'react';
import { createProfile } from '../utils/db';

const STEPS = ['name', 'metabolism', 'goal', 'occasion'];

export default function Setup({ onComplete }) {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [basalMetabolism, setBasalMetabolism] = useState('');
  const [targetWeightLoss, setTargetWeightLoss] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [occasion, setOccasion] = useState('');
  const [dailyProteinGoal, setDailyProteinGoal] = useState('');
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_OPENAI_API_KEY || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setSaving(true);
      setError(null);
      try {
        const profile = await createProfile({
          firstName,
          basalMetabolism: parseInt(basalMetabolism, 10),
          targetWeightLoss: parseFloat(targetWeightLoss),
          targetDate,
          apiKey,
          occasion,
          dailyProteinGoal: parseInt(dailyProteinGoal, 10) || 0,
        });
        onComplete(profile);
      } catch (err) {
        setError(err.message);
        setSaving(false);
      }
    }
  };

  const canNext = () => {
    if (step === 0) return firstName.trim().length > 0;
    if (step === 1) return basalMetabolism > 0 && apiKey.trim().length > 0;
    if (step === 2) return targetWeightLoss > 0 && targetDate;
    if (step === 3) return true; // occasion is optional
    return false;
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`progress-dot ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="setup-step">
            <h2>Bienvenue !</h2>
            <p>Comment tu t'appelles ?</p>
            <input
              type="text"
              placeholder="Ton prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && canNext() && handleNext()}
            />
          </div>
        )}

        {step === 1 && (
          <div className="setup-step">
            <h2>Bonjour {firstName} !</h2>
            <p>Quel est ton métabolisme de base (en kcal/jour) ?</p>
            <p className="hint">
              C'est le nombre de calories que ton corps brûle au repos.
              En général entre 1400 et 2500 kcal selon ton profil.
            </p>
            <input
              type="number"
              placeholder="Ex: 1800"
              value={basalMetabolism}
              onChange={(e) => setBasalMetabolism(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canNext() && handleNext()}
            />
            <p style={{ marginTop: '1.5rem' }}>Ta clé API OpenAI</p>
            <p className="hint">
              Elle sera stockée et utilisée pour estimer les calories via l'IA.
            </p>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canNext() && handleNext()}
            />
          </div>
        )}

        {step === 2 && (
          <div className="setup-step">
            <h2>Ton objectif</h2>
            <p>Combien de kg de gras veux-tu perdre ?</p>
            <input
              type="number"
              step="0.1"
              placeholder="Ex: 5"
              value={targetWeightLoss}
              onChange={(e) => setTargetWeightLoss(e.target.value)}
            />
            <p style={{ marginTop: '1.5rem' }}>Date objectif</p>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              onKeyDown={(e) => e.key === 'Enter' && canNext() && handleNext()}
            />
            <p style={{ marginTop: '1.5rem' }}>Objectif protéines par jour (g)</p>
            <p className="hint">
              En général 1.6 à 2.2g par kg de poids de corps. Ex: 70kg = ~120-150g/jour.
            </p>
            <input
              type="number"
              placeholder="Ex: 130 (optionnel)"
              value={dailyProteinGoal}
              onChange={(e) => setDailyProteinGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canNext() && handleNext()}
            />
          </div>
        )}

        {step === 3 && (
          <div className="setup-step">
            <h2>Motivation</h2>
            <p>Tu fais ça pour une occasion spéciale ?</p>
            <p className="hint">
              Mariage, vacances, compétition, santé... On adaptera les messages de motivation !
            </p>
            <input
              type="text"
              placeholder="Ex: Mon mariage en juillet (optionnel)"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canNext() && handleNext()}
            />
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {error}
          </p>
        )}

        <div className="setup-actions">
          {step > 0 && (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>
              Retour
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleNext}
            disabled={!canNext() || saving}
          >
            {saving ? 'Sauvegarde...' : step === STEPS.length - 1 ? 'Commencer !' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}

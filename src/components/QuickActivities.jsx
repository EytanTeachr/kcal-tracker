import { useState } from 'react';
import { addEntry } from '../utils/db';

const QUICK_ACTIVITIES = [
  { name: '10 pompes', emoji: '💪', kcal: 30, duration: '2 min' },
  { name: '10 squats', emoji: '🦵', kcal: 25, duration: '2 min' },
  { name: '10 min marche', emoji: '🚶', kcal: 40, duration: '10 min' },
  { name: '5 min corde à sauter', emoji: '🤸', kcal: 55, duration: '5 min' },
  { name: '20 abdos', emoji: '🏋️', kcal: 20, duration: '3 min' },
  { name: '15 min vélo', emoji: '🚴', kcal: 90, duration: '15 min' },
  { name: '10 min yoga', emoji: '🧘', kcal: 30, duration: '10 min' },
  { name: '20 min course', emoji: '🏃', kcal: 200, duration: '20 min' },
];

export default function QuickActivities({ profileId, selectedDate, onAdded }) {
  const [addedIndex, setAddedIndex] = useState(null);

  const handleTap = async (activity, index) => {
    if (addedIndex !== null) return;
    try {
      await addEntry(profileId, selectedDate, 'activity', {
        description: activity.name,
        kcal: activity.kcal,
        proteins: 0,
        lipids: 0,
        carbs: 0,
      });
      setAddedIndex(index);
      onAdded();
      setTimeout(() => setAddedIndex(null), 1200);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="quick-activities-section">
      <div className="quick-activities-title">Activités rapides</div>
      <div className="quick-activities-scroll">
        {QUICK_ACTIVITIES.map((act, i) => (
          <div
            key={i}
            className={`activity-card${addedIndex === i ? ' added' : ''}`}
            onClick={() => handleTap(act, i)}
          >
            <div className="activity-card-emoji">{addedIndex === i ? '✓' : act.emoji}</div>
            <div className="activity-card-name">{addedIndex === i ? 'Ajouté ✓' : act.name}</div>
            <div className="activity-card-info">{act.duration}</div>
            <div className="activity-card-kcal">−{act.kcal} kcal</div>
          </div>
        ))}
      </div>
    </div>
  );
}

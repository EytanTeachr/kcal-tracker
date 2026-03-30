// 1 kg of fat = 7000 kcal
const KCAL_PER_KG_FAT = 7000;

export function kcalToKgFat(kcal) {
  return Math.round((kcal / KCAL_PER_KG_FAT) * 100) / 100;
}

export function kgFatToKcal(kg) {
  return kg * KCAL_PER_KG_FAT;
}

// Calculate daily deficit target based on goal
export function getDailyTarget(profile) {
  if (!profile || !profile.targetDate || !profile.targetWeightLoss) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(profile.targetDate);
  target.setHours(0, 0, 0, 0);

  const daysRemaining = Math.max(1, Math.ceil((target - today) / (1000 * 60 * 60 * 24)));
  const totalKcalToLose = kgFatToKcal(profile.targetWeightLoss);
  const dailyDeficit = Math.round(totalKcalToLose / daysRemaining);

  return {
    daysRemaining,
    totalKcalToLose,
    dailyDeficit,
    dailyKgFat: kcalToKgFat(dailyDeficit),
  };
}

// Get day status: green, yellow, red
export function getDayStatus(actualDeficit, targetDeficit) {
  if (targetDeficit <= 0) return 'green';
  const ratio = actualDeficit / targetDeficit;
  if (ratio >= 1.05) return 'green';
  if (ratio >= 0.95) return 'yellow';
  return 'red';
}

// Calculate balance for a day
export function getDayBalance(dayLog, basalMetabolism) {
  const totalIn = dayLog.totalIn || 0;
  const totalOut = (dayLog.totalOut || 0) + basalMetabolism;
  const deficit = totalOut - totalIn;
  return {
    totalIn,
    totalOut,
    deficit,
    kgFat: kcalToKgFat(deficit),
  };
}

export function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function formatDateFR(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

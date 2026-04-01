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

// Adaptive daily target based on historical performance
export function getAdaptiveDailyTarget(profile, historicalDayLogs) {
  const naive = getDailyTarget(profile);
  if (!naive) return null;

  const totalKcalToLose = naive.totalKcalToLose;
  const daysRemaining = naive.daysRemaining;

  // If no historical data, fall back to naive target
  if (!historicalDayLogs || historicalDayLogs.length === 0) {
    return {
      dailyDeficit: naive.dailyDeficit,
      daysRemaining,
      totalRemaining: totalKcalToLose,
      isAdaptive: false,
    };
  }

  // Compute total achieved deficit from past days
  const totalAchievedDeficit = historicalDayLogs.reduce((sum, day) => {
    const dayDeficit = profile.basalMetabolism + (day.totalOut || 0) - (day.totalIn || 0);
    return sum + dayDeficit;
  }, 0);

  const remainingToLose = totalKcalToLose - totalAchievedDeficit;
  let adaptiveTarget = Math.round(remainingToLose / daysRemaining);

  // Clamp between reasonable bounds: never below 200, never above 2x naive target
  const minTarget = 200;
  const maxTarget = naive.dailyDeficit * 2;
  adaptiveTarget = Math.max(minTarget, Math.min(maxTarget, adaptiveTarget));

  return {
    dailyDeficit: adaptiveTarget,
    daysRemaining,
    totalRemaining: Math.max(0, remainingToLose),
    isAdaptive: true,
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

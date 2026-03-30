// LocalStorage helper for persisting app data

const STORAGE_KEYS = {
  USER_PROFILE: 'kcal_user_profile',
  DAILY_LOGS: 'kcal_daily_logs',
  SETTINGS: 'kcal_settings',
};

export function getUserProfile() {
  const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
  return data ? JSON.parse(data) : null;
}

export function saveUserProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
}

export function getSettings() {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return data ? JSON.parse(data) : null;
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// Daily logs: { "2026-03-30": { meals: [...], activities: [...], totalIn: 0, totalOut: 0 } }
export function getDailyLogs() {
  const data = localStorage.getItem(STORAGE_KEYS.DAILY_LOGS);
  return data ? JSON.parse(data) : {};
}

export function saveDailyLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(logs));
}

export function getDayLog(dateStr) {
  const logs = getDailyLogs();
  return logs[dateStr] || { meals: [], activities: [], totalIn: 0, totalOut: 0 };
}

export function saveDayLog(dateStr, dayLog) {
  const logs = getDailyLogs();
  logs[dateStr] = dayLog;
  saveDailyLogs(logs);
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

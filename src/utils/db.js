// Database operations layer using Supabase + Auth

import { supabase } from './supabase';

// ============ PROFILE ============

function mapProfile(data) {
  return {
    id: data.id,
    userId: data.user_id,
    firstName: data.first_name,
    basalMetabolism: data.basal_metabolism,
    targetWeightLoss: parseFloat(data.target_weight_loss),
    targetDate: data.target_date,
    apiKey: data.api_key,
    occasion: data.occasion || '',
    createdAt: data.created_at,
  };
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return mapProfile(data);
}

export async function createProfile(profile) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      first_name: profile.firstName,
      basal_metabolism: profile.basalMetabolism,
      target_weight_loss: profile.targetWeightLoss,
      target_date: profile.targetDate,
      api_key: profile.apiKey,
      occasion: profile.occasion || '',
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur création profil: ${error.message}`);

  return mapProfile(data);
}

export async function updateProfile(profile) {
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: profile.firstName,
      basal_metabolism: profile.basalMetabolism,
      target_weight_loss: profile.targetWeightLoss,
      target_date: profile.targetDate,
      api_key: profile.apiKey,
      occasion: profile.occasion || '',
    })
    .eq('id', profile.id);

  if (error) throw new Error(`Erreur mise à jour profil: ${error.message}`);
  return profile;
}

// ============ DAILY ENTRIES ============

export async function getEntriesForDate(profileId, dateStr) {
  const { data, error } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('profile_id', profileId)
    .eq('entry_date', dateStr)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erreur chargement entrées: ${error.message}`);

  const meals = [];
  const activities = [];

  for (const row of data || []) {
    const entry = {
      id: row.id,
      description: row.description,
      kcal: row.kcal,
      detail: row.detail || '',
      time: row.entry_time || '',
    };
    if (row.type === 'meal') {
      meals.push(entry);
    } else {
      activities.push(entry);
    }
  }

  const totalIn = meals.reduce((sum, m) => sum + m.kcal, 0);
  const totalOut = activities.reduce((sum, a) => sum + a.kcal, 0);

  return { meals, activities, totalIn, totalOut };
}

export async function addEntry(profileId, dateStr, type, entry) {
  const { data, error } = await supabase
    .from('daily_entries')
    .insert({
      profile_id: profileId,
      entry_date: dateStr,
      type,
      description: entry.description,
      kcal: entry.kcal,
      detail: entry.detail || '',
      entry_time: entry.time || '',
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur ajout entrée: ${error.message}`);

  return {
    id: data.id,
    description: data.description,
    kcal: data.kcal,
    detail: data.detail,
    time: data.entry_time,
  };
}

export async function addMultipleEntries(profileId, dateStr, type, entries) {
  const rows = entries.map((entry) => ({
    profile_id: profileId,
    entry_date: dateStr,
    type,
    description: entry.description,
    kcal: entry.kcal,
    detail: entry.detail || '',
    entry_time: entry.time || '',
  }));

  const { data, error } = await supabase
    .from('daily_entries')
    .insert(rows)
    .select();

  if (error) throw new Error(`Erreur ajout entrées: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    description: row.description,
    kcal: row.kcal,
    detail: row.detail,
    time: row.entry_time,
  }));
}

export async function updateEntry(entryId, updates) {
  const updateData = {};
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.kcal !== undefined) updateData.kcal = updates.kcal;

  const { error } = await supabase
    .from('daily_entries')
    .update(updateData)
    .eq('id', entryId);

  if (error) throw new Error(`Erreur mise à jour: ${error.message}`);
}

export async function deleteEntry(entryId) {
  const { error } = await supabase
    .from('daily_entries')
    .delete()
    .eq('id', entryId);

  if (error) throw new Error(`Erreur suppression: ${error.message}`);
}

// ============ CALENDAR / RANGE QUERIES ============

export async function getEntriesForMonth(profileId, year, month) {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

  const { data, error } = await supabase
    .from('daily_entries')
    .select('entry_date, type, kcal')
    .eq('profile_id', profileId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate);

  if (error) throw new Error(`Erreur chargement mois: ${error.message}`);

  const grouped = {};
  for (const row of data || []) {
    const d = row.entry_date;
    if (!grouped[d]) grouped[d] = { totalIn: 0, totalOut: 0 };
    if (row.type === 'meal') {
      grouped[d].totalIn += row.kcal;
    } else {
      grouped[d].totalOut += row.kcal;
    }
  }

  return grouped;
}

export async function getEntriesForWeek(profileId, mondayStr, sundayStr) {
  const { data, error } = await supabase
    .from('daily_entries')
    .select('entry_date, type, kcal')
    .eq('profile_id', profileId)
    .gte('entry_date', mondayStr)
    .lte('entry_date', sundayStr);

  if (error) throw new Error(`Erreur chargement semaine: ${error.message}`);

  const grouped = {};
  for (const row of data || []) {
    const d = row.entry_date;
    if (!grouped[d]) grouped[d] = { totalIn: 0, totalOut: 0 };
    if (row.type === 'meal') {
      grouped[d].totalIn += row.kcal;
    } else {
      grouped[d].totalOut += row.kcal;
    }
  }

  return grouped;
}

// ============ RESET ============

export async function deleteAllData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get profile for this user
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (profile) {
    await supabase.from('daily_entries').delete().eq('profile_id', profile.id);
    await supabase.from('profiles').delete().eq('id', profile.id);
  }
}

// ============ AUTH ============

export async function signOut() {
  await supabase.auth.signOut();
  sessionStorage.removeItem('kcal_session_only');
}

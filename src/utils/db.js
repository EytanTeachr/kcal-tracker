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
    dailyProteinGoal: data.daily_protein_goal || 0,
    friendPin: data.friend_pin || '',
    email: data.email || '',
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

  console.log('getProfile query result:', { data, error, userId: user.id });

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
      daily_protein_goal: profile.dailyProteinGoal || 0,
      email: user.email || '',
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur création profil: ${error.message}`);

  return mapProfile(data);
}

export async function updateProfile(profile) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: profile.firstName,
      basal_metabolism: profile.basalMetabolism,
      target_weight_loss: profile.targetWeightLoss,
      target_date: profile.targetDate,
      api_key: profile.apiKey,
      occasion: profile.occasion || '',
      daily_protein_goal: profile.dailyProteinGoal || 0,
      friend_pin: profile.friendPin || '',
      email: user?.email || profile.email || '',
    })
    .eq('id', profile.id);

  if (error) throw new Error(`Erreur mise à jour profil: ${error.message}`);
  return { ...profile, email: user?.email || profile.email || '' };
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
      proteins: parseFloat(row.proteins) || 0,
      lipids: parseFloat(row.lipids) || 0,
      carbs: parseFloat(row.carbs) || 0,
      advice: row.advice || '',
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
  const totalProteins = meals.reduce((sum, m) => sum + m.proteins, 0);
  const totalLipids = meals.reduce((sum, m) => sum + m.lipids, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);

  return { meals, activities, totalIn, totalOut, totalProteins, totalLipids, totalCarbs };
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
      proteins: entry.proteins || 0,
      lipids: entry.lipids || 0,
      carbs: entry.carbs || 0,
      advice: entry.advice || '',
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
    proteins: parseFloat(data.proteins) || 0,
    lipids: parseFloat(data.lipids) || 0,
    carbs: parseFloat(data.carbs) || 0,
    advice: data.advice || '',
    detail: data.detail,
    time: data.entry_time,
  };
}

export async function addMultipleEntries(profileId, dateStr, type, entries, advice) {
  const rows = entries.map((entry) => ({
    profile_id: profileId,
    entry_date: dateStr,
    type,
    description: entry.description,
    kcal: entry.kcal,
    proteins: entry.proteins || 0,
    lipids: entry.lipids || 0,
    carbs: entry.carbs || 0,
    advice: advice || entry.advice || '',
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
    proteins: parseFloat(row.proteins) || 0,
    lipids: parseFloat(row.lipids) || 0,
    carbs: parseFloat(row.carbs) || 0,
    advice: row.advice || '',
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

// ============ HISTORICAL DEFICITS ============

export async function getHistoricalDeficits(profileId, startDate, endDate) {
  const { data, error } = await supabase
    .from('daily_entries')
    .select('entry_date, type, kcal')
    .eq('profile_id', profileId)
    .gte('entry_date', startDate)
    .lt('entry_date', endDate);

  if (error) throw new Error(`Erreur chargement historique: ${error.message}`);

  const grouped = {};
  for (const row of data || []) {
    const d = row.entry_date;
    if (!grouped[d]) grouped[d] = { date: d, totalIn: 0, totalOut: 0 };
    if (row.type === 'meal') {
      grouped[d].totalIn += row.kcal;
    } else {
      grouped[d].totalOut += row.kcal;
    }
  }

  return Object.values(grouped);
}

// ============ FAVORITES ============

export async function getFavorites(profileId) {
  const { data, error } = await supabase
    .from('favorite_meals')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Erreur chargement favoris: ${error.message}`);

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    items: row.items,
    createdAt: row.created_at,
  }));
}

export async function addFavorite(profileId, name, items) {
  const { data, error } = await supabase
    .from('favorite_meals')
    .insert({
      profile_id: profileId,
      name,
      items,
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur ajout favori: ${error.message}`);

  return {
    id: data.id,
    name: data.name,
    items: data.items,
    createdAt: data.created_at,
  };
}

export async function deleteFavorite(favoriteId) {
  const { error } = await supabase
    .from('favorite_meals')
    .delete()
    .eq('id', favoriteId);

  if (error) throw new Error(`Erreur suppression favori: ${error.message}`);
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

// ============ FRIENDS ============

export async function updateProfilePin(profileId, pin) {
  const { error } = await supabase
    .from('profiles')
    .update({ friend_pin: pin })
    .eq('id', profileId);

  if (error) throw new Error(`Erreur mise à jour PIN: ${error.message}`);
}

export async function findProfileByEmailAndPin(email, pin) {
  // Try RPC function first (bypasses RLS to search other users)
  const { data, error } = await supabase.rpc('find_friend_by_email_and_pin', {
    search_email: email,
    search_pin: pin,
  });

  console.log('RPC find_friend result:', { data, error });

  if (!error && data && data.length > 0) {
    const d = data[0];
    return {
      id: d.id,
      firstName: d.first_name,
      email: d.email,
    };
  }

  // If RPC function doesn't exist, log a helpful message
  if (error) {
    console.error('RPC error (make sure find_friend_by_email_and_pin function exists in Supabase):', error.message);
  }

  return null;
}

export async function sendFriendRequest(requesterId, addresseeId) {
  const { data, error } = await supabase
    .from('friendships')
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur envoi demande: ${error.message}`);
  return data;
}

export async function respondToFriendRequest(friendshipId, status, permission) {
  const { error } = await supabase
    .from('friendships')
    .update({ status, permission: permission || 'read' })
    .eq('id', friendshipId);

  if (error) throw new Error(`Erreur réponse demande: ${error.message}`);
}

// Helper: load profiles by IDs using RPC (bypasses RLS)
async function loadProfilesByIds(ids) {
  if (!ids || ids.length === 0) return {};

  const { data, error } = await supabase.rpc('get_friend_profiles', {
    profile_ids: ids,
  });

  if (error) {
    console.error('get_friend_profiles RPC error:', error.message);
    return {};
  }

  const profileMap = {};
  for (const p of data || []) {
    profileMap[p.id] = {
      id: p.id,
      firstName: p.first_name,
      email: p.email,
      basalMetabolism: p.basal_metabolism,
      targetWeightLoss: parseFloat(p.target_weight_loss),
      targetDate: p.target_date,
      occasion: p.occasion || '',
      dailyProteinGoal: p.daily_protein_goal || 0,
    };
  }
  return profileMap;
}

export async function getFriends(profileId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, permission, created_at')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`);

  if (error) throw new Error(`Erreur chargement amis: ${error.message}`);

  const friendIds = (data || []).map((f) =>
    f.requester_id === profileId ? f.addressee_id : f.requester_id
  );

  if (friendIds.length === 0) return [];

  const profileMap = await loadProfilesByIds(friendIds);

  return (data || []).map((f) => {
    const friendId = f.requester_id === profileId ? f.addressee_id : f.requester_id;
    return {
      friendshipId: f.id,
      permission: f.permission,
      friend: profileMap[friendId] || null,
    };
  }).filter((f) => f.friend);
}

export async function getPendingRequests(profileId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at')
    .eq('status', 'pending')
    .eq('addressee_id', profileId);

  if (error) throw new Error(`Erreur chargement demandes: ${error.message}`);

  const requesterIds = (data || []).map((f) => f.requester_id);
  if (requesterIds.length === 0) return [];

  const profileMap = await loadProfilesByIds(requesterIds);

  return (data || []).map((f) => ({
    friendshipId: f.id,
    requester: profileMap[f.requester_id] || null,
  })).filter((f) => f.requester);
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  if (error) throw new Error(`Erreur suppression ami: ${error.message}`);
}

export async function getFriendDayLog(friendProfileId, dateStr) {
  const { data, error } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('profile_id', friendProfileId)
    .eq('entry_date', dateStr)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erreur chargement entrées ami: ${error.message}`);

  const meals = [];
  const activities = [];

  for (const row of data || []) {
    const entry = {
      id: row.id,
      description: row.description,
      kcal: row.kcal,
      proteins: parseFloat(row.proteins) || 0,
      lipids: parseFloat(row.lipids) || 0,
      carbs: parseFloat(row.carbs) || 0,
      advice: row.advice || '',
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
  const totalProteins = meals.reduce((sum, m) => sum + m.proteins, 0);
  const totalLipids = meals.reduce((sum, m) => sum + m.lipids, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);

  return { meals, activities, totalIn, totalOut, totalProteins, totalLipids, totalCarbs };
}

export async function sendEncouragement(senderId, receiverId, message) {
  const { data, error } = await supabase
    .from('encouragements')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      message,
    })
    .select()
    .single();

  if (error) throw new Error(`Erreur envoi encouragement: ${error.message}`);
  return data;
}

export async function getEncouragements(receiverId) {
  const { data, error } = await supabase
    .from('encouragements')
    .select('id, sender_id, receiver_id, message, created_at')
    .or(`receiver_id.eq.${receiverId},sender_id.eq.${receiverId}`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Erreur chargement encouragements: ${error.message}`);

  const senderIds = [...new Set((data || []).map((e) => e.sender_id))];
  if (senderIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, first_name')
    .in('id', senderIds);

  if (pErr) throw new Error(`Erreur chargement profils: ${pErr.message}`);

  const nameMap = {};
  for (const p of profiles || []) {
    nameMap[p.id] = p.first_name;
  }

  return (data || []).map((e) => ({
    id: e.id,
    senderId: e.sender_id,
    receiverId: e.receiver_id,
    senderName: nameMap[e.sender_id] || 'Inconnu',
    message: e.message,
    createdAt: e.created_at,
  }));
}

export async function updateFriendPermission(friendshipId, permission) {
  const { error } = await supabase
    .from('friendships')
    .update({ permission })
    .eq('id', friendshipId);

  if (error) throw new Error(`Erreur mise à jour permission: ${error.message}`);
}

// ============ AUTH ============

export async function signOut() {
  await supabase.auth.signOut();
  sessionStorage.removeItem('kcal_session_only');
}

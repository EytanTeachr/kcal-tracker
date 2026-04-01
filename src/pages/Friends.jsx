import { useState, useEffect } from 'react';
import {
  getFriends,
  getPendingRequests,
  findProfileByEmailAndPin,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  getEntriesForDate,
} from '../utils/db';
import { getDayBalance, getDayStatus, getDailyTarget, formatDate } from '../utils/kcal';
import FriendProfile from './FriendProfile';

export default function Friends({ profile }) {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchPin, setSearchPin] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendStatuses, setFriendStatuses] = useState({});
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [acceptPermission, setAcceptPermission] = useState({});

  const loadData = async () => {
    try {
      const [friendsList, requests] = await Promise.all([
        getFriends(profile.id),
        getPendingRequests(profile.id),
      ]);
      setFriends(friendsList);
      setPendingRequests(requests);

      // Load today's status for each friend
      const today = formatDate(new Date());
      const statuses = {};
      for (const f of friendsList) {
        try {
          const dayLog = await getEntriesForDate(f.friend.id, today);
          const target = getDailyTarget(f.friend);
          const balance = getDayBalance(dayLog, f.friend.basalMetabolism);
          const status = target ? getDayStatus(balance.deficit, target.dailyDeficit) : 'green';
          statuses[f.friend.id] = status;
        } catch {
          statuses[f.friend.id] = null;
        }
      }
      setFriendStatuses(statuses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const handleSearch = async () => {
    setSearchError('');
    setSearchResult(null);
    if (!searchEmail.trim() || !searchPin.trim()) {
      setSearchError('Remplis les deux champs.');
      return;
    }
    if (searchPin.length < 4 || searchPin.length > 6) {
      setSearchError('Le code PIN doit contenir 4 a 6 chiffres.');
      return;
    }
    setSearching(true);
    try {
      const found = await findProfileByEmailAndPin(searchEmail.trim(), searchPin.trim());
      if (!found) {
        setSearchError('Aucun utilisateur trouve avec cet email et ce PIN.');
        return;
      }
      if (found.id === profile.id) {
        setSearchError('Tu ne peux pas t\'ajouter toi-meme.');
        return;
      }
      const alreadyFriend = friends.some((f) => f.friend.id === found.id);
      if (alreadyFriend) {
        setSearchError('Vous etes deja amis !');
        return;
      }
      setSearchResult(found);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;
    setSending(true);
    try {
      await sendFriendRequest(profile.id, searchResult.id);
      setSearchResult(null);
      setSearchEmail('');
      setSearchPin('');
      setSearchError('');
      alert('Demande envoyee !');
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (friendshipId) => {
    const perm = acceptPermission[friendshipId] || 'read';
    try {
      await respondToFriendRequest(friendshipId, 'accepted', perm);
      await loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleDecline = async (friendshipId) => {
    try {
      await respondToFriendRequest(friendshipId, 'declined', 'read');
      await loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (!confirm('Supprimer cet ami ?')) return;
    try {
      await removeFriend(friendshipId);
      await loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // If viewing a friend's profile
  if (selectedFriend) {
    return (
      <FriendProfile
        friend={selectedFriend}
        currentProfile={profile}
        permission={selectedPermission}
        onBack={() => {
          setSelectedFriend(null);
          setSelectedPermission(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="friends-page">
        <div className="no-data">
          <div className="spinner" />
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <h2>Amis</h2>

      {/* Section 1: Mes amis */}
      <div className="friends-section">
        <h3>Mes amis</h3>
        {friends.length === 0 ? (
          <p className="no-data">Aucun ami pour le moment.</p>
        ) : (
          friends.map((f) => (
            <div
              key={f.friendshipId}
              className="friend-item"
              onClick={() => {
                setSelectedFriend(f.friend);
                setSelectedPermission(f.permission);
              }}
            >
              <div className="friend-info">
                {friendStatuses[f.friend.id] && (
                  <span
                    className="friend-status-dot"
                    style={{
                      background:
                        friendStatuses[f.friend.id] === 'green'
                          ? 'var(--green)'
                          : friendStatuses[f.friend.id] === 'yellow'
                          ? 'var(--yellow)'
                          : 'var(--red)',
                    }}
                  />
                )}
                <span className="friend-name">{f.friend.firstName}</span>
                <span className="friend-email">{f.friend.email}</span>
                <span className="permission-badge">
                  {f.permission === 'write' ? 'Lecture + modif.' : 'Lecture'}
                </span>
              </div>
              <button
                className="btn-remove-friend"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFriend(f.friendshipId);
                }}
                title="Supprimer"
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>

      {/* Section 2: Demandes en attente */}
      <div className="friends-section">
        <h3>Demandes en attente</h3>
        {pendingRequests.length === 0 ? (
          <p className="no-data">Aucune demande en attente.</p>
        ) : (
          pendingRequests.map((req) => (
            <div key={req.friendshipId} className="friend-item pending">
              <div className="friend-info">
                <span className="friend-name">{req.requester.firstName}</span>
                <span className="friend-email">{req.requester.email}</span>
              </div>
              <div className="friend-actions">
                <select
                  className="permission-select"
                  value={acceptPermission[req.friendshipId] || 'read'}
                  onChange={(e) =>
                    setAcceptPermission((prev) => ({
                      ...prev,
                      [req.friendshipId]: e.target.value,
                    }))
                  }
                >
                  <option value="read">Lecture seule</option>
                  <option value="write">Lecture + modification</option>
                </select>
                <button
                  className="btn-primary btn-small"
                  onClick={() => handleAccept(req.friendshipId)}
                >
                  Accepter
                </button>
                <button
                  className="btn-secondary btn-small"
                  onClick={() => handleDecline(req.friendshipId)}
                >
                  Refuser
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Section 3: Ajouter un ami */}
      <div className="friends-section">
        <h3>Ajouter un ami</h3>
        <div className="add-friend-form">
          <input
            type="email"
            placeholder="Email de l'ami"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Code PIN (4-6 chiffres)"
            value={searchPin}
            onChange={(e) => setSearchPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>

        {searchError && <p className="search-error">{searchError}</p>}

        {searchResult && (
          <div className="search-result">
            <p>
              Utilisateur trouve : <strong>{searchResult.firstName}</strong> ({searchResult.email})
            </p>
            <button
              className="btn-primary"
              onClick={handleSendRequest}
              disabled={sending}
            >
              {sending ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

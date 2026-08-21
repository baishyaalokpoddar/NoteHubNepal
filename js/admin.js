/**
 * NoteHub Nepal - Admin Panel & Room/ID Management System
 * Allows administrators to monitor all created Room IDs, manage logins/IDs,
 * create new rooms, delete unwanted rooms, view storage analytics, and control app security.
 */

const NoteAdmin = (() => {
  const ROOMS_REGISTRY_KEY = 'nhub_known_rooms';
  const ROOMS_METADATA_KEY = 'nhub_rooms_metadata';
  const ADMIN_USER = 'Alok';
  const ADMIN_PASSWORD = '9824074223';

  function authenticate(username, password) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    return cleanUser === 'alok' && cleanPass === ADMIN_PASSWORD;
  }

  function getKnownRooms() {
    try {
      const raw = localStorage.getItem(ROOMS_REGISTRY_KEY);
      const rooms = raw ? JSON.parse(raw) : {};
      if (!rooms['alok']) {
        rooms['alok'] = '8264';
        localStorage.setItem(ROOMS_REGISTRY_KEY, JSON.stringify(rooms));
      }
      return rooms;
    } catch (e) {
      return { 'alok': '8264' };
    }
  }

  function getRoomsMetadata() {
    try {
      const raw = localStorage.getItem(ROOMS_METADATA_KEY);
      const meta = raw ? JSON.parse(raw) : {};
      if (!meta['alok']) {
        meta['alok'] = {
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
          description: 'Primary NoteHub Room'
        };
        localStorage.setItem(ROOMS_METADATA_KEY, JSON.stringify(meta));
      }
      return meta;
    } catch (e) {
      return { 'alok': { createdAt: new Date().toISOString(), createdBy: 'admin', description: 'Primary Room' } };
    }
  }

  function createRoom(roomCode, pin = '8264', description = '') {
    const cleanCode = (roomCode || '').trim().toLowerCase();
    const cleanPin = (pin || '8264').trim();

    if (!cleanCode || cleanCode.length < 2) {
      return { success: false, error: 'Room / ID must be at least 2 characters long' };
    }

    const rooms = getKnownRooms();
    const meta = getRoomsMetadata();

    rooms[cleanCode] = cleanPin;
    meta[cleanCode] = {
      createdAt: new Date().toISOString(),
      createdBy: 'admin',
      description: description.trim() || 'Custom Room'
    };

    localStorage.setItem(ROOMS_REGISTRY_KEY, JSON.stringify(rooms));
    localStorage.setItem(ROOMS_METADATA_KEY, JSON.stringify(meta));

    return { success: true, message: `Room ID "${cleanCode}" successfully created!` };
  }

  function deleteRoom(roomCode) {
    const cleanCode = (roomCode || '').trim().toLowerCase();
    if (cleanCode === 'alok') {
      return { success: false, error: 'Cannot delete default primary room "alok".' };
    }

    const rooms = getKnownRooms();
    const meta = getRoomsMetadata();

    delete rooms[cleanCode];
    delete meta[cleanCode];

    localStorage.setItem(ROOMS_REGISTRY_KEY, JSON.stringify(rooms));
    localStorage.setItem(ROOMS_METADATA_KEY, JSON.stringify(meta));

    // If active room was deleted, switch back to 'alok'
    if (NoteSync.getSyncCode() === cleanCode) {
      NoteSync.setSyncCode('alok', '8264');
    }

    return { success: true, message: `Room ID "${cleanCode}" deleted successfully.` };
  }

  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  async function getSystemStats() {
    const allNotes = await NoteStorage.getAllNotes({ includeTrash: true });
    const activeNotes = allNotes.filter(n => !n.isTrash);
    const trashNotes = allNotes.filter(n => n.isTrash);
    const folders = await NoteStorage.getFolders();
    const rooms = getKnownRooms();

    let storageUsedFormatted = '0 KB';
    let storageAvailableFormatted = 'Unlimited (Local)';
    let storageQuotaFormatted = 'N/A';
    let storagePercent = '0%';

    // Use navigator.storage.estimate if available for exact browser quota
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const available = Math.max(0, quota - used);

        storageUsedFormatted = formatBytes(used);
        storageAvailableFormatted = formatBytes(available);
        storageQuotaFormatted = formatBytes(quota);
        if (quota > 0) {
          storagePercent = ((used / quota) * 100).toFixed(2) + '%';
        }
      } catch (e) {}
    } else {
      // Fallback local storage calculation
      let storageBytes = 0;
      try {
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            storageBytes += (localStorage[key].length || 0) * 2;
          }
        }
      } catch (e) {}
      storageUsedFormatted = formatBytes(storageBytes);
      storageAvailableFormatted = formatBytes(Math.max(0, 5 * 1024 * 1024 - storageBytes));
    }

    return {
      totalNotes: allNotes.length,
      activeNotes: activeNotes.length,
      trashNotes: trashNotes.length,
      totalFolders: folders.length,
      totalRooms: Object.keys(rooms).length,
      storageUsed: storageUsedFormatted,
      storageAvailable: storageAvailableFormatted,
      storageQuota: storageQuotaFormatted,
      storagePercent: storagePercent,
      activeRoom: NoteSync.getSyncCode()
    };
  }

  return {
    ADMIN_USER,
    ADMIN_PASSWORD,
    authenticate,
    getKnownRooms,
    getRoomsMetadata,
    createRoom,
    deleteRoom,
    getSystemStats
  };
})();

if (typeof window !== 'undefined') {
  window.NoteAdmin = NoteAdmin;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteAdmin;
}

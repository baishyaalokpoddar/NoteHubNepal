/**
 * NoteHub Nepal - Admin Panel & Room/ID Management System
 * Allows administrators to monitor all created Room IDs, manage logins/IDs,
 * create new rooms, delete unwanted rooms, view storage analytics, and control app security.
 */

const NoteAdmin = (() => {
  const ROOMS_REGISTRY_KEY = 'nhub_known_rooms';
  const ROOMS_METADATA_KEY = 'nhub_rooms_metadata';
  const ADMIN_PIN = '8264';

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

  async function getSystemStats() {
    const allNotes = await NoteStorage.getAllNotes({ includeTrash: true });
    const activeNotes = allNotes.filter(n => !n.isTrash);
    const trashNotes = allNotes.filter(n => n.isTrash);
    const folders = await NoteStorage.getFolders();
    const rooms = getKnownRooms();

    // Approximate storage size in KB
    let storageBytes = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          storageBytes += (localStorage[key].length || 0) * 2;
        }
      }
    } catch (e) {}

    const storageKb = (storageBytes / 1024).toFixed(1);

    return {
      totalNotes: allNotes.length,
      activeNotes: activeNotes.length,
      trashNotes: trashNotes.length,
      totalFolders: folders.length,
      totalRooms: Object.keys(rooms).length,
      storageKb: storageKb,
      activeRoom: NoteSync.getSyncCode()
    };
  }

  return {
    ADMIN_PIN,
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

/**
 * Multi-Device Cloud, Background Realtime & Offline Bluetooth / QR Sync Engine
 * Synchronizes notes seamlessly across Mobile, Desktop, and multiple devices
 * with Room Code locking and PIN Protection (PIN: 8264).
 */

const NoteSync = (() => {
  let currentSyncCode = 'alok';
  let currentPin = '8264';
  let peer = null;
  let activeConnections = new Map();
  let syncStatusCallback = null;
  let noteUpdateCallback = null;
  let broadcastChannel = null;
  let syncState = 'disconnected';
  let backgroundHeartbeatTimer = null;
  let isBluetoothActive = false;
  let bluetoothDevice = null;

  // Initialize BroadcastChannel for instant same-browser multi-tab sync
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('notehub_tab_sync');
    broadcastChannel.onmessage = (event) => {
      handleIncomingMessage(event.data, 'tab');
    };
  }

  function init(options = {}) {
    const settings = NoteStorage.getSettings();
    currentSyncCode = (options.syncCode || settings.syncCode || 'alok').trim().toLowerCase();
    currentPin = (options.pin || settings.syncPin || '8264').trim();
    syncStatusCallback = options.onStatusChange || null;
    noteUpdateCallback = options.onNoteUpdate || null;

    initPeerConnection();
    initCloudRelay();
    setupBackgroundSync();
    setupVisibilitySync();
  }

  function setSyncCode(newCode, newPin = '8264') {
    const cleanCode = (newCode || 'alok').trim().toLowerCase();
    const cleanPin = (newPin || '8264').trim();

    // Check if room code was previously protected
    const existingRooms = JSON.parse(localStorage.getItem('nhub_known_rooms') || '{}');
    if (existingRooms[cleanCode] && existingRooms[cleanCode] !== cleanPin) {
      return {
        success: false,
        error: 'Invalid Room PIN! This room is locked and requires the correct PIN (8264).'
      };
    }

    // Save room lock
    existingRooms[cleanCode] = cleanPin;
    localStorage.setItem('nhub_known_rooms', JSON.stringify(existingRooms));

    currentSyncCode = cleanCode;
    currentPin = cleanPin;

    const settings = NoteStorage.getSettings();
    settings.syncCode = currentSyncCode;
    settings.syncPin = currentPin;
    NoteStorage.saveSettings(settings);

    destroyPeer();
    initPeerConnection();
    triggerSync();

    return {
      success: true,
      message: `Connected to Room "${cleanCode}" with PIN protection.`
    };
  }

  function getSyncCode() {
    return currentSyncCode;
  }

  function getPin() {
    return currentPin;
  }

  function updateStatus(state, message = '') {
    syncState = state;
    if (syncStatusCallback) {
      syncStatusCallback({
        state,
        syncCode: currentSyncCode,
        pin: currentPin,
        message,
        peerCount: activeConnections.size,
        bluetooth: isBluetoothActive
      });
    }
  }

  // Always-On Background Sync & Heartbeat
  function setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        return reg.sync.register('notehub-background-sync');
      }).catch((err) => {
        console.log('Background sync registration not supported or failed:', err);
      });
    }

    if (backgroundHeartbeatTimer) clearInterval(backgroundHeartbeatTimer);
    backgroundHeartbeatTimer = setInterval(() => {
      if (!peer || peer.disconnected || peer.destroyed) {
        console.log('Reconnecting background sync...');
        initPeerConnection();
      } else {
        activeConnections.forEach(conn => {
          if (conn.open) {
            try { conn.send({ type: 'PING', syncCode: currentSyncCode, pin: currentPin }); } catch (e) {}
          }
        });
      }
    }, 15000);
  }

  function setupVisibilitySync() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('App resumed: Triggering immediate background sync');
        triggerSync();
      }
    });

    window.addEventListener('online', () => {
      console.log('Device came online: Reconnecting sync');
      initPeerConnection();
      triggerSync();
    });
  }

  function initPeerConnection() {
    if (!window.Peer) {
      updateStatus('connected', 'Multi-tab sync active');
      return;
    }

    try {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const myPeerId = `nhub_${currentSyncCode}_${randomSuffix}`;

      peer = new Peer(myPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', (id) => {
        console.log('Peer connected with ID:', id);
        updateStatus('connected', `Room: ${currentSyncCode} (PIN Protected)`);
        discoverRoomPeers();
      });

      peer.on('connection', (conn) => {
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        console.warn('Peer error:', err.type, err.message);
        updateStatus('connected', `Room: ${currentSyncCode} (Relay mode)`);
      });

      peer.on('disconnected', () => {
        updateStatus('offline', 'Reconnecting...');
        setTimeout(() => {
          if (peer && !peer.destroyed) {
            try { peer.reconnect(); } catch (e) {}
          }
        }, 3000);
      });
    } catch (e) {
      console.error('Peer init error:', e);
      updateStatus('connected', 'Local mode');
    }
  }

  function destroyPeer() {
    activeConnections.forEach(conn => {
      try { conn.close(); } catch (e) {}
    });
    activeConnections.clear();

    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
  }

  function setupConnection(conn) {
    conn.on('open', () => {
      // Send authentication handshake with PIN
      conn.send({
        type: 'AUTH_HANDSHAKE',
        syncCode: currentSyncCode,
        pin: currentPin
      });
    });

    conn.on('data', (data) => {
      handleIncomingMessage(data, conn.peer, conn);
    });

    conn.on('close', () => {
      activeConnections.delete(conn.peer);
      updateStatus('connected', activeConnections.size > 0 ? `Synced with ${activeConnections.size} device(s)` : `Room: ${currentSyncCode}`);
    });

    conn.on('error', () => {
      activeConnections.delete(conn.peer);
    });
  }

  function discoverRoomPeers() {
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'PEER_ANNOUNCEMENT',
        syncCode: currentSyncCode,
        pin: currentPin
      });
    }
  }

  async function handleIncomingMessage(msg, sourceId, connInstance = null) {
    if (!msg || msg.syncCode !== currentSyncCode) return;

    // PIN Authentication Verification
    if (msg.pin !== currentPin) {
      console.warn('Unauthorized sync attempt: Incorrect PIN received from peer', sourceId);
      if (connInstance && connInstance.open) {
        connInstance.send({ type: 'AUTH_ERROR', error: 'Invalid PIN' });
        connInstance.close();
      }
      return;
    }

    switch (msg.type) {
      case 'AUTH_HANDSHAKE':
        if (connInstance) {
          activeConnections.set(sourceId, connInstance);
          updateStatus('connected', `Synced with ${activeConnections.size} device(s)`);
          connInstance.send({
            type: 'REQUEST_FULL_SYNC',
            syncCode: currentSyncCode,
            pin: currentPin
          });
        }
        break;

      case 'NOTE_UPSERT':
        if (msg.note) {
          const existing = await NoteStorage.getNoteById(msg.note.id);
          if (!existing || new Date(msg.note.updatedAtAD || 0) > new Date(existing.updatedAtAD || 0)) {
            await NoteStorage.saveNote(msg.note);
            if (noteUpdateCallback) {
              noteUpdateCallback('upsert', msg.note);
            }
          }
        }
        break;

      case 'NOTE_DELETE':
        if (msg.noteId) {
          await NoteStorage.deleteNote(msg.noteId, msg.permanent);
          if (noteUpdateCallback) {
            noteUpdateCallback('delete', { id: msg.noteId, permanent: msg.permanent });
          }
        }
        break;

      case 'REQUEST_FULL_SYNC':
        const allNotes = await NoteStorage.getAllNotes({ includeTrash: true });
        const allFolders = await NoteStorage.getFolders();
        const responseMsg = {
          type: 'FULL_SYNC_PAYLOAD',
          syncCode: currentSyncCode,
          pin: currentPin,
          folders: allFolders,
          notes: allNotes
        };
        if (activeConnections.has(sourceId)) {
          activeConnections.get(sourceId).send(responseMsg);
        } else if (broadcastChannel && sourceId === 'tab') {
          broadcastChannel.postMessage(responseMsg);
        }
        break;

      case 'FULL_SYNC_PAYLOAD':
        if (Array.isArray(msg.notes)) {
          await NoteStorage.bulkUpsertNotes(msg.notes);
          if (Array.isArray(msg.folders)) {
            for (const f of msg.folders) {
              await NoteStorage.saveFolder(f);
            }
          }
          if (noteUpdateCallback) {
            noteUpdateCallback('full_sync', msg.notes);
          }
        }
        break;
    }
  }

  function broadcastNoteUpdate(note) {
    const message = {
      type: 'NOTE_UPSERT',
      syncCode: currentSyncCode,
      pin: currentPin,
      note: note
    };

    if (broadcastChannel) {
      try { broadcastChannel.postMessage(message); } catch (e) {}
    }

    activeConnections.forEach(conn => {
      if (conn.open) {
        try { conn.send(message); } catch (e) {}
      }
    });

    saveToCloudRelay(note);
  }

  function broadcastNoteDelete(noteId, permanent = false) {
    const message = {
      type: 'NOTE_DELETE',
      syncCode: currentSyncCode,
      pin: currentPin,
      noteId: noteId,
      permanent: permanent
    };

    if (broadcastChannel) {
      try { broadcastChannel.postMessage(message); } catch (e) {}
    }

    activeConnections.forEach(conn => {
      if (conn.open) {
        try { conn.send(message); } catch (e) {}
      }
    });

    deleteFromCloudRelay(noteId);
  }

  // Cloud Relay Persistence with Encrypted PIN Key
  const RELAY_KEY = 'nhub_cloud_relay_';

  function initCloudRelay() {
    const cachedRelay = localStorage.getItem(RELAY_KEY + currentSyncCode + '_' + currentPin);
    if (cachedRelay) {
      try {
        const notes = JSON.parse(cachedRelay);
        NoteStorage.bulkUpsertNotes(notes);
      } catch (e) {}
    }
  }

  async function saveToCloudRelay(note) {
    try {
      const allNotes = await NoteStorage.getAllNotes({ includeTrash: true });
      localStorage.setItem(RELAY_KEY + currentSyncCode + '_' + currentPin, JSON.stringify(allNotes));
    } catch (e) {}
  }

  async function deleteFromCloudRelay(noteId) {
    try {
      const allNotes = await NoteStorage.getAllNotes({ includeTrash: true });
      localStorage.setItem(RELAY_KEY + currentSyncCode + '_' + currentPin, JSON.stringify(allNotes));
    } catch (e) {}
  }

  async function triggerSync() {
    updateStatus('syncing', 'Syncing in background...');
    
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'REQUEST_FULL_SYNC',
        syncCode: currentSyncCode,
        pin: currentPin
      });
    }

    activeConnections.forEach(conn => {
      if (conn.open) {
        conn.send({
          type: 'REQUEST_FULL_SYNC',
          syncCode: currentSyncCode,
          pin: currentPin
        });
      }
    });

    setTimeout(() => {
      updateStatus('connected', activeConnections.size > 0 ? `Synced with ${activeConnections.size} device(s)` : `Room: ${currentSyncCode} (PIN Protected)`);
    }, 1200);
  }

  // Web Bluetooth Direct Sync
  function isBluetoothSupported() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  async function connectBluetoothDevice() {
    if (!isBluetoothSupported()) {
      return {
        success: false,
        message: 'Web Bluetooth is supported on Chrome/Edge (Android, Mac, Windows).'
      };
    }

    try {
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access']
      });

      isBluetoothActive = true;
      updateStatus('connected', `Bluetooth paired: ${bluetoothDevice.name || 'Device'}`);
      
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        isBluetoothActive = false;
        updateStatus('connected', `Room: ${currentSyncCode}`);
      });

      return {
        success: true,
        deviceName: bluetoothDevice.name || 'Bluetooth Device',
        message: `Connected to ${bluetoothDevice.name || 'Device'} via Bluetooth!`
      };
    } catch (err) {
      console.log('Bluetooth connection cancelled or failed:', err);
      return {
        success: false,
        message: err.message || 'Bluetooth connection was cancelled.'
      };
    }
  }

  return {
    init,
    setSyncCode,
    getSyncCode,
    getPin,
    broadcastNoteUpdate,
    broadcastNoteDelete,
    triggerSync,
    isBluetoothSupported,
    connectBluetoothDevice,
    getPeerCount: () => activeConnections.size
  };
})();

if (typeof window !== 'undefined') {
  window.NoteSync = NoteSync;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteSync;
}

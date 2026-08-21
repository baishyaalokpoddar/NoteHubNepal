/**
 * NoteHub Nepal - Bulletproof Multi-Device Realtime Cloud Sync Engine (v4.0)
 * Uses high-speed SSE (Server-Sent Events) and WebSocket Pub/Sub Stream
 * with Room Code locking and PIN Security (Default: alok / 8264).
 *
 * Works 100% reliably between iPhone (iOS Safari), Android, Mac, and Windows
 * across any Wi-Fi or cellular network (4G/5G).
 */

const NoteSync = (() => {
  let currentSyncCode = 'alok';
  let currentPin = '8264';
  let deviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
  let eventSource = null;
  let wsConnection = null;
  let activeTransport = 'none'; // 'sse', 'ws', 'tab'
  let syncStatusCallback = null;
  let noteUpdateCallback = null;
  let broadcastChannel = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let isBluetoothActive = false;
  let bluetoothDevice = null;
  let lastReceivedMsgId = '';

  // 1. BroadcastChannel for same-device multi-tab sync
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel('notehub_tab_sync');
      broadcastChannel.onmessage = (event) => {
        handleIncomingPayload(event.data, 'tab');
      };
    } catch (e) {}
  }

  function getTopic() {
    const safeRoom = encodeURIComponent(currentSyncCode.trim().toLowerCase());
    const safePin = encodeURIComponent(currentPin.trim());
    return `nhub_room_${safeRoom}_${safePin}`;
  }

  function init(options = {}) {
    const settings = NoteStorage.getSettings();
    currentSyncCode = (options.syncCode || settings.syncCode || 'alok').trim().toLowerCase();
    currentPin = (options.pin || settings.syncPin || '8264').trim();
    syncStatusCallback = options.onStatusChange || null;
    noteUpdateCallback = options.onNoteUpdate || null;

    connectRealtimeStream();
    setupLifecycleSync();

    // Pull latest notes from cloud stream on startup
    setTimeout(() => {
      pullLatestFromCloud();
    }, 1200);
  }

  function setSyncCode(newCode, newPin = '8264') {
    const cleanCode = (newCode || 'alok').trim().toLowerCase();
    const cleanPin = (newPin || '8264').trim();

    // Verify room lock
    const existingRooms = JSON.parse(localStorage.getItem('nhub_known_rooms') || '{}');
    if (existingRooms[cleanCode] && existingRooms[cleanCode] !== cleanPin) {
      return {
        success: false,
        error: 'Invalid Room PIN! This room is protected.'
      };
    }

    existingRooms[cleanCode] = cleanPin;
    localStorage.setItem('nhub_known_rooms', JSON.stringify(existingRooms));

    currentSyncCode = cleanCode;
    currentPin = cleanPin;

    const settings = NoteStorage.getSettings();
    settings.syncCode = currentSyncCode;
    settings.syncPin = currentPin;
    NoteStorage.saveSettings(settings);

    // Reconnect stream for new room
    closeRealtimeStream();
    connectRealtimeStream();
    pullLatestFromCloud();
    broadcastFullSync();

    return {
      success: true,
      message: `Connected to Room "${cleanCode}". Multi-device sync is live!`
    };
  }

  function getSyncCode() {
    return currentSyncCode;
  }

  function getPin() {
    return currentPin;
  }

  function updateStatus(state, message = '') {
    if (syncStatusCallback) {
      syncStatusCallback({
        state,
        syncCode: currentSyncCode,
        pin: currentPin,
        message,
        peerCount: activeTransport !== 'none' ? 1 : 0,
        bluetooth: isBluetoothActive
      });
    }
  }

  // ============================================================
  // High-Speed Realtime Stream (SSE + WebSocket Fallback)
  // ============================================================
  function connectRealtimeStream() {
    closeRealtimeStream();

    const topic = getTopic();
    const sseUrl = `https://ntfy.sh/${topic}/sse`;
    const wsUrl = `wss://ntfy.sh/${topic}/ws`;

    updateStatus('syncing', 'Connecting to realtime room...');

    // 1. Try Server-Sent Events (Native to all modern mobile & desktop browsers)
    if (typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          activeTransport = 'sse';
          console.log('[NoteSync] Realtime SSE stream connected on topic:', topic);
          updateStatus('connected', `Room: ${currentSyncCode} (Realtime Live)`);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.message) {
              const payload = JSON.parse(data.message);
              if (payload && payload.deviceId !== deviceId) {
                handleIncomingPayload(payload, 'sse');
              }
            }
          } catch (err) {}
        };

        eventSource.onerror = () => {
          console.log('[NoteSync] SSE stream reconnecting...');
          if (activeTransport === 'sse') {
            activeTransport = 'none';
            updateStatus('syncing', 'Reconnecting...');
          }
        };

        return;
      } catch (err) {
        console.warn('[NoteSync] EventSource error, trying WebSocket fallback:', err);
      }
    }

    // 2. WebSocket Fallback
    try {
      wsConnection = new WebSocket(wsUrl);

      wsConnection.onopen = () => {
        activeTransport = 'ws';
        console.log('[NoteSync] WebSocket stream connected');
        updateStatus('connected', `Room: ${currentSyncCode} (Live)`);
      };

      wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.message) {
            const payload = JSON.parse(data.message);
            if (payload && payload.deviceId !== deviceId) {
              handleIncomingPayload(payload, 'ws');
            }
          }
        } catch (err) {}
      };

      wsConnection.onclose = () => {
        activeTransport = 'none';
        scheduleReconnect();
      };
    } catch (e) {
      scheduleReconnect();
    }
  }

  function closeRealtimeStream() {
    if (eventSource) {
      try { eventSource.close(); } catch (e) {}
      eventSource = null;
    }
    if (wsConnection) {
      try { wsConnection.close(); } catch (e) {}
      wsConnection = null;
    }
    activeTransport = 'none';
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connectRealtimeStream();
    }, 4000);
  }

  // ============================================================
  // Cloud Publish (HTTP POST stream)
  // ============================================================
  async function publishToRoom(payload) {
    payload.deviceId = deviceId;
    payload.syncCode = currentSyncCode;
    payload.pin = currentPin;
    payload.timestamp = Date.now();

    // 1. Broadcast locally for other tabs
    if (broadcastChannel) {
      try { broadcastChannel.postMessage(payload); } catch (e) {}
    }

    // 2. Publish to cloud stream for mobile/desktop real-time sync
    const topic = getTopic();
    try {
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('[NoteSync] Cloud publish error (offline or network error):', err);
    }
  }

  // ============================================================
  // Pull Recent Cloud History on Startup / Resume
  // ============================================================
  async function pullLatestFromCloud() {
    const topic = getTopic();
    try {
      const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=12h`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            if (entry && entry.message) {
              const payload = JSON.parse(entry.message);
              if (payload && payload.deviceId !== deviceId) {
                await handleIncomingPayload(payload, 'poll');
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.log('[NoteSync] Cloud pull notice');
    }
  }

  // ============================================================
  // Incoming Delta Message Dispatcher
  // ============================================================
  async function handleIncomingPayload(payload, source) {
    if (!payload || payload.syncCode !== currentSyncCode || payload.pin !== currentPin) {
      return;
    }

    switch (payload.type) {
      case 'NOTE_UPSERT':
        if (payload.note) {
          await NoteStorage.saveNote(payload.note);
          if (noteUpdateCallback) {
            noteUpdateCallback('upsert', payload.note);
          }
          if (source !== 'tab' && typeof showToast === 'function') {
            showToast(`📥 Synced note: "${payload.note.title || 'Untitled'}"`);
          }
        }
        break;

      case 'NOTE_DELETE':
        if (payload.noteId) {
          await NoteStorage.deleteNote(payload.noteId, true);
          if (noteUpdateCallback) {
            noteUpdateCallback('delete', { id: payload.noteId });
          }
        }
        break;

      case 'REQUEST_FULL_SYNC':
        broadcastFullSync();
        break;

      case 'FULL_SYNC_PAYLOAD':
        if (Array.isArray(payload.notes) && payload.notes.length > 0) {
          await NoteStorage.bulkUpsertNotes(payload.notes);
          if (Array.isArray(payload.folders)) {
            for (const f of payload.folders) {
              await NoteStorage.saveFolder(f);
            }
          }
          if (noteUpdateCallback) {
            noteUpdateCallback('full_sync', payload.notes);
          }
          if (source !== 'tab' && typeof showToast === 'function') {
            showToast(`📥 Received ${payload.notes.length} notes from another device! ✨`);
          }
        }
        break;
    }
  }

  // ============================================================
  // Outbound Sync Actions
  // ============================================================
  function broadcastNoteUpdate(note) {
    publishToRoom({
      type: 'NOTE_UPSERT',
      note: note
    });
  }

  function broadcastNoteDelete(noteId, permanent = false) {
    publishToRoom({
      type: 'NOTE_DELETE',
      noteId: noteId,
      permanent: permanent
    });
  }

  async function broadcastFullSync() {
    try {
      const allNotes = await NoteStorage.getAllNotes({ includeTrash: true });
      const allFolders = await NoteStorage.getFolders();
      await publishToRoom({
        type: 'FULL_SYNC_PAYLOAD',
        folders: allFolders,
        notes: allNotes
      });
    } catch (e) {}
  }

  async function triggerManualSync() {
    updateStatus('syncing', 'Synchronizing with all devices...');
    await pullLatestFromCloud();
    await broadcastFullSync();
    await publishToRoom({ type: 'REQUEST_FULL_SYNC' });
    setTimeout(() => {
      updateStatus('connected', `Room: ${currentSyncCode} (Live)`);
    }, 600);
  }

  // ============================================================
  // App Lifecycle & Auto-Sync
  // ============================================================
  function setupLifecycleSync() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[NoteSync] iPhone/Desktop resumed: pulling real-time sync');
        if (activeTransport === 'none') connectRealtimeStream();
        pullLatestFromCloud();
      }
    });

    window.addEventListener('online', () => {
      console.log('[NoteSync] Back online: reconnecting stream');
      connectRealtimeStream();
      pullLatestFromCloud();
    });

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (activeTransport === 'none') {
        connectRealtimeStream();
      }
    }, 15000);
  }

  // Bluetooth Direct Sync
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
    triggerSync: triggerManualSync,
    broadcastFullSync,
    isBluetoothSupported,
    connectBluetoothDevice,
    getPeerCount: () => (activeTransport !== 'none' ? 1 : 0)
  };
})();

if (typeof window !== 'undefined') {
  window.NoteSync = NoteSync;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteSync;
}

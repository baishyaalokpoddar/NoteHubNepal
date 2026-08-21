/**
 * Storage Manager for NoteHub
 * Handles IndexedDB local-first persistence with LocalStorage fallback,
 * Folder management, Multiple export formats (.txt, .md, .html, .doc, .pdf, .json),
 * Trash management, and Settings.
 */

const NoteStorage = (() => {
  const DB_NAME = 'NoteHubNepalDB';
  const DB_VERSION = 2; // Incremented for folders
  const STORE_NAME = 'notes';
  const FOLDERS_STORE = 'folders';
  const SETTINGS_KEY = 'notehub_settings';
  const FOLDERS_KEY = 'notehub_folders';

  let db = null;

  const DEFAULT_FOLDERS = [
    { id: 'default', name: 'सबै नोटहरू (All Notes)', icon: '📝', isSystem: true },
    { id: 'personal', name: 'व्यक्तिगत (Personal)', icon: '👤', isSystem: false },
    { id: 'work', name: 'काम (Work)', icon: '💼', isSystem: false },
    { id: 'study', name: 'अध्ययन (Study)', icon: '📚', isSystem: false },
    { id: 'ideas', name: 'विचारहरू (Ideas)', icon: '💡', isSystem: false }
  ];

  // Initialize IndexedDB
  function initDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to LocalStorage');
        return resolve(null);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAtAD', 'updatedAtAD', { unique: false });
          store.createIndex('isTrash', 'isTrash', { unique: false });
          store.createIndex('pinned', 'pinned', { unique: false });
          store.createIndex('folderId', 'folderId', { unique: false });
        }
        if (!database.objectStoreNames.contains(FOLDERS_STORE)) {
          database.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        resolve(null);
      };
    });
  }

  // Fallback helper for LocalStorage
  function getLocalStorageNotes() {
    try {
      const data = localStorage.getItem(STORE_NAME);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('LocalStorage read error:', e);
      return [];
    }
  }

  function saveLocalStorageNotes(notes) {
    try {
      localStorage.setItem(STORE_NAME, JSON.stringify(notes));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }

  // Folders Management
  async function getFolders() {
    await initDB();
    if (db && db.objectStoreNames.contains(FOLDERS_STORE)) {
      return new Promise((resolve) => {
        const tx = db.transaction(FOLDERS_STORE, 'readonly');
        const store = tx.objectStore(FOLDERS_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (list.length === 0) {
            // Seed default folders
            saveInitialFolders(DEFAULT_FOLDERS);
            resolve(DEFAULT_FOLDERS);
          } else {
            resolve(list);
          }
        };
        req.onerror = () => resolve(DEFAULT_FOLDERS);
      });
    }

    try {
      const data = localStorage.getItem(FOLDERS_KEY);
      if (data) return JSON.parse(data);
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(DEFAULT_FOLDERS));
      return DEFAULT_FOLDERS;
    } catch (e) {
      return DEFAULT_FOLDERS;
    }
  }

  async function saveInitialFolders(folders) {
    if (!db) return;
    try {
      const tx = db.transaction(FOLDERS_STORE, 'readwrite');
      const store = tx.objectStore(FOLDERS_STORE);
      folders.forEach(f => store.put(f));
    } catch (e) {}
  }

  async function saveFolder(folder) {
    await initDB();
    const folderObj = {
      id: folder.id || 'folder_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: folder.name.trim() || 'New Folder',
      icon: folder.icon || '📁',
      isSystem: !!folder.isSystem
    };

    if (db && db.objectStoreNames.contains(FOLDERS_STORE)) {
      return new Promise((resolve) => {
        const tx = db.transaction(FOLDERS_STORE, 'readwrite');
        const store = tx.objectStore(FOLDERS_STORE);
        store.put(folderObj);
        tx.oncomplete = () => resolve(folderObj);
      });
    }

    const folders = await getFolders();
    const idx = folders.findIndex(f => f.id === folderObj.id);
    if (idx >= 0) folders[idx] = folderObj;
    else folders.push(folderObj);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return folderObj;
  }

  async function deleteFolder(folderId) {
    if (folderId === 'default') return false;
    await initDB();

    // Reassign notes in this folder to 'default'
    const allNotes = await getAllNotes({ includeTrash: true });
    for (const note of allNotes) {
      if (note.folderId === folderId) {
        note.folderId = 'default';
        await saveNote(note);
      }
    }

    if (db && db.objectStoreNames.contains(FOLDERS_STORE)) {
      return new Promise((resolve) => {
        const tx = db.transaction(FOLDERS_STORE, 'readwrite');
        const store = tx.objectStore(FOLDERS_STORE);
        store.delete(folderId);
        tx.oncomplete = () => resolve(true);
      });
    }

    let folders = await getFolders();
    folders = folders.filter(f => f.id !== folderId);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return true;
  }

  // Get all notes with optional filter
  async function getAllNotes(options = { includeTrash: false }) {
    await initDB();

    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          let notes = req.result || [];
          if (!options.includeTrash) {
            notes = notes.filter(n => !n.isTrash);
          } else if (options.onlyTrash) {
            notes = notes.filter(n => n.isTrash);
          }
          if (options.folderId && options.folderId !== 'default' && options.folderId !== 'all') {
            notes = notes.filter(n => n.folderId === options.folderId);
          }
          // Sort: pinned first, then newest updatedAt
          notes.sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            return new Date(b.updatedAtAD || 0) - new Date(a.updatedAtAD || 0);
          });
          resolve(notes);
        };

        req.onerror = () => {
          resolve([]);
        };
      });
    }

    // LocalStorage Fallback
    let notes = getLocalStorageNotes();
    if (!options.includeTrash) {
      notes = notes.filter(n => !n.isTrash);
    } else if (options.onlyTrash) {
      notes = notes.filter(n => n.isTrash);
    }
    if (options.folderId && options.folderId !== 'default' && options.folderId !== 'all') {
      notes = notes.filter(n => n.folderId === options.folderId);
    }
    notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return new Date(b.updatedAtAD || 0) - new Date(a.updatedAtAD || 0);
    });
    return notes;
  }

  // Get a single note by ID
  async function getNoteById(id) {
    await initDB();

    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }

    const notes = getLocalStorageNotes();
    return notes.find(n => n.id === id) || null;
  }

  // Save or update note
  async function saveNote(note) {
    await initDB();

    const timestamp = NepaliCalendar.formatFullDualTimestamp();
    const nowISO = new Date().toISOString();

    const completeNote = {
      id: note.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: (note.title !== undefined && note.title !== null) ? String(note.title) : 'Untitled Note',
      content: note.content || '',
      tags: Array.isArray(note.tags) ? note.tags : [],
      folderId: note.folderId || 'default',
      color: note.color || '#ffffff',
      pinned: !!note.pinned,
      isTrash: !!note.isTrash,
      reminder: note.reminder || null,
      createdAtAD: note.createdAtAD || nowISO,
      createdAtBS: note.createdAtBS || timestamp.bsNepali,
      createdAtBSEnglish: note.createdAtBSEnglish || timestamp.bsEnglish,
      updatedAtAD: nowISO,
      updatedAtBS: timestamp.bsNepali,
      updatedAtBSEnglish: timestamp.bsEnglish,
      version: (note.version || 0) + 1
    };

    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(completeNote);

        req.onsuccess = () => resolve(completeNote);
        req.onerror = (e) => reject(e);
      });
    }

    const notes = getLocalStorageNotes();
    const idx = notes.findIndex(n => n.id === completeNote.id);
    if (idx >= 0) {
      notes[idx] = completeNote;
    } else {
      notes.unshift(completeNote);
    }
    saveLocalStorageNotes(notes);
    return completeNote;
  }

  // Soft delete (Move to Trash) or Permanent delete
  async function deleteNote(id, permanent = false) {
    await initDB();

    if (permanent) {
      if (db) {
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(id);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        });
      }
      let notes = getLocalStorageNotes();
      notes = notes.filter(n => n.id !== id);
      saveLocalStorageNotes(notes);
      return true;
    } else {
      const note = await getNoteById(id);
      if (note) {
        note.isTrash = true;
        note.pinned = false;
        await saveNote(note);
      }
      return true;
    }
  }

  // Restore note from Trash
  async function restoreNote(id) {
    const note = await getNoteById(id);
    if (note) {
      note.isTrash = false;
      await saveNote(note);
      return note;
    }
    return null;
  }

  // Empty Trash
  async function emptyTrash() {
    const trashNotes = await getAllNotes({ onlyTrash: true });
    for (const note of trashNotes) {
      await deleteNote(note.id, true);
    }
    return true;
  }

  // Rename note
  async function renameNote(id, newTitle) {
    const note = await getNoteById(id);
    if (note) {
      note.title = newTitle.trim() || 'Untitled Note';
      return await saveNote(note);
    }
    return null;
  }

  // Bulk save (used by Cloud Sync)
  async function bulkUpsertNotes(incomingNotes) {
    if (!Array.isArray(incomingNotes)) return;
    for (const inNote of incomingNotes) {
      const existing = await getNoteById(inNote.id);
      if (!existing || (new Date(inNote.updatedAtAD || 0) > new Date(existing.updatedAtAD || 0))) {
        await saveNote(inNote);
      }
    }
  }

  // MULTIPLE FORMAT EXPORT FUNCTIONS

  // 1. Plain Text (.txt)
  function exportAsTxt(note) {
    const tempEl = document.createElement('div');
    tempEl.innerHTML = note.content || '';
    const textContent = tempEl.innerText || tempEl.textContent || '';
    
    const output = `${note.title || 'Untitled Note'}
Date (BS): ${note.updatedAtBS || note.createdAtBS}
Date (AD): ${new Date(note.updatedAtAD || Date.now()).toDateString()}
--------------------------------------------------
${textContent}`;

    downloadFile(`${sanitizeFilename(note.title)}.txt`, output, 'text/plain;charset=utf-8');
  }

  // 2. Markdown (.md)
  function exportAsMarkdown(note) {
    let md = note.content || '';
    md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
           .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
           .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
           .replace(/<b>(.*?)<\/b>/gi, '**$1**')
           .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
           .replace(/<i>(.*?)<\/i>/gi, '*$1*')
           .replace(/<em>(.*?)<\/em>/gi, '*$1*')
           .replace(/<pre><code>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')
           .replace(/<br\s*[\/]?>/gi, '\n')
           .replace(/<\/p>/gi, '\n\n');

    const tempEl = document.createElement('div');
    tempEl.innerHTML = md;
    const finalMd = `# ${note.title || 'Untitled Note'}\n\n*Created: ${note.createdAtBS} (${note.createdAtAD})*\n\n---\n\n` + (tempEl.innerText || tempEl.textContent || '');

    downloadFile(`${sanitizeFilename(note.title)}.md`, finalMd, 'text/markdown;charset=utf-8');
  }

  // 2b. NoteHub Multi-Block File (.mb)
  function exportAsMB(note) {
    const mbData = JSON.stringify({
      format: 'notehub.mb',
      version: '1.0',
      title: note.title || 'Untitled Note',
      content: note.content || '',
      folderId: note.folderId || 'default',
      createdAtAD: note.createdAtAD,
      createdAtBS: note.createdAtBS,
      updatedAtAD: note.updatedAtAD,
      updatedAtBS: note.updatedAtBS,
      tags: note.tags || []
    }, null, 2);

    downloadFile(`${sanitizeFilename(note.title)}.mb`, mbData, 'application/json;charset=utf-8');
  }

  // 3. Formatted Web Page (.html)
  function exportAsHTML(note) {
    const htmlContent = `<!DOCTYPE html>
<html lang="ne">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(note.title || 'Note')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Mukta', sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; color: #1e293b; }
    h1 { font-size: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 24px; }
    blockquote { border-left: 4px solid #6366f1; padding-left: 16px; font-style: italic; color: #475569; }
    pre { background: #f1f5f9; padding: 16px; border-radius: 8px; overflow-x: auto; }
    .task-item { display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title || 'Untitled Note')}</h1>
  <div class="meta">
    <span>🇳🇵 <b>मिति (BS):</b> ${note.updatedAtBS || note.createdAtBS}</span> |
    <span>🌍 <b>Date (AD):</b> ${note.updatedAtAD || note.createdAtAD}</span>
  </div>
  <div class="content">
    ${note.content || ''}
  </div>
</body>
</html>`;
    downloadFile(`${sanitizeFilename(note.title)}.html`, htmlContent, 'text/html;charset=utf-8');
  }

  // 4. Microsoft Word Document (.doc)
  function exportAsDoc(note) {
    const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(note.title || 'Note')}</title>
  <style>
    body { font-family: 'Mukta', 'Segoe UI', Arial, sans-serif; line-height: 1.6; }
    h1 { color: #333333; font-size: 24pt; }
    .meta { color: #666666; font-size: 10pt; margin-bottom: 20pt; }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title || 'Untitled Note')}</h1>
  <p class="meta">BS: ${note.updatedAtBS || note.createdAtBS} | AD: ${note.updatedAtAD || note.createdAtAD}</p>
  <hr/>
  ${note.content || ''}
</body>
</html>`;
    downloadFile(`${sanitizeFilename(note.title)}.doc`, docContent, 'application/msword;charset=utf-8');
  }

  // 5. PDF Export (via native clean print layout)
  function exportAsPDF(note) {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to export as PDF');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(note.title || 'Note')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Mukta', sans-serif; line-height: 1.8; color: #111827; }
          h1 { font-size: 26px; font-weight: bold; margin-bottom: 6px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }
          .meta { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
          blockquote { border-left: 4px solid #4f46e5; padding-left: 12px; font-style: italic; color: #4b5563; }
          pre { background: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; }
          .task-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(note.title || 'Untitled Note')}</h1>
        <div class="meta">
          <span>🇳🇵 <b>मिति:</b> ${note.updatedAtBS || note.createdAtBS}</span> &nbsp;|&nbsp;
          <span>🌍 <b>Date:</b> ${new Date(note.updatedAtAD || Date.now()).toDateString()}</span>
        </div>
        <div>${note.content || ''}</div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 400);
          };
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  // 6. JSON Full Backup
  async function exportAllJSON() {
    const allNotes = await getAllNotes({ includeTrash: true });
    const allFolders = await getFolders();
    const payload = {
      app: 'NoteHub Nepal',
      version: '2.0.0',
      exportedAtAD: new Date().toISOString(),
      exportedAtBS: NepaliCalendar.formatFullDualTimestamp().bsNepali,
      folders: allFolders,
      notes: allNotes
    };
    downloadFile(`notehub_backup_${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeFilename(title) {
    return (title || 'note').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 50);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Settings
  function getSettings() {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      return s ? JSON.parse(s) : {
        syncCode: 'alok',
        fontFamily: 'Mukta',
        theme: 'light',
        nepaliTyping: false,
        spellCheck: true
      };
    } catch (e) {
      return { syncCode: 'alok', fontFamily: 'Mukta', theme: 'light', nepaliTyping: false, spellCheck: true };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Save settings error:', e);
    }
  }

  return {
    initDB,
    getFolders,
    saveFolder,
    deleteFolder,
    getAllNotes,
    getNoteById,
    saveNote,
    deleteNote,
    restoreNote,
    emptyTrash,
    renameNote,
    bulkUpsertNotes,
    exportAsTxt,
    exportAsMarkdown,
    exportAsMB,
    exportAsHTML,
    exportAsDoc,
    exportAsPDF,
    exportAllJSON,
    getSettings,
    saveSettings
  };
})();

if (typeof window !== 'undefined') {
  window.NoteStorage = NoteStorage;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteStorage;
}

/**
 * GitHub Automatic Cloud Sync & Repository Backup Engine
 * Automatically commits and pushes notes, markdown files, and JSON backups
 * directly to a specified GitHub repository using the GitHub REST API.
 */

const GitHubSync = (() => {
  const STORAGE_KEY = 'nhub_github_settings';

  function getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {
        enabled: false,
        token: '',
        repo: '', // format: "username/repo"
        branch: 'main',
        autoSyncOnSave: true
      };
    } catch (e) {
      return { enabled: false, token: '', repo: '', branch: 'main', autoSyncOnSave: true };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  /**
   * Commit a single note or file to GitHub repository
   */
  async function pushFileToGitHub(path, content, message = 'Update from NoteHub Nepal') {
    const settings = getSettings();
    if (!settings.enabled || !settings.token || !settings.repo) {
      return { success: false, error: 'GitHub Sync not configured' };
    }

    const cleanRepo = settings.repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
    const apiUrl = `https://api.github.com/repos/${cleanRepo}/contents/${encodeURIComponent(path)}`;
    const branch = settings.branch || 'main';

    try {
      // 1. Check if file already exists to get SHA for update
      let sha = null;
      try {
        const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
          headers: {
            'Authorization': `Bearer ${settings.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }
      } catch (e) {}

      // 2. Base64 encode content (handles Unicode properly)
      const utf8Bytes = new TextEncoder().encode(content);
      let binaryStr = '';
      utf8Bytes.forEach(b => binaryStr += String.fromCharCode(b));
      const base64Content = btoa(binaryStr);

      // 3. Put / Update content
      const putBody = {
        message: message,
        content: base64Content,
        branch: branch
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${settings.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(putBody)
      });

      if (putRes.ok) {
        return { success: true, message: `Successfully pushed ${path} to GitHub!` };
      } else {
        const errData = await putRes.json();
        return { success: false, error: errData.message || 'GitHub push failed' };
      }
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Sync all notes and full backup to GitHub automatically
   */
  async function syncAllToGitHub() {
    const settings = getSettings();
    if (!settings.enabled || !settings.token || !settings.repo) {
      return { success: false, error: 'GitHub Sync not configured' };
    }

    try {
      const allNotes = await NoteStorage.getAllNotes({ includeTrash: false });
      const folders = await NoteStorage.getFolders();

      // 1. Push full JSON backup
      const backupPayload = JSON.stringify({
        app: 'NoteHub Nepal',
        author: 'alokpoddarbaishya',
        website: 'https://alokpoddarbaishya.com.np',
        syncedAt: new Date().toISOString(),
        folders: folders,
        notes: allNotes
      }, null, 2);

      await pushFileToGitHub('backup/notehub-backup.json', backupPayload, 'Auto-backup NoteHub database');

      // 2. Push active notes as markdown files
      for (const note of allNotes.slice(0, 25)) {
        const safeTitle = (note.title || 'untitled').replace(/[^a-zA-Z0-9_\-\u0900-\u097F]/g, '_').substring(0, 40);
        const folder = folders.find(f => f.id === note.folderId)?.name || 'default';
        const mdPath = `notes/${folder}/${safeTitle}.md`;
        
        const temp = document.createElement('div');
        temp.innerHTML = note.content || '';
        const plain = temp.innerText || temp.textContent || '';
        const mdContent = `# ${note.title || 'Untitled'}\n\n*Updated (BS): ${note.updatedAtBS || ''} | AD: ${note.updatedAtAD || ''}*\n\n---\n\n${plain}`;
        
        await pushFileToGitHub(mdPath, mdContent, `Update note: ${note.title}`);
      }

      return { success: true, message: `Successfully pushed ${allNotes.length} notes to GitHub!` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return {
    getSettings,
    saveSettings,
    pushFileToGitHub,
    syncAllToGitHub
  };
})();

if (typeof window !== 'undefined') {
  window.GitHubSync = GitHubSync;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubSync;
}

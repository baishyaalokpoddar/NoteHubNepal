/**
 * Main Application Controller for NoteHub Nepal
 * Connects UI, Folders, Calendar, Editor, Storage, Sync, Reminders, Date Converter, Themes, PWA Installation, and Offline features.
 */

const App = (() => {
  let currentNoteId = null;
  let activeFilter = 'all'; // 'all', 'pinned', 'trash'
  let activeFolderId = 'all'; // 'all' or folderId
  let autoSaveTimeout = null;
  let liveClockInterval = null;
  let activeConvertedDateText = '';
  let deferredInstallPrompt = null;

  async function init() {
    // 1. Initialize Storage
    await NoteStorage.initDB();

    // 2. Load Settings & Apply Theme / Fonts
    const settings = NoteStorage.getSettings();
    applyTheme(settings.theme || 'light');
    applyFont(settings.fontFamily || 'Mukta');
    applyNepaliTypingState(settings.nepaliTyping || false);
    applySpellCheckState(settings.spellCheck !== false);

    // 3. Initialize Editor
    NoteEditor.init({
      onContentChange: handleEditorContentChange
    });

    // 4. Initialize Reminders
    NoteReminder.init();

    // 5. Initialize Sync Engine
    NoteSync.init({
      syncCode: settings.syncCode || 'alok',
      onStatusChange: handleSyncStatusChange,
      onNoteUpdate: handleIncomingNoteSync
    });

    // 6. Setup UI Event Listeners, Date Converter, Folders, & Themes
    setupUIEventListeners();
    setupKeyboardShortcuts();
    setupDateConverter();
    setupThemePicker();
    setupFolderManagement();
    setupPWAInstall();
    setupExportDropdown();
    setupDictionary();
    setupPopupPreferences();
    setupPinLock();
    setupFacebookCaptionModal();
    setupGitHubSync();
    setupAdminPanel();
    startLiveDualClock();

    // 7. Load Folders and Notes List
    await refreshFoldersList();
    await refreshNotesList();

    const notes = await NoteStorage.getAllNotes();
    const welcomeShown = localStorage.getItem('nhub_welcome_note_created');
    if (notes.length > 0) {
      openNote(notes[0].id);
    } else if (!welcomeShown) {
      localStorage.setItem('nhub_welcome_note_created', 'true');
      createNewNote('Welcome to NoteHub Nepal / नोटहब नेपालमा स्वागत छ', getDefaultWelcomeContent());
    } else {
      currentNoteId = null;
      NoteEditor.setTitle('');
      NoteEditor.setContent('');
    }

    // Check if URL contains #admin or ?admin=1
    if (window.location.hash === '#admin' || window.location.search.includes('admin')) {
      setTimeout(() => {
        showModal('admin-panel-modal');
        const userInput = document.getElementById('admin-user-auth-input');
        if (userInput) userInput.focus();
      }, 250);
    }
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin') {
        showModal('admin-panel-modal');
        const userInput = document.getElementById('admin-user-auth-input');
        if (userInput) userInput.focus();
      }
    });

    // Register Service Worker for offline PWA
    registerServiceWorker();
  }

  function getDefaultWelcomeContent() {
    return `<h2>नमस्ते र NoteHub मा स्वागत छ! 🇳🇵✨</h2>
<p>NoteHub is your full-featured Nepali &amp; English offline-first, cloud-synced notepad.</p>
<hr>
<h3>🔥 Highlight Features:</h3>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>📁 Folder Organization:</b> Categorize notes into Work, Personal, Study, or custom folders!</span></div>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>⬇️ Multi-Format Downloads:</b> Export as Plain Text (.txt), Markdown (.md), HTML (.html), Word (.doc), or PDF (.pdf)!</span></div>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>📲 PWA Installable:</b> Install on Android, iPhone (iOS), and Desktop for native app feel.</span></div>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>Right-click copy to note:</b> Select any text in the browser and right click to copy directly to your note!</span></div>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>Nepali Romanized Typing:</b> Click "नेपाली" toggle on top and type "namaste" to get "नमस्ते"!</span></div>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>AD ⇄ BS Date Converter:</b> Convert dates both ways and insert them into notes with 1 click.</span></div>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>Multi-Device Cloud Sync:</b> Share Room Code <span style="background-color: #fef08a"><b>alok</b></span> across your mobile &amp; laptop for instant sync!</span></div>
<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text"><b>Multiple Themes:</b> Choose between Light, Dark, Forest Emerald, Ocean Blue, Sunset, Lavender, and Sepia.</span></div>
<br>
<blockquote>"योजना बिनाको लक्ष्य केवल एउटा चाहना मात्र हो।" — Start writing your thoughts!</blockquote>`;
  }

  // Live Dual Clock (AD + BS live timer in both Nepali and English)
  function startLiveDualClock() {
    function updateClock() {
      const stamp = NepaliCalendar.formatFullDualTimestamp();
      const liveClockEl = document.getElementById('live-clock-display');
      if (liveClockEl) {
        liveClockEl.innerHTML = `
          <div class="flex items-center gap-2 text-xs font-medium">
            <span class="px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-semibold font-nepali">🇳🇵 ${stamp.bsNepali}</span>
            <span class="text-gray-400">|</span>
            <span class="text-gray-600 dark:text-gray-300 hidden xl:inline font-nepali">${stamp.bsEnglish}</span>
            <span class="text-gray-400 hidden xl:inline">•</span>
            <span class="text-gray-700 dark:text-gray-200 font-semibold">${stamp.adDate}</span>
            <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono">${stamp.time}</span>
          </div>
        `;
      }
    }
    updateClock();
    if (liveClockInterval) clearInterval(liveClockInterval);
    liveClockInterval = setInterval(updateClock, 1000);
  }

  // Folders Management
  async function refreshFoldersList() {
    const listEl = document.getElementById('folders-list');
    const selectEl = document.getElementById('note-folder-select');
    const folders = await NoteStorage.getFolders();
    const allNotes = await NoteStorage.getAllNotes({ includeTrash: false });

    if (listEl) {
      listEl.innerHTML = `
        <button class="folder-pill px-2.5 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 transition-all ${activeFolderId === 'all' ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}" data-id="all">
          <span>📁</span>
          <span>All</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeFolderId === 'all' ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}">${allNotes.length}</span>
        </button>
      `;

      folders.forEach(f => {
        const count = allNotes.filter(n => (n.folderId || 'default') === f.id).length;
        const isActive = activeFolderId === f.id;
        const btn = document.createElement('button');
        btn.className = `folder-pill px-2.5 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 transition-all ${isActive ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}`;
        btn.setAttribute('data-id', f.id);
        btn.innerHTML = `
          <span>${f.icon || '📁'}</span>
          <span class="truncate max-w-[90px]">${escapeHtml(f.name)}</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}">${count}</span>
        `;

        btn.onclick = () => {
          activeFolderId = f.id;
          activeFilter = 'all';
          refreshFoldersList();
          refreshNotesList();
        };

        listEl.appendChild(btn);
      });

      // "All" button click
      const allBtn = listEl.querySelector('[data-id="all"]');
      if (allBtn) {
        allBtn.onclick = () => {
          activeFolderId = 'all';
          refreshFoldersList();
          refreshNotesList();
        };
      }
    }

    if (selectEl) {
      selectEl.innerHTML = '';
      folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `${f.icon || '📁'} ${f.name}`;
        selectEl.appendChild(opt);
      });
    }
  }

  function setupFolderManagement() {
    document.getElementById('btn-new-folder')?.addEventListener('click', () => {
      const input = document.getElementById('new-folder-name-input');
      if (input) input.value = '';
      showModal('folder-modal');
    });

    let selectedIcon = '📁';
    document.querySelectorAll('.folder-icon-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.folder-icon-choice').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-950'));
        btn.classList.add('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-950');
        selectedIcon = btn.getAttribute('data-icon') || '📁';
      });
    });

    document.getElementById('btn-save-folder')?.addEventListener('click', async () => {
      const input = document.getElementById('new-folder-name-input');
      if (input && input.value.trim()) {
        await NoteStorage.saveFolder({
          name: input.value.trim(),
          icon: selectedIcon
        });
        closeModal('folder-modal');
        await refreshFoldersList();
        showToast('Folder created! 📁');
      }
    });

    // Note header folder selector change
    const selectEl = document.getElementById('note-folder-select');
    selectEl?.addEventListener('change', async (e) => {
      if (!currentNoteId) return;
      const note = await NoteStorage.getNoteById(currentNoteId);
      if (note) {
        note.folderId = e.target.value;
        await NoteStorage.saveNote(note);
        NoteSync.broadcastNoteUpdate(note);
        await refreshFoldersList();
        await refreshNotesList();
        showToast('Note moved to folder! 📁');
      }
    });
  }

  // Quick Download / Export Dropdown Setup
  function setupExportDropdown() {
    const dropdownBtn = document.getElementById('btn-quick-download-dropdown');
    const dropdownMenu = document.getElementById('quick-download-menu');

    dropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu?.classList.toggle('hidden');
    });

    window.addEventListener('click', (e) => {
      if (!e.target.closest('#quick-download-menu') && !e.target.closest('#btn-quick-download-dropdown')) {
        dropdownMenu?.classList.add('hidden');
      }
    });

    document.querySelectorAll('.export-format-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const format = btn.getAttribute('data-format');
        dropdownMenu?.classList.add('hidden');
        closeModal('export-modal');

        if (format === 'json') {
          await NoteStorage.exportAllJSON();
          showToast('JSON backup exported! 💾');
          return;
        }

        if (!currentNoteId) {
          showToast('Please select or create a note to export');
          return;
        }

        const note = await NoteStorage.getNoteById(currentNoteId);
        if (!note) return;

        switch (format) {
          case 'txt':
            NoteStorage.exportAsTxt(note);
            showToast('Exported as Plain Text (.txt)');
            break;
          case 'md':
            NoteStorage.exportAsMarkdown(note);
            showToast('Exported as Markdown (.md)');
            break;
          case 'mb':
            NoteStorage.exportAsMB(note);
            showToast('Exported as NoteHub Multi-Block (.mb)');
            break;
          case 'html':
            NoteStorage.exportAsHTML(note);
            showToast('Exported as Webpage (.html)');
            break;
          case 'doc':
            NoteStorage.exportAsDoc(note);
            showToast('Exported as Word Document (.doc)');
            break;
          case 'pdf':
            NoteStorage.exportAsPDF(note);
            showToast('Opening PDF Print View...');
            break;
        }
      });
    });
  }

  // Facebook Caption Formatter & Live Preview Setup
  function setupFacebookCaptionModal() {
    const openBtn = document.getElementById('btn-open-facebook-caption');
    const modal = document.getElementById('facebook-caption-modal');
    const textarea = document.getElementById('fb-caption-input');
    const preview = document.getElementById('fb-preview-content');
    const charCount = document.getElementById('fb-char-count');
    const reloadBtn = document.getElementById('btn-import-from-current-note');
    const copyBtn = document.getElementById('btn-copy-fb-caption');

    function updatePreview() {
      if (!textarea || !preview) return;
      const text = textarea.value || '';
      preview.textContent = text || 'Your formatted Facebook caption preview will appear here...';

      if (charCount) {
        const chars = text.length;
        const lines = text.split('\n').length;
        charCount.textContent = `${chars} characters • ${lines} lines`;
      }
    }

    async function loadNoteIntoCaption() {
      if (!currentNoteId) {
        if (textarea) textarea.value = 'Start typing your Facebook caption here...';
        updatePreview();
        return;
      }
      const note = await NoteStorage.getNoteById(currentNoteId);
      if (note && window.FacebookCaption) {
        const formatted = FacebookCaption.formatHtmlToFacebookCaption(note.content || '');
        const titleBold = FacebookCaption.toUnicodeStyle(note.title || '', 'boldSans');
        const finalCaption = titleBold ? `${titleBold}\n\n${formatted}` : formatted;
        if (textarea) textarea.value = finalCaption;
        updatePreview();
      }
    }

    openBtn?.addEventListener('click', async () => {
      showModal('facebook-caption-modal');
      await loadNoteIntoCaption();
      setTimeout(() => textarea?.focus(), 150);
    });

    reloadBtn?.addEventListener('click', async () => {
      await loadNoteIntoCaption();
      showToast('Reloaded current note content');
    });

    textarea?.addEventListener('input', updatePreview);

    // Style button actions (Sans Bold, Serif Bold, Italic, Script, Mono)
    function applyStyleToSelection(styleName) {
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (start !== end) {
        const selectedText = val.substring(start, end);
        const styled = FacebookCaption.toUnicodeStyle(selectedText, styleName);
        textarea.value = val.substring(0, start) + styled + val.substring(end);
        textarea.selectionStart = start;
        textarea.selectionEnd = start + styled.length;
      } else {
        const styled = FacebookCaption.toUnicodeStyle(val, styleName);
        textarea.value = styled;
      }
      updatePreview();
      textarea.focus();
    }

    document.getElementById('btn-fb-style-bold-sans')?.addEventListener('click', () => applyStyleToSelection('boldSans'));
    document.getElementById('btn-fb-style-bold-serif')?.addEventListener('click', () => applyStyleToSelection('boldSerif'));
    document.getElementById('btn-fb-style-italic')?.addEventListener('click', () => applyStyleToSelection('italicSans'));
    document.getElementById('btn-fb-style-script')?.addEventListener('click', () => applyStyleToSelection('script'));
    document.getElementById('btn-fb-style-mono')?.addEventListener('click', () => applyStyleToSelection('monospace'));

    // Divider insert
    document.getElementById('btn-fb-add-divider')?.addEventListener('click', () => {
      if (!textarea) return;
      const pos = textarea.selectionStart;
      const val = textarea.value;
      const divider = '\n\n━━━━━━━━━━━━━━━━━━━━\n\n';
      textarea.value = val.substring(0, pos) + divider + val.substring(pos);
      textarea.selectionStart = textarea.selectionEnd = pos + divider.length;
      updatePreview();
      textarea.focus();
    });

    // Bullet insert
    document.getElementById('btn-fb-add-bullets')?.addEventListener('click', () => {
      if (!textarea) return;
      const pos = textarea.selectionStart;
      const val = textarea.value;
      const bullet = '\n✦ ';
      textarea.value = val.substring(0, pos) + bullet + val.substring(pos);
      textarea.selectionStart = textarea.selectionEnd = pos + bullet.length;
      updatePreview();
      textarea.focus();
    });

    // Hashtags insert
    document.getElementById('btn-fb-add-hashtags')?.addEventListener('click', () => {
      if (!textarea) return;
      const val = textarea.value;
      const tags = '\n\n#NoteHub #Nepal #Notes #DailyThoughts #Inspiration';
      textarea.value = val + tags;
      updatePreview();
      textarea.focus();
    });

    // Delete / Clear Caption
    document.getElementById('btn-fb-delete-caption')?.addEventListener('click', () => {
      if (!textarea) return;
      if (confirm('Clear and delete current Facebook caption text?')) {
        textarea.value = '';
        updatePreview();
        showToast('Caption cleared');
      }
    });

    // Edit / Apply to Active Note
    document.getElementById('btn-fb-apply-to-editor')?.addEventListener('click', async () => {
      if (!textarea || !textarea.value.trim()) {
        showToast('Caption is empty');
        return;
      }
      const formattedHtml = `<p>${escapeHtml(textarea.value).replace(/\n/g, '<br>')}</p>`;
      NoteEditor.setContent(formattedHtml);
      await saveCurrentNote(false);
      closeModal('facebook-caption-modal');
      showToast('Caption applied to active note! ✏️');
    });

    // Save Caption as a New Note
    document.getElementById('btn-fb-save-as-new-note')?.addEventListener('click', async () => {
      if (!textarea || !textarea.value.trim()) {
        showToast('Caption is empty');
        return;
      }
      const firstLine = textarea.value.split('\n')[0].substring(0, 35) || 'Facebook Caption';
      const formattedHtml = `<p>${escapeHtml(textarea.value).replace(/\n/g, '<br>')}</p>`;
      await createNewNote(`[FB] ${firstLine}`, formattedHtml);
      closeModal('facebook-caption-modal');
      showToast('Saved as new Facebook Caption note! 💾');
    });

    // Copy caption
    copyBtn?.addEventListener('click', async () => {
      if (!textarea) return;
      try {
        await navigator.clipboard.writeText(textarea.value);
        showToast('Caption copied for Facebook! 📋');
        closeModal('facebook-caption-modal');
      } catch (err) {
        showToast('Please copy manually from the box');
      }
    });
  }

  // PWA Install Handling for Mobile and Desktop
  function setupPWAInstall() {
    const installBanner = document.getElementById('mobile-install-banner');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      console.log('beforeinstallprompt fired - ready to install');

      // If on mobile browser and not standalone, show floating install banner
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      const isDismissed = sessionStorage.getItem('nhub_banner_dismissed');
      if (!isStandalone && !isDismissed && installBanner) {
        installBanner.classList.remove('hidden');
      }
    });

    // Auto-check on mobile after 2.5s
    setTimeout(() => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      const isDismissed = sessionStorage.getItem('nhub_banner_dismissed');
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && !isStandalone && !isDismissed && installBanner) {
        installBanner.classList.remove('hidden');
      }
    }, 2500);

    // Dismiss floating banner
    document.getElementById('btn-dismiss-install-banner')?.addEventListener('click', () => {
      if (installBanner) installBanner.classList.add('hidden');
      sessionStorage.setItem('nhub_banner_dismissed', '1');
    });

    // All Install Button Triggers (Header, Sidebar, Mobile Bottom Bar, Floating Banner, Modal)
    const installButtons = [
      'btn-install-app',
      'btn-sidebar-install-app',
      'mobile-btn-install',
      'btn-banner-install',
      'btn-trigger-pwa-install'
    ];

    installButtons.forEach(btnId => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        triggerPWAInstall();
      });
    });
  }

  function triggerPWAInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('NoteHub installed successfully! 📱🚀');
          const installBanner = document.getElementById('mobile-install-banner');
          if (installBanner) installBanner.classList.add('hidden');
        }
        deferredInstallPrompt = null;
        closeModal('install-modal');
      });
    } else {
      // Show full install guide modal (with step-by-step for Android, iOS Safari & Chrome)
      showModal('install-modal');
    }
  }

  // Offline Dictionary Setup
  function setupDictionary() {
    const dictBtn = document.getElementById('btn-open-dictionary-modal');
    const searchInput = document.getElementById('dict-search-input');
    const resultsList = document.getElementById('dict-results-list');

    dictBtn?.addEventListener('click', () => {
      showModal('dictionary-modal');
      renderDictionaryResults(searchInput ? searchInput.value : '');
      setTimeout(() => searchInput?.focus(), 150);
    });

    searchInput?.addEventListener('input', (e) => {
      renderDictionaryResults(e.target.value);
    });

    function renderDictionaryResults(query) {
      if (!resultsList || !window.NoteDictionary) return;
      const results = NoteDictionary.search(query || 'nepal');

      if (results.length === 0) {
        resultsList.innerHTML = `
          <div class="p-6 text-center text-gray-400 text-xs">
            <p>No dictionary matches found for "${escapeHtml(query)}"</p>
          </div>
        `;
        return;
      }

      resultsList.innerHTML = '';
      results.forEach(item => {
        const card = document.createElement('div');
        card.className = 'p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3 text-xs';
        card.innerHTML = `
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm text-gray-900 dark:text-white capitalize">${escapeHtml(item.en)}</span>
              <span class="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold font-nepali text-sm">${escapeHtml(item.np)}</span>
              <span class="text-[10px] text-gray-400 italic">(${escapeHtml(item.type || 'noun')})</span>
            </div>
            <p class="text-gray-600 dark:text-gray-300 mt-1">${escapeHtml(item.def || '')}</p>
          </div>
          <button class="btn-insert-dict-item px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0">
            + Insert
          </button>
        `;

        card.querySelector('.btn-insert-dict-item').onclick = () => {
          const dictHtml = `<p><b>${escapeHtml(item.en)}</b> (<span class="font-nepali text-red-600 dark:text-red-400">${escapeHtml(item.np)}</span>): <i>${escapeHtml(item.def)}</i></p>`;
          NoteEditor.appendHtmlToCurrentNote(dictHtml);
          closeModal('dictionary-modal');
          showToast(`Inserted "${item.en}" into note`);
        };

        resultsList.appendChild(card);
      });
    }
  }

  // Popup & Suggestion Preferences Setup
  function setupPopupPreferences() {
    const openBtn = document.getElementById('btn-open-popup-settings');
    const saveBtn = document.getElementById('btn-save-popup-prefs');

    const chkSuggestions = document.getElementById('pref-auto-suggestions');
    const chkTooltip = document.getElementById('pref-selection-tooltip');
    const chkReminders = document.getElementById('pref-reminders');
    const chkSpellcheck = document.getElementById('pref-spellcheck');

    openBtn?.addEventListener('click', () => {
      const settings = NoteStorage.getSettings();
      const p = settings.popupSettings || {};

      if (chkSuggestions) chkSuggestions.checked = p.autoSuggestions !== false;
      if (chkTooltip) chkTooltip.checked = p.selectionTooltip !== false;
      if (chkReminders) chkReminders.checked = p.reminders !== false;
      if (chkSpellcheck) chkSpellcheck.checked = settings.spellCheck !== false;

      showModal('popup-settings-modal');
    });

    saveBtn?.addEventListener('click', () => {
      const settings = NoteStorage.getSettings();
      settings.popupSettings = {
        autoSuggestions: chkSuggestions ? chkSuggestions.checked : true,
        selectionTooltip: chkTooltip ? chkTooltip.checked : true,
        reminders: chkReminders ? chkReminders.checked : true
      };
      if (chkSpellcheck) {
        settings.spellCheck = chkSpellcheck.checked;
        applySpellCheckState(settings.spellCheck);
      }

      NoteStorage.saveSettings(settings);
      closeModal('popup-settings-modal');
      showToast('Popup preferences saved');
    });
  }

  // PIN Security Lock Setup (Default PIN: 8264)
  function setupPinLock() {
    let enteredPin = '';
    const correctPin = '8264';
    const pinModal = document.getElementById('pin-lock-modal');
    const errorMsg = document.getElementById('pin-error-msg');

    function updateDots() {
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById(`pin-dot-${i}`);
        if (dot) {
          if (i < enteredPin.length) {
            dot.classList.add('bg-indigo-600', 'border-indigo-600');
          } else {
            dot.classList.remove('bg-indigo-600', 'border-indigo-600');
          }
        }
      }
    }

    function verifyPin() {
      if (enteredPin === correctPin) {
        if (pinModal) pinModal.classList.add('hidden');
        enteredPin = '';
        updateDots();
        if (errorMsg) errorMsg.classList.add('hidden');
        showToast('App Unlocked');
      } else {
        if (errorMsg) errorMsg.classList.remove('hidden');
        enteredPin = '';
        updateDots();
        // Shake animation
        const box = pinModal?.querySelector('.bg-white');
        if (box) {
          box.classList.add('animate-bounce');
          setTimeout(() => box.classList.remove('animate-bounce'), 500);
        }
      }
    }

    document.querySelectorAll('.pin-num-btn[data-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (enteredPin.length < 4) {
          enteredPin += btn.getAttribute('data-val');
          updateDots();
          if (enteredPin.length === 4) {
            setTimeout(verifyPin, 150);
          }
        }
      });
    });

    document.getElementById('btn-clear-pin')?.addEventListener('click', () => {
      enteredPin = '';
      updateDots();
      if (errorMsg) errorMsg.classList.add('hidden');
    });

    document.getElementById('btn-backspace-pin')?.addEventListener('click', () => {
      enteredPin = enteredPin.slice(0, -1);
      updateDots();
      if (errorMsg) errorMsg.classList.add('hidden');
    });

    document.getElementById('btn-lock-app-now')?.addEventListener('click', () => {
      closeModal('sync-modal');
      enteredPin = '';
      updateDots();
      if (errorMsg) errorMsg.classList.add('hidden');
      showModal('pin-lock-modal');
    });
  }

  // Refresh Note List UI
  async function refreshNotesList() {
    const listEl = document.getElementById('notes-list');
    if (!listEl) return;

    let notes = [];
    if (activeFilter === 'trash') {
      notes = await NoteStorage.getAllNotes({ onlyTrash: true });
    } else {
      notes = await NoteStorage.getAllNotes({
        includeTrash: false,
        folderId: activeFolderId
      });
      if (activeFilter === 'pinned') {
        notes = notes.filter(n => n.pinned);
      }
    }

    // Search query filter
    const searchInput = document.getElementById('search-notes-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (query) {
      notes = notes.filter(n => 
        (n.title && n.title.toLowerCase().includes(query)) ||
        (n.content && n.content.toLowerCase().includes(query))
      );
    }

    listEl.innerHTML = '';

    if (notes.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-gray-400 dark:text-gray-500">
          <div class="text-3xl mb-2">${activeFilter === 'trash' ? '🗑️' : '📝'}</div>
          <p class="text-sm font-medium">${activeFilter === 'trash' ? 'Trash is empty' : 'No notes found in this folder'}</p>
        </div>
      `;
      return;
    }

    notes.forEach(note => {
      const card = document.createElement('div');
      const isActive = note.id === currentNoteId;
      card.className = `note-card p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
        isActive 
          ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm' 
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 shadow-xs'
      } relative overflow-hidden mb-2`;

      if (note.color && note.color !== '#ffffff') {
        card.style.borderLeft = `5px solid ${note.color}`;
      }

      // Extract plain text snippet
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = note.content || '';
      const snippet = (tempDiv.textContent || tempDiv.innerText || '').substring(0, 70);

      const bsDisplay = note.updatedAtBS || note.createdAtBS || '';

      const isTrashCard = !!note.isTrash;

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <h4 class="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate flex-1">${escapeHtml(note.title || 'Untitled Note')}</h4>
          <div class="flex items-center gap-1 flex-shrink-0">
            ${note.pinned ? '<span title="Pinned" class="text-amber-500 text-xs">📌</span>' : ''}
            ${note.reminder && note.reminder.active ? '<span title="Reminder Set" class="text-indigo-500 text-xs">⏰</span>' : ''}
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">${escapeHtml(snippet || 'No additional text')}</p>
        <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/40 text-[11px] text-gray-400 dark:text-gray-500">
          <div class="flex items-center gap-1 truncate font-nepali">
            <span class="text-red-700 dark:text-red-400 font-medium">${bsDisplay}</span>
          </div>
          ${isTrashCard ? `
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button class="btn-restore-card px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-200 text-[10px]" data-id="${note.id}" title="Restore Note">Restore ♻️</button>
              <button class="btn-del-forever-card px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-semibold hover:bg-red-200 text-[10px]" data-id="${note.id}" title="Delete Permanently">Delete ✕</button>
            </div>
          ` : `
            <button class="note-menu-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1" data-id="${note.id}" title="Options">⋮</button>
          `}
        </div>
      `;

      card.onclick = async (e) => {
        if (e.target.closest('.btn-restore-card')) {
          e.stopPropagation();
          await NoteStorage.restoreNote(note.id);
          showToast('Note restored from Trash! ♻️');
          await refreshNotesList();
          return;
        }
        if (e.target.closest('.btn-del-forever-card')) {
          e.stopPropagation();
          if (confirm('Permanently delete this note? This action cannot be undone.')) {
            await NoteStorage.deleteNote(note.id, true);
            NoteSync.broadcastNoteDelete(note.id, true);
            if (currentNoteId === note.id) {
              currentNoteId = null;
              NoteEditor.setTitle('');
              NoteEditor.setContent('');
            }
            showToast('Note permanently deleted 🗑️');
            await refreshNotesList();
          }
          return;
        }
        if (e.target.closest('.note-menu-btn')) {
          e.stopPropagation();
          showNoteActionModal(note);
          return;
        }
        openNote(note.id);
      };

      listEl.appendChild(card);
    });

    // Update note count badges
    const allNotes = await NoteStorage.getAllNotes({ includeTrash: false });
    const trashNotes = await NoteStorage.getAllNotes({ onlyTrash: true });
    const totalCountEl = document.getElementById('total-notes-badge');
    const trashCountEl = document.getElementById('trash-notes-badge');
    if (totalCountEl) totalCountEl.textContent = allNotes.length;
    if (trashCountEl) trashCountEl.textContent = trashNotes.length;
  }

  // Open note in editor
  async function openNote(noteId) {
    currentNoteId = noteId;
    const note = await NoteStorage.getNoteById(noteId);
    if (!note) return;

    NoteEditor.setTitle(note.title || '');
    NoteEditor.setContent(note.content || '');

    // Update editor header date badges & folder select
    const noteTimeAdEl = document.getElementById('current-note-time-ad');
    const noteTimeBsEl = document.getElementById('current-note-time-bs');
    const folderSelectEl = document.getElementById('note-folder-select');

    const updateDate = new Date(note.updatedAtAD || Date.now());
    const bsInfo = NepaliCalendar.adToBs(updateDate);

    if (noteTimeAdEl) noteTimeAdEl.textContent = `AD: ${updateDate.toLocaleDateString()}`;
    if (noteTimeBsEl) noteTimeBsEl.textContent = `BS: ${bsInfo.formattedBSNepali}`;
    if (folderSelectEl) folderSelectEl.value = note.folderId || 'default';

    // Update Pin status icon
    const pinBtn = document.getElementById('btn-pin-note');
    if (pinBtn) {
      pinBtn.classList.toggle('text-amber-500', !!note.pinned);
      pinBtn.title = note.pinned ? 'Unpin Note' : 'Pin Note';
    }

    // Refresh list active highlight
    refreshNotesList();

    // Close mobile drawer if open
    closeMobileSidebar();
  }

  // Create a new note
  async function createNewNote(title = 'Untitled Note', initialContent = '') {
    const timestamp = NepaliCalendar.formatFullDualTimestamp();
    const newNote = await NoteStorage.saveNote({
      title: title,
      content: initialContent,
      pinned: false,
      folderId: activeFolderId !== 'all' ? activeFolderId : 'default',
      color: '#ffffff'
    });

    NoteSync.broadcastNoteUpdate(newNote);
    await refreshFoldersList();
    await refreshNotesList();
    openNote(newNote.id);
    showToast('New note created! ✨');

    const editor = document.getElementById('note-editor');
    if (editor) editor.focus();
  }

  // Handle content change & auto-save with debounce
  function handleEditorContentChange() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
      await saveCurrentNote(false);
    }, 600);
  }

  // Save current note
  async function saveCurrentNote(showFeedback = true) {
    if (!currentNoteId) return;

    const note = await NoteStorage.getNoteById(currentNoteId);
    if (!note) return;

    note.title = NoteEditor.getTitle();
    note.content = NoteEditor.getContent();
    const folderSelect = document.getElementById('note-folder-select');
    if (folderSelect) note.folderId = folderSelect.value;

    const saved = await NoteStorage.saveNote(note);
    NoteSync.broadcastNoteUpdate(saved);

    // Auto push to GitHub if configured
    if (window.GitHubSync) {
      const gh = GitHubSync.getSettings();
      if (gh.enabled && gh.autoSyncOnSave && gh.token && gh.repo) {
        const safeTitle = (saved.title || 'untitled').replace(/[^a-zA-Z0-9_\-\u0900-\u097F]/g, '_').substring(0, 40);
        const temp = document.createElement('div');
        temp.innerHTML = saved.content || '';
        const mdText = `# ${saved.title}\n\n*Updated: ${saved.updatedAtBS} (${saved.updatedAtAD})*\n\n---\n\n` + (temp.innerText || temp.textContent || '');
        GitHubSync.pushFileToGitHub(`notes/${safeTitle}.md`, mdText, `Auto-update: ${saved.title}`).catch(() => {});
      }
    }

    // Update timestamps on screen
    const noteTimeAdEl = document.getElementById('current-note-time-ad');
    const noteTimeBsEl = document.getElementById('current-note-time-bs');

    const updateDate = new Date();
    const bsInfo = NepaliCalendar.adToBs(updateDate);

    if (noteTimeAdEl) noteTimeAdEl.textContent = `AD: ${updateDate.toLocaleDateString()}`;
    if (noteTimeBsEl) noteTimeBsEl.textContent = `BS: ${bsInfo.formattedBSNepali}`;

    await refreshNotesList();

    if (showFeedback) {
      showToast('Note saved successfully! 💾✓');
    }
  }

  // GitHub Sync & Cloud Repository Setup
  function setupGitHubSync() {
    const openBtn = document.getElementById('btn-open-github-modal');
    const tokenInput = document.getElementById('gh-token-input');
    const repoInput = document.getElementById('gh-repo-input');
    const branchInput = document.getElementById('gh-branch-input');
    const enableToggle = document.getElementById('gh-enable-toggle');
    const saveBtn = document.getElementById('btn-save-gh-settings');
    const pushNowBtn = document.getElementById('btn-gh-push-now');

    function populateFields() {
      if (!window.GitHubSync) return;
      const settings = GitHubSync.getSettings();
      if (tokenInput) tokenInput.value = settings.token || '';
      if (repoInput) repoInput.value = settings.repo || '';
      if (branchInput) branchInput.value = settings.branch || 'main';
      if (enableToggle) enableToggle.checked = !!settings.enabled;
    }

    openBtn?.addEventListener('click', () => {
      populateFields();
      showModal('github-sync-modal');
    });

    saveBtn?.addEventListener('click', () => {
      if (!window.GitHubSync) return;
      const settings = {
        enabled: enableToggle ? enableToggle.checked : false,
        token: tokenInput ? tokenInput.value.trim() : '',
        repo: repoInput ? repoInput.value.trim() : '',
        branch: branchInput ? branchInput.value.trim() || 'main' : 'main',
        autoSyncOnSave: true
      };
      GitHubSync.saveSettings(settings);
      closeModal('github-sync-modal');
      showToast('GitHub settings saved! 🚀');
    });

    pushNowBtn?.addEventListener('click', async () => {
      if (!window.GitHubSync) return;
      showToast('Syncing all notes to GitHub...');
      const res = await GitHubSync.syncAllToGitHub();
      if (res.success) {
        showToast(res.message || 'All notes pushed to GitHub! 🚀');
        closeModal('github-sync-modal');
      } else {
        alert('GitHub Sync Error: ' + res.error);
      }
    });
  }

  // Setup Date Converter
  function setupDateConverter() {
    document.getElementById('btn-open-converter-modal')?.addEventListener('click', () => {
      openDateConverterModal();
    });

    document.getElementById('btn-insert-date')?.addEventListener('click', () => {
      const dual = NepaliCalendar.formatFullDualTimestamp();
      const dateHtml = `<span class="inline-block px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-semibold my-1 font-nepali">📅 ${dual.bsNepali} (${dual.bsEnglish}) • ${dual.adDate} [${dual.time}]</span>&nbsp;`;
      NoteEditor.appendHtmlToCurrentNote(dateHtml);
      showToast('Current date inserted into note! 📅');
    });

    const tabAdToBs = document.getElementById('tab-ad-to-bs');
    const tabBsToAd = document.getElementById('tab-bs-to-ad');
    const panelAdToBs = document.getElementById('panel-ad-to-bs');
    const panelBsToAd = document.getElementById('panel-bs-to-ad');

    tabAdToBs?.addEventListener('click', () => {
      tabAdToBs.className = 'flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-indigo-600 text-white transition-colors';
      tabBsToAd.className = 'flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors';
      panelAdToBs.classList.remove('hidden');
      panelBsToAd.classList.add('hidden');
      updateAdToBsConversion();
    });

    tabBsToAd?.addEventListener('click', () => {
      tabBsToAd.className = 'flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-indigo-600 text-white transition-colors';
      tabAdToBs.className = 'flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors';
      panelBsToAd.classList.remove('hidden');
      panelAdToBs.classList.add('hidden');
      updateBsToAdConversion();
    });

    const bsYearSelect = document.getElementById('conv-bs-year-select');
    if (bsYearSelect && bsYearSelect.options.length === 0) {
      for (let y = 2095; y >= 2000; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y} (${NepaliCalendar.toNepaliDigits(y)})`;
        bsYearSelect.appendChild(opt);
      }
    }

    const today = new Date();
    const adInput = document.getElementById('conv-ad-input');
    if (adInput) {
      const monthStr = String(today.getMonth() + 1).padStart(2, '0');
      const dayStr = String(today.getDate()).padStart(2, '0');
      adInput.value = `${today.getFullYear()}-${monthStr}-${dayStr}`;
      adInput.addEventListener('input', updateAdToBsConversion);
      adInput.addEventListener('change', updateAdToBsConversion);
    }

    const bsMonthSelect = document.getElementById('conv-bs-month-select');
    const bsDaySelect = document.getElementById('conv-bs-day-select');

    const updateDaysDropdown = () => {
      if (!bsYearSelect || !bsMonthSelect || !bsDaySelect) return;
      const yr = parseInt(bsYearSelect.value, 10);
      const mo = parseInt(bsMonthSelect.value, 10);
      const maxDays = NepaliCalendar.getDaysInBsMonth(yr, mo);
      const currVal = parseInt(bsDaySelect.value, 10) || 1;

      bsDaySelect.innerHTML = '';
      for (let d = 1; d <= maxDays; d++) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${d} (${NepaliCalendar.toNepaliDigits(d)} गते)`;
        bsDaySelect.appendChild(opt);
      }
      bsDaySelect.value = Math.min(currVal, maxDays);
      updateBsToAdConversion();
    };

    bsYearSelect?.addEventListener('change', updateDaysDropdown);
    bsMonthSelect?.addEventListener('change', updateDaysDropdown);
    bsDaySelect?.addEventListener('change', updateBsToAdConversion);

    const currentBs = NepaliCalendar.adToBs(today);
    if (bsYearSelect) bsYearSelect.value = currentBs.bsYear;
    if (bsMonthSelect) bsMonthSelect.value = currentBs.bsMonth;
    updateDaysDropdown();
    if (bsDaySelect) bsDaySelect.value = currentBs.bsDay;

    document.getElementById('btn-insert-converted-date')?.addEventListener('click', () => {
      if (activeConvertedDateText) {
        const dateHtml = `<p><b>📅 Date:</b> ${escapeHtml(activeConvertedDateText)}</p>`;
        NoteEditor.appendHtmlToCurrentNote(dateHtml);
        closeModal('converter-modal');
        showToast('Converted date inserted into note! 📅');
      }
    });
  }

  function openDateConverterModal() {
    updateAdToBsConversion();
    showModal('converter-modal');
  }

  function updateAdToBsConversion() {
    const adInput = document.getElementById('conv-ad-input');
    if (!adInput || !adInput.value) return;

    const [y, m, d] = adInput.value.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const bs = NepaliCalendar.adToBs(dateObj);

    const resNepali = document.getElementById('conv-bs-result-nepali');
    const resEnglish = document.getElementById('conv-bs-result-english');

    if (resNepali) resNepali.textContent = `🇳🇵 ${bs.formattedBSNepali}`;
    if (resEnglish) resEnglish.textContent = `English: ${bs.formattedBSEnglish} [Gregorian: ${NepaliCalendar.englishMonths[m - 1]} ${d}, ${y}]`;

    activeConvertedDateText = `${bs.formattedBSNepali} (${bs.formattedBSEnglish}) [${NepaliCalendar.englishMonths[m - 1]} ${d}, ${y} AD]`;
  }

  function updateBsToAdConversion() {
    const bsYearSelect = document.getElementById('conv-bs-year-select');
    const bsMonthSelect = document.getElementById('conv-bs-month-select');
    const bsDaySelect = document.getElementById('conv-bs-day-select');

    if (!bsYearSelect || !bsMonthSelect || !bsDaySelect) return;

    const y = parseInt(bsYearSelect.value, 10);
    const m = parseInt(bsMonthSelect.value, 10);
    const d = parseInt(bsDaySelect.value, 10);

    const ad = NepaliCalendar.bsToAd(y, m, d);
    if (!ad) return;

    const resFull = document.getElementById('conv-ad-result-full');
    const resDual = document.getElementById('conv-ad-result-dual');

    if (resFull) resFull.textContent = `🌍 ${ad.formattedADWithDay}`;
    if (resDual) resDual.textContent = `वि.सं.: ${ad.bsNepali} (${ad.bsEnglish})`;

    activeConvertedDateText = `${ad.bsNepali} • ${ad.formattedADWithDay} (${ad.isoDate})`;
  }

  // Multi-Theme Picker Setup
  function setupThemePicker() {
    const pickerBtn = document.getElementById('btn-open-theme-picker');
    const dropdown = document.getElementById('theme-dropdown-menu');

    pickerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('hidden');
    });

    window.addEventListener('click', (e) => {
      if (!e.target.closest('#theme-dropdown-menu') && !e.target.closest('#btn-open-theme-picker')) {
        dropdown?.classList.add('hidden');
      }
    });

    const themeButtons = document.querySelectorAll('.theme-select-btn');
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme') || 'light';
        applyTheme(theme);
        const settings = NoteStorage.getSettings();
        settings.theme = theme;
        NoteStorage.saveSettings(settings);
        dropdown?.classList.add('hidden');
        showToast(`Theme changed to ${theme.toUpperCase()}! 🎨`);
      });
    });
  }

  function applyTheme(theme) {
    const htmlEl = document.documentElement;
    htmlEl.classList.remove('dark', 'theme-emerald', 'theme-ocean', 'theme-sunset', 'theme-lavender', 'theme-sepia');

    const themeNames = {
      'light': 'Light ☀️',
      'dark': 'Dark 🌙',
      'emerald': 'Emerald 🌲',
      'ocean': 'Ocean 🌊',
      'sunset': 'Sunset 🌅',
      'lavender': 'Lavender 🌸',
      'sepia': 'Sepia ☕'
    };

    if (theme === 'dark') htmlEl.classList.add('dark');
    else if (theme === 'emerald') htmlEl.classList.add('theme-emerald');
    else if (theme === 'ocean') htmlEl.classList.add('theme-ocean');
    else if (theme === 'sunset') htmlEl.classList.add('theme-sunset');
    else if (theme === 'lavender') htmlEl.classList.add('theme-lavender');
    else if (theme === 'sepia') htmlEl.classList.add('theme-sepia');

    const currentThemeNameEl = document.getElementById('current-theme-name');
    if (currentThemeNameEl) {
      currentThemeNameEl.textContent = themeNames[theme] || theme;
    }
  }

  // Setup UI Event Listeners
  function setupUIEventListeners() {
    // New Note Button
    document.getElementById('btn-new-note')?.addEventListener('click', () => createNewNote());

    // Save Note Explicit Buttons
    document.getElementById('btn-save-note-header')?.addEventListener('click', () => saveCurrentNote(true));
    document.getElementById('btn-save-note-bottom')?.addEventListener('click', () => saveCurrentNote(true));

    // Mobile Bottom Floating Action Bar
    document.getElementById('mobile-btn-sidebar')?.addEventListener('click', () => toggleMobileSidebar());
    document.getElementById('mobile-btn-new-note')?.addEventListener('click', () => createNewNote());
    document.getElementById('mobile-btn-save-note')?.addEventListener('click', () => saveCurrentNote(true));
    document.getElementById('mobile-btn-nepali')?.addEventListener('click', () => {
      const newState = NepaliTransliterate.toggleNepaliTyping();
      applyNepaliTypingState(newState);
      showToast(newState ? 'नेपाली Typing ON' : 'English Typing ON');
    });
    document.getElementById('mobile-btn-converter')?.addEventListener('click', () => openDateConverterModal());

    // Search input
    document.getElementById('search-notes-input')?.addEventListener('input', () => {
      refreshNotesList();
    });

    // Filter Buttons (All, Pinned, Trash)
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('bg-indigo-600', 'text-white', 'dark:bg-indigo-600'));
        btn.classList.add('bg-indigo-600', 'text-white', 'dark:bg-indigo-600');
        activeFilter = btn.getAttribute('data-filter') || 'all';
        refreshNotesList();
      });
    });

    // Pin Button
    document.getElementById('btn-pin-note')?.addEventListener('click', async () => {
      if (!currentNoteId) return;
      const note = await NoteStorage.getNoteById(currentNoteId);
      if (note) {
        note.pinned = !note.pinned;
        await NoteStorage.saveNote(note);
        NoteSync.broadcastNoteUpdate(note);
        openNote(note.id);
        showToast(note.pinned ? 'Note pinned 📌' : 'Note unpinned');
      }
    });

    // Delete Button
    document.getElementById('btn-delete-note')?.addEventListener('click', async () => {
      if (!currentNoteId) return;
      if (activeFilter === 'trash') {
        if (confirm('Permanently delete this note? This action cannot be undone.')) {
          await NoteStorage.deleteNote(currentNoteId, true);
          NoteSync.broadcastNoteDelete(currentNoteId, true);
          currentNoteId = null;
          NoteEditor.setTitle('');
          NoteEditor.setContent('');
          await refreshNotesList();
          showToast('Note deleted permanently');
        }
      } else {
        await NoteStorage.deleteNote(currentNoteId, false);
        NoteSync.broadcastNoteDelete(currentNoteId, false);
        showToast('Moved to Trash 🗑️');
        const notes = await NoteStorage.getAllNotes();
        if (notes.length > 0) {
          openNote(notes[0].id);
        } else {
          currentNoteId = null;
          NoteEditor.setTitle('');
          NoteEditor.setContent('');
        }
        await refreshNotesList();
      }
    });

    // Empty Trash Button
    document.getElementById('btn-empty-trash')?.addEventListener('click', async () => {
      const trashNotes = await NoteStorage.getAllNotes({ onlyTrash: true });
      if (trashNotes.length === 0) {
        showToast('Trash is already empty');
        return;
      }
      if (confirm(`Permanently empty ${trashNotes.length} note(s) in Trash? This cannot be undone.`)) {
        for (const tn of trashNotes) {
          NoteSync.broadcastNoteDelete(tn.id, true);
        }
        await NoteStorage.emptyTrash();
        if (activeFilter === 'trash') {
          currentNoteId = null;
          NoteEditor.setTitle('');
          NoteEditor.setContent('');
        }
        await refreshNotesList();
        showToast('Trash permanently emptied 🗑️');
      }
    });

    // Nepali Typing Mode Toggle
    const nepaliToggleBtn = document.getElementById('btn-toggle-nepali');
    nepaliToggleBtn?.addEventListener('click', () => {
      const newState = NepaliTransliterate.toggleNepaliTyping();
      applyNepaliTypingState(newState);
      const settings = NoteStorage.getSettings();
      settings.nepaliTyping = newState;
      NoteStorage.saveSettings(settings);
      showToast(newState ? 'नेपाली Typing Mode ON (Type "namaste" -> "नमस्ते")' : 'English Typing Mode');
    });

    // Spell Check Toggle
    const spellcheckToggleBtn = document.getElementById('btn-toggle-spellcheck');
    spellcheckToggleBtn?.addEventListener('click', () => {
      const settings = NoteStorage.getSettings();
      settings.spellCheck = !settings.spellCheck;
      NoteStorage.saveSettings(settings);
      applySpellCheckState(settings.spellCheck);
      showToast(settings.spellCheck ? 'Spell Checker Enabled ✓' : 'Spell Checker Disabled');
    });

    // Font Family Select
    const fontSelect = document.getElementById('font-family-select');
    fontSelect?.addEventListener('change', (e) => {
      const font = e.target.value;
      applyFont(font);
      const settings = NoteStorage.getSettings();
      settings.fontFamily = font;
      NoteStorage.saveSettings(settings);
    });

    // Sync Room Code Modal Trigger & Actions
    document.getElementById('btn-open-sync-modal')?.addEventListener('click', () => {
      showSyncModal();
    });

    document.getElementById('sync-status-badge')?.addEventListener('click', () => {
      showSyncModal();
    });

    document.getElementById('mobile-btn-sync')?.addEventListener('click', () => {
      showSyncModal();
    });

    document.getElementById('btn-save-sync-code')?.addEventListener('click', () => {
      const input = document.getElementById('sync-code-input');
      const pinInput = document.getElementById('sync-pin-input');
      if (input) {
        const code = input.value.trim() || 'alok';
        const pin = pinInput ? pinInput.value.trim() : '8264';
        const res = NoteSync.setSyncCode(code, pin);
        if (res.success) {
          closeModal('sync-modal');
          showToast(`Connected to Room "${code}" with PIN protection.`);
        } else {
          alert(res.error || 'Connection failed.');
        }
      }
    });

    // Force Sync Now Action
    document.getElementById('btn-force-sync-now')?.addEventListener('click', async () => {
      showToast('⚡ Syncing all notes across devices...');
      await NoteSync.triggerSync();
      await refreshFoldersList();
      await refreshNotesList();
      showToast('All notes synced with iPhone & Mac! ✨');
    });

    // Bluetooth Direct Connection Trigger
    document.getElementById('btn-connect-bluetooth')?.addEventListener('click', async () => {
      const statusMsg = document.getElementById('bluetooth-status-msg');
      if (statusMsg) {
        statusMsg.classList.remove('hidden');
        statusMsg.textContent = 'Scanning for nearby Bluetooth devices...';
      }

      const res = await NoteSync.connectBluetoothDevice();
      if (statusMsg) {
        statusMsg.textContent = res.message;
      }
      showToast(res.message);
    });

    // Reminder Setup Trigger & Actions
    document.getElementById('btn-open-reminder-modal')?.addEventListener('click', () => {
      showReminderModal();
    });

    document.getElementById('btn-save-reminder')?.addEventListener('click', async () => {
      await saveReminderFromModal();
    });

    document.getElementById('btn-clear-reminder')?.addEventListener('click', async () => {
      if (!currentNoteId) return;
      const note = await NoteStorage.getNoteById(currentNoteId);
      if (note) {
        note.reminder = null;
        await NoteStorage.saveNote(note);
        NoteSync.broadcastNoteUpdate(note);
        closeModal('reminder-modal');
        await refreshNotesList();
        showToast('Reminder removed');
      }
    });

    // Rename Note Trigger & Modal
    document.getElementById('btn-rename-note')?.addEventListener('click', () => {
      showRenameModal();
    });

    document.getElementById('btn-save-rename')?.addEventListener('click', async () => {
      const newTitleInput = document.getElementById('rename-title-input');
      if (newTitleInput && currentNoteId) {
        await NoteStorage.renameNote(currentNoteId, newTitleInput.value);
        NoteEditor.setTitle(newTitleInput.value);
        closeModal('rename-modal');
        await refreshNotesList();
        showToast('Note renamed! ✏️');
      }
    });

    // Export Modal Trigger
    document.getElementById('btn-open-export-modal')?.addEventListener('click', () => {
      showModal('export-modal');
    });

    // Import File Trigger
    const importFileInput = document.getElementById('import-file-input');
    document.getElementById('btn-import-file')?.addEventListener('click', () => {
      importFileInput?.click();
    });

    importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target.result;
        if (file.name.endsWith('.json')) {
          try {
            const data = JSON.parse(content);
            if (data.notes && Array.isArray(data.notes)) {
              await NoteStorage.bulkUpsertNotes(data.notes);
              if (data.folders && Array.isArray(data.folders)) {
                for (const f of data.folders) {
                  await NoteStorage.saveFolder(f);
                }
              }
              await refreshFoldersList();
              await refreshNotesList();
              showToast(`Imported ${data.notes.length} notes!`);
            }
          } catch (err) {
            alert('Invalid JSON backup file');
          }
        } else if (file.name.endsWith('.mb')) {
          try {
            const data = JSON.parse(content);
            await NoteStorage.saveNote({
              title: data.title || file.name.replace(/\.[^/.]+$/, ''),
              content: data.content || '',
              folderId: data.folderId || 'default'
            });
            await refreshNotesList();
            showToast('Imported .mb note!');
          } catch (err) {
            const title = file.name.replace(/\.[^/.]+$/, '');
            await createNewNote(title, `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`);
          }
        } else {
          const title = file.name.replace(/\.[^/.]+$/, '');
          await createNewNote(title, `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Note Color Picker
    const colorPickers = document.querySelectorAll('.note-color-choice');
    colorPickers.forEach(picker => {
      picker.addEventListener('click', async () => {
        if (!currentNoteId) return;
        const color = picker.getAttribute('data-color') || '#ffffff';
        const note = await NoteStorage.getNoteById(currentNoteId);
        if (note) {
          note.color = color;
          await NoteStorage.saveNote(note);
          NoteSync.broadcastNoteUpdate(note);
          await refreshNotesList();
          showToast('Color updated!');
        }
      });
    });

    // Mobile Sidebar Drawer Toggle
    document.getElementById('btn-mobile-menu')?.addEventListener('click', () => {
      toggleMobileSidebar();
    });
    document.getElementById('sidebar-backdrop')?.addEventListener('click', () => {
      closeMobileSidebar();
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-container');
        if (modal) modal.classList.add('hidden');
      });
    });
  }

  // Keyboard Shortcuts
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentNote(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNewNote();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const newState = NepaliTransliterate.toggleNepaliTyping();
        applyNepaliTypingState(newState);
        showToast(newState ? 'नेपाली Typing ON' : 'English Typing ON');
      }
    });
  }

  // Modal helpers
  function showModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
  }

  function showSyncModal() {
    const input = document.getElementById('sync-code-input');
    if (input) input.value = NoteSync.getSyncCode();
    showModal('sync-modal');
  }

  async function showReminderModal() {
    if (!currentNoteId) {
      showToast('Please open or create a note first');
      return;
    }
    const note = await NoteStorage.getNoteById(currentNoteId);
    if (!note) return;

    const dateInput = document.getElementById('reminder-date-input');
    const timeInput = document.getElementById('reminder-time-input');
    const bsPreview = document.getElementById('reminder-bs-preview');

    const now = new Date(Date.now() + 10 * 60 * 1000);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');

    if (dateInput) dateInput.value = `${year}-${month}-${day}`;
    if (timeInput) timeInput.value = `${hours}:${mins}`;

    const updateBsPreview = () => {
      if (dateInput && bsPreview) {
        const bs = NepaliCalendar.adToBs(dateInput.value);
        bsPreview.textContent = `📅 BS Date: ${bs.formattedBSNepali} (${bs.formattedBSEnglish})`;
      }
    };
    updateBsPreview();
    dateInput?.addEventListener('change', updateBsPreview);

    showModal('reminder-modal');
  }

  async function saveReminderFromModal() {
    if (!currentNoteId) return;
    const dateInput = document.getElementById('reminder-date-input');
    const timeInput = document.getElementById('reminder-time-input');

    if (!dateInput || !timeInput || !dateInput.value || !timeInput.value) {
      alert('Please select both date and time');
      return;
    }

    const reminderDateTime = new Date(`${dateInput.value}T${timeInput.value}`);
    if (isNaN(reminderDateTime.getTime())) {
      alert('Invalid date or time');
      return;
    }

    const bs = NepaliCalendar.adToBs(dateInput.value);
    const note = await NoteStorage.getNoteById(currentNoteId);
    if (note) {
      note.reminder = {
        timestamp: reminderDateTime.getTime(),
        dateAD: dateInput.value,
        dateBS: bs.formattedBSNepali,
        time: timeInput.value,
        triggered: false,
        active: true
      };
      await NoteStorage.saveNote(note);
      NoteSync.broadcastNoteUpdate(note);
      closeModal('reminder-modal');
      await refreshNotesList();
      showToast(`Reminder set for ${bs.formattedBSNepali} (${timeInput.value})! ⏰`);
    }
  }

  async function showRenameModal() {
    if (!currentNoteId) return;
    const note = await NoteStorage.getNoteById(currentNoteId);
    if (!note) return;

    const input = document.getElementById('rename-title-input');
    if (input) input.value = note.title || '';
    showModal('rename-modal');
  }

  function showNoteActionModal(note) {
    const action = prompt(`Options for "${note.title}":\n1. Rename\n2. ${note.pinned ? 'Unpin' : 'Pin'}\n3. Delete\nType 1, 2, or 3:`);
    if (action === '1') {
      const newTitle = prompt('Enter new note title:', note.title);
      if (newTitle) {
        NoteStorage.renameNote(note.id, newTitle).then(() => {
          if (note.id === currentNoteId) NoteEditor.setTitle(newTitle);
          refreshNotesList();
        });
      }
    } else if (action === '2') {
      note.pinned = !note.pinned;
      NoteStorage.saveNote(note).then(() => refreshNotesList());
    } else if (action === '3') {
      NoteStorage.deleteNote(note.id, activeFilter === 'trash').then(() => refreshNotesList());
    }
  }

  function applyFont(fontName) {
    const fontMap = {
      'Mukta': "'Mukta', sans-serif",
      'Noto Sans Devanagari': "'Noto Sans Devanagari', sans-serif",
      'Poppins': "'Poppins', sans-serif",
      'Fira Code': "'Fira Code', monospace",
      'Roboto': "'Roboto', sans-serif"
    };

    const fontStyle = fontMap[fontName] || "'Mukta', sans-serif";
    NoteEditor.setFontFamily(fontStyle);

    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect) fontSelect.value = fontName;
  }

  function applyNepaliTypingState(enabled) {
    NepaliTransliterate.toggleNepaliTyping(enabled);
    const nepaliBtn = document.getElementById('btn-toggle-nepali');
    if (nepaliBtn) {
      if (enabled) {
        nepaliBtn.classList.add('bg-red-600', 'text-white');
        nepaliBtn.classList.remove('bg-gray-100', 'text-gray-700', 'dark:bg-gray-800', 'dark:text-gray-300');
        nepaliBtn.innerHTML = '🇳🇵 नेपाली (ON)';
      } else {
        nepaliBtn.classList.remove('bg-red-600', 'text-white');
        nepaliBtn.classList.add('bg-gray-100', 'text-gray-700', 'dark:bg-gray-800', 'dark:text-gray-300');
        nepaliBtn.innerHTML = '🇳🇵 नेपाली (OFF)';
      }
    }
  }

  function applySpellCheckState(enabled) {
    NoteEditor.setSpellCheck(enabled);
    const spellBtn = document.getElementById('btn-toggle-spellcheck');
    if (spellBtn) {
      spellBtn.classList.toggle('text-indigo-600', enabled);
      spellBtn.classList.toggle('font-bold', enabled);
    }
  }

  // Sync Callbacks
  function handleSyncStatusChange(status) {
    const badge = document.getElementById('sync-status-badge');
    if (!badge) return;

    if (status.state === 'connected') {
      const peerText = status.peerCount > 0 
        ? `${status.peerCount} Device${status.peerCount > 1 ? 's' : ''}` 
        : 'Live';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> <span class="truncate">Room: <b>${status.syncCode}</b> (${peerText})</span>`;
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 cursor-pointer';
    } else if (status.state === 'syncing') {
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> <span>Syncing...</span>`;
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 cursor-pointer';
    } else {
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-400"></span> <span>Offline</span>`;
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700 cursor-pointer';
    }
  }

  async function handleIncomingNoteSync(type, payload) {
    if (type === 'upsert') {
      if (currentNoteId === payload.id) {
        NoteEditor.setTitle(payload.title);
        NoteEditor.setContent(payload.content);
      }
    } else if (type === 'delete') {
      if (currentNoteId === payload.id) {
        currentNoteId = null;
        NoteEditor.setTitle('');
        NoteEditor.setContent('');
      }
    }
    await refreshFoldersList();
    await refreshNotesList();
  }

  // Toast notifications
  function showToast(msg) {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed bottom-14 md:bottom-5 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-fade-in pointer-events-none';
    toast.textContent = msg;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  // Mobile drawer controls
  function toggleMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar?.classList.toggle('-translate-x-full');
    backdrop?.classList.toggle('hidden');
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar?.classList.add('-translate-x-full');
    backdrop?.classList.add('hidden');
  }

  // Admin Panel & ID Management Controller
  let isAdminAuthenticated = false;

  function setupAdminPanel() {
    const adminBtn = document.getElementById('btn-open-admin-modal');
    const userInput = document.getElementById('admin-user-auth-input');
    const pinInput = document.getElementById('admin-pin-auth-input');
    const submitPinBtn = document.getElementById('btn-submit-admin-pin');
    const pinError = document.getElementById('admin-pin-error');
    const authView = document.getElementById('admin-auth-lock-view');
    const dashboardView = document.getElementById('admin-dashboard-content');
    const lockBtn = document.getElementById('btn-admin-lock-session');

    adminBtn?.addEventListener('click', () => {
      showModal('admin-panel-modal');
      if (isAdminAuthenticated) {
        authView?.classList.add('hidden');
        dashboardView?.classList.remove('hidden');
        lockBtn?.classList.remove('hidden');
        renderAdminDashboard();
      } else {
        authView?.classList.remove('hidden');
        dashboardView?.classList.add('hidden');
        lockBtn?.classList.add('hidden');
        if (userInput) {
          userInput.value = '';
          setTimeout(() => userInput.focus(), 150);
        }
        if (pinInput) pinInput.value = '';
      }
    });

    function checkAdminAuth() {
      const enteredUser = userInput ? userInput.value.trim() : '';
      const enteredPass = pinInput ? pinInput.value.trim() : '';

      if (NoteAdmin.authenticate(enteredUser, enteredPass)) {
        isAdminAuthenticated = true;
        if (pinError) pinError.classList.add('hidden');
        authView?.classList.add('hidden');
        dashboardView?.classList.remove('hidden');
        lockBtn?.classList.remove('hidden');
        renderAdminDashboard();
        showToast('Welcome, Admin Alok! 👑');
      } else {
        if (pinError) pinError.classList.remove('hidden');
        if (pinInput) pinInput.value = '';
      }
    }

    submitPinBtn?.addEventListener('click', checkAdminAuth);
    userInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && pinInput) pinInput.focus();
    });
    pinInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkAdminAuth();
    });

    lockBtn?.addEventListener('click', () => {
      isAdminAuthenticated = false;
      authView?.classList.remove('hidden');
      dashboardView?.classList.add('hidden');
      lockBtn?.classList.add('hidden');
      showToast('Admin Session Locked 🔒');
    });

    // Create New Room ID
    document.getElementById('btn-admin-create-room')?.addEventListener('click', () => {
      const codeEl = document.getElementById('admin-new-room-code');
      const pinEl = document.getElementById('admin-new-room-pin');
      const descEl = document.getElementById('admin-new-room-desc');

      const code = codeEl ? codeEl.value.trim() : '';
      const pin = pinEl ? pinEl.value.trim() : '8264';
      const desc = descEl ? descEl.value.trim() : '';

      const res = NoteAdmin.createRoom(code, pin, desc);
      if (res.success) {
        showToast(res.message);
        if (codeEl) codeEl.value = '';
        if (descEl) descEl.value = '';
        renderAdminDashboard();
      } else {
        alert(res.error || 'Failed to create room ID.');
      }
    });
  }

  async function renderAdminDashboard() {
    const stats = await NoteAdmin.getSystemStats();
    const rooms = NoteAdmin.getKnownRooms();
    const meta = NoteAdmin.getRoomsMetadata();

    // Update Stats Badges
    const statRooms = document.getElementById('admin-stat-rooms');
    const statNotes = document.getElementById('admin-stat-notes');
    const statStorageUsed = document.getElementById('admin-stat-storage-used');
    const statStorageAvailable = document.getElementById('admin-stat-storage-available');

    if (statRooms) statRooms.textContent = stats.totalRooms;
    if (statNotes) statNotes.textContent = stats.totalNotes;
    if (statStorageUsed) statStorageUsed.textContent = stats.storageUsed;
    if (statStorageAvailable) statStorageAvailable.textContent = stats.storageAvailable;

    // Render Table
    const tableBody = document.getElementById('admin-rooms-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    const currentActiveRoom = NoteSync.getSyncCode();

    Object.keys(rooms).forEach(roomCode => {
      const pin = rooms[roomCode];
      const roomMeta = meta[roomCode] || {};
      const isActive = roomCode === currentActiveRoom;
      const isDefault = roomCode === 'alok';

      const row = document.createElement('div');
      row.className = `p-3 flex items-center justify-between gap-2 text-xs ${
        isActive ? 'bg-indigo-50/70 dark:bg-indigo-950/40 font-semibold' : ''
      }`;

      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="w-7 h-7 rounded-xl ${
            isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          } flex items-center justify-center font-mono font-bold text-[11px] flex-shrink-0">
            ${roomCode.substring(0, 2).toUpperCase()}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-gray-900 dark:text-white uppercase">${roomCode}</span>
              ${isActive ? '<span class="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">ACTIVE NOW</span>' : ''}
            </div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
              ${roomMeta.description || 'Custom Room'} • PIN: ••••
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${!isActive ? `
            <button class="btn-admin-switch-room px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]" data-code="${roomCode}" data-pin="${pin}">
              Switch
            </button>
          ` : ''}
          ${!isDefault ? `
            <button class="btn-admin-del-room px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 text-red-600 dark:text-red-400 font-semibold text-[11px]" data-code="${roomCode}">
              Delete 🗑️
            </button>
          ` : ''}
        </div>
      `;

      row.querySelector('.btn-admin-switch-room')?.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        const pin = e.currentTarget.getAttribute('data-pin');
        NoteSync.setSyncCode(code, pin);
        renderAdminDashboard();
        showToast(`Switched active Room to "${code}" 🚀`);
      });

      row.querySelector('.btn-admin-del-room')?.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        if (confirm(`Are you sure you want to delete Room ID "${code}"?`)) {
          const res = NoteAdmin.deleteRoom(code);
          if (res.success) {
            showToast(res.message);
            renderAdminDashboard();
          } else {
            alert(res.error);
          }
        }
      });

      tableBody.appendChild(row);
    });
  }

  // Service Worker for offline PWA
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('ServiceWorker registered:', reg.scope))
          .catch(err => console.log('ServiceWorker registration failed:', err));
      });
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  return {
    init,
    openNote,
    createNewNote,
    refreshNotesList,
    refreshFoldersList,
    showToast
  };
})();

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

if (typeof window !== 'undefined') {
  window.App = App;
}

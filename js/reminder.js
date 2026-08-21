/**
 * Notification & Reminder Manager for NoteHub
 * Supports Browser Push Notifications, in-app modal popup alerts,
 * and Web Audio API chime sounds with offline capability.
 */

const NoteReminder = (() => {
  let reminderCheckInterval = null;
  let activeAlertModal = null;

  function init() {
    // Check for due reminders every 10 seconds
    if (reminderCheckInterval) clearInterval(reminderCheckInterval);
    reminderCheckInterval = setInterval(checkDueReminders, 10000);
    // Request notification permission if not yet decided
    requestBrowserNotificationPermission();
  }

  function requestBrowserNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }

  // Play audio chime using Web Audio API (works completely offline)
  function playReminderChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.01, startTime);
        gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(587.33, now, 0.4);        // D5
      playTone(880.00, now + 0.15, 0.4); // A5
      playTone(1174.66, now + 0.3, 0.6); // D6
    } catch (e) {
      console.warn('Audio chime failed:', e);
    }
  }

  async function checkDueReminders() {
    const allNotes = await NoteStorage.getAllNotes();
    const now = Date.now();

    for (const note of allNotes) {
      if (note.reminder && note.reminder.active && !note.reminder.triggered) {
        const reminderTime = new Date(note.reminder.timestamp).getTime();
        if (now >= reminderTime) {
          // Trigger reminder
          triggerReminder(note);
        }
      }
    }
  }

  async function triggerReminder(note) {
    // Mark as triggered in storage
    note.reminder.triggered = true;
    await NoteStorage.saveNote(note);

    // Play chime sound
    playReminderChime();

    // Browser Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`⏰ NoteHub Reminder: ${note.title || 'Note'}`, {
          body: getSnippet(note.content),
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: `reminder-${note.id}`
        });
        notif.onclick = () => {
          window.focus();
          if (window.App && window.App.openNote) {
            window.App.openNote(note.id);
          }
        };
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }

    // In-app Animated Popup Alert
    showInAppReminderPopup(note);
  }

  function getSnippet(htmlContent) {
    if (!htmlContent) return 'Time to check your note!';
    const div = document.createElement('div');
    div.innerHTML = htmlContent;
    const txt = div.textContent || div.innerText || '';
    return txt.substring(0, 120) + (txt.length > 120 ? '...' : '');
  }

  function showInAppReminderPopup(note) {
    // Remove existing alert if present
    const existing = document.getElementById('notehub-reminder-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'notehub-reminder-popup';
    popup.className = 'fixed bottom-6 right-6 z-50 max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-indigo-500 p-5 transform transition-all duration-300 animate-bounce-short text-gray-900 dark:text-gray-100';

    const bsInfo = note.reminder.dateBS || NepaliCalendar.adToBs(new Date()).formattedBSNepali;

    popup.innerHTML = `
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-2xl flex-shrink-0 text-indigo-600 dark:text-indigo-400">
          ⏰
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Note Reminder Alert</span>
            <span class="text-xs text-gray-500">${note.reminder.time || 'Due Now'}</span>
          </div>
          <h4 class="font-bold text-lg text-gray-900 dark:text-white truncate mt-0.5">${escapeHtml(note.title || 'Untitled Note')}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📅 ${bsInfo}</p>
          <div class="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
            ${escapeHtml(getSnippet(note.content))}
          </div>
          <div class="mt-4 flex items-center justify-end gap-2">
            <button id="reminder-snooze-btn" class="px-3 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors">
              Snooze 5m
            </button>
            <button id="reminder-open-btn" class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
              Open Note
            </button>
            <button id="reminder-dismiss-btn" class="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Event listeners
    document.getElementById('reminder-open-btn').onclick = () => {
      popup.remove();
      if (window.App && window.App.openNote) {
        window.App.openNote(note.id);
      }
    };

    document.getElementById('reminder-snooze-btn').onclick = async () => {
      popup.remove();
      // Snooze 5 minutes
      const newTime = Date.now() + 5 * 60 * 1000;
      note.reminder.timestamp = newTime;
      note.reminder.triggered = false;
      await NoteStorage.saveNote(note);
    };

    document.getElementById('reminder-dismiss-btn').onclick = () => {
      popup.remove();
    };
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return {
    init,
    playReminderChime,
    triggerReminder,
    requestBrowserNotificationPermission
  };
})();

if (typeof window !== 'undefined') {
  window.NoteReminder = NoteReminder;
}

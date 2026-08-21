# NoteHub Nepal 🇳🇵 - Smart Nepali & English Cloud Notepad

A modern, responsive, offline-ready Note Taking Web Application with real-time multi-device cloud synchronization, Nepali Unicode typing, dual Gregorian (AD) and Bikram Sambat (BS) live calendar timestamps, right-click "Copy to Note", rich formatting with checklists, reminders with audio chime popups, and full file management.

---

## ✨ Key Features

1. **Right-Click & Selection "Copy to Note"**:
   - Highlight any text anywhere in the browser and choose **➕ Add to Note** or **📝 New Note**.
   - Custom Right-Click Context Menu with options:
     - 📋 Copy Selection to Current Note
     - 📝 Create New Note from Selection
     - ⏰ Append with Dual Nepali (BS) & Gregorian (AD) Timestamp
     - 📄 Copy to Clipboard

2. **Nepali & English Support + Typing Mode**:
   - Native Romanized Nepali typing (e.g. typing `namaste` becomes `नमस्ते`, `nepal` becomes `नेपाल`, `alok` becomes `आलोक`).
   - Quick toggle button on header + keyboard shortcut (`Ctrl + G`).
   - Integrated Google Fonts: *Mukta*, *Noto Sans Devanagari*, *Poppins*, *Roboto*, *Fira Code*.
   - Integrated Spellchecker toggle (`✓ Spellcheck`).

3. **Dual AD & BS Live Calendar Timestamps**:
   - Real-time live Bikram Sambat (BS) clock and Gregorian (AD) clock in the top bar.
   - Every note is automatically stamped with both AD and BS dates in Nepali script (e.g., `२०८३ भदौ ५, शुक्रबार`).

4. **Multi-Device Cloud Sync with Custom Room Code (e.g., `alok`)**:
   - Sync between Mobile, Desktop, Laptop, and Tablet effortlessly.
   - Enter your Room ID / Sync Code (e.g., `alok`).
   - Powered by WebRTC peer-to-peer real-time data channels with cloud relay fallback.

5. **Rich Formatting & Checklists**:
   - **Text styles**: Bold, Italic, Underline, Strikethrough.
   - **Headings**: H1, H2, H3, Paragraph.
   - **Lists**: Bullet lists (`•`), Numbered lists (`1.`), and interactive **To-Do Checklists** with clickable checkboxes.
   - **Highlights**: Multi-color highlighting (Yellow, Green, Sky, Pink).
   - **Code blocks & Quotes**: Syntax code blocks and blockquotes.

6. **Notification & Reminder Popups**:
   - Schedule reminders with specific date (AD & BS) and time.
   - In-app animated popup alert modal + crystal-clear Web Audio API chime sound + browser push notification.
   - Snooze (5 minutes) and Dismiss options.

7. **File & Note Management**:
   - New Note (`Ctrl + N`), Save (`Ctrl + S`), Rename, Pin/Unpin, Color Tagging.
   - Trash bin with restore and permanent delete / empty trash.
   - Search across all notes in English and Nepali.
   - Export to **Plain Text (.txt)**, **Markdown (.md)**, or **Full JSON Backup**.
   - Import from **.txt**, **.md**, or **.json** backup files.

8. **100% Offline Ready (PWA)**:
   - Built with Service Worker and IndexedDB for local-first zero-latency offline operation.
   - Installable as an app on Android, iOS, Windows, and macOS.

---

## 🚀 How to Deploy to Netlify (`.netlify.com`)

1. **Option A: Drag & Drop Deploy**
   - Go to [Netlify Drop](https://app.netlify.com/drop).
   - Drag and drop this folder (`/notepad`).
   - Your website is instantly live at `https://your-name.netlify.app`!

2. **Option B: GitHub / Git Deploy**
   - Push this repository to GitHub or GitLab.
   - Link the repository in your Netlify dashboard.
   - Build command: *(leave empty)*
   - Publish directory: `.` (root)
   - Deploy site!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + S` / `Cmd + S` | Save Current Note |
| `Ctrl + N` / `Cmd + N` | Create New Note |
| `Ctrl + G` / `Cmd + G` | Toggle Nepali Romanized Typing Mode |
| `Ctrl + B` / `Cmd + B` | Bold Text |
| `Ctrl + I` / `Cmd + I` | Italic Text |
| `Ctrl + U` / `Cmd + U` | Underline Text |

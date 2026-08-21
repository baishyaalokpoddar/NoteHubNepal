/**
 * Rich Text Editor, Auto-Suggestion Bar, & Context Menu Controller
 * Handles rich text formatting, live offline auto-suggestions/spelling hints,
 * customizable popup options, and Nepali transliteration.
 */

const NoteEditor = (() => {
  let editorEl = null;
  let titleEl = null;
  let selectionTooltipEl = null;
  let contextMenuEl = null;
  let suggestionBarEl = null;
  let lastSelectionText = '';
  let onContentChangeCallback = null;
  let currentWordRange = null;
  let suggestionDebounceTimer = null;
  let statsDebounceTimer = null;
  let scrollThrottleTimer = null;

  function init(options = {}) {
    editorEl = document.getElementById('note-editor');
    titleEl = document.getElementById('note-title');
    selectionTooltipEl = document.getElementById('selection-tooltip');
    contextMenuEl = document.getElementById('custom-context-menu');
    suggestionBarEl = document.getElementById('auto-suggestion-bar');
    onContentChangeCallback = options.onContentChange || null;

    setupEditorEventListeners();
    setupFormattingToolbar();
    setupSelectionListeners();
    setupCustomContextMenu();
    setupAutoSuggestions();
  }

  function setupEditorEventListeners() {
    if (!editorEl) return;

    editorEl.addEventListener('input', (e) => {
      if (onContentChangeCallback) {
        onContentChangeCallback();
      }
      debouncedUpdateStats();
      debouncedTriggerAutoSuggestions();
    });

    titleEl.addEventListener('input', (e) => {
      if (onContentChangeCallback) {
        onContentChangeCallback();
      }
    });

    editorEl.addEventListener('keydown', handleEditorKeydown);
    titleEl.addEventListener('keydown', handleEditorKeydown);

    editorEl.addEventListener('click', (e) => {
      if (e.target && e.target.type === 'checkbox') {
        const checkbox = e.target;
        if (checkbox.checked) {
          checkbox.setAttribute('checked', 'checked');
          checkbox.parentElement.classList.add('task-completed');
        } else {
          checkbox.removeAttribute('checked');
          checkbox.parentElement.classList.remove('task-completed');
        }
        if (onContentChangeCallback) {
          onContentChangeCallback();
        }
      }
    });
  }

  function handleEditorKeydown(e) {
    // Hide suggestions on Escape
    if (e.key === 'Escape' && suggestionBarEl) {
      suggestionBarEl.classList.add('hidden');
      return;
    }

    // Tab key accepts first suggestion if visible
    if (e.key === 'Tab' && suggestionBarEl && !suggestionBarEl.classList.contains('hidden')) {
      const firstBtn = suggestionBarEl.querySelector('.suggestion-pill');
      if (firstBtn) {
        e.preventDefault();
        firstBtn.click();
        return;
      }
    }

    // Nepali Transliteration typing support
    if (NepaliTransliterate.isEnabled()) {
      if (e.key === ' ' || e.key === 'Enter' || e.key === ',' || e.key === '.') {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const node = sel.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) {
          const textBeforeCursor = node.textContent.substring(0, sel.anchorOffset);
          const words = textBeforeCursor.split(/[\s,.]+/);
          const lastWord = words[words.length - 1];

          if (lastWord && /^[a-zA-Z0-9]+$/.test(lastWord)) {
            const converted = NepaliTransliterate.transliterateWord(lastWord);
            if (converted && converted !== lastWord) {
              e.preventDefault();
              const startIdx = sel.anchorOffset - lastWord.length;
              const newText = node.textContent.substring(0, startIdx) + converted + (e.key === 'Enter' ? '\n' : e.key) + node.textContent.substring(sel.anchorOffset);
              node.textContent = newText;

              const newOffset = startIdx + converted.length + 1;
              const newRange = document.createRange();
              newRange.setStart(node, Math.min(newOffset, node.textContent.length));
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);

              if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
              if (onContentChangeCallback) onContentChangeCallback();
            }
          }
        }
      }
    }
  }

  // Live Auto-Suggestion Bar
  function setupAutoSuggestions() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#auto-suggestion-bar') && !e.target.closest('#note-editor')) {
        if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
      }
    });
  }

  function debouncedTriggerAutoSuggestions() {
    if (suggestionDebounceTimer) clearTimeout(suggestionDebounceTimer);
    suggestionDebounceTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        triggerAutoSuggestions();
      });
    }, 200);
  }

  function debouncedUpdateStats() {
    if (statsDebounceTimer) clearTimeout(statsDebounceTimer);
    statsDebounceTimer = setTimeout(() => {
      updateStats();
    }, 350);
  }

  function triggerAutoSuggestions() {
    const settings = NoteStorage.getSettings();
    if (settings.popupSettings && settings.popupSettings.autoSuggestions === false) {
      if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
      return;
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
      return;
    }

    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
      return;
    }

    const textBeforeCursor = node.textContent.substring(0, sel.anchorOffset);
    const match = textBeforeCursor.match(/([a-zA-Z0-9\u0900-\u097F]+)$/);
    if (!match || match[1].length < 2) {
      if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
      return;
    }

    const currentWord = match[1];
    if (window.NoteDictionary) {
      const suggestions = NoteDictionary.getAutoSuggestions(currentWord);
      if (suggestions.length > 0 && suggestionBarEl) {
        renderAutoSuggestions(suggestions, currentWord, node, sel.anchorOffset);
      } else {
        if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
      }
    }
  }

  function renderAutoSuggestions(suggestions, currentWord, textNode, cursorOffset) {
    if (!suggestionBarEl) return;
    suggestionBarEl.innerHTML = '';

    suggestions.slice(0, 5).forEach((s, idx) => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-pill px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 rounded-lg flex items-center gap-1.5 transition-colors flex-shrink-0 font-medium text-gray-800 dark:text-gray-200';
      btn.innerHTML = `
        <span class="${s.isNepali ? 'font-nepali font-bold text-red-600 dark:text-red-400 group-hover:text-white' : ''}">${escapeHtml(s.word)}</span>
        <span class="text-[10px] text-gray-400 dark:text-gray-400">${escapeHtml(s.subtitle || '')}</span>
      `;

      btn.onmousedown = (e) => {
        e.preventDefault();
        applySuggestion(s.insertText, currentWord, textNode, cursorOffset);
      };

      suggestionBarEl.appendChild(btn);
    });

    suggestionBarEl.classList.remove('hidden');
  }

  function applySuggestion(replacement, currentWord, textNode, cursorOffset) {
    const sel = window.getSelection();
    if (!textNode || !sel) return;

    const startIdx = cursorOffset - currentWord.length;
    const newText = textNode.textContent.substring(0, startIdx) + replacement + ' ' + textNode.textContent.substring(cursorOffset);
    textNode.textContent = newText;

    const newOffset = startIdx + replacement.length + 1;
    const newRange = document.createRange();
    newRange.setStart(textNode, Math.min(newOffset, textNode.textContent.length));
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    if (suggestionBarEl) suggestionBarEl.classList.add('hidden');
    if (onContentChangeCallback) onContentChangeCallback();
  }

  // Formatting Toolbar
  function setupFormattingToolbar() {
    const bindBtn = (id, command, value = null) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          editorEl.focus();
          document.execCommand(command, false, value);
          if (onContentChangeCallback) onContentChangeCallback();
        });
      }
    };

    bindBtn('btn-bold', 'bold');
    bindBtn('btn-italic', 'italic');
    bindBtn('btn-underline', 'underline');
    bindBtn('btn-strike', 'strikeThrough');
    bindBtn('btn-h1', 'formatBlock', '<h1>');
    bindBtn('btn-h2', 'formatBlock', '<h2>');
    bindBtn('btn-h3', 'formatBlock', '<h3>');
    bindBtn('btn-paragraph', 'formatBlock', '<p>');
    bindBtn('btn-quote', 'formatBlock', '<blockquote>');
    bindBtn('btn-ul', 'insertUnorderedList');
    bindBtn('btn-ol', 'insertOrderedList');
    bindBtn('btn-clear', 'removeFormat');

    document.getElementById('btn-task')?.addEventListener('click', (e) => {
      e.preventDefault();
      insertChecklist();
    });

    document.getElementById('btn-code')?.addEventListener('click', (e) => {
      e.preventDefault();
      insertCodeBlock();
    });

    // Image Upload & Insertion Button
    const imageInput = document.getElementById('note-image-file-input');
    document.getElementById('btn-insert-image')?.addEventListener('click', (e) => {
      e.preventDefault();
      imageInput?.click();
    });

    imageInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        insertImageFromFile(file);
      }
      e.target.value = '';
    });

    // Video Upload & Insertion Button
    const videoInput = document.getElementById('note-video-file-input');
    document.getElementById('btn-insert-video')?.addEventListener('click', (e) => {
      e.preventDefault();
      showVideoOptionsModal();
    });

    document.getElementById('btn-modal-upload-video')?.addEventListener('click', () => {
      if (typeof closeModal === 'function') closeModal('share-note-modal');
      videoInput?.click();
    });

    document.getElementById('btn-modal-embed-youtube')?.addEventListener('click', () => {
      if (typeof closeModal === 'function') closeModal('share-note-modal');
      if (typeof showModal === 'function') showModal('video-url-modal');
    });

    videoInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        insertVideoFromFile(file);
      }
      e.target.value = '';
    });

    document.getElementById('btn-submit-youtube-embed')?.addEventListener('click', () => {
      const urlInput = document.getElementById('youtube-url-input');
      const url = urlInput ? urlInput.value.trim() : '';
      if (url) {
        insertYouTubeEmbed(url);
        if (urlInput) urlInput.value = '';
        if (typeof closeModal === 'function') closeModal('video-url-modal');
      }
    });

    // Handle Media Paste from Clipboard (Images & Videos)
    editorEl.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (items) {
        for (const item of items) {
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) insertImageFromFile(blob);
            return;
          }
          if (item.type.indexOf('video') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) insertVideoFromFile(blob);
            return;
          }
        }
      }
    });

    // Handle Drag & Drop for Images and Videos
    editorEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      editorEl.classList.add('border-indigo-500', 'bg-indigo-50/20');
    });

    editorEl.addEventListener('dragleave', () => {
      editorEl.classList.remove('border-indigo-500', 'bg-indigo-50/20');
    });

    editorEl.addEventListener('drop', (e) => {
      e.preventDefault();
      editorEl.classList.remove('border-indigo-500', 'bg-indigo-50/20');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          insertImageFromFile(file);
        } else if (file.type.startsWith('video/')) {
          insertVideoFromFile(file);
        }
      }
    });

    document.querySelectorAll('.highlight-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const color = btn.getAttribute('data-color') || '#fef08a';
        applyHighlight(color);
      });
    });

    setupMobileKeyboardOptimization();
  }

  function showVideoOptionsModal() {
    const choice = prompt("Insert Video:\n1. Upload Video File (.mp4, .webm, .mov)\n2. Embed YouTube / Vimeo Video URL\nType 1 or 2:");
    if (choice === '1') {
      document.getElementById('note-video-file-input')?.click();
    } else if (choice === '2') {
      const url = prompt("Paste YouTube or Video URL (e.g. https://www.youtube.com/watch?v=...):");
      if (url) insertYouTubeEmbed(url);
    }
  }

  function insertVideoFromFile(file) {
    if (typeof showToast === 'function') showToast(`Loading video "${file.name}"... 🎥`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const videoDataUrl = event.target.result;
      insertVideoHtml(videoDataUrl, file.name);
    };
    reader.readAsDataURL(file);
  }

  function insertVideoHtml(src, title = 'Video') {
    editorEl.focus();
    const videoHtml = `<div class="note-video-container my-3 text-center" contenteditable="false">
      <video src="${src}" controls playsinline class="note-video-player max-w-full max-h-[450px] inline-block rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"></video>
      <div class="text-[11px] text-gray-400 mt-1 italic">${escapeHtml(title)}</div>
    </div><p><br></p>`;
    document.execCommand('insertHTML', false, videoHtml);
    if (onContentChangeCallback) onContentChangeCallback();
    if (typeof showToast === 'function') showToast('Video inserted! 🎬');
  }

  function insertYouTubeEmbed(url) {
    let embedUrl = '';
    // YouTube
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    } else if (url.includes('vimeo.com/')) {
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch && vimeoMatch[1]) {
        embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
    }

    if (embedUrl) {
      editorEl.focus();
      const iframeHtml = `<div class="video-embed-wrapper my-3" contenteditable="false">
        <iframe src="${embedUrl}" title="Embedded Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div><p><br></p>`;
      document.execCommand('insertHTML', false, iframeHtml);
      if (onContentChangeCallback) onContentChangeCallback();
      if (typeof showToast === 'function') showToast('YouTube video embedded! 🎥✨');
    } else {
      insertVideoHtml(url, 'Online Video');
    }
  }

  // Mobile Keyboard Optimization
  function setupMobileKeyboardOptimization() {
    if (typeof window === 'undefined') return;

    // Detect virtual keyboard resize via visualViewport
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const isKeyboardOpen = window.visualViewport.height < window.innerHeight - 100;
        document.body.classList.toggle('keyboard-open', isKeyboardOpen);
        if (isKeyboardOpen) {
          scrollCursorIntoView();
        }
      });
    }

    // Auto-scroll on cursor typing and focus
    editorEl.addEventListener('focus', () => {
      setTimeout(scrollCursorIntoView, 250);
    });

    editorEl.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Backspace') {
        scrollCursorIntoView();
      }
    });
  }

  function scrollCursorIntoView() {
    if (scrollThrottleTimer) return;
    scrollThrottleTimer = setTimeout(() => {
      scrollThrottleTimer = null;
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.top > 0 && rect.bottom > 0) {
          if (rect.bottom > (window.innerHeight - 150) || rect.top < 90) {
            range.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
    }, 250);
  }

  function insertImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target.result;
      insertImageHtml(base64Url, file.name);
    };
    reader.readAsDataURL(file);
  }

  function insertImageHtml(src, alt = 'Uploaded Image') {
    editorEl.focus();
    const imgHtml = `<div class="note-image-wrapper my-3 text-center" contenteditable="false">
      <img src="${src}" alt="${escapeHtml(alt)}" class="rounded-xl shadow-md max-w-full max-h-[500px] inline-block border border-gray-200 dark:border-gray-700 hover:scale-[1.01] transition-transform">
      <div class="text-[11px] text-gray-400 mt-1 italic">${escapeHtml(alt)}</div>
    </div><p><br></p>`;
    document.execCommand('insertHTML', false, imgHtml);
    if (onContentChangeCallback) onContentChangeCallback();
    showToast('Image inserted into note! 🖼️');
  }

  function applyHighlight(color) {
    editorEl.focus();
    const sel = window.getSelection();
    if (!sel.isCollapsed && sel.rangeCount > 0) {
      document.execCommand('hiliteColor', false, color);
      if (onContentChangeCallback) onContentChangeCallback();
    }
  }

  function insertChecklist() {
    editorEl.focus();
    const html = `<div class="task-item flex items-center gap-2 my-1"><input type="checkbox" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"><span class="task-text">To-do task...</span></div><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    if (onContentChangeCallback) onContentChangeCallback();
  }

  function insertCodeBlock() {
    editorEl.focus();
    const html = `<pre class="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 rounded-lg font-mono text-sm my-2 overflow-x-auto"><code>// Write code here...</code></pre><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    if (onContentChangeCallback) onContentChangeCallback();
  }

  // Floating Selection Tooltip
  function setupSelectionListeners() {
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text.length > 0) lastSelectionText = text;
    });

    document.addEventListener('mouseup', (e) => {
      if (e.target.closest('#selection-tooltip') || e.target.closest('#custom-context-menu')) {
        return;
      }

      const settings = NoteStorage.getSettings();
      if (settings.popupSettings && settings.popupSettings.selectionTooltip === false) {
        if (selectionTooltipEl) selectionTooltipEl.style.display = 'none';
        return;
      }

      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';

      if (text.length > 1 && selectionTooltipEl) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          selectionTooltipEl.style.display = 'flex';
          selectionTooltipEl.style.top = `${Math.max(10, window.scrollY + rect.top - 48)}px`;
          selectionTooltipEl.style.left = `${Math.max(10, window.scrollX + rect.left + (rect.width / 2) - 80)}px`;
          return;
        }
      }

      if (selectionTooltipEl) selectionTooltipEl.style.display = 'none';
    });

    document.getElementById('tooltip-copy-note-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      appendSelectionToCurrentNote(lastSelectionText);
      selectionTooltipEl.style.display = 'none';
    });

    document.getElementById('tooltip-new-note-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      createNewNoteFromSelection(lastSelectionText);
      selectionTooltipEl.style.display = 'none';
    });

    document.getElementById('tooltip-define-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDynamicDefinitionPopup(lastSelectionText);
      selectionTooltipEl.style.display = 'none';
    });

    // Double-click word definition trigger inside editor
    editorEl.addEventListener('dblclick', (e) => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text && /^[a-zA-Z\u0900-\u097F]+$/.test(text)) {
        showDynamicDefinitionPopup(text, e.clientX, e.clientY);
      }
    });
  }

  // Dynamic Word Definition Popup
  async function showDynamicDefinitionPopup(word, clientX = null, clientY = null) {
    if (!word || !window.NoteDictionary) return;
    const popup = document.getElementById('dynamic-dict-popup');
    if (!popup) return;

    popup.innerHTML = `
      <div class="p-3 text-xs flex items-center justify-center text-gray-500">
        <span>Looking up "${escapeHtml(word)}"...</span>
      </div>
    `;
    popup.classList.remove('hidden');

    // Position popup
    if (clientX !== null && clientY !== null) {
      popup.style.top = `${Math.min(window.innerHeight - 220, clientY + 15)}px`;
      popup.style.left = `${Math.min(window.innerWidth - 300, Math.max(10, clientX - 100))}px`;
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        popup.style.top = `${Math.min(window.innerHeight - 220, rect.bottom + 10)}px`;
        popup.style.left = `${Math.min(window.innerWidth - 300, Math.max(10, rect.left))}px`;
      }
    }

    const data = await NoteDictionary.lookupWordFull(word);
    if (!data) {
      popup.innerHTML = `
        <div class="p-3 text-xs text-gray-500 flex items-center justify-between">
          <span>No definition found for "${escapeHtml(word)}"</span>
          <button class="text-gray-400 hover:text-gray-600 p-1" onclick="document.getElementById('dynamic-dict-popup').classList.add('hidden')">✕</button>
        </div>
      `;
      return;
    }

    popup.innerHTML = `
      <div class="p-3 text-xs space-y-1.5">
        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-1.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-sm text-gray-900 dark:text-white capitalize">${escapeHtml(data.en)}</span>
            ${data.phonetic ? `<span class="text-[10px] text-gray-400 font-mono">${escapeHtml(data.phonetic)}</span>` : ''}
            ${data.np ? `<span class="px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold font-nepali text-xs">${escapeHtml(data.np)}</span>` : ''}
          </div>
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5" onclick="document.getElementById('dynamic-dict-popup').classList.add('hidden')">✕</button>
        </div>
        <div class="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold italic">${escapeHtml(data.type || 'noun')}</div>
        <p class="text-gray-700 dark:text-gray-300 leading-snug">${escapeHtml(data.def || 'Meaning available.')}</p>
        ${data.example ? `<p class="text-[11px] text-gray-500 dark:text-gray-400 italic">"${escapeHtml(data.example)}"</p>` : ''}
        ${data.synonyms && data.synonyms.length > 0 ? `<div class="text-[10px] text-gray-400">Synonyms: ${escapeHtml(data.synonyms.join(', '))}</div>` : ''}
        <div class="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700/60 mt-1">
          <span class="text-[10px] text-gray-400">${data.isOnline ? '🌐 Online' : '⚡ Offline'}</span>
          <button id="btn-insert-dynamic-dict" class="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px]">
            + Insert
          </button>
        </div>
      </div>
    `;

    popup.querySelector('#btn-insert-dynamic-dict')?.addEventListener('click', () => {
      const defHtml = `<p><b>${escapeHtml(data.en)}</b> ${data.phonetic ? `<i>${escapeHtml(data.phonetic)}</i> ` : ''}(<span class="font-nepali text-red-600 dark:text-red-400">${escapeHtml(data.np)}</span>): ${escapeHtml(data.def)}</p>`;
      appendHtmlToCurrentNote(defHtml);
      popup.classList.add('hidden');
      showToast(`Inserted "${data.en}" into note`);
    });
  }

  // Custom Context Menu
  function setupCustomContextMenu() {
    if (!contextMenuEl) return;

    window.addEventListener('contextmenu', (e) => {
      const sel = window.getSelection();
      const selectedText = sel ? sel.toString().trim() : '';

      if (selectedText.length > 0) {
        e.preventDefault();
        lastSelectionText = selectedText;

        const menuWidth = 240;
        const menuHeight = 180;
        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        contextMenuEl.style.top = `${y}px`;
        contextMenuEl.style.left = `${x}px`;
        contextMenuEl.classList.remove('hidden');

        const previewEl = document.getElementById('ctx-selection-preview');
        if (previewEl) {
          previewEl.textContent = `"${selectedText.substring(0, 22)}${selectedText.length > 22 ? '...' : ''}"`;
        }
      } else {
        contextMenuEl.classList.add('hidden');
      }
    });

    window.addEventListener('click', (e) => {
      if (!e.target.closest('#custom-context-menu')) {
        contextMenuEl.classList.add('hidden');
      }
    });

    document.getElementById('ctx-copy-to-current')?.addEventListener('click', () => {
      appendSelectionToCurrentNote(lastSelectionText);
      contextMenuEl.classList.add('hidden');
    });

    document.getElementById('ctx-create-new-note')?.addEventListener('click', () => {
      createNewNoteFromSelection(lastSelectionText);
      contextMenuEl.classList.add('hidden');
    });

    document.getElementById('ctx-append-with-timestamp')?.addEventListener('click', () => {
      const dualTime = NepaliCalendar.formatFullDualTimestamp();
      const stampedText = `<p><small class="text-gray-400 font-mono">[${dualTime.bsNepali} | ${dualTime.time}]</small><br>${escapeHtml(lastSelectionText)}</p>`;
      appendHtmlToCurrentNote(stampedText);
      contextMenuEl.classList.add('hidden');
    });

    document.getElementById('ctx-copy-clipboard')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lastSelectionText);
        showToast('Copied to clipboard');
      } catch (e) {}
      contextMenuEl.classList.add('hidden');
    });
  }

  function appendSelectionToCurrentNote(text) {
    if (!text) return;
    const formatted = `<p>${escapeHtml(text)}</p>`;
    appendHtmlToCurrentNote(formatted);
    showToast('Appended to current note');
  }

  function appendHtmlToCurrentNote(html) {
    if (!editorEl) return;
    editorEl.focus();
    editorEl.innerHTML += html;
    if (onContentChangeCallback) onContentChangeCallback();
    updateStats();
  }

  async function createNewNoteFromSelection(text) {
    if (!text) return;
    const titleSnippet = text.split('\n')[0].substring(0, 40) || 'Note from selection';
    const note = await NoteStorage.saveNote({
      title: titleSnippet,
      content: `<p>${escapeHtml(text)}</p>`
    });
    if (window.App && window.App.openNote) {
      await window.App.refreshNotesList();
      window.App.openNote(note.id);
    }
    showToast('New note created from selected text');
  }

  function updateStats() {
    const text = editorEl ? (editorEl.innerText || editorEl.textContent || '') : '';
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const charCount = text.length;

    const statsEl = document.getElementById('note-stats');
    if (statsEl) {
      statsEl.textContent = `${wordCount} words • ${charCount} chars`;
    }
  }

  function setContent(content) {
    if (editorEl) {
      editorEl.innerHTML = content || '';
      updateStats();
    }
  }

  function getContent() {
    return editorEl ? editorEl.innerHTML : '';
  }

  function setTitle(title) {
    if (titleEl) titleEl.value = title || '';
  }

  function getTitle() {
    return titleEl ? titleEl.value : 'Untitled Note';
  }

  function setFontFamily(fontFamily) {
    if (editorEl) editorEl.style.fontFamily = fontFamily;
    if (titleEl) titleEl.style.fontFamily = fontFamily;
  }

  function setSpellCheck(enabled) {
    if (editorEl) editorEl.setAttribute('spellcheck', enabled ? 'true' : 'false');
    if (titleEl) titleEl.setAttribute('spellcheck', enabled ? 'true' : 'false');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(msg) {
    if (window.App && window.App.showToast) {
      window.App.showToast(msg);
    }
  }

  return {
    init,
    setContent,
    getContent,
    setTitle,
    getTitle,
    setFontFamily,
    setSpellCheck,
    updateStats,
    appendHtmlToCurrentNote,
    insertChecklist
  };
})();

if (typeof window !== 'undefined') {
  window.NoteEditor = NoteEditor;
}

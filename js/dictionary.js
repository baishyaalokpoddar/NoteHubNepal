/**
 * NoteHub Enhanced English & Nepali Dictionary Engine
 * Comprehensive offline dictionary with phonetic guides, parts of speech, synonyms,
 * example sentences, live prefix auto-suggestions, and dynamic online API fallback.
 */

const NoteDictionary = (() => {
  // Rich Offline Dictionary Database
  const offlineDatabase = [
    {
      en: "hello",
      np: "नमस्ते / नमस्कार",
      phonetic: "/həˈloʊ/",
      type: "greeting / interjection",
      def: "Used as a greeting or to begin a telephone conversation.",
      example: "Hello, it is a pleasure to meet you!",
      synonyms: ["hi", "greetings", "welcome", "namaste"]
    },
    {
      en: "namaste",
      np: "नमस्ते",
      phonetic: "/nʌmʌsˈteɪ/",
      type: "greeting",
      def: "A respectful greeting and gesture of bowing with joined palms in Nepal and India.",
      example: "We welcomed our guests by saying Namaste.",
      synonyms: ["greeting", "salutation", "pranam"]
    },
    {
      en: "nepal",
      np: "नेपाल",
      phonetic: "/nəˈpɔːl/",
      type: "proper noun",
      def: "A sovereign landlocked country in South Asia situated along the majestic Himalayas.",
      example: "Nepal is home to Mount Everest, the highest peak in the world.",
      synonyms: ["Federal Democratic Republic of Nepal", "Himalayan nation"]
    },
    {
      en: "nepali",
      np: "नेपाली",
      phonetic: "/nəˈpɔːli/",
      type: "noun / adjective",
      def: "The official Indo-Aryan language of Nepal, or a citizen/culture belonging to Nepal.",
      example: "She speaks fluent Nepali and English.",
      synonyms: ["Khas Kura", "Nepalese"]
    },
    {
      en: "alok",
      np: "आलोक / प्रकाश",
      phonetic: "/ɑːˈloʊk/",
      type: "noun",
      def: "Light, brightness, illumination, or spiritual enlightenment.",
      example: "Knowledge brings alok into our lives.",
      synonyms: ["light", "brightness", "radiance", "illumination"]
    },
    {
      en: "knowledge",
      np: "ज्ञान / विद्या",
      phonetic: "/ˈnɒl.ɪdʒ/",
      type: "noun",
      def: "Facts, information, and skills acquired through experience or education.",
      example: "Knowledge is the greatest power a human can possess.",
      synonyms: ["wisdom", "understanding", "learning", "erudition"]
    },
    {
      en: "peace",
      np: "शान्ति",
      phonetic: "/piːs/",
      type: "noun",
      def: "Freedom from disturbance; tranquility, serenity, or absence of conflict.",
      example: "Lumbini is the historic birthplace of Buddha and a world symbol of peace.",
      synonyms: ["tranquility", "serenity", "calm", "harmony"]
    },
    {
      en: "freedom",
      np: "स्वतन्त्रता / मुक्ति",
      phonetic: "/ˈfriː.dəm/",
      type: "noun",
      def: "The power or right to act, speak, or think as one wants without hindrance.",
      example: "Freedom of expression is a fundamental human right.",
      synonyms: ["liberty", "independence", "autonomy"]
    },
    {
      en: "success",
      np: "सफलता",
      phonetic: "/səkˈsɛs/",
      type: "noun",
      def: "The accomplishment of an aim, goal, or desired purpose.",
      example: "Hard work and consistency lead directly to success.",
      synonyms: ["triumph", "achievement", "victory", "prosperity"]
    },
    {
      en: "courage",
      np: "साहस / हिम्मत",
      phonetic: "/ˈkɜːr.ɪdʒ/",
      type: "noun",
      def: "The ability to do something that frightens one; bravery.",
      example: "The Gurkhas are world-famous for their incredible courage.",
      synonyms: ["bravery", "valor", "boldness", "fearlessness"]
    },
    {
      en: "friend",
      np: "साथी / मित्र",
      phonetic: "/frɛnd/",
      type: "noun",
      def: "A person with whom one has a bond of mutual affection and trust.",
      example: "A true friend is a treasure for a lifetime.",
      synonyms: ["companion", "mate", "partner", "ally"]
    },
    {
      en: "family",
      np: "परिवार",
      phonetic: "/ˈfæm.əl.i/",
      type: "noun",
      def: "A group consisting of parents and children living together, or ancestors and descendants.",
      example: "Family gives us unconditional love and strength.",
      synonyms: ["relatives", "household", "kin", "clan"]
    },
    {
      en: "mountain",
      np: "पहाड / हिमाल",
      phonetic: "/ˈmaʊn.tən/",
      type: "noun",
      def: "A large natural elevation of the earth's surface rising abruptly from the surrounding level.",
      example: "Mount Everest is the highest mountain on Earth.",
      synonyms: ["peak", "height", "summit", "elevation"]
    },
    {
      en: "river",
      np: "नदी / खोला",
      phonetic: "/ˈrɪv.ər/",
      type: "noun",
      def: "A large natural stream of water flowing in a channel to the sea, lake, or another river.",
      example: "The Koshi and Gandaki are vital rivers of Nepal.",
      synonyms: ["stream", "waterway", "tributary"]
    },
    {
      en: "water",
      np: "पानी / जल",
      phonetic: "/ˈwɔː.tər/",
      type: "noun",
      def: "A colorless, transparent, odorless liquid that forms the seas, lakes, and rivers.",
      example: "Clean drinking water is essential for good health.",
      synonyms: ["liquid", "aqua", "moisture"]
    },
    {
      en: "book",
      np: "किताब / पुस्तक",
      phonetic: "/bʊk/",
      type: "noun",
      def: "A written or printed work consisting of pages glued or sewn together.",
      example: "Reading a great book expands your imagination.",
      synonyms: ["volume", "tome", "publication", "manuscript"]
    },
    {
      en: "note",
      np: "नोट / टिपोट",
      phonetic: "/noʊt/",
      type: "noun / verb",
      def: "A brief record of points, ideas, or facts written down as an aid to memory.",
      example: "Take quick notes during the lecture for exam review.",
      synonyms: ["memo", "record", "jotting", "reminder"]
    },
    {
      en: "dream",
      np: "सपना",
      phonetic: "/driːm/",
      type: "noun / verb",
      def: "A series of thoughts or aspirations; a cherished ambition or ideal.",
      example: "Always have the courage to follow your dreams.",
      synonyms: ["aspiration", "ambition", "vision", "goal"]
    },
    {
      en: "goal",
      np: "लक्ष्य / उद्देश्य",
      phonetic: "/ɡoʊl/",
      type: "noun",
      def: "The object of a person's ambition or effort; an aim or desired result.",
      example: "Set clear goals and track your daily progress in NoteHub.",
      synonyms: ["objective", "target", "purpose", "aim"]
    },
    {
      en: "culture",
      np: "संस्कृति",
      phonetic: "/ˈkʌl.tʃər/",
      type: "noun",
      def: "The customs, arts, social institutions, and achievements of a particular nation or people.",
      example: "Nepal has a rich cultural heritage spanning thousands of years.",
      synonyms: ["tradition", "heritage", "customs", "folklore"]
    },
    {
      en: "love",
      np: "माया / प्रेम",
      phonetic: "/lʌv/",
      type: "noun / verb",
      def: "An intense feeling of deep affection, compassion, and care.",
      example: "Love and kindness make the world a better place.",
      synonyms: ["affection", "devotion", "fondness", "care"]
    },
    {
      en: "happiness",
      np: "खुसी / आनन्द",
      phonetic: "/ˈhæp.i.nəs/",
      type: "noun",
      def: "The state of being happy; contentment, joy, and pleasure.",
      example: "True happiness comes from inner peace and helping others.",
      synonyms: ["joy", "delight", "cheerfulness", "bliss"]
    },
    {
      en: "work",
      np: "काम / कार्य",
      phonetic: "/wɜːrk/",
      type: "noun / verb",
      def: "Activity involving mental or physical effort done in order to achieve a purpose.",
      example: "Consistent work is the key to mastering any skill.",
      synonyms: ["labor", "effort", "toil", "endeavor"]
    },
    {
      en: "study",
      np: "अध्ययन / पढाइ",
      phonetic: "/ˈstʌd.i/",
      type: "noun / verb",
      def: "The devotion of time and attention to acquiring knowledge on an academic subject.",
      example: "Organize your study notes with folders and tags.",
      synonyms: ["learning", "education", "research", "revision"]
    },
    {
      en: "time",
      np: "समय / काल",
      phonetic: "/taɪm/",
      type: "noun",
      def: "The indefinite continued progress of existence and events in the past, present, and future.",
      example: "Time is our most valuable non-renewable resource.",
      synonyms: ["moment", "period", "duration", "era"]
    },
    {
      en: "today",
      np: "आज",
      phonetic: "/təˈdeɪ/",
      type: "adverb / noun",
      def: "On or in the course of the present day.",
      example: "Today is a great day to begin writing your journal.",
      synonyms: ["this day", "nowadays", "present"]
    },
    {
      en: "tomorrow",
      np: "भोलि",
      phonetic: "/təˈmɔːr.oʊ/",
      type: "adverb / noun",
      def: "On the day after today.",
      example: "Plan today so you can conquer tomorrow.",
      synonyms: ["the next day", "future"]
    },
    {
      en: "yesterday",
      np: "हिजो",
      phonetic: "/ˈjɛs.tər.deɪ/",
      type: "adverb / noun",
      def: "On the day before today.",
      example: "Learn from yesterday, live for today, hope for tomorrow.",
      synonyms: ["the day before", "the past"]
    },
    {
      en: "beautiful",
      np: "सुन्दर / राम्रो",
      phonetic: "/ˈbjuː.tɪ.fəl/",
      type: "adjective",
      def: "Pleasing the senses or mind aesthetically.",
      example: "The sunrise over the Himalayas is breathtakingly beautiful.",
      synonyms: ["gorgeous", "lovely", "attractive", "stunning"]
    },
    {
      en: "smart",
      np: "चलाख / बुद्धिमान",
      phonetic: "/smɑːrt/",
      type: "adjective",
      def: "Having or showing a quick-witted intelligence and capability.",
      example: "NoteHub is a smart notepad for multi-device sync and offline notes.",
      synonyms: ["intelligent", "clever", "sharp", "bright"]
    }
  ];

  // In-memory cache for fast lookups
  const localMap = new Map();
  offlineDatabase.forEach(item => {
    localMap.set(item.en.toLowerCase(), item);
  });

  /**
   * Search offline dictionary
   */
  function search(query) {
    if (!query) return offlineDatabase.slice(0, 15);
    const q = query.trim().toLowerCase();
    const results = [];

    offlineDatabase.forEach(item => {
      if (item.en.toLowerCase() === q || item.np.includes(query.trim())) {
        results.unshift(item);
      } else if (item.en.toLowerCase().startsWith(q) || item.en.toLowerCase().includes(q)) {
        results.push(item);
      }
    });

    return results.slice(0, 20);
  }

  /**
   * Fetch rich online dictionary definition with automatic offline fallback
   */
  async function lookupWordFull(word) {
    if (!word) return null;
    const clean = word.trim().toLowerCase();

    // 1. Check local offline database first
    const offlineMatch = localMap.get(clean) || offlineDatabase.find(i => i.en.toLowerCase().startsWith(clean));

    // 2. Try online Free Dictionary API if online
    if (navigator.onLine) {
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            const meaning = entry.meanings?.[0];
            const definition = meaning?.definitions?.[0]?.definition || '';
            const example = meaning?.definitions?.[0]?.example || '';
            const synonyms = meaning?.synonyms?.slice(0, 5) || [];
            const phonetic = entry.phonetic || entry.phonetics?.[0]?.text || '';

            return {
              en: entry.word,
              np: offlineMatch ? offlineMatch.np : (typeof window !== 'undefined' && window.NepaliTransliterate ? window.NepaliTransliterate.transliterateWord(entry.word) : ''),
              phonetic: phonetic,
              type: meaning?.partOfSpeech || 'noun',
              def: definition,
              example: example,
              synonyms: synonyms,
              isOnline: true
            };
          }
        }
      } catch (err) {
        console.log('Online dictionary lookup failed, falling back to offline db:', err);
      }
    }

    // 3. Fallback to offline match or transliteration
    if (offlineMatch) {
      return { ...offlineMatch, isOnline: false };
    }

    if (typeof window !== 'undefined' && window.NepaliTransliterate) {
      const npWord = window.NepaliTransliterate.transliterateWord(clean);
      return {
        en: clean,
        np: npWord,
        phonetic: '',
        type: 'word',
        def: `Nepali transliteration for "${clean}".`,
        example: '',
        synonyms: [],
        isOnline: false
      };
    }

    return null;
  }

  /**
   * Fast auto-suggestion lookup for typing in editor
   */
  function getAutoSuggestions(prefix) {
    if (!prefix || prefix.length < 2) return [];
    const p = prefix.trim().toLowerCase();
    const suggestions = [];

    // 1. Direct transliteration word
    if (typeof window !== 'undefined' && window.NepaliTransliterate) {
      const transliterated = window.NepaliTransliterate.transliterateWord(p);
      if (transliterated && transliterated !== p) {
        suggestions.push({
          word: transliterated,
          subtitle: `नेपाली Unicode (${p})`,
          insertText: transliterated,
          isNepali: true
        });
      }
    }

    // 2. Prefix matches from offline database
    offlineDatabase.forEach(item => {
      if (item.en.toLowerCase().startsWith(p)) {
        suggestions.push({
          word: item.en,
          subtitle: item.np,
          insertText: item.en,
          isNepali: false
        });
        suggestions.push({
          word: item.np.split('/')[0].trim(),
          subtitle: item.en,
          insertText: item.np.split('/')[0].trim(),
          isNepali: true
        });
      }
    });

    // Remove duplicates
    const seen = new Set();
    const unique = [];
    for (const s of suggestions) {
      if (!seen.has(s.insertText)) {
        seen.add(s.insertText);
        unique.push(s);
      }
      if (unique.length >= 6) break;
    }

    return unique;
  }

  /**
   * Levenshtein Distance for Spelling Check
   */
  function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function getSpellingCorrections(word) {
    if (!word || word.length < 3) return [];
    const w = word.trim().toLowerCase();
    const scored = [];

    offlineDatabase.forEach(item => {
      const dist = levenshteinDistance(w, item.en.toLowerCase());
      if (dist <= 2 && dist > 0) {
        scored.push({ item, dist });
      }
    });

    scored.sort((a, b) => a.dist - b.dist);
    return scored.slice(0, 3).map(s => s.item);
  }

  return {
    search,
    lookupWordFull,
    getAutoSuggestions,
    getSpellingCorrections,
    database: offlineDatabase
  };
})();

if (typeof window !== 'undefined') {
  window.NoteDictionary = NoteDictionary;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteDictionary;
}

/**
 * Nepali Unicode Transliteration & Spellcheck Assistant
 * Converts Romanized Nepali (e.g., 'namaste' -> 'नमस्ते', 'nepal' -> 'नेपाल')
 * and provides spellchecking suggestions.
 */

const NepaliTransliterate = (() => {
  let isNepaliTypingEnabled = false;

  // Common word dictionary for high-accuracy direct replacement
  const wordDictionary = {
    "namaste": "नमस्ते",
    "namaskar": "नमस्कार",
    "nepal": "नेपाल",
    "nepali": "नेपाली",
    "mero": "मेरो",
    "hamro": "हाम्रो",
    "timro": "तिम्रो",
    "tapai": "तपाईं",
    "tapain": "तपाईं",
    "dhanyabad": "धन्यवाद",
    "dhanyabaad": "धन्यवाद",
    "alok": "आलोक",
    "sathi": "साथी",
    "ghar": "घर",
    "pani": "पानी",
    "khana": "खाना",
    "din": "दिन",
    "raat": "रात",
    "bholi": "भोलि",
    "aaja": "आज",
    "hijo": "हिजो",
    "ramro": "राम्रो",
    "naramro": "नराम्रो",
    "sanchai": "सञ्चै",
    "kasto": "कस्तो",
    "kina": "किन",
    "kasari": "कसरी",
    "kahile": "कहिल्यै",
    "kaha": "कहाँ",
    "kahan": "कहाँ",
    "yo": "यो",
    "tyo": "त्यो",
    "ani": "अनि",
    "tara": "तर",
    "ra": "र",
    "ho": "हो",
    "haina": "होइन",
    "cha": "छ",
    "chaina": "छैन",
    "theyo": "थियो",
    "thiyo": "थियो",
    "hunchha": "हुन्छ",
    "huncha": "हुन्छ",
    "bhanda": "भन्दा",
    "sabai": "सबै",
    "dherai": "धेरै",
    "thorai": "थोरै",
    "bisesh": "विशेष",
    "kaam": "काम",
    "pustak": "पुस्तक",
    "kitab": "किताब",
    "lekh": "लेख",
    "katha": "कथा",
    "desh": "देश",
    "samaya": "समय",
    "miti": "मिति",
    "suchi": "सूची",
    "not": "नोट",
    "file": "फाइल"
  };

  // Phonetic rule mappings
  const vowels = {
    'a': 'अ', 'aa': 'आ', 'i': 'इ', 'ee': 'ई', 'u': 'उ', 'oo': 'ऊ',
    'ri': 'ऋ', 'e': 'ए', 'ai': 'ऐ', 'o': 'ओ', 'au': 'औ', 'am': 'अं', 'ah': 'अः'
  };

  const matras = {
    'a': '', 'aa': 'ा', 'A': 'ा', 'i': 'ि', 'I': 'ी', 'ee': 'ी',
    'u': 'ु', 'U': 'ू', 'oo': 'ू', 'e': 'े', 'ai': 'ै',
    'o': 'ो', 'au': 'ौ', 'am': 'ं', 'ah': 'ः', 'ri': 'ृ'
  };

  const consonants = {
    'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ng': 'ङ',
    'ch': 'च', 'chh': 'छ', 'j': 'ज', 'jh': 'झ', 'yn': 'ञ',
    't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न',
    'T': 'ट', 'Th': 'ठ', 'D': 'ड', 'Dh': 'ढ', 'N': 'ण',
    'p': 'प', 'ph': 'फ', 'f': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म',
    'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
    'sh': 'श', 'Sh': 'ष', 's': 'स', 'h': 'ह',
    'ksh': 'क्ष', 'tra': 'त्र', 'gya': 'ज्ञ'
  };

  const nepaliNumbers = {
    '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
    '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
  };

  /**
   * Transliterate a single word from Romanized English to Nepali Unicode
   */
  function transliterateWord(word) {
    if (!word) return '';
    const cleanWord = word.trim().toLowerCase();
    
    // Check direct dictionary
    if (wordDictionary[cleanWord]) {
      return wordDictionary[cleanWord];
    }

    // Number conversion
    if (/^\d+$/.test(word)) {
      return word.split('').map(d => nepaliNumbers[d] || d).join('');
    }

    // Phonetic token parser
    let result = '';
    let i = 0;
    const len = word.length;

    while (i < len) {
      // Try 3-char match (e.g. ksh, chh, gya)
      const c3 = word.substring(i, i + 3).toLowerCase();
      const c2 = word.substring(i, i + 2).toLowerCase();
      const c1 = word[i];
      const c1Low = c1.toLowerCase();

      // Check numbers
      if (nepaliNumbers[c1]) {
        result += nepaliNumbers[c1];
        i++;
        continue;
      }

      // Check 3-char consonants
      if (consonants[c3]) {
        const cons = consonants[c3];
        i += 3;
        const nextPart = getVowelMatra(word, i);
        result += cons + nextPart.matra;
        i += nextPart.len;
        continue;
      }

      // Check 2-char consonants
      if (consonants[c2]) {
        const cons = consonants[c2];
        i += 2;
        const nextPart = getVowelMatra(word, i);
        result += cons + nextPart.matra;
        i += nextPart.len;
        continue;
      }

      // Check 1-char consonants
      if (consonants[c1] || consonants[c1Low]) {
        const cons = consonants[c1] || consonants[c1Low];
        i += 1;
        const nextPart = getVowelMatra(word, i);
        result += cons + nextPart.matra;
        i += nextPart.len;
        continue;
      }

      // Standalone vowels
      if (vowels[c2]) {
        result += vowels[c2];
        i += 2;
        continue;
      }
      if (vowels[c1Low]) {
        result += vowels[c1Low];
        i += 1;
        continue;
      }

      // Punctuation / other
      result += c1;
      i++;
    }

    return result || word;
  }

  function getVowelMatra(str, idx) {
    if (idx >= str.length) {
      return { matra: '्', len: 0 }; // Halant if no vowel
    }
    const s2 = str.substring(idx, idx + 2).toLowerCase();
    const s1 = str[idx].toLowerCase();

    if (s2 === 'aa' || s2 === 'ee' || s2 === 'oo' || s2 === 'ai' || s2 === 'au' || s2 === 'ri') {
      return { matra: matras[s2] !== undefined ? matras[s2] : '', len: 2 };
    }
    if (s1 === 'a') {
      return { matra: '', len: 1 }; // Default inherent vowel
    }
    if (matras[s1] !== undefined) {
      return { matra: matras[s1], len: 1 };
    }

    // Another consonant follows -> halant (joint letter)
    return { matra: '्', len: 0 };
  }

  function transliterateText(text) {
    if (!text) return '';
    return text.replace(/\b[a-zA-Z0-9]+\b/g, (match) => {
      return transliterateWord(match);
    });
  }

  function toggleNepaliTyping(forceState) {
    if (typeof forceState === 'boolean') {
      isNepaliTypingEnabled = forceState;
    } else {
      isNepaliTypingEnabled = !isNepaliTypingEnabled;
    }
    return isNepaliTypingEnabled;
  }

  function isEnabled() {
    return isNepaliTypingEnabled;
  }

  return {
    transliterateWord,
    transliterateText,
    toggleNepaliTyping,
    isEnabled,
    wordDictionary
  };
})();

if (typeof window !== 'undefined') {
  window.NepaliTransliterate = NepaliTransliterate;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NepaliTransliterate;
}

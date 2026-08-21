/**
 * Facebook & Social Media Caption Formatter & Unicode Text Styler
 * Converts regular text, markdown, and formatted text into true Facebook-compatible
 * Unicode bold, italic, and stylish characters with live post preview.
 */

const FacebookCaption = (() => {
  // Unicode character map conversions
  const unicodeMaps = {
    boldSans: {
      from: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      to:   "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"
    },
    boldSerif: {
      from: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      to:   "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗"
    },
    italicSans: {
      from: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      to:   "𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻"
    },
    boldItalic: {
      from: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      to:   "𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯"
    },
    script: {
      from: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      to:   "𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃"
    },
    monospace: {
      from: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      to:   "𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿"
    },
    doubleStruck: {
      from: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      to:   "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡"
    }
  };

  /**
   * Convert plain string to specified Unicode style
   */
  function toUnicodeStyle(text, styleName = 'boldSans') {
    if (!text) return '';
    const map = unicodeMaps[styleName] || unicodeMaps.boldSans;
    
    // Split target characters considering 32-bit Unicode surrogate pairs
    const targetChars = Array.from(map.to);
    const sourceChars = map.from.split('');
    const charMap = new Map();
    
    sourceChars.forEach((c, idx) => {
      charMap.set(c, targetChars[idx] || c);
    });

    return text.split('').map(c => charMap.get(c) || c).join('');
  }

  /**
   * Format an entire HTML or Plain text note into a Facebook-ready clean caption:
   * Converts <h1>/<h2>/<h3>/<b>/<strong> into true Unicode bold,
   * <i>/<em> into Unicode italic, checklists into stylish bullet marks (✦, ☑),
   * and preserves proper Facebook spacing and line breaks.
   */
  function formatHtmlToFacebookCaption(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Convert headings to bold with divider
    temp.querySelectorAll('h1, h2, h3').forEach(h => {
      const boldText = toUnicodeStyle(h.textContent.trim(), 'boldSans');
      const replacement = document.createTextNode(`\n\n━ ${boldText} ━\n`);
      h.replaceWith(replacement);
    });

    // Convert <b>, <strong> to boldSans
    temp.querySelectorAll('b, strong').forEach(b => {
      const boldText = toUnicodeStyle(b.textContent, 'boldSans');
      b.replaceWith(document.createTextNode(boldText));
    });

    // Convert <i>, <em> to italicSans
    temp.querySelectorAll('i, em').forEach(i => {
      const itText = toUnicodeStyle(i.textContent, 'italicSans');
      i.replaceWith(document.createTextNode(itText));
    });

    // Convert checklists
    temp.querySelectorAll('.task-item').forEach(item => {
      const isChecked = item.querySelector('input[type="checkbox"]')?.checked;
      const text = item.querySelector('.task-text')?.textContent || item.textContent;
      const mark = isChecked ? '☑ ' : '☐ ';
      item.replaceWith(document.createTextNode(`\n${mark}${text.trim()}`));
    });

    // Convert <li> items
    temp.querySelectorAll('li').forEach(li => {
      li.replaceWith(document.createTextNode(`\n• ${li.textContent.trim()}`));
    });

    // Convert blockquotes
    temp.querySelectorAll('blockquote').forEach(bq => {
      bq.replaceWith(document.createTextNode(`\n\n❝ ${bq.textContent.trim()} ❞\n`));
    });

    // Extract text and normalize line breaks
    let rawText = temp.innerText || temp.textContent || '';
    
    // Clean multiple consecutive blank lines
    rawText = rawText.replace(/\n{3,}/g, '\n\n').trim();

    return rawText;
  }

  return {
    toUnicodeStyle,
    formatHtmlToFacebookCaption,
    unicodeMaps
  };
})();

if (typeof window !== 'undefined') {
  window.FacebookCaption = FacebookCaption;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FacebookCaption;
}

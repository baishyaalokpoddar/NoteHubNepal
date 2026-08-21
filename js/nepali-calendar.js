/**
 * Nepali Bikram Sambat (BS) <-> Gregorian (AD) Date Engine
 * Comprehensive calendar converter supporting years 2000 BS - 2095 BS (1943 AD - 2039 AD)
 */

const NepaliCalendar = (() => {
  // Days in each Nepali month from 2000 BS to 2095 BS
  // Format: [Baisakh, Jestha, Ashadh, Shrawan, Bhadra, Ashwin, Kartik, Mangshir, Poush, Magh, Falgun, Chaitra]
  const bsMonthDaysData = {
    2000: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2004: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2006: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2008: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    2009: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2010: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2011: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2012: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2013: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2014: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2015: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2016: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2017: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2018: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2019: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2020: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2021: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2022: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2023: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2024: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2025: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2026: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2027: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2028: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2029: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
    2030: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2031: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2032: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2033: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2035: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2037: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2038: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2039: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2040: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2041: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2042: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2043: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2044: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2045: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2047: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2048: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2049: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2050: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2051: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2052: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2053: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2054: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2055: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2056: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
    2057: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2058: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2059: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2060: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2061: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2062: [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    2063: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2064: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2065: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2066: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    2067: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2068: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2069: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2082: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2084: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
    2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2087: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2088: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2089: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2091: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2092: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2093: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2094: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    2095: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]
  };

  // Base starting point: 2000-01-01 BS = 1943-04-14 AD (Wednesday)
  const baseAdDate = new Date(1943, 3, 14); // month index 3 is April
  const baseBsYear = 2000;
  const baseBsMonth = 1;
  const baseBsDay = 1;

  const nepaliMonths = [
    'वैशाख', 'जेठ', 'असार', 'श्रावण', 'भदौ', 'असोज',
    'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत'
  ];

  const nepaliMonthsEnglish = [
    'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
  ];

  const nepaliDays = [
    'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'
  ];

  const nepaliDaysEnglish = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];

  const englishMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

  function toNepaliDigits(number) {
    if (number === null || number === undefined) return '';
    return String(number)
      .split('')
      .map(char => (char >= '0' && char <= '9' ? nepaliDigits[parseInt(char)] : char))
      .join('');
  }

  function adToBs(dateInput) {
    const targetDate = dateInput ? new Date(dateInput) : new Date();
    // Normalize to 12:00:00 (noon) to avoid DST / timezone issues
    const tDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 12, 0, 0);
    const bDate = new Date(baseAdDate.getFullYear(), baseAdDate.getMonth(), baseAdDate.getDate(), 12, 0, 0);

    const diffTime = tDate.getTime() - bDate.getTime();
    let totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (totalDays < 0) {
      return {
        bsYear: 2000,
        bsMonth: 1,
        bsDay: 1,
        dayOfWeek: targetDate.getDay(),
        monthNameNepali: nepaliMonths[0],
        monthNameEnglish: nepaliMonthsEnglish[0],
        dayNameNepali: nepaliDays[targetDate.getDay()],
        dayNameEnglish: nepaliDaysEnglish[targetDate.getDay()],
        formattedBSNepali: `२००० वैशाख १, ${nepaliDays[targetDate.getDay()]}`,
        formattedBSEnglish: `Baisakh 1, 2000 BS, ${nepaliDaysEnglish[targetDate.getDay()]}`
      };
    }

    let currentYear = baseBsYear;
    let currentMonth = baseBsMonth;
    let currentDay = baseBsDay;

    while (totalDays > 0) {
      const yearMonths = bsMonthDaysData[currentYear] || [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30];
      const daysInCurrentMonth = yearMonths[currentMonth - 1];

      if (totalDays >= daysInCurrentMonth) {
        totalDays -= daysInCurrentMonth;
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      } else {
        currentDay += totalDays;
        totalDays = 0;
      }
    }

    const dayOfWeek = targetDate.getDay();

    return {
      bsYear: currentYear,
      bsMonth: currentMonth,
      bsDay: currentDay,
      dayOfWeek: dayOfWeek,
      monthNameNepali: nepaliMonths[currentMonth - 1] || '',
      monthNameEnglish: nepaliMonthsEnglish[currentMonth - 1] || '',
      dayNameNepali: nepaliDays[dayOfWeek] || '',
      dayNameEnglish: nepaliDaysEnglish[dayOfWeek] || '',
      formattedBSNepali: `${toNepaliDigits(currentYear)} ${nepaliMonths[currentMonth - 1]} ${toNepaliDigits(currentDay)}, ${nepaliDays[dayOfWeek]}`,
      formattedBSEnglish: `${nepaliMonthsEnglish[currentMonth - 1]} ${currentDay}, ${currentYear} BS, ${nepaliDaysEnglish[dayOfWeek]}`,
      formattedDualLanguage: `${toNepaliDigits(currentYear)} ${nepaliMonths[currentMonth - 1]} ${toNepaliDigits(currentDay)} (${nepaliMonthsEnglish[currentMonth - 1]} ${currentDay}, ${currentYear} BS)`
    };
  }

  function getDaysInBsMonth(bsYear, bsMonth) {
    const yearData = bsMonthDaysData[bsYear];
    if (yearData && yearData[bsMonth - 1]) {
      return yearData[bsMonth - 1];
    }
    return 30; // default fallback
  }

  function bsToAd(bsYear, bsMonth, bsDay) {
    bsYear = parseInt(bsYear, 10);
    bsMonth = parseInt(bsMonth, 10);
    bsDay = parseInt(bsDay, 10);

    if (isNaN(bsYear) || isNaN(bsMonth) || isNaN(bsDay)) {
      return null;
    }

    if (bsYear < 2000 || bsYear > 2095 || bsMonth < 1 || bsMonth > 12 || bsDay < 1) {
      return null;
    }

    const maxDays = getDaysInBsMonth(bsYear, bsMonth);
    if (bsDay > maxDays) {
      bsDay = maxDays;
    }

    let totalDays = 0;

    // Count days from 2000 BS up to bsYear - 1
    for (let y = baseBsYear; y < bsYear; y++) {
      const yData = bsMonthDaysData[y] || [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30];
      for (let m = 0; m < 12; m++) {
        totalDays += yData[m];
      }
    }

    // Count days in current year up to bsMonth - 1
    const currentYearData = bsMonthDaysData[bsYear] || [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30];
    for (let m = 0; m < bsMonth - 1; m++) {
      totalDays += currentYearData[m];
    }

    // Add days in current month
    totalDays += (bsDay - 1);

    // Calculate AD date by adding totalDays from base date at noon
    const bDate = new Date(baseAdDate.getFullYear(), baseAdDate.getMonth(), baseAdDate.getDate(), 12, 0, 0);
    const adDate = new Date(bDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
    const dayOfWeek = adDate.getDay();

    const adMonth = englishMonths[adDate.getMonth()];
    const adDay = adDate.getDate();
    const adYear = adDate.getFullYear();

    const monthStr = String(adDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(adDay).padStart(2, '0');

    return {
      adDate: adDate,
      adYear: adYear,
      adMonth: adDate.getMonth() + 1,
      adDay: adDay,
      dayOfWeek: dayOfWeek,
      formattedAD: `${adMonth} ${adDay}, ${adYear}`,
      formattedADWithDay: `${adMonth} ${adDay}, ${adYear} (${nepaliDaysEnglish[dayOfWeek]})`,
      isoDate: `${adYear}-${monthStr}-${dayStr}`,
      nepaliDayName: nepaliDays[dayOfWeek],
      englishDayName: nepaliDaysEnglish[dayOfWeek],
      bsNepali: `${toNepaliDigits(bsYear)} ${nepaliMonths[bsMonth - 1]} ${toNepaliDigits(bsDay)}, ${nepaliDays[dayOfWeek]}`,
      bsEnglish: `${nepaliMonthsEnglish[bsMonth - 1]} ${bsDay}, ${bsYear} BS, ${nepaliDaysEnglish[dayOfWeek]}`
    };
  }

  function formatFullDualTimestamp(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const bs = adToBs(d);
    
    const adHours = d.getHours();
    const adMinutes = String(d.getMinutes()).padStart(2, '0');
    const adSeconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = adHours >= 12 ? 'PM' : 'AM';
    const displayHours = adHours % 12 || 12;
    const timeStr = `${displayHours}:${adMinutes}:${adSeconds} ${ampm}`;

    const adMonth = englishMonths[d.getMonth()];
    const adDay = d.getDate();
    const adYear = d.getFullYear();
    const adFormatted = `${adMonth.substring(0, 3)} ${adDay}, ${adYear}`;

    return {
      adDate: adFormatted,
      adFullDate: `${adMonth} ${adDay}, ${adYear} (${nepaliDaysEnglish[d.getDay()]})`,
      time: timeStr,
      bsNepali: bs.formattedBSNepali,
      bsEnglish: bs.formattedBSEnglish,
      bsShort: `${bs.monthNameEnglish} ${bs.bsDay}, ${bs.bsYear} BS`,
      bsShortNepali: `${toNepaliDigits(bs.bsDay)} ${bs.monthNameNepali} ${toNepaliDigits(bs.bsYear)}`,
      dualFormatted: `${bs.formattedBSNepali} (${adFormatted} AD)`,
      dualBothLanguage: `${bs.formattedBSNepali} • ${bs.formattedBSEnglish} [${adFormatted} AD]`,
      isoString: d.toISOString()
    };
  }

  return {
    adToBs,
    bsToAd,
    getDaysInBsMonth,
    toNepaliDigits,
    formatFullDualTimestamp,
    nepaliMonths,
    nepaliMonthsEnglish,
    nepaliDays,
    nepaliDaysEnglish,
    englishMonths
  };
})();

if (typeof window !== 'undefined') {
  window.NepaliCalendar = NepaliCalendar;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NepaliCalendar;
}

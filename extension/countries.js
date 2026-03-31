/**
 * Map English country / region labels (as shown in X “Connected via … App Store”) to ISO 3166-1 alpha-2.
 * Aliases cover common App Store wording.
 */
(function initCountryMap(global) {
  const RAW = {
    Afghanistan: "AF",
    Albania: "AL",
    Algeria: "DZ",
    Angola: "AO",
    "Antigua and Barbuda": "AG",
    Argentina: "AR",
    Armenia: "AM",
    Australia: "AU",
    Austria: "AT",
    Azerbaijan: "AZ",
    Bahamas: "BS",
    Bahrain: "BH",
    Bangladesh: "BD",
    Barbados: "BB",
    Belarus: "BY",
    Belgium: "BE",
    Belize: "BZ",
    Benin: "BJ",
    Bermuda: "BM",
    Bhutan: "BT",
    Bolivia: "BO",
    "Bosnia and Herzegovina": "BA",
    Botswana: "BW",
    Brazil: "BR",
    Brunei: "BN",
    Bulgaria: "BG",
    "Burkina Faso": "BF",
    Cambodia: "KH",
    Cameroon: "CM",
    Canada: "CA",
    "Cape Verde": "CV",
    "Cayman Islands": "KY",
    Chile: "CL",
    China: "CN",
    Colombia: "CO",
    "Costa Rica": "CR",
    Croatia: "HR",
    Cyprus: "CY",
    "Czech Republic": "CZ",
    Czechia: "CZ",
    "Democratic Republic of the Congo": "CD",
    Denmark: "DK",
    Dominica: "DM",
    "Dominican Republic": "DO",
    Ecuador: "EC",
    Egypt: "EG",
    "El Salvador": "SV",
    Estonia: "EE",
    Eswatini: "SZ",
    Swaziland: "SZ",
    Fiji: "FJ",
    Finland: "FI",
    France: "FR",
    Gabon: "GA",
    Gambia: "GM",
    Georgia: "GE",
    Germany: "DE",
    Ghana: "GH",
    Greece: "GR",
    Grenada: "GD",
    Guatemala: "GT",
    Guinea: "GN",
    "Guinea-Bissau": "GW",
    Guyana: "GY",
    Honduras: "HN",
    "Hong Kong": "HK",
    Hungary: "HU",
    Iceland: "IS",
    India: "IN",
    Indonesia: "ID",
    Iraq: "IQ",
    Ireland: "IE",
    Israel: "IL",
    Italy: "IT",
    Jamaica: "JM",
    Japan: "JP",
    Jordan: "JO",
    Kazakhstan: "KZ",
    Kenya: "KE",
    Korea: "KR",
    "South Korea": "KR",
    "Republic of Korea": "KR",
    Kosovo: "XK",
    Kuwait: "KW",
    Kyrgyzstan: "KG",
    Laos: "LA",
    Latvia: "LV",
    Lebanon: "LB",
    Liberia: "LR",
    Libya: "LY",
    Lithuania: "LT",
    Luxembourg: "LU",
    Macau: "MO",
    "Macao": "MO",
    Madagascar: "MG",
    Malawi: "MW",
    Malaysia: "MY",
    Maldives: "MV",
    Mali: "ML",
    Malta: "MT",
    Mauritania: "MR",
    Mauritius: "MU",
    Mexico: "MX",
    Micronesia: "FM",
    Moldova: "MD",
    Monaco: "MC",
    Mongolia: "MN",
    Montenegro: "ME",
    Montserrat: "MS",
    Morocco: "MA",
    Mozambique: "MZ",
    Myanmar: "MM",
    Namibia: "NA",
    Nepal: "NP",
    Netherlands: "NL",
    "The Netherlands": "NL",
    "New Zealand": "NZ",
    Nicaragua: "NI",
    Niger: "NE",
    Nigeria: "NG",
    "North Macedonia": "MK",
    Macedonia: "MK",
    Norway: "NO",
    Oman: "OM",
    Pakistan: "PK",
    Palau: "PW",
    Panama: "PA",
    "Papua New Guinea": "PG",
    Paraguay: "PY",
    Peru: "PE",
    Philippines: "PH",
    Poland: "PL",
    Portugal: "PT",
    Qatar: "QA",
    Romania: "RO",
    Russia: "RU",
    "Russian Federation": "RU",
    Rwanda: "RW",
    "Saint Kitts and Nevis": "KN",
    "Saint Lucia": "LC",
    "Saint Vincent and the Grenadines": "VC",
    Samoa: "WS",
    "Saudi Arabia": "SA",
    Senegal: "SN",
    Serbia: "RS",
    Seychelles: "SC",
    "Sierra Leone": "SL",
    Singapore: "SG",
    Slovakia: "SK",
    Slovenia: "SI",
    "Solomon Islands": "SB",
    "South Africa": "ZA",
    Spain: "ES",
    "Sri Lanka": "LK",
    Suriname: "SR",
    Sweden: "SE",
    Switzerland: "CH",
    Taiwan: "TW",
    Tajikistan: "TJ",
    Tanzania: "TZ",
    Thailand: "TH",
    Tonga: "TO",
    "Trinidad and Tobago": "TT",
    Tunisia: "TN",
    Turkey: "TR",
    Türkiye: "TR",
    Turkmenistan: "TM",
    Uganda: "UG",
    Ukraine: "UA",
    "United Arab Emirates": "AE",
    UAE: "AE",
    "United Kingdom": "GB",
    UK: "GB",
    "Great Britain": "GB",
    England: "GB",
    Scotland: "GB",
    "Northern Ireland": "GB",
    Wales: "GB",
    "United States": "US",
    USA: "US",
    "U.S.": "US",
    Uruguay: "UY",
    Uzbekistan: "UZ",
    Vanuatu: "VU",
    Venezuela: "VE",
    Vietnam: "VN",
    "Viet Nam": "VN",
    Yemen: "YE",
    Zambia: "ZM",
    Zimbabwe: "ZW",
    Åland: "AX",
    "Åland Islands": "AX",
  };

  const map = new Map();
  for (const [name, code] of Object.entries(RAW)) {
    map.set(normalizeLabel(name), code);
  }

  function normalizeLabel(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function stripAppStoreSuffix(label) {
    let s = String(label).trim();
    s = s.replace(/\s+app\s+store$/i, "");
    s = s.replace(/\s+play\s+store$/i, "");
    s = s.replace(/\s+google\s+play$/i, "");
    return s.trim();
  }

  function alpha2ToFlagEmoji(code) {
    if (!code || code.length !== 2) return "";
    const A = 0x1f1e6;
    const up = code.toUpperCase();
    const a = up.charCodeAt(0);
    const b = up.charCodeAt(1);
    if (a < 65 || a > 90 || b < 65 || b > 90) return "";
    return String.fromCodePoint(A + (a - 65), A + (b - 65));
  }

  /**
   * @param {string} connectedViaLabel e.g. "United States App Store"
   * @returns {{ emoji: string, countryName: string, code: string } | null }
   */
  function parseConnectedVia(connectedViaLabel) {
    const cleaned = stripAppStoreSuffix(connectedViaLabel);
    if (!cleaned) return null;

    const key = normalizeLabel(cleaned);
    let code = map.get(key);
    if (code) {
      return {
        emoji: alpha2ToFlagEmoji(code),
        countryName: cleaned,
        code,
      };
    }

    for (const [k, c] of map) {
      if (key.startsWith(k + " ") || key.endsWith(" " + k) || key.includes(" " + k + " ")) {
        code = c;
        break;
      }
    }
    if (!code) {
      for (const [k, c] of map) {
        if (key === k || key.includes(k)) {
          code = c;
          break;
        }
      }
    }
    if (!code) return null;
    return {
      emoji: alpha2ToFlagEmoji(code),
      countryName: cleaned,
      code,
    };
  }

  global.CooFlagsCountries = {
    parseConnectedVia,
    normalizeLabel,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

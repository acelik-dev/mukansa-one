import { s } from './dom.js'

// 24x24, çizgi ikonlar (lucide tarzı)
const P = {
  layout: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  droplet: '<path d="M12 2.7c3.5 4 6 7 6 10.3a6 6 0 0 1-12 0c0-3.300 2.500-6.300 6-10.300z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.500"/><path d="M10.700 12.300 21 2M17 6l3 3M14 9l2 2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.300 21a1.940 1.940 0 0 0 3.400 0"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6l8-3z"/><path d="m9 12 2 2 4-4"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.300-4.300"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.700L21 8M21 3v5h-5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.300 3.900 1.800 18a2 2 0 0 0 1.700 3h17a2 2 0 0 0 1.700-3L13.700 3.900a2 2 0 0 0-3.400 0z"/><path d="M12 9v4M12 17h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7zM22 2 11 13"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.900 4.900 14.200 14.200"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.700L3 8M3 3v5h5"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  wrench: '<path d="M14.700 6.300a1 1 0 0 0 0 1.400l1.600 1.600a1 1 0 0 0 1.400 0l3.770-3.770a6 6 0 0 1-7.940 7.940l-6.910 6.910a2.120 2.120 0 0 1-3-3l6.910-6.910a6 6 0 0 1 7.940-7.940l-3.760 3.760z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.870M16 3.130a4 4 0 0 1 0 7.750"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
}

export function icon(name, size) {
  const svg = s('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.7',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    width: size,
    height: size,
  })
  // P içindeki sabit, kendi yazdığımız SVG parçaları (kullanıcı verisi değil)
  svg.innerHTML = P[name] ?? ''
  return svg
}

export function brandMark() {
  const svg = s('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' })
  svg.innerHTML =
    '<path d="M12 2.700c3.500 4 6 7 6 10.300a6 6 0 0 1-12 0c0-3.300 2.500-6.300 6-10.300z" fill="url(#bm)" stroke="#e6c98f" stroke-width="1.100"/>' +
    '<path d="M9 14a3 3 0 0 0 2.600 2.900" stroke="#fff" stroke-opacity=".7" stroke-width="1.200" stroke-linecap="round"/>' +
    '<defs><linearGradient id="bm" x1="12" y1="3" x2="12" y2="19" gradientUnits="userSpaceOnUse"><stop stop-color="#e6c98f" stop-opacity=".9"/><stop offset="1" stop-color="#3aa1b8" stop-opacity=".85"/></linearGradient></defs>'
  return svg
}

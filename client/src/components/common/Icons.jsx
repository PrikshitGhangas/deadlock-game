/**
 * Icons.jsx — Clean, lightweight SVG vector icons replacing emojis.
 * All icons follow standard stroke/fill rules, scalable with `size` (default: 16).
 */

export function Icon({ name, size = 16, className = '', color = 'currentColor', style = {} }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style: { display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0, ...style },
    'aria-hidden': true,
  };

  switch (name) {
    case 'lock':
      return (
        <svg {...props}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'bank':
      return (
        <svg {...props}>
          <line x1="3" y1="21" x2="21" y2="21" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polyline points="3 10 12 3 21 10" />
          <line x1="6" y1="10" x2="6" y2="21" />
          <line x1="10" y1="10" x2="10" y2="21" />
          <line x1="14" y1="10" x2="14" y2="21" />
          <line x1="18" y1="10" x2="18" y2="21" />
        </svg>
      );
    case 'game':
      return (
        <svg {...props}>
          <rect x="2" y="6" width="20" height="12" rx="4" />
          <line x1="6" y1="12" x2="10" y2="12" />
          <line x1="8" y1="10" x2="8" y2="14" />
          <circle cx="15" cy="11" r="0.5" fill={color} />
          <circle cx="18" cy="13" r="0.5" fill={color} />
        </svg>
      );
    case 'history':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'book':
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'lightbulb':
      return (
        <svg {...props}>
          <line x1="9" y1="18" x2="15" y2="18" />
          <line x1="10" y1="22" x2="14" y2="22" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5h6.18z" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...props}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'volume':
      return (
        <svg {...props}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    case 'stop':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
    case 'play':
      return (
        <svg {...props} fill={color}>
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...props} fill={color}>
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      );
    case 'first':
      return (
        <svg {...props}>
          <polyline points="11 19 4 12 11 5" />
          <polyline points="18 19 11 12 18 5" />
          <line x1="4" y1="5" x2="4" y2="19" />
        </svg>
      );
    case 'last':
      return (
        <svg {...props}>
          <polyline points="13 19 20 12 13 5" />
          <polyline points="6 19 13 12 6 5" />
          <line x1="20" y1="5" x2="20" y2="19" />
        </svg>
      );
    case 'prev':
      return (
        <svg {...props}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );
    case 'next':
      return (
        <svg {...props}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case 'dice':
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="4" />
          <circle cx="8" cy="8" r="1.5" fill={color} />
          <circle cx="16" cy="8" r="1.5" fill={color} />
          <circle cx="12" cy="12" r="1.5" fill={color} />
          <circle cx="8" cy="16" r="1.5" fill={color} />
          <circle cx="16" cy="16" r="1.5" fill={color} />
        </svg>
      );
    case 'save':
      return (
        <svg {...props}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      );
    case 'share':
      return (
        <svg {...props}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case 'download':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...props}>
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case 'restart':
      return (
        <svg {...props}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      );
    case 'bot':
      return (
        <svg {...props}>
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="8.5" cy="16" r="1.5" fill={color} />
          <circle cx="15.5" cy="16" r="1.5" fill={color} />
          <line x1="12" y1="3" x2="12" y2="7" />
          <circle cx="12" cy="3" r="1" fill={color} />
          <line x1="2" y1="15" x2="3" y2="15" />
          <line x1="21" y1="15" x2="22" y2="15" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...props}>
          <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />
          <path d="M19 16l1.2 2.8L23 20l-2.8 1.2L19 24l-1.2-2.8L15 20l2.8-1.2z" />
        </svg>
      );
    case 'offline':
      return (
        <svg {...props}>
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 16.71a5 5 0 0 1 2.58 0" />
        </svg>
      );
    case 'puzzle':
      return (
        <svg {...props}>
          <path d="M19.439 7.85c0-1.571-.84-2.85-1.875-2.85H14.5V3.125C14.5 2.09 13.22 1.25 11.65 1.25S8.8 2.09 8.8 3.125V5H5.735C4.7 5 3.86 6.279 3.86 7.85s.84 2.85 1.875 2.85H6v2.15c0 1.035 1.28 1.875 2.85 1.875s2.85-.84 2.85-1.875V11h3.064c1.035 0 1.875-1.279 1.875-2.85z" />
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
      );
    case 'lab':
      return (
        <svg {...props}>
          <path d="M10 2v7.31L4.14 19.1A2 2 0 0 0 5.86 22h12.28a2 2 0 0 0 1.72-2.9L14 9.31V2" />
          <line x1="8.5" y1="2" x2="15.5" y2="2" />
          <line x1="7" y1="16" x2="17" y2="16" />
        </svg>
      );
    case 'database':
      return (
        <svg {...props}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case 'git-branch':
      return (
        <svg {...props}>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'table':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      );
    case 'sliders':
      return (
        <svg {...props}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    default:
      return null;
  }
}

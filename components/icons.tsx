type IconProps = {
  className?: string;
  color?: string;
};

export function HomeIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 8.2L10 2.8L17 8.2V16.4C17 16.8 16.7 17.2 16.2 17.2H12.4V12.2H7.6V17.2H3.8C3.3 17.2 3 16.8 3 16.4V8.2Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M17 9.4C17 12.9 13.9 15.8 10 15.8C9 15.8 8.1 15.6 7.3 15.3L3.5 16.5L4.6 13.6C3.6 12.5 3 11 3 9.4C3 5.9 6.1 3 10 3C13.9 3 17 5.9 17 9.4Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GraphIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="5" cy="10" r="2.4" stroke={color} strokeWidth="1.6" />
      <circle cx="15" cy="4.6" r="2.2" stroke={color} strokeWidth="1.6" />
      <circle cx="15" cy="15.4" r="2.2" stroke={color} strokeWidth="1.6" />
      <path d="M7.2 8.9L12.9 5.6M7.2 11.1L12.9 14.4" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function PeopleIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="7" r="3.2" stroke={color} strokeWidth="1.6" />
      <path d="M2.5 16.5C2.5 13.9 5 12.2 8 12.2C11 12.2 13.5 13.9 13.5 16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="15.5" cy="7.6" r="2.6" stroke={color} strokeWidth="1.6" />
      <path d="M15.6 12.4C17.9 12.7 19.6 14.2 19.6 16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PhotoIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="1" width="18" height="14" rx="3.5" stroke={color} strokeWidth="1.6" />
      <circle cx="6.4" cy="5.8" r="1.6" fill={color} />
      <path d="M3.5 13L8.4 8.6L12 11.6L15.2 8.8L16.8 10.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MicIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="1" width="6" height="10" rx="3" stroke={color} strokeWidth="1.5" />
      <path d="M1.5 8.5C1.5 11.5 4 13.7 7 13.7C10 13.7 12.5 11.5 12.5 8.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 13.7V17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowUpIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" className={className} aria-hidden="true">
      <path d="M7 16.5V2M7 2L1.5 7.5M7 2L12.5 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className={className} aria-hidden="true">
      <path d="M1.5 1.5L6.5 7L1.5 12.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

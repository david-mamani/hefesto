type IconProps = {
  className?: string;
  color?: string;
};

export function SettingsIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6.6" stroke={color} strokeWidth="1.6" />
      <circle cx="9" cy="9" r="2.6" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function SearchIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.6" />
      <path d="M12.5 12.5L16.5 16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ color = "currentColor", className }: IconProps) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className} aria-hidden="true">
      <path d="M6 1V11M1 6H11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

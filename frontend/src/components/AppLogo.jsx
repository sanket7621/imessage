// Simple app branding used across auth and loader screens
// Exports:
//  - APP_NAME: string
//  - AppLogo: React component

export const APP_NAME = "iMessage";

export function AppLogo({ size = 40, className = "", alt = APP_NAME }) {
  // Uses the public favicon as the logo; sized square
  return (
    <img
      src="/favicon.svg"
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
      decoding="async"
    />
  );
}

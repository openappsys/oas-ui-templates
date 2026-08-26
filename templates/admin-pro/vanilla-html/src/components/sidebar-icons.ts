import { iconRegistry } from '@oas-ui/icons'

const registry = iconRegistry as unknown as Record<string, string>

function colorize(path: string, color: string): string {
  return path.split('stroke="currentColor"').join(`stroke="${color}"`)
}

const BLUE = 'var(--oas-color-primary)'
const CYAN = 'var(--oas-tint-cyan)'
const VIOLET = 'var(--oas-tint-violet)'
const GREEN = 'var(--oas-color-success)'
const ORANGE = 'var(--oas-color-warning)'
const RED = 'var(--oas-color-danger)'

const ORG_PATH =
  '<path d="M8 3 V6 M3 6 H13 M3 6 V8 M8 6 V8 M13 6 V8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="3" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="3" cy="9.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="9.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="13" cy="9.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 10.7 V12 H13 V10.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'

export function registerSidebarIcons(): void {
  registry['nav-dashboard'] = colorize(
    '<path d="M8 2.4 L9.9 6.2 L14 6.8 L11 9.7 L11.6 13.8 L8 12 L4.4 13.8 L5 9.7 L2 6.8 L6.1 6.2 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    BLUE,
  )
  registry['nav-orders'] = colorize(
    '<rect x="3" y="4.5" width="10" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 7.5 H13 M5.5 2.8 V4.8 M10.5 2.8 V4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    CYAN,
  )
  registry['nav-products'] = colorize(
    '<path d="M11.2 3.3 L12.7 4.8 L6 11.5 L3.5 12.5 L4.5 10 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    VIOLET,
  )
  registry['nav-users'] = colorize(
    '<circle cx="8" cy="5.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 13.5 A4.5 4.5 0 0 1 12.5 13.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    GREEN,
  )
  registry['nav-profile'] = colorize(
    '<path d="M8 3.5 A4.5 4.5 0 1 1 3.5 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 2.5 V4.8 M3.5 8 H5.8 M2.5 8 H3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    BLUE,
  )
  registry['nav-create-order'] = colorize(
    '<path d="M8 3.5 V12.5 M3.5 8 H12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    ORANGE,
  )
  registry['nav-settings'] = colorize(
    '<path d="M3.5 4.5 H12.5 L8.5 9 V12.5 L7.5 12 V9 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    VIOLET,
  )
  registry['nav-roles'] = colorize(
    '<path d="M8 2.5 C6 2.5 4.6 4.2 5.6 5.8 C6.6 7.4 5 8.8 5 8.8 C4.2 9.4 4.6 11 6 11 C7 11 8 12.5 8 13.5 C8 12.5 9 11 10 11 C11.4 11 11.8 9.4 11 8.8 C11 8.8 9.4 7.4 10.4 5.8 C11.4 4.2 10 2.5 8 2.5 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    VIOLET,
  )
  registry['nav-menus'] = colorize(
    '<rect x="4.5" y="7" width="7" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 7 V5.5 a2 2 0 0 1 4 0 V7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    BLUE,
  )
  registry['nav-dept'] = colorize(ORG_PATH, CYAN)
  registry['nav-category'] = colorize(
    '<rect x="3" y="3" width="4.5" height="4.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="8.5" y="3" width="4.5" height="4.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="8.5" width="4.5" height="4.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="8.5" y="8.5" width="4.5" height="4.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    VIOLET,
  )
  registry['nav-dict'] = colorize(
    '<circle cx="7" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.6 9.6 L13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    GREEN,
  )
  registry['nav-logs'] = colorize(
    '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5 V8.5 L10.5 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    ORANGE,
  )
  registry['nav-forbidden'] = colorize(
    '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5.3 V8.8 M8 10.9 H8.01" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    RED,
  )
  registry['nav-not-found'] = colorize(
    '<circle cx="7" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.6 9.6 L13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    BLUE,
  )
  registry['nav-server-error'] = colorize(
    '<path d="M8 2.3 L14.2 13 H1.8 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5 V9.6 M8 11 H8.01" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    ORANGE,
  )
  registry['nav-basic-form'] = colorize(
    '<path d="M4.5 2.5 H11.5 L13 4 V13.5 H4.5 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.5 6.5 H11 M6.5 9 H10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    GREEN,
  )
}

// Type declarations for the JSX UI component library (ui.jsx, icons.jsx).
// All props are declared as optional so TypeScript doesn't complain about
// unused/missing props — the JS components handle defaults internally.

declare module '*/ui.jsx' {
  import type { ReactNode } from 'react'

  export function Card(props: { children?: ReactNode; className?: string; [key: string]: any }): JSX.Element
  export function Button(props: { children?: ReactNode; variant?: string; size?: string; icon?: string; className?: string; type?: string; disabled?: boolean; onClick?: () => void; [key: string]: any }): JSX.Element
  export function IconButton(props: { icon: string; label?: string; className?: string; title?: string; onClick?: () => void; [key: string]: any }): JSX.Element
  export function Badge(props: { children?: ReactNode; tone?: string; dot?: boolean; className?: string; [key: string]: any }): JSX.Element
  export function Input(props: { label?: string; icon?: string; hint?: string; className?: string; type?: string; [key: string]: any }): JSX.Element
  export function Select(props: { label?: string; children?: ReactNode; className?: string; [key: string]: any }): JSX.Element
  export function Toggle(props: { checked?: boolean; onChange?: (v: boolean) => void; size?: string; [key: string]: any }): JSX.Element
  export function Modal(props: { open: boolean; onClose: () => void; title?: string; subtitle?: string; children?: ReactNode; footer?: ReactNode; width?: string; [key: string]: any }): JSX.Element
  export function PageHeader(props: { title?: string; subtitle?: string; children?: ReactNode; [key: string]: any }): JSX.Element
  export function EmptyState(props: { icon?: string; title?: string; desc?: string; action?: ReactNode; [key: string]: any }): JSX.Element
  export function Avatar(props: { name?: string; color?: string; size?: number; [key: string]: any }): JSX.Element
  export function ImgPlaceholder(props: { label?: string; tint?: string; rounded?: string; className?: string; [key: string]: any }): JSX.Element
  export const BADGE_TONES: Record<string, string>
}

declare module '*/icons.jsx' {
  export function Icon(props: { name: string; className?: string; strokeWidth?: number; [key: string]: any }): JSX.Element
}

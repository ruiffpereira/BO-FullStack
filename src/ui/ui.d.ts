import type { ReactNode, CSSProperties, ChangeEvent, MouseEvent } from 'react'

export declare function Card(props: { children?: ReactNode; className?: string; style?: CSSProperties; onClick?: (e: MouseEvent) => void; [k: string]: any }): JSX.Element
export declare function Button(props: { children?: ReactNode; variant?: string; size?: string; icon?: string; className?: string; type?: 'button' | 'submit' | 'reset'; disabled?: boolean; onClick?: () => void; form?: string; [k: string]: any }): JSX.Element
export declare function IconButton(props: { icon: string; label?: string; className?: string; title?: string; onClick?: () => void; [k: string]: any }): JSX.Element
export declare const BADGE_TONES: Record<string, string>
export declare function Badge(props: { children?: ReactNode; tone?: string; dot?: boolean; className?: string; [k: string]: any }): JSX.Element
export declare function Input(props: { label?: string; icon?: string; hint?: string; className?: string; type?: string; value?: any; onChange?: (e: ChangeEvent<HTMLInputElement>) => void; placeholder?: string; autoComplete?: string; min?: number; step?: number; required?: boolean; [k: string]: any }): JSX.Element
export declare function Select(props: { label?: string; value?: any; onChange?: (e: ChangeEvent<HTMLSelectElement>) => void; children?: ReactNode; className?: string; [k: string]: any }): JSX.Element
export declare function Toggle(props: { checked?: boolean; onChange?: (v: boolean) => void; size?: string; [k: string]: any }): JSX.Element
export declare function Modal(props: { open: boolean; onClose: () => void; title?: string; subtitle?: string; children?: ReactNode; footer?: ReactNode; width?: string; [k: string]: any }): JSX.Element
export declare function PageHeader(props: { title?: string; subtitle?: string; children?: ReactNode; [k: string]: any }): JSX.Element
export declare function EmptyState(props: { icon?: string; title?: string; desc?: string; action?: ReactNode; [k: string]: any }): JSX.Element
export declare function Avatar(props: { name?: string; color?: string; size?: number; [k: string]: any }): JSX.Element
export declare function ImgPlaceholder(props: { label?: string; tint?: string; rounded?: string; className?: string; [k: string]: any }): JSX.Element

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'brand' | 'success' | 'danger' | 'white' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const VARIANTS: Record<Variant, string> = {
  /** tmavé tlačidlo ako "Enter" v Kahoote – na bielej karte v hre */
  primary: 'btn-3d bg-ink text-white',
  brand: 'btn-3d bg-brand-700 text-white',
  success: 'btn-3d bg-ans-green text-white',
  danger: 'btn-3d bg-ans-red text-white',
  white: 'btn-3d bg-white text-ink',
  ghost: 'bg-transparent hover:bg-black/5 text-current',
  outline: 'border-2 border-gray-200 bg-white text-ink hover:border-brand-300 hover:bg-brand-50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-11 px-4 text-base gap-2 rounded-md',
  lg: 'h-14 px-6 text-lg gap-2 rounded-lg',
  xl: 'h-16 px-8 text-2xl gap-3 rounded-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'brand',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 select-none items-center justify-center font-bold whitespace-nowrap disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner className="size-5" /> : icon}
      {children}
    </button>
  )
}

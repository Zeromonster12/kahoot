import { Tag } from 'lucide-react'
import { categoryColor } from '../lib/theme'

/** Farebný štítok kategórie otázky. Prázdna kategória sa nezobrazí. */
export function CategoryBadge({ category, size = 'md', className = '' }: { category: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  if (!category.trim()) return null
  const s = {
    sm: 'text-xs px-2 py-0.5 gap-1 [&_svg]:size-3',
    md: 'text-sm px-3 py-1 gap-1.5 [&_svg]:size-4',
    lg: 'text-xl px-5 py-2 gap-2 [&_svg]:size-5',
  }[size]
  return (
    <span
      className={`inline-flex items-center rounded-full font-extrabold uppercase tracking-wide text-white shadow-[0_3px_0_rgb(0_0_0/0.2)] ${s} ${className}`}
      style={{ backgroundColor: categoryColor(category) }}
    >
      <Tag aria-hidden />
      {category}
    </span>
  )
}

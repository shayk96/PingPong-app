/**
 * Reusable Card component
 * Container with consistent styling
 */

import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ 
  children, 
  className = '', 
  onClick,
  hoverable = false 
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-background-light rounded-2xl p-4
        border border-background-lighter
        ${hoverable ? 'hover:bg-background-lighter cursor-pointer transition-colors' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-400">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}


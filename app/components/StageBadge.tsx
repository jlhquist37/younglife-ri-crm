import { STAGE_COLORS } from '@/app/lib/constants'

interface StageBadgeProps {
  stage: string | null
  className?: string
}

export default function StageBadge({ stage, className = '' }: StageBadgeProps) {
  if (!stage) return null
  const colorClass = STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`stage-badge ${colorClass} ${className}`}>
      {stage}
    </span>
  )
}

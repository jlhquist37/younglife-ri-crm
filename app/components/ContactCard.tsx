import Link from 'next/link'
import StageBadge from './StageBadge'
import { isStale, daysSince } from '@/app/lib/stale'
import { TYPE_LABELS } from '@/app/lib/constants'
import type { ContactWithOwner } from '@/app/lib/types'

interface ContactCardProps {
  contact: ContactWithOwner
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, contactId: string) => void
  compact?: boolean
}

export default function ContactCard({ contact, draggable = false, onDragStart, compact = false }: ContactCardProps) {
  const stale = isStale(contact.last_touchpoint_date ?? null, contact.created_at)
  const days = contact.last_touchpoint_date
    ? daysSince(contact.last_touchpoint_date)
    : daysSince(contact.created_at)

  if (compact) {
    return (
      <Link href={`/contacts/${contact.id}`}>
        <div
          className={`contact-card-compact ${stale ? 'stale-card' : ''}`}
          draggable={draggable}
          onDragStart={draggable && onDragStart ? (e) => onDragStart(e, contact.id) : undefined}
        >
          <div className="font-medium text-gray-900 text-sm truncate">{contact.name}</div>
          {contact.organization && (
            <div className="text-xs text-gray-500 truncate">{contact.organization}</div>
          )}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              {contact.type && (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {TYPE_LABELS[contact.type] ?? contact.type}
                </span>
              )}
              {contact.owner?.name && (
                <span className="text-xs text-gray-400">{contact.owner.name}</span>
              )}
            </div>
            {stale ? (
              <span className="stale-text">{days != null ? `${days}d` : '—'}</span>
            ) : (
              <span className="text-xs text-gray-400">{days != null ? `${days}d` : 'New'}</span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/contacts/${contact.id}`}>
      <div
        className={`contact-card ${stale ? 'stale-card' : ''}`}
        draggable={draggable}
        onDragStart={draggable && onDragStart ? (e) => onDragStart(e, contact.id) : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">{contact.name}</div>
            {contact.organization && (
              <div className="text-sm text-gray-500 truncate">{contact.organization}</div>
            )}
          </div>
          {contact.stage && <StageBadge stage={contact.stage} />}
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {contact.type && (
            <span className="type-badge">{TYPE_LABELS[contact.type] ?? contact.type}</span>
          )}
          {contact.owner?.name && (
            <span className="text-xs text-gray-500">{contact.owner.name}</span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          {stale ? (
            <span className="stale-text">
              {days != null ? `${days}d no activity` : 'No activity'}
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              {days != null ? `${days}d ago` : 'New'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

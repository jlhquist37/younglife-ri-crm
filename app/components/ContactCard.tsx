import Link from 'next/link'
import StageBadge from './StageBadge'
import { isStale, daysSince } from '@/app/lib/stale'
import { TYPE_LABELS } from '@/app/lib/constants'
import type { ContactWithOwner } from '@/app/lib/types'

interface ContactCardProps {
  contact: ContactWithOwner
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, contactId: string) => void
}

export default function ContactCard({ contact, draggable = false, onDragStart }: ContactCardProps) {
  const stale = isStale(contact.last_touchpoint_date ?? null, contact.created_at)
  const days = contact.last_touchpoint_date
    ? daysSince(contact.last_touchpoint_date)
    : daysSince(contact.created_at)

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

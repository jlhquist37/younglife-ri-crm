'use client'

import { useState } from 'react'
import { PREDEFINED_TAGS } from '@/app/lib/constants'

interface TagPickerProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export default function TagPicker({ value, onChange }: TagPickerProps) {
  const [customInput, setCustomInput] = useState('')

  function toggleTag(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag))
    } else {
      onChange([...value, tag])
    }
  }

  function addCustom() {
    const trimmed = customInput.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setCustomInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustom()
    }
  }

  return (
    <div>
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="hover:text-red-600 transition-colors ml-0.5"
                aria-label={`Remove ${tag}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Predefined tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PREDEFINED_TAGS.map((tag) => {
          const selected = value.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                selected
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>

      {/* Custom tag input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add custom tag..."
          className="form-input"
        />
        <button
          type="button"
          onClick={addCustom}
          className="btn-secondary whitespace-nowrap"
        >
          Add
        </button>
      </div>
    </div>
  )
}

import type { SnapshotData } from '@/app/lib/types'

function pipelineTable(stages: Record<string, number>, deltas?: Record<string, number>): string {
  const rows = Object.entries(stages)
    .map(([stage, count]) => {
      const delta = deltas?.[stage]
      const deltaStr =
        delta !== undefined
          ? `<span style="color:${delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#6b7280'};font-size:12px;margin-left:6px">${delta > 0 ? '+' : ''}${delta}</span>`
          : ''
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${stage}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${count}${deltaStr}</td></tr>`
    })
    .join('')
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px"><tbody>${rows}</tbody></table>`
}

export function buildSummaryEmail(data: SnapshotData): string {
  const month = new Date(data.period + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const staleRows = data.stale_contacts
    .slice(0, 10)
    .map(
      (c) =>
        `<tr><td style="padding:4px 12px;border-bottom:1px solid #fde68a">${c.name}</td><td style="padding:4px 12px;border-bottom:1px solid #fde68a;text-align:right">${c.days} days</td></tr>`
    )
    .join('')

  const touchpointByTypeRows = Object.entries(data.touchpoints_by_type)
    .map(
      ([type, count]) =>
        `<tr><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb">${type.replace(/_/g, ' ')}</td><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${count}</td></tr>`
    )
    .join('')

  const teamRows = data.touchpoints_by_user
    .map(
      (u) =>
        `<tr><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb">${u.name}</td><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${u.count}</td></tr>`
    )
    .join('')

  const newContactRows = data.new_contacts
    .map(
      (c) =>
        `<tr><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb">${c.name}</td><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb">${c.type}</td><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb">${c.stage ?? '—'}</td></tr>`
    )
    .join('')

  const stageChangeRows = data.stage_changes
    .map(
      (s) =>
        `<tr><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb">${s.name}</td><td style="padding:4px 12px;border-bottom:1px solid #e5e7eb">${s.from ?? '—'} → ${s.to ?? '—'}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)">
  <!-- Header -->
  <div style="background:#1e3a5f;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">YoungLife RI</h1>
    <p style="margin:4px 0 0;color:#93c5fd;font-size:14px">Monthly Relationship Summary — ${month}</p>
  </div>

  <div style="padding:24px 32px">

    <!-- Individual Pipeline -->
    <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 8px">Individual & Business Pipeline</h2>
    ${pipelineTable(data.pipeline_individual, data.delta_individual)}

    <!-- Church Pipeline -->
    <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 8px">Church Partnerships</h2>
    ${pipelineTable(data.pipeline_church, data.delta_church)}

    <p style="font-size:13px;color:#6b7280;margin:-8px 0 20px">Active partners: <strong>${data.church_summary.active_partners}</strong> &nbsp;|&nbsp; New churches this month: <strong>${data.church_summary.new_churches}</strong></p>

    <!-- Touchpoints this month -->
    <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 8px">Touchpoints This Month</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px"><tbody>${touchpointByTypeRows}</tbody></table>

    <!-- Team activity -->
    <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 8px">Team Activity</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px"><tbody>${teamRows}</tbody></table>

    <!-- New contacts -->
    ${
      data.new_contacts.length > 0
        ? `<h2 style="font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 8px">New Contacts (${data.new_contacts_count})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#f9fafb"><th style="padding:6px 12px;text-align:left;font-size:12px;color:#6b7280">Name</th><th style="padding:6px 12px;text-align:left;font-size:12px;color:#6b7280">Type</th><th style="padding:6px 12px;text-align:left;font-size:12px;color:#6b7280">Stage</th></tr></thead>
      <tbody>${newContactRows}</tbody>
    </table>`
        : ''
    }

    <!-- Stage changes -->
    ${
      data.stage_changes.length > 0
        ? `<h2 style="font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 8px">Stage Changes</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px"><tbody>${stageChangeRows}</tbody></table>`
        : ''
    }

    <!-- Stale contacts -->
    ${
      data.stale_contacts.length > 0
        ? `<h2 style="font-size:16px;font-weight:700;color:#b45309;margin:0 0 8px">Needs Attention (60+ days)</h2>
    <div style="background:#fffbeb;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse"><tbody>${staleRows}</tbody></table>
      ${data.stale_contacts.length > 10 ? `<p style="padding:8px 12px;font-size:12px;color:#92400e;margin:0">...and ${data.stale_contacts.length - 10} more</p>` : ''}
    </div>`
        : ''
    }

  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:12px;color:#9ca3af">Financial tracking is managed separately and not reflected here.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">YoungLife Rhode Island &bull; youngliferi.org</p>
  </div>
</div>
</body>
</html>`
}

export function buildSummaryPlainText(data: SnapshotData): string {
  const month = new Date(data.period + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const lines: string[] = [
    `YoungLife RI — Monthly Summary: ${month}`,
    '='.repeat(50),
    '',
    'INDIVIDUAL & BUSINESS PIPELINE',
    ...Object.entries(data.pipeline_individual).map(([s, c]) => `  ${s}: ${c}`),
    '',
    'CHURCH PARTNERSHIPS',
    ...Object.entries(data.pipeline_church).map(([s, c]) => `  ${s}: ${c}`),
    `  Active Partners: ${data.church_summary.active_partners}`,
    '',
    'TOUCHPOINTS THIS MONTH',
    ...Object.entries(data.touchpoints_by_type).map(([t, c]) => `  ${t}: ${c}`),
    '',
    'TEAM ACTIVITY',
    ...data.touchpoints_by_user.map((u) => `  ${u.name}: ${u.count}`),
    '',
    `NEW CONTACTS: ${data.new_contacts_count}`,
    ...data.new_contacts.map((c) => `  ${c.name} (${c.type}) — ${c.stage ?? 'no stage'}`),
    '',
    'STAGE CHANGES',
    ...data.stage_changes.map((s) => `  ${s.name}: ${s.from ?? '—'} → ${s.to ?? '—'}`),
    '',
    'NEEDS ATTENTION (60+ days)',
    ...data.stale_contacts.map((c) => `  ${c.name}: ${c.days} days`),
    '',
    '---',
    'Financial tracking is managed separately and not reflected here.',
  ]

  return lines.join('\n')
}

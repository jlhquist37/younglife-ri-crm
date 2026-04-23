const fs = require('fs');

const ANTHROPIC_KEY = 'process.env.ANTHROPIC_API_KEY';
const SUPABASE_URL = 'https://isrujlamyagkmvleoers.supabase.co';
const SUPABASE_SERVICE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
const PDF_PATH = 'C:\\Users\\James\\Downloads\\RIYL - Donor List - Oct 1 2024 to March 27 2026.pdf';
const JAMES_USER_ID = '241e7471-1ad3-412a-b12e-95bb3f6ae48a';

async function sbFetch(path, options = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

async function main() {
  console.log('Reading PDF...');
  const bytes = fs.readFileSync(PDF_PATH);
  const base64 = bytes.toString('base64');
  console.log(`PDF size: ${(bytes.length / 1024).toFixed(0)}KB, base64 length: ${base64.length}`);

  console.log('Sending to Claude for extraction...');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          },
          {
            type: 'text',
            text: `Extract all person/donor records from this document. Return ONLY a JSON array.
Each object should have these fields (use null if not present):
- name (string, required - full name)
- organization (string or null)
- phone (string or null)
- email (string or null)
- address (string or null - combine street, city, state, zip into one string)

Example: [{"name":"John Smith","organization":null,"phone":"401-555-1234","email":"john@example.com","address":"123 Main St, Providence, RI 02903"}]

Return ONLY the JSON array, no explanation.`
          }
        ]
      }]
    })
  });

  const data = await res.json();
  if (data.error) {
    console.error('Anthropic error:', data.error);
    process.exit(1);
  }

  const text = data.content[0].type === 'text' ? data.content[0].text : '';
  console.log('\nClaude response (first 500 chars):', text.substring(0, 500));

  // Extract JSON array
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error('No JSON array found in response');
    console.log('Full response:', text);
    process.exit(1);
  }

  let rows;
  try {
    rows = JSON.parse(match[0]);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    process.exit(1);
  }

  console.log(`\nExtracted ${rows.length} contacts from PDF`);
  if (rows.length > 0) {
    console.log('Sample:', JSON.stringify(rows[0]));
    console.log('Sample:', JSON.stringify(rows[1]));
  }

  if (rows.length === 0) {
    console.log('No contacts to import.');
    process.exit(0);
  }

  // Insert into Supabase contacts table
  console.log('\nInserting into Supabase...');
  let imported = 0, errors = 0;

  // Batch in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const chunk = rows.slice(i, i + chunkSize).map(r => {
      // Use organization as name if name is null
      const name = (r.name || r.organization || '').trim();
      // Validate email — if it doesn't look like an email, discard it
      const email = r.email && emailRegex.test(r.email.trim()) ? r.email.trim() : null;
      return {
        name,
        organization: r.organization || null,
        phone: r.phone || null,
        email,
        address: r.address || null,
        type: 'individual',
        stage: 'Donor',
        relationship_owner: JAMES_USER_ID,
        tags: ['donor', 'imported'],
      };
    }).filter(r => r.name);

    const result = await sbFetch('/rest/v1/contacts', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(chunk)
    });

    if (result.status === 201 || result.status === 200) {
      imported += chunk.length;
      console.log(`  Chunk ${Math.floor(i/chunkSize)+1}: inserted ${chunk.length} contacts`);
    } else {
      console.error(`  Chunk ${Math.floor(i/chunkSize)+1} error:`, JSON.stringify(result.body).substring(0, 200));
      errors += chunk.length;
    }
  }

  console.log(`\nDone! Imported: ${imported}, Errors: ${errors}`);
}

main().catch(console.error);

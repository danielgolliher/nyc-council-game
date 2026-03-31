const ALLOWED_ORIGINS = [
  'https://danielgolliher.github.io',
  'http://localhost:8080',
  'http://localhost:3000',
]

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildEmailHTML({ fromName, fromEmail, toEmail, memberName, district, subject, body }) {
  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #F0F2F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #F0F2F5;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width: 560px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a3a5c, #2980b9); border-radius: 12px 12px 0 0; padding: 24px 28px; text-align: center;">
              <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; color: #FFFFFF; margin: 0 0 6px; line-height: 1.2;">
                Message for ${escapeHtml(memberName)}
              </h1>
              <div style="font-size: 14px; color: rgba(255,255,255,0.85);">
                ${escapeHtml(district)} &middot; NYC Council
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background: #FFFFFF; padding: 28px;">
              <div style="font-size: 13px; color: #666; margin-bottom: 16px;">
                From: <strong>${escapeHtml(fromName || fromEmail)}</strong> &lt;${escapeHtml(fromEmail)}&gt;
              </div>
              <div style="font-size: 15px; color: #222; line-height: 1.6;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #F8F9FA; border-top: 1px solid #E0E0E0; border-radius: 0 0 12px 12px; padding: 20px 28px; text-align: center;">
              <div style="font-size: 12px; color: #999; line-height: 1.5;">
                Sent via <a href="https://danielgolliher.github.io/nyc-council-game/" target="_blank" style="color: #2980b9; text-decoration: none; font-weight: 600;">NYC Council Quest</a>
                &middot; The sender's email is in CC for direct reply.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      })
    }

    const { toEmail, fromEmail, memberName, district, subject, message } = body

    if (!fromEmail || typeof fromEmail !== 'string' || !fromEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid sender email required' }), {
        status: 400,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      })
    }

    if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid recipient email required' }), {
        status: 400,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      })
    }

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: 'Subject and message required' }), {
        status: 400,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      })
    }

    const html = buildEmailHTML({
      fromName: '',
      fromEmail,
      toEmail,
      memberName: memberName || '',
      district: district || '',
      subject,
      body: message,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NYC Council Quest <noreply@data.maximumnewyork.com>',
        to: toEmail,
        cc: fromEmail,
        reply_to: fromEmail,
        subject: subject,
        html,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: result.message || 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    })
  },
}

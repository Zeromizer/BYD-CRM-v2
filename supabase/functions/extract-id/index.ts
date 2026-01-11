/**
 * Supabase Edge Function: extract-id
 * Extracts ID card and license information using Claude Haiku
 * API key stored in Edge Function Secrets (ANTHROPIC_API_KEY)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractIDRequest {
  type: 'id' | 'license'
  frontImage: string
  backImage?: string
}

interface ImageContent {
  type: 'image'
  source: {
    type: 'base64'
    media_type: string
    data: string
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Edge function called')

  try {
    const body = (await req.json()) as ExtractIDRequest & { type?: string }

    // Handle ping request for pre-warming (eliminates cold start)
    if (body.type === 'ping') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in secrets')
      return new Response(JSON.stringify({ error: 'Claude API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.log('API key found')

    const { type, frontImage, backImage } = body as ExtractIDRequest
    console.log(
      'Request type:',
      type,
      'Front image size:',
      frontImage?.length || 0,
      'Back image size:',
      backImage?.length || 0
    )

    if (!frontImage) {
      return new Response(JSON.stringify({ error: 'Front image is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let prompt: string

    if (type === 'license') {
      prompt = `Extract from this Singapore driving license image. Return ONLY valid JSON, no other text:
{"licenseStartDate":"YYYY-MM-DD","confidence":0-100}

Find the DATE OF ISSUE or VALID FROM date. Use "" if not found.`
    } else {
      prompt = `Extract from this Singapore NRIC/FIN card. Return ONLY valid JSON, no other text:
{"name":"FULL NAME","nric":"S1234567A","dob":"YYYY-MM-DD","address":"BLK STREET UNIT","addressContinue":"SINGAPORE POSTAL","confidence":0-100}

- name: Full name as shown on card
- nric: NRIC/FIN number (format: S1234567A)
- dob: Date of birth (YYYY-MM-DD)
- address: First line of address (from back of card if available)
- addressContinue: Second line with SINGAPORE and postal code
- confidence: Your confidence in the extraction (0-100)

Use "" for any field you cannot read clearly.`
    }

    // Build image content array for Claude
    const imageContent: ImageContent[] = []

    imageContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: getMimeType(frontImage),
        data: dataUrlToBase64(frontImage),
      },
    })

    if (backImage) {
      imageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: getMimeType(backImage),
          data: dataUrlToBase64(backImage),
        },
      })
    }

    console.log('Calling Claude API with', imageContent.length, 'image(s)')

    // Call Claude API
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20241022',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [...imageContent, { type: 'text', text: prompt }],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      return new Response(JSON.stringify({ error: `Claude API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const textResponse = data.content?.[0]?.text

    console.log('Claude response:', textResponse)

    if (!textResponse) {
      return new Response(JSON.stringify({ error: 'No response from Claude' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse JSON from response (Claude might wrap in markdown code blocks)
    let jsonStr = textResponse.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    let result
    try {
      result = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse JSON:', jsonStr)
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Format response based on type
    if (type === 'license') {
      return new Response(
        JSON.stringify({
          licenseStartDate: result.licenseStartDate || '',
          confidence: result.confidence || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({
          name: result.name || '',
          nric: result.nric?.toUpperCase() || '',
          dob: result.dob || '',
          address: result.address || '',
          addressContinue: result.addressContinue || '',
          confidence: result.confidence || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Convert base64 data URL to base64 string (without prefix)
 */
function dataUrlToBase64(dataUrl: string): string {
  const base64Index = dataUrl.indexOf('base64,')
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7)
  }
  return dataUrl
}

/**
 * Detect MIME type from data URL
 */
function getMimeType(dataUrl: string): string {
  if (dataUrl.includes('image/webp')) return 'image/webp'
  if (dataUrl.includes('image/png')) return 'image/png'
  return 'image/jpeg'
}

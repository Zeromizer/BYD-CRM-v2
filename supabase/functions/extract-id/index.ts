/**
 * Supabase Edge Function: extract-id
 * Extracts ID card and license information using Gemini AI
 * API key stored in Edge Function Secrets (GEMINI_API_KEY)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractIDRequest {
  type: 'id' | 'license'
  frontImage: string
  backImage?: string
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

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error('GEMINI_API_KEY not found in secrets')
      return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
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
    let imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = []

    if (type === 'license') {
      // License extraction prompt (optimized for faster inference)
      prompt = `Extract from Singapore driving license. Return JSON only:
{"licenseStartDate":"YYYY-MM-DD","confidence":0-100}
Find DATE OF ISSUE or VALID FROM date. Use "" if not found.`

      imageParts.push({
        inlineData: {
          mimeType: getMimeType(frontImage),
          data: dataUrlToBase64(frontImage),
        },
      })
    } else {
      // ID card extraction prompt (optimized for faster inference)
      prompt = `Extract from Singapore NRIC/FIN card. Return JSON only:
{"name":"FULL NAME","nric":"S1234567A","dob":"YYYY-MM-DD","address":"BLK STREET UNIT","addressContinue":"SINGAPORE POSTAL","confidence":0-100}
Use "" for unreadable fields. Address from back if available.`

      imageParts.push({
        inlineData: {
          mimeType: getMimeType(frontImage),
          data: dataUrlToBase64(frontImage),
        },
      })

      if (backImage) {
        imageParts.push({
          inlineData: {
            mimeType: getMimeType(backImage),
            data: dataUrlToBase64(backImage),
          },
        })
      }
    }

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, ...imageParts],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: type === 'license' ? 256 : 512,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `Gemini API error: ${response.status}`
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textResponse) {
      return new Response(JSON.stringify({ error: 'No response from Gemini' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse JSON from response
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

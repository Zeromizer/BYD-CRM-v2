// Supabase Edge Function: extract-id
// Uses Claude Haiku for ID/License extraction

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, frontImage, backImage } = await req.json()

    console.log(
      'Request received:',
      type,
      'front:',
      frontImage?.length || 0,
      'back:',
      backImage?.length || 0
    )

    // Ping for pre-warming
    if (type === 'ping') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!frontImage) {
      return new Response(JSON.stringify({ error: 'Front image is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build prompt
    const prompt =
      type === 'license'
        ? `Extract from this Singapore driving license. You MUST respond with ONLY this JSON format, nothing else: {"licenseStartDate":"YYYY-MM-DD","confidence":0-100}. If you cannot find the data, use empty strings and confidence 0.`
        : `Extract from this Singapore NRIC/FIN card. You MUST respond with ONLY this JSON format, nothing else: {"name":"","nric":"","dob":"YYYY-MM-DD","address":"","addressContinue":"","confidence":0-100}. If you cannot find the data, use empty strings and confidence 0.`

    // Build image content
    const images = []
    images.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: frontImage.includes('webp')
          ? 'image/webp'
          : frontImage.includes('png')
            ? 'image/png'
            : 'image/jpeg',
        data: frontImage.split('base64,')[1] || frontImage,
      },
    })

    if (backImage) {
      images.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: backImage.includes('webp')
            ? 'image/webp'
            : backImage.includes('png')
              ? 'image/png'
              : 'image/jpeg',
          data: backImage.split('base64,')[1] || backImage,
        },
      })
    }

    console.log('Calling Claude with', images.length, 'images')

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [...images, { type: 'text', text: prompt }],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Claude error:', response.status, err)
      return new Response(JSON.stringify({ error: `Claude API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    let text = data.content?.[0]?.text || ''
    console.log('Claude response:', text)

    // Clean up JSON
    text = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const result = JSON.parse(text)

    // Return formatted response
    if (type === 'license') {
      return new Response(
        JSON.stringify({
          licenseStartDate: result.licenseStartDate || '',
          confidence: result.confidence || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        name: result.name || '',
        nric: (result.nric || '').toUpperCase(),
        dob: result.dob || '',
        address: result.address || '',
        addressContinue: result.addressContinue || '',
        confidence: result.confidence || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

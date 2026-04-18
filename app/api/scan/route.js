import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { imageBase64, mediaType } = await request.json()

    if (!imageBase64 || !mediaType) {
      return Response.json({ error: 'imageBase64 y mediaType son requeridos' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Analizá esta imagen de un medicamento. Respondé ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones) con estos campos:
- "name": nombre comercial del medicamento
- "dose": dosis (ej: "10mg", "500mg/5ml")
- "activeIngredient": principio activo o componente principal
- "laboratory": laboratorio fabricante (null si no se ve)
- "instructions": instrucciones de uso visibles en el envase (null si no hay)

Si la imagen no muestra un medicamento o no podés identificarlo, devolvé: {"error": "No se pudo identificar el medicamento en la imagen"}

Responde SOLO con el JSON, nada más.`,
            },
          ],
        },
      ],
    })

    const raw = response.content[0]?.text ?? ''
    // Extract JSON — Claude might wrap it in ```json blocks
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ error: 'No se pudo identificar el medicamento en la imagen' })
    }

    const data = JSON.parse(jsonMatch[0])
    return Response.json(data)
  } catch (err) {
    console.error('[/api/scan]', err)
    return Response.json({ error: 'Error al analizar la imagen' }, { status: 500 })
  }
}

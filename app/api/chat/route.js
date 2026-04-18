import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Sos un asistente de medicación en español argentino. Tenés acceso a la lista de medicamentos del usuario y podés ayudarlo con dudas sobre su medicación.

Reglas importantes:
- Respondé de forma clara, empática y concisa.
- SIEMPRE aclarás que no sos un médico y que el usuario debe consultar con un profesional de salud para decisiones médicas.
- Si te preguntan sobre interacciones, efectos secundarios o si pueden tomar algo, respondé con información general pero siempre recomendando consultar al médico.
- Nunca inventés información médica que no conozcas.
- Si el usuario olvidó una dosis, orientalo según las guías generales pero indicando que consulte a su médico o farmacéutico.
- Usá el tuteo (vos, tenés, tomás).`

export async function POST(request) {
  try {
    const { messages, medications } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'messages requerido' }, { status: 400 })
    }

    // Build medications context
    const medsContext = medications?.length
      ? `\n\nMedicamentos actuales del usuario:\n${medications
          .map(
            (m) =>
              `• ${m.name} ${m.dose} — ${m.frequency}${
                m.times?.length ? ` (horarios: ${m.times.join(', ')})` : ''
              }${m.instructions ? ` — ${m.instructions}` : ''}`
          )
          .join('\n')}`
      : '\n\nEl usuario no tiene medicamentos registrados todavía.'

    const systemWithContext = SYSTEM_PROMPT + medsContext

    // Stream from Anthropic
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-0',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemWithContext,
          // Cache the system prompt + meds context — stays stable per session
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[/api/chat]', err)
    return Response.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

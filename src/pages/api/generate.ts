import { verifySignature } from '@/utils/auth'
import OpenAI from 'openai'
import type { APIRoute } from 'astro'

const apiKey = import.meta.env.OPENAI_API_KEY
const baseUrl = ((import.meta.env.OPENAI_API_BASE_URL) || 'https://api.openai.com').trim().replace(/\/$/, '')
export const model = import.meta.env.OPENAI_API_MODEL || 'gpt-3.5-turbo'
const sitePassword = import.meta.env.SITE_PASSWORD || ''
const passList = sitePassword.split(',') || []

const client = new OpenAI({ baseURL: baseUrl, apiKey });

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const { sign, time, messages, pass, temperature } = body
  if (!messages) {
    return new Response(JSON.stringify({
      error: {
        message: 'No input text.',
      },
    }), { status: 400 })
  }
  if (sitePassword && !(sitePassword === pass || passList.includes(pass))) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid password.',
      },
    }), { status: 401 })
  }
  if (import.meta.env.PROD && !await verifySignature({ t: time, m: messages?.[messages.length - 1]?.content || '' }, sign)) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid signature.',
      },
    }), { status: 401 })
  }

  const response = await client.chat.completions.create({
      messages,
      model,
      temperature,
      stream: true
    });

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of response) {
        for (const choice of chunk.choices) {
          if (choice.delta.content) {
            controller.enqueue(choice.delta.content);
          }
        }
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' }
  });
}

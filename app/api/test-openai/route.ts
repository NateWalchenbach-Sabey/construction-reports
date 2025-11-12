import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

export async function GET() {
  try {
    const openai = getOpenAIClient()
    
    // Simple test: send "hello" and get a response
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello back to me' },
      ],
      max_tokens: 50,
      temperature: 0.7,
    })

    const message = response.choices[0].message.content

    return NextResponse.json({ 
      success: true,
      message: message,
      test: 'OpenAI connection is working!'
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect to OpenAI'
    const errorDetails = error instanceof Error ? error.toString() : String(error)
    console.error('OpenAI test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    )
  }
}


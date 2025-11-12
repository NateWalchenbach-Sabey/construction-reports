import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { REGION_NAMES } from '@/lib/constants'
import OpenAI from 'openai'

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

export async function POST(request: NextRequest) {
  try {
    // Skip auth check in dev mode
    if (process.env.BYPASS_AUTH !== 'true') {
      const session = await getServerSession(authOptions)
      
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { question, projects, weekEnding } = await request.json()

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Build context from projects
    let contextText = `Week Ending: ${weekEnding}\n\nProjects:\n`
    
    for (const project of projects || []) {
      const region = REGION_NAMES[project.region] || project.region
      const budget = typeof project.projectBudget === 'string'
        ? parseFloat(project.projectBudget.replace(/[$,]/g, '')) || 0
        : project.projectBudget || 0
      const eac = typeof project.eac === 'string'
        ? parseFloat(project.eac.replace(/[$,]/g, '')) || 0
        : project.eac || 0
      const variance = typeof project.budgetVariance === 'string'
        ? parseFloat(project.budgetVariance.replace(/[$,]/g, '')) || 0
        : project.budgetVariance || 0

      const latestReport = project.reports && project.reports.length > 0 ? project.reports[0] : null
      const totalTradeWorkers = latestReport?.totalTradeWorkers || 0
      const workPerformed = latestReport?.workPerformed || 'No recent updates'
      const safety = latestReport?.safety || 'None to report'

      contextText += `
Project Name: ${project.name}
Project Code: ${project.code}
Region: ${region}
Budget: $${budget.toLocaleString()}
Est. Cost at Completion: $${eac.toLocaleString()}
Budget Variance: $${variance.toLocaleString()} ${variance > 0 ? '(OVER BUDGET)' : variance < 0 ? '(UNDER BUDGET)' : '(ON BUDGET)'}
Percent Complete: ${project.percentComplete || 0}%
Start Date: ${project.startDate || 'N/A'}
Scheduled Completion: ${project.scheduledCompletion || 'N/A'}
Tenant: ${project.tenant || 'N/A'}
Latest Report Date: ${latestReport?.reportDate || 'No reports yet'}
Total Trade Workers: ${totalTradeWorkers}
Work Performed: ${workPerformed.substring(0, 200)}${workPerformed.length > 200 ? '...' : ''}
Safety: ${safety.substring(0, 100)}${safety.length > 100 ? '...' : ''}
---
`
    }

    const prompt = `You are a helpful construction project assistant. Answer questions about the construction projects based on the following data.

${contextText}

     Instructions:
     - Answer the user's question concisely and accurately
     - Use rich markdown formatting for excellent readability:
       * Use **bold** for ALL financial numbers, project names, and key metrics
       * Use bullet points (-) or numbered lists (1., 2., 3.) for multiple items
       * Use code formatting (\`code\`) for project codes
       * Use line breaks between sections
       * Use headers (##) to organize sections when appropriate
     - When mentioning projects, use the project name. Only include the project code if it's different from the name or if it adds clarity (e.g., **SDC-SEA-53 UPS Replacement** or just **UPS Replacement** if the code is redundant)
     - Do NOT add parentheses around project codes unless the code is significantly different from the name
     - For budget questions, ALWAYS format dollar amounts with commas and bold them (e.g., **$5,000,000** or **$1,234,567.89**)
     - For percentages, always bold them (e.g., **75%** or **12.5%**)
     - For "top" or "highest" questions, use numbered lists (1., 2., 3.) with bold project names and numbers
     - For "over budget" questions, look for projects with positive budget variance and highlight the amounts in bold
     - For "under budget" questions, look for projects with negative budget variance and highlight the amounts in bold
     - When listing financial data, use bullet points or tables with bold numbers
     - Mention regions when relevant
     - Be helpful, direct, and conversational
     - Structure your response with clear sections using markdown headers
     - Make numbers stand out - they should be bold and easy to scan
     - Use tables when comparing multiple projects or financial metrics

     User question: ${question}`

    const openai = getOpenAIClient()
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful construction project assistant. Answer questions concisely and accurately based on the provided project data.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    })

    const answer = response.choices[0].message.content?.trim() || 'I apologize, but I could not generate a response.'

    return NextResponse.json({ answer })
  } catch (error: unknown) {
    console.error('AI Chat error:', error)
    const message = error instanceof Error ? error.message : 'Failed to process question'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}


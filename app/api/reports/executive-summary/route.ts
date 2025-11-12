import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { REGION_NAMES } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { getProjectsFinancials } from '@/lib/get-project-financials'
import OpenAI from 'openai'

// Initialize OpenAI client only if API key is available
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'PM', 'EXECUTIVE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { weekEnding } = await request.json()

    if (!weekEnding) {
      return NextResponse.json({ error: 'weekEnding is required' }, { status: 400 })
    }

    // Fetch all projects with their latest reports
    const projects = await prisma.project.findMany({
      include: {
        reports: {
          take: 1,
          orderBy: { reportDate: 'desc' },
        },
      },
    })

    // Get financial data from ProjectFinancials for all projects
    const projectIds = projects.map(p => p.id)
    const financialsMap = await getProjectsFinancials(projectIds)

    // Build report text similar to Python script
    let reportText = ''
    for (const project of projects) {
      const region = REGION_NAMES[project.region] || project.region
      const latestReport = project.reports[0]
      const financials = financialsMap.get(project.id) || { budget: null, eac: null, variance: null }
      
      // Use cost report data if available, otherwise fall back to project defaults
      const budget = financials.budget !== null ? financials.budget : (project.projectBudget || 0)
      const eac = financials.eac !== null ? financials.eac : (project.eac || 0)
      const variance = financials.variance !== null ? financials.variance : (project.budgetVariance || 0)
      
      reportText += `Region: ${region}
Project: ${project.name}
Start Date: ${project.startDate || 'N/A'}
End Date: ${project.scheduledCompletion || 'N/A'}
Percent Complete: ${project.percentComplete || 0}
Budget: ${budget}
Est. Cost at Completion: ${eac}
Variance: ${variance}
Work Performed: ${latestReport?.workPerformed || 'None to report'}
Safety: ${latestReport?.safety || 'None to report'}
Variance Comments: ${project.budgetVarianceNote || ''}

`
    }

    // Generate AI summary
    const prompt = `
You are writing a weekly construction portfolio summary for executive leadership.

Instructions:
- For each unique region found in the data, write a brief paragraph (1–2 sentences) stating whether projects in that region are generally on schedule and on budget.
- Mention only significant risks or incidents if explicitly reported and always relate them to the specific Project Names.
- For each region, review all project work descriptions and, using your best judgment, identify the most critical path activity currently underway; summarize it in 1–2 sentences and mention the relevant project name.
- Be concise, direct, and positive. Mention individual project names, numbers, or details as needed. Do also mention Budget and Est Cost at Completion, relating them to specific Project names.
- Use <b>Region Name:</b> at the start of each paragraph (in HTML).
- Do not invent or speculate; only summarize what is present in the data.

-Format your output in HTML, with each region's summary as a separate paragraph with line separators and starting with Region name in bold.

Examples of regions are SDC Austin, SDC Seattle, SDC Columbia. 
Here is the report data:
${reportText}
`

    const openai = getOpenAIClient()
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful construction analyst.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    })

    let aiSummary = response.choices[0].message.content?.trim() || ''

    // Clean up markdown code blocks if present
    if (aiSummary.startsWith('```html')) {
      aiSummary = aiSummary.slice(7)
    }
    if (aiSummary.startsWith('```')) {
      aiSummary = aiSummary.slice(3)
    }
    if (aiSummary.endsWith('```')) {
      aiSummary = aiSummary.slice(0, -3)
    }
    aiSummary = aiSummary.trim()

    return NextResponse.json({ summary: aiSummary })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate executive summary'
    console.error('Error generating executive summary:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import { REGION_NAMES } from '@/lib/constants'
import { getProjectsFinancials } from '@/lib/get-project-financials'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PM, Executive, and Admin can view weekly summary
    if (!['PM', 'EXECUTIVE', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const weekEnding = searchParams.get('weekEnding') // Optional: specific week, defaults to most recent

    // Get all projects with their latest reports for the week
    const weekStart = new Date(weekEnding || new Date())
    weekStart.setDate(weekStart.getDate() - 6) // Go back 6 days to get the week
    
    const projects = await prisma.project.findMany({
      include: {
        reports: {
          where: weekEnding ? {
            reportDate: {
              gte: weekStart,
              lte: new Date(weekEnding),
            },
          } : undefined,
          orderBy: { reportDate: 'desc' },
          include: {
            activities: {
              include: {
                subcontractor: true,
                craft: true,
              },
            },
            author: {
              select: { name: true, email: true },
            },
          },
        },
      },
      orderBy: { region: 'asc' },
    })

    // Get financial data from ProjectFinancials for all projects
    const projectIds = projects.map(p => p.id)
    const financialsMap = await getProjectsFinancials(projectIds)

    // Attach financial data to projects
    const projectsWithFinancials = projects.map(project => {
      const financials = financialsMap.get(project.id) || { budget: null, eac: null, variance: null }
      return {
        ...project,
        projectBudget: financials.budget !== null ? financials.budget : project.projectBudget,
        eac: financials.eac !== null ? financials.eac : project.eac,
        budgetVariance: financials.variance !== null ? financials.variance : (financials.eac && financials.budget ? financials.eac - financials.budget : project.budgetVariance),
      }
    })

    // Group projects by region
    const projectsByRegion: Record<string, typeof projectsWithFinancials> = {}
    projectsWithFinancials.forEach(project => {
      const region = project.region
      if (!projectsByRegion[region]) {
        projectsByRegion[region] = []
      }
      projectsByRegion[region].push(project)
    })

    // Generate HTML report
    const html = generateWeeklySummaryHTML(projectsByRegion, weekEnding)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    console.error('Error generating weekly summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateWeeklySummaryHTML(
  projectsByRegion: Record<string, Array<{
    name: string
    projectNumber?: string | null
    tenant?: string | null
    projectBudget?: number | string | null
    eac?: number | string | null
    budgetVariance?: number | string | null
    percentComplete?: number | null
    reports?: Array<{ totalTradeWorkers?: number | null; reportDate: Date }>
  }>>,
  weekEnding: string | null
): string {
  const currentWeekEnding = weekEnding 
    ? new Date(weekEnding)
    : new Date() // Default to current date

  // Set to Friday of current week
  const dayOfWeek = currentWeekEnding.getDay()
  const diff = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 - dayOfWeek + 7
  const friday = new Date(currentWeekEnding)
  friday.setDate(friday.getDate() + diff)

  const weekEndingStr = formatDate(friday)

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Project Summary - ${weekEndingStr}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #dc2626;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #dc2626;
      font-size: 32px;
      margin-bottom: 10px;
    }
    .header .week-ending {
      font-size: 18px;
      color: #666;
      font-weight: 500;
    }
    .region-section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .region-header {
      background: #dc2626;
      color: white;
      padding: 12px 20px;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .project-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .project-card-header {
      padding: 15px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .project-card-header h3 {
      font-size: 18px;
      color: #333;
      margin: 0;
    }
    .region-badge {
      background: #3b82f6;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .project-card-body {
      padding: 15px;
    }
    .project-meta {
      font-size: 13px;
      color: #666;
      margin-bottom: 15px;
    }
    .project-meta div {
      margin-bottom: 5px;
    }
    .progress-section {
      margin-bottom: 15px;
    }
    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .progress-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s;
    }
    .financial-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    .financial-item {
      text-align: center;
    }
    .financial-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    .financial-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .variance {
      grid-column: 1 / -1;
      text-align: center;
      padding-top: 10px;
    }
    .variance-value {
      font-size: 16px;
      font-weight: 600;
    }
    .variance.positive {
      color: #dc2626;
    }
    .variance.negative {
      color: #16a34a;
    }
    .trade-workers {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }
    .trade-workers-label {
      color: #666;
    }
    .trade-workers-value {
      font-weight: 600;
      color: #333;
    }
    .report-count {
      font-size: 12px;
      color: #999;
      margin-top: 5px;
    }
    .no-reports {
      text-align: center;
      color: #999;
      padding: 20px;
      font-style: italic;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .container {
        box-shadow: none;
        padding: 20px;
      }
      .region-section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Project Summary</h1>
      <div class="week-ending">Week Ending: ${weekEndingStr}</div>
    </div>
`

  // Generate sections for each region
  Object.entries(projectsByRegion).forEach(([region, regionProjects]) => {
    html += `
    <div class="region-section">
      <div class="region-header">${REGION_NAMES[region] || region}</div>
      <div class="projects-grid">
`

    regionProjects.forEach(project => {
      const latestReport = project.reports[0]
      const variance = project.budgetVariance 
        ? (typeof project.budgetVariance === 'string' 
          ? parseFloat(project.budgetVariance) 
          : project.budgetVariance)
        : 0
      const varianceClass = variance <= 0 ? 'negative' : 'positive'
      const varianceSign = variance >= 0 ? '+' : ''

      html += `
        <div class="project-card">
          <div class="project-card-header">
            <h3>${project.name}</h3>
            <span class="region-badge">${REGION_NAMES[region] || region}</span>
          </div>
          <div class="project-card-body">
            <div class="project-meta">
              <div><strong>Project Code:</strong> ${project.code}</div>
              ${project.tenant ? `<div><strong>Tenant:</strong> ${project.tenant}</div>` : ''}
              ${project.startDate ? `<div><strong>Start Date:</strong> ${formatDate(project.startDate)}</div>` : ''}
              ${project.scheduledCompletion ? `<div><strong>Scheduled Completion:</strong> ${formatDate(project.scheduledCompletion)}</div>` : ''}
            </div>
            <div class="progress-section">
              <div class="progress-label">
                <span>Progress</span>
                <span>${formatPercent(project.percentComplete)}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(project.percentComplete, 100)}%"></div>
              </div>
            </div>
            <div class="financial-grid">
              <div class="financial-item">
                <div class="financial-label">Budget</div>
                <div class="financial-value">${formatCurrency(project.projectBudget)}</div>
              </div>
              <div class="financial-item">
                <div class="financial-label">EAC (Est. Cost)</div>
                <div class="financial-value">${formatCurrency(project.eac)}</div>
              </div>
              <div class="variance ${varianceClass}">
                <div class="financial-label">Variance</div>
                <div class="variance-value">${varianceSign}${formatCurrency(variance)}</div>
              </div>
            </div>
            <div class="trade-workers">
              <span class="trade-workers-label">Trade Workers</span>
              <span class="trade-workers-value">${latestReport?.totalTradeWorkers || 0}</span>
            </div>
            ${latestReport ? `<div class="report-count">Latest report: ${formatDate(latestReport.reportDate)}</div>` : '<div class="report-count">No reports yet</div>'}
          </div>
        </div>
`
    })

    html += `
      </div>
    </div>
`
  })

  html += `
  </div>
</body>
</html>`

  return html
}


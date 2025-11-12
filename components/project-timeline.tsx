'use client'

import { formatDate } from '@/lib/utils'
import { REGION_NAMES, REGION_COLORS } from '@/lib/constants'

interface Project {
  id: string
  code: string
  name: string
  region: string
  startDate: string | null
  scheduledCompletion: string | null
}

interface ProjectTimelineProps {
  projects: Project[]
  currentDate?: string // Optional: date to show status line (defaults to today)
}

export function ProjectTimeline({ projects, currentDate }: ProjectTimelineProps) {
  // Filter projects with valid dates
  const validProjects = projects.filter(
    p => p.startDate && p.scheduledCompletion
  )

  if (validProjects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No projects with valid dates to display on timeline.</p>
      </div>
    )
  }

  // Calculate timeline window
  const dates = validProjects.map(p => ({
    start: new Date(p.startDate!),
    end: new Date(p.scheduledCompletion!),
  }))

  const earliest = new Date(Math.min(...dates.map(d => d.start.getTime())))
  const latest = new Date(Math.max(...dates.map(d => d.end.getTime())))

  // Add buffer (183 days = ~6 months)
  const bufferDays = 183
  const adjStart = new Date(earliest)
  adjStart.setDate(adjStart.getDate() - bufferDays)
  const adjEnd = new Date(latest)
  adjEnd.setDate(adjEnd.getDate() + bufferDays)

  const totalDays = Math.ceil((adjEnd.getTime() - adjStart.getTime()) / (1000 * 60 * 60 * 24))

  // Layout constants - timeline matches full width of region title blocks
  const containerPx = 1000
  const labelWidthPx = 220
  const timelineWidthPx = containerPx // Timeline now spans full width to match region blocks

  // Status line date (current date or provided date)
  const statusDate = currentDate ? new Date(currentDate) : new Date()
  // Normalize status date to midnight for accurate comparison
  const statusDateNormalized = new Date(statusDate.getFullYear(), statusDate.getMonth(), statusDate.getDate())
  // Use Math.floor for consistency with bar calculations
  const statusDays = Math.floor((statusDateNormalized.getTime() - adjStart.getTime()) / (1000 * 60 * 60 * 24))
  const statusLeftPx = totalDays > 0 ? (statusDays / totalDays) * timelineWidthPx : 0
  const statusWithinRange = statusLeftPx >= 0 && statusLeftPx <= timelineWidthPx

  // Group projects by region
  const projectsByRegion: Record<string, Project[]> = {}
  validProjects.forEach(project => {
    const region = project.region
    if (!projectsByRegion[region]) {
      projectsByRegion[region] = []
    }
    projectsByRegion[region].push(project)
  })

  // Generate year markers for ruler
  const yearMarkers: Array<{ year: number; leftPx: number }> = []
  for (let year = adjStart.getFullYear(); year <= adjEnd.getFullYear(); year++) {
    const yearStart = new Date(year, 0, 1)
    if (yearStart >= adjStart && yearStart <= adjEnd) {
      const daysFromStart = Math.ceil((yearStart.getTime() - adjStart.getTime()) / (1000 * 60 * 60 * 24))
      const leftPx = totalDays > 0 ? (daysFromStart / totalDays) * timelineWidthPx : 0
      yearMarkers.push({ year, leftPx })
    }
  }

  // Region order (use the order from constants)
  const regionOrder = Object.keys(REGION_NAMES)

  return (
    <div className="mt-12 space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-900">
        Project Duration Timeline
      </h2>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-sm">
        <span className="font-semibold text-gray-700">Region Colors:</span>
        {regionOrder.map(region => {
          const color = REGION_COLORS[region] || '#888'
          if (!projectsByRegion[region] || projectsByRegion[region].length === 0) {
            return null
          }
          return (
            <span key={region} className="flex items-center gap-2">
              <span
                className="inline-block w-3.5 h-3.5 rounded"
                style={{ backgroundColor: color }}
              />
              <span>{REGION_NAMES[region] || region}</span>
            </span>
          )
        })}
      </div>

      {/* Timeline Container */}
      <div className="relative w-full max-w-full overflow-x-auto" style={{ paddingBottom: '40px' }}>
        <div className="relative" style={{ width: `${containerPx}px`, margin: '0 auto', minWidth: '100%' }}>
          {/* Ruler (aligned to match region title blocks - starts at left edge) */}
          <div
            className="relative border-b-2 border-blue-600 h-8"
            style={{ width: `${timelineWidthPx}px`, marginLeft: '0px' }}
          >
            {yearMarkers.map(({ year, leftPx }) => (
              <div
                key={year}
                className="absolute bg-white px-1 text-xs font-mono"
                style={{
                  left: `${leftPx}px`,
                  transform: 'translateX(-50%)',
                }}
              >
                {year}
              </div>
            ))}
          </div>

          {/* Status Line overlay (aligned to match region title blocks) */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: '0px', width: `${timelineWidthPx}px` }}
          >
            {statusWithinRange ? (
              <>
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-600"
                  style={{
                    left: `${statusLeftPx}px`, // Use unclamped to match clipping calculations
                    zIndex: 20,
                  }}
                  title={`Status line – ${formatDate(statusDateNormalized)}`}
                />
                <div
                  className="absolute text-xs text-red-600 font-semibold whitespace-nowrap"
                  style={{
                    left: `${statusLeftPx}px`, // Use unclamped to match clipping calculations
                    top: '-28px',
                    transform: 'translateX(-50%)',
                    zIndex: 21,
                  }}
                >
                  {formatDate(statusDateNormalized)}
                </div>
              </>
            ) : (
              <div
                className="absolute text-xs text-red-600 font-semibold whitespace-nowrap"
                style={{
                  left: statusLeftPx < 0 ? '-12px' : `${timelineWidthPx + 12}px`,
                  top: '-28px',
                  transform: statusLeftPx < 0 ? 'translateX(-100%)' : 'translateX(0)',
                  zIndex: 21,
                }}
              >
                {formatDate(statusDate)}
              </div>
            )}
          </div>

          {/* Project Bars by Region */}
          {regionOrder.map(region => {
            const regionProjects = projectsByRegion[region] || []
            if (regionProjects.length === 0) return null

            const color = REGION_COLORS[region] || '#4CAF50'

            return (
              <div key={region} className="mt-8" style={{ width: `${containerPx}px` }}>
                <div className="bg-gradient-to-r from-blue-600 via-blue-300 to-blue-100 text-white px-5 py-3 text-xl font-bold shadow-sm rounded-lg mb-4">
                  {REGION_NAMES[region] || region}
                </div>
                <div className="space-y-3" style={{ width: `${containerPx}px`, minWidth: '100%' }}>
                  {regionProjects.map(project => {
                    const startDate = new Date(project.startDate!)
                    const endDate = new Date(project.scheduledCompletion!)
                    
                    // Normalize ALL dates to midnight (00:00:00) for accurate comparison
                    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0)
                    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0)
                    const statusDateOnly = new Date(statusDateNormalized.getFullYear(), statusDateNormalized.getMonth(), statusDateNormalized.getDate(), 0, 0, 0, 0)
                    
                    // CRITICAL: Check if project ENDS on or before status date
                    // If end date <= status date, project is PAST and must be clipped
                    const isPast = endDateOnly.getTime() <= statusDateOnly.getTime()
                    
                    // Calculate days from timeline start - use Math.floor consistently
                    const startDays = Math.floor((startDateOnly.getTime() - adjStart.getTime()) / (1000 * 60 * 60 * 24))
                    const endDays = Math.floor((endDateOnly.getTime() - adjStart.getTime()) / (1000 * 60 * 60 * 24))
                    
                    // Calculate pixel positions - use EXACT same formula for all
                    const leftPx = totalDays > 0 ? (startDays / totalDays) * timelineWidthPx : 0
                    const endDatePx = totalDays > 0 ? (endDays / totalDays) * timelineWidthPx : 0
                    // CRITICAL: Use the EXACT SAME calculation as statusLeftPx (calculated outside loop)
                    // This ensures perfect alignment with the red line
                    const statusLinePx = statusLeftPx
                    
                    // Calculate display position
                    let displayLeft = Math.max(0, leftPx)
                    let displayWidth = 0
                    
                    // IF PAST: Force bar to end BEFORE status line - ABSOLUTE ENFORCEMENT
                    if (isPast) {
                      // For past projects, the width MUST be calculated to stop BEFORE the status line
                      // Use a generous buffer to ensure no visual overlap
                      const bufferPx = 60
                      
                      // Calculate the absolute maximum right edge - status line minus buffer
                      const absoluteMaxRight = Math.max(0, statusLinePx - bufferPx)
                      
                      // Width is simply: from displayLeft to absoluteMaxRight
                      // This is the ONLY calculation for past projects
                      displayWidth = Math.max(0, absoluteMaxRight - displayLeft)
                      
                      // CRITICAL: If endDatePx is beyond status line, we MUST clip it
                      // This check ensures that even if calculations are off, we clip
                      if (endDatePx >= statusLinePx) {
                        displayWidth = Math.max(0, absoluteMaxRight - displayLeft)
                      }
                      
                      // ABSOLUTE FINAL CHECK: The right edge CANNOT exceed absoluteMaxRight
                      const calculatedRightEdge = displayLeft + displayWidth
                      if (calculatedRightEdge > absoluteMaxRight) {
                        displayWidth = Math.max(0, absoluteMaxRight - displayLeft)
                      }
                      
                      // One more time - ensure width is never negative and never exceeds limit
                      displayWidth = Math.max(0, Math.min(displayWidth, absoluteMaxRight - displayLeft))
                    } else {
                      // IF FUTURE/ACTIVE: Normal width calculation
                      displayWidth = Math.max(0, endDatePx - displayLeft)
                      if (displayLeft + displayWidth > timelineWidthPx) {
                        displayWidth = Math.max(0, timelineWidthPx - displayLeft)
                      }
                    }
                    
                    // Handle negative left edge
                    if (leftPx < 0) {
                      displayLeft = 0
                      if (isPast) {
                        // For past projects, recalculate width with new left position
                        const bufferPx = 60 // Match the buffer used above
                        const maxAllowedRightPx = Math.max(0, statusLinePx - bufferPx)
                        displayWidth = Math.max(0, maxAllowedRightPx - displayLeft)
                      } else {
                        displayWidth = Math.max(0, displayWidth + leftPx)
                      }
                    }

                    const startLabel = formatDate(startDate)
                    const endLabel = formatDate(endDate)
                    const label = `${startLabel} → ${endLabel}`

                    return (
                      <div
                        key={project.id}
                        className="text-sm relative"
                        style={{
                          width: `${containerPx}px`,
                          height: '32px',
                        }}
                      >
                        {/* Project name positioned on the left, overlapping timeline area */}
                        <span 
                          className="absolute left-0 top-0 font-medium text-gray-700 truncate z-10 bg-white/80 px-1" 
                          style={{ width: `${labelWidthPx}px`, maxWidth: `${labelWidthPx}px` }}
                          title={project.name}
                        >
                          {project.name}
                        </span>
                        {/* Timeline bar area - starts at left edge to match region blocks, full width */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '0px',
                            top: '4px',
                            width: `${timelineWidthPx}px`,
                            height: '24px',
                            // For past projects, create a hard cutoff at the status line
                            ...(isPast ? {
                              clipPath: `inset(0 ${Math.max(0, timelineWidthPx - Math.max(0, statusLinePx - 60))}px 0 0)`,
                              overflow: 'hidden',
                            } : {})
                          }}
                        >
                          <div 
                            className="relative h-6" 
                            style={{ 
                              zIndex: 1,
                              width: '100%',
                              // Additional clipping layer
                              ...(isPast ? {
                                overflow: 'hidden',
                                maxWidth: `${Math.max(0, statusLinePx - 60)}px`,
                              } : {})
                            }}
                          >
                            <div
                              className="absolute h-5 rounded"
                              style={{
                                left: `${displayLeft}px`,
                                width: `${displayWidth}px`,
                                backgroundColor: color,
                                opacity: isPast ? 0.6 : 1,
                                // ABSOLUTE constraints for past projects - multiple layers
                                ...(isPast ? {
                                  // Force width to never exceed status line minus buffer
                                  maxWidth: `${Math.max(0, statusLinePx - 60 - displayLeft)}px`,
                                  // Override width if it would exceed
                                  width: `${Math.min(displayWidth, Math.max(0, statusLinePx - 60 - displayLeft))}px`,
                                  // Additional clip on element
                                  clipPath: `inset(0 ${Math.max(0, (displayLeft + displayWidth) - (statusLinePx - 60))}px 0 0)`,
                                } : {})
                              }}
                              title={`Start: ${startLabel} | End: ${endLabel} | Status: ${formatDate(statusDateOnly)} | Past: ${isPast} | EndPx: ${endDatePx.toFixed(1)} | StatusPx: ${statusLinePx.toFixed(1)} | Width: ${displayWidth.toFixed(1)}`}
                            />
                            <div
                              className="absolute whitespace-nowrap pl-2 text-xs text-gray-600"
                              style={{
                                left: `${Math.min(leftPx + displayWidth + 6, timelineWidthPx - 80)}px`,
                                top: '0',
                              }}
                            >
                              {label}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                })}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}


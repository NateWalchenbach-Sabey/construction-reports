export const REGIONS = [
  'ASHBURN',
  'SEATTLE',
  'AUSTIN',
  'COLUMBIA',
  'QUINCY',
  'MANHATTAN',
  'UMATILLA',
  'BUTTE',
  'NON_SDC',
] as const

export const REGION_NAMES: Record<string, string> = {
  ASHBURN: 'SDC Ashburn',
  SEATTLE: 'SDC Seattle',
  AUSTIN: 'SDC Austin',
  COLUMBIA: 'SDC Columbia',
  QUINCY: 'SDC Quincy',
  MANHATTAN: 'SDC Manhattan',
  UMATILLA: 'SDC Umatilla',
  BUTTE: 'SDC Butte',
  NON_SDC: 'Non SDC Projects',
}

// Region colors for timeline/Gantt chart (matching Python script)
export const REGION_COLORS: Record<string, string> = {
  ASHBURN: '#0074D9',
  SEATTLE: '#FF851B',
  AUSTIN: '#2ECC40',
  COLUMBIA: '#B10DC9',
  QUINCY: '#39CCCC',
  MANHATTAN: '#FF4136',
  UMATILLA: '#8D5524',
  BUTTE: '#AAAAAA',
  NON_SDC: '#333333',
}

export const REPORT_TYPES = ['WEEKLY'] as const

export const SAFETY_TYPES = [
  'NONE_TO_REPORT',
  'TOOL_BOX_TALK_PPE',
  'INCIDENT',
  'NEAR_MISS',
  'AUDIT',
] as const

export const SAFETY_TYPE_LABELS: Record<string, string> = {
  NONE_TO_REPORT: 'None to report',
  TOOL_BOX_TALK_PPE: 'Tool Box Talk – PPE',
  INCIDENT: 'Incident',
  NEAR_MISS: 'Near Miss',
  AUDIT: 'Audit',
}

export const CUSTOM_FIELD_TYPES = [
  'TEXT',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'CHECKBOX',
] as const

export const ROLES = ['SUPERINTENDENT', 'PM', 'EXECUTIVE', 'ADMIN'] as const

export const ROLE_LABELS: Record<string, string> = {
  SUPERINTENDENT: 'Superintendent',
  PM: 'Project Manager',
  EXECUTIVE: 'Executive',
  ADMIN: 'Administrator',
}

// Excel import header synonyms
export const HEADER_SYNONYMS: Record<string, string[]> = {
  // Project fields
  start_date: ['Start Date', 'Start', 'Project Start', 'Start Date'],
  scheduled_completion: ['Scheduled Completion', 'Completion', 'Scheduled End', 'End Date'],
  tenant: ['Tenant', 'Client', 'Customer'],
  project_budget: ['Project Budget', 'Budget', 'Total Budget', 'Budget Amount'],
  eac: ['Est. Cost at Completion', 'EAC', 'Estimated Cost at Completion', 'Final Cost'],
  budget_variance: ['Budget Variance', 'Variance', 'Budget Diff', 'Variance Amount'],
  percent_complete: ['% Complete', 'Percent Complete', 'Progress', '% Progress', 'Completion %'],
  
  // Report fields
  work_performed: ['Work Performed', 'Work Done', 'Work Completed', 'Activities', 'Narrative'],
  safety: ['Safety', 'Safety Notes', 'Safety Report', 'Safety Issues'],
  
  // Subcontractor fields
  subcontractor: ['Company', 'Subcontractor', 'Contractor', 'Sub', 'Company Name'],
  craft: ['Craft', 'Trade', 'Discipline', 'Work Type'],
  trade_workers: ['Trade Workers', 'Workers', 'Headcount', 'Manpower', 'Workers Count'],
  total_trade_workers: ['Total Trade Workers', 'Total Workers', 'Total Headcount'],
}


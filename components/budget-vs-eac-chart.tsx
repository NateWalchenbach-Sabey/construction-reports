'use client'

import { formatCurrency } from '@/lib/utils'
import { REGION_NAMES, REGION_COLORS } from '@/lib/constants'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'

interface Project {
  region: string
  projectBudget: number | string
  eac: number | string
}

interface BudgetVsEacChartProps {
  projects: Project[]
}

export function BudgetVsEacChart({ projects }: BudgetVsEacChartProps) {
  // Aggregate budget and EAC by region
  const regionData: Record<string, { budget: number; eac: number }> = {}

  projects.forEach(project => {
    const region = project.region
    if (!regionData[region]) {
      regionData[region] = { budget: 0, eac: 0 }
    }

    const budget = typeof project.projectBudget === 'string' 
      ? parseFloat(project.projectBudget.replace(/[$,]/g, '')) || 0
      : project.projectBudget || 0
    
    const eac = typeof project.eac === 'string'
      ? parseFloat(project.eac.replace(/[$,]/g, '')) || 0
      : project.eac || 0

    regionData[region].budget += budget
    regionData[region].eac += eac
  })

  // Convert to chart data format
  const chartData = Object.keys(REGION_NAMES)
    .filter(region => regionData[region] && (regionData[region].budget > 0 || regionData[region].eac > 0))
    .map(region => ({
      region: REGION_NAMES[region] || region,
      regionKey: region,
      budget: regionData[region].budget,
      eac: regionData[region].eac,
      budgetColor: REGION_COLORS[region] || '#888',
    }))

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No budget data available to display.</p>
      </div>
    )
  }

  // Custom label formatter with currency
  const formatLabel = (value: number) => {
    if (value === 0) return ''
    return formatCurrency(value)
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-800 via-gray-600 to-gray-400 text-white px-6 py-4 text-2xl font-bold shadow-lg rounded-lg text-center">
        Budget vs. Est. Cost at Completion by Region
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <ResponsiveContainer width="100%" height={550}>
          <BarChart
            data={chartData}
            margin={{ top: 80, right: 30, left: 80, bottom: 80 }}
            barGap={8}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="region"
              angle={-20}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 14, fontWeight: 'bold', fill: '#374151' }}
            />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              tick={{ fontSize: 14, fontWeight: 'bold', fill: '#374151' }}
              label={{ 
                value: 'Dollars', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 16, fontWeight: 'bold', fill: '#374151' }
              }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
              formatter={(value) => <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{value}</span>}
            />
            
            {/* Budget bars (colored by region) */}
            <Bar dataKey="budget" name="Budget" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`budget-${index}`} fill={entry.budgetColor} stroke="#222" strokeWidth={1} opacity={0.92} />
              ))}
              <LabelList
                dataKey="budget"
                position="top"
                offset={5}
                formatter={formatLabel}
                style={{ fontSize: '12px', fontWeight: 'bold', fill: '#111' }}
              />
            </Bar>
            
            {/* EAC bars (gray) */}
            <Bar dataKey="eac" name="Est. Cost at Completion" fill="#aaaaaa" stroke="#222" strokeWidth={1} opacity={0.8} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="eac"
                position="top"
                offset={22}
                formatter={formatLabel}
                style={{ fontSize: '12px', fontWeight: 'bold', fill: '#444' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Region color legend */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm border-t pt-6">
          <span className="font-semibold text-gray-700">Region Colors:</span>
          {chartData.map(({ region, regionKey, budgetColor }) => (
            <span key={regionKey} className="flex items-center gap-2">
              <span
                className="inline-block w-4 h-4 rounded"
                style={{ backgroundColor: budgetColor, border: '1px solid #222' }}
              />
              <span className="text-gray-700">{region}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface FridayDatePickerProps {
  value: string
  onChange: (date: string) => void
  label?: string
}

export function FridayDatePicker({ value, onChange, label }: FridayDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Initialize current month from value
  useEffect(() => {
    if (value) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setCurrentMonth(new Date(value))
      }, 0)
    }
  }, [value])

  const getWeekdaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const weekdays: { date: Date; dayOfWeek: number }[] = []
    
    // Start from the first day of the month
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Iterate through all days in the month
    const currentDate = new Date(firstDay)
    while (currentDate <= lastDay) {
      const dayOfWeek = currentDate.getDay()
      // Only include Monday (1) through Friday (5), exclude Saturday (6) and Sunday (0)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdays.push({ date: new Date(currentDate), dayOfWeek })
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return weekdays
  }

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    onChange(dateStr)
    setIsOpen(false)
  }

  const handlePreviousMonth = () => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() - 1)
    setCurrentMonth(newMonth)
  }

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() + 1)
    setCurrentMonth(newMonth)
  }

  const handleToday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    
    // Calculate last Friday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    
    // Go back one week to get last week's Monday
    const lastWeekMonday = new Date(monday)
    lastWeekMonday.setDate(monday.getDate() - 7)
    
    // Friday is 4 days after Monday
    const friday = new Date(lastWeekMonday)
    friday.setDate(lastWeekMonday.getDate() + 4)
    
    handleDateSelect(friday)
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
  }

  const weekdays = getWeekdaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const selectedDate = value ? new Date(value) : null

  // Group weekdays by week for proper grid layout
  const weeks: { date: Date; dayOfWeek: number }[][] = []
  let currentWeek: { date: Date; dayOfWeek: number }[] = []
  
  weekdays.forEach((day) => {
    // Start a new week on Monday (dayOfWeek === 1)
    if (day.dayOfWeek === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
  })
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  return (
    <div className="relative" ref={pickerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center gap-2 bg-white"
      >
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="flex-1">
          {value ? formatDate(new Date(value)) : 'Select week ending date (Friday)'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 min-w-[320px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePreviousMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-gray-900">{monthName}</h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday headers (Monday-Friday only, no Saturday/Sunday) */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Weekday dates (Monday-Friday only) */}
          <div className="space-y-1">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-5 gap-1">
                {week.map((day, dayIdx) => {
                  const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString()
                  const isToday = day.date.toDateString() === new Date().toDateString()
                  const isFriday = day.dayOfWeek === 5
                  
                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      onClick={() => handleDateSelect(day.date)}
                      className={`
                        py-2 px-3 text-sm rounded
                        ${isSelected 
                          ? 'bg-blue-600 text-white font-semibold' 
                          : isToday
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : isFriday
                          ? 'text-blue-600 hover:bg-blue-50 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      {day.date.getDate()}
                    </button>
                  )
                })}
                {/* Fill empty cells if week doesn't have 5 days */}
                {Array.from({ length: 5 - week.length }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="py-2 px-3" />
                ))}
              </div>
            ))}
          </div>

          {/* Footer buttons */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleToday}
              className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


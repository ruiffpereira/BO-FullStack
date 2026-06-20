import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import './DateRangePicker.css'
import { pt } from 'date-fns/locale'

export type { DateRange }

/**
 * Selector de intervalo de datas (react-day-picker, modo range, locale PT),
 * estilizado para condizer com a app (accent + dark mode) via DateRangePicker.css.
 */
export function DateRangePicker({
  value,
  onChange,
  className = '',
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  className?: string
}) {
  return (
    <div
      className={`inline-block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 ${className}`}
    >
      <DayPicker
        className="app-rdp"
        mode="range"
        selected={value}
        onSelect={onChange}
        locale={pt}
        weekStartsOn={1}
      />
    </div>
  )
}

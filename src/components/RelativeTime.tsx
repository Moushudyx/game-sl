import { useEffect, useMemo, useState } from 'react'

type Mode = 'relative' | 'absolute'

type Props = {
  value?: number
  className?: string
  mode?: Mode
}

function formatAbsolute(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatRelative(now: number, ts: number) {
  const diff = Math.max(0, now - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 30) return '刚刚'
  if (sec < 60) return `${sec} 秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 天前`
  // 7 天以上显示绝对时间
  return formatAbsolute(ts)
}
/** 时间展示采用相对时间，悬停可看绝对时间 */
export default function RelativeTime({ value, className, mode = 'relative' }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const text = useMemo(() => {
    if (!value) return '暂无备份'
    if (mode === 'absolute') return formatAbsolute(value)
    return formatRelative(now, value)
  }, [mode, now, value])

  const title = useMemo(() => (value ? formatAbsolute(value) : ''), [value])

  return (
    <span className={className} title={title}>
      {text}
    </span>
  )
}

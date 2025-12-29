import { useEffect, useState } from 'react'

export function useAppVersion() {
  const [backendVersion, setBackendVersion] = useState<string | undefined>(undefined)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('@tauri-apps/api/app')
        if (mod && typeof mod.getVersion === 'function') {
          const v = await mod.getVersion()
          if (mounted) setBackendVersion(v)
        }
      } catch (_) {
        // 调用失败时不影响前端运行
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return { backendVersion }
}

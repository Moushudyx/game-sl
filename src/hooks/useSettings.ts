import { useCallback, useEffect, useState } from 'react'
import { AppConfig } from '../types'
import { setSetting, loadConfig } from '../services/tauri'

/** 返回值类型：设置相关状态与动作 */
export interface UseSettingsReturn {
  loading: boolean
  config: AppConfig | null
  /** 是否使用相对时间（例如“3 分钟前”） */
  useRelativeTime: boolean
  /** 复原前是否额外备份现有存档 */
  restoreExtraBackup: boolean
  /** 更新相对时间偏好并保存配置 */
  updateUseRelativeTime: (checked: boolean) => Promise<void>
  /** 更新复原前额外备份偏好并保存配置 */
  updateRestoreExtraBackup: (checked: boolean) => Promise<void>
}

/**
 * 使用设置 Hook：从配置中读取/更新用户偏好，并提供保存配置操作
 * @param onError 错误提示与上报回调
 */
export function useSettings(onError?: (msg: string, err?: unknown) => void): UseSettingsReturn {
  const [useRelativeTime, setUseRelativeTime] = useState(true)
  const [restoreExtraBackup, setRestoreExtraBackup] = useState(true)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cfg = await loadConfig()
        if (!mounted) return
        setConfig(cfg)
        const pref = (cfg.settings as any)?.useRelativeTime
        setUseRelativeTime(typeof pref === 'boolean' ? pref : true)
        const restorePref = (cfg.settings as any)?.restoreExtraBackup
        setRestoreExtraBackup(typeof restorePref === 'boolean' ? restorePref : true)
      } catch (err) {
        onError?.('加载配置失败', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [onError])

  const updateUseRelativeTime = useCallback(
    async (checked: boolean) => {
      try {
        const cfg = await setSetting('useRelativeTime', checked)
        setConfig(cfg)
        setUseRelativeTime(checked)
      } catch (err) {
        onError?.('保存时间偏好失败', err)
      }
    },
    [onError]
  )

  const updateRestoreExtraBackup = useCallback(
    async (checked: boolean) => {
      try {
        const cfg = await setSetting('restoreExtraBackup', checked)
        setConfig(cfg)
        setRestoreExtraBackup(checked)
      } catch (err) {
        onError?.('保存复原安全设置失败', err)
      }
    },
    [onError]
  )

  return {
    loading,
    config,
    useRelativeTime,
    restoreExtraBackup,
    updateUseRelativeTime,
    updateRestoreExtraBackup,
  }
}

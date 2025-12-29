import { useCallback, useMemo, useState } from 'react'
import { AppConfig, GameEntry, PathState } from '../types'
import {
  loadConfig,
  getUserFolder,
  getSteamInstallDir,
  getSteamUIDList,
  checkSavePath,
  reorderGames,
} from '../services/tauri'
import { resolveTemplateForDisplay } from '../utils/path'

/**
 * useAppState
 * 集中管理应用基础状态（配置、路径解析、排序等）
 * 提供与后端交互的便捷方法，减少上层组件样板代码。
 */

/** 选项：用于注入统一错误处理回调 */
export interface UseAppStateOptions {
  /** 错误提示与上报 */
  onError?: (msg: string, err?: unknown) => void
}

/** 返回值类型：便于 IDE 自动补全 */
export interface UseAppStateReturn {
  // state
  loading: boolean
  checkingPaths: boolean
  config: AppConfig | null
  setConfig: (cfg: AppConfig) => void
  userFolder: string
  steamDir: string | null
  steamUIDs: string[]
  selectedSteamUID: string | undefined
  setSelectedSteamUID: (uid?: string) => void
  pathState: Record<string, PathState>
  hasSteam: boolean
  // helpers
  /** 将路径模板解析为可展示的绝对/相对路径字符串 */
  resolveTemplate: (template: string) => string
  /** 刷新基础信息（配置、用户目录、Steam 安装目录与 UID 列表） */
  refreshBaseInfo: () => Promise<void>
  /** 扫描并更新各游戏的存档路径存在性与解析结果 */
  refreshPathState: () => Promise<void>
  /** 上移指定游戏的排序位置并持久化 */
  moveGameUp: (game: GameEntry) => Promise<void>
  /** 下移指定游戏的排序位置并持久化 */
  moveGameDown: (game: GameEntry) => Promise<void>
  /** 将指定游戏置顶并持久化 */
  pinGameTop: (game: GameEntry) => Promise<void>
}

// 集中管理与后端交互的基础状态，减少 App 组件样板与耦合
export function useAppState(options?: UseAppStateOptions): UseAppStateReturn {
  const { onError } = options || {}

  const [loading, setLoading] = useState(true)
  const [checkingPaths, setCheckingPaths] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [userFolder, setUserFolder] = useState('')
  const [steamDir, setSteamDir] = useState<string | null>(null)
  const [steamUIDs, setSteamUIDs] = useState<string[]>([])
  const [selectedSteamUID, setSelectedSteamUID] = useState<string | undefined>(undefined)
  const [pathState, setPathState] = useState<Record<string, PathState>>({})


  const hasSteam = useMemo(() => Boolean(steamDir), [steamDir])

  const resolveTemplate = useCallback(
    (template: string) =>
      resolveTemplateForDisplay(template, {
        userFolder,
        steamDir,
        steamUID: selectedSteamUID,
      }),
    [selectedSteamUID, steamDir, userFolder]
  )

  const refreshBaseInfo = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, userPath, steamPath, uidList] = await Promise.all([
        loadConfig(),
        getUserFolder(),
        getSteamInstallDir(),
        getSteamUIDList(),
      ])

      setConfig(cfg)
      setUserFolder(userPath)
      setSteamDir(steamPath)
      setSteamUIDs(uidList)

      if (!selectedSteamUID && uidList.length > 0) {
        setSelectedSteamUID(uidList[0])
      }
    } catch (err) {
      console.error(err)
      onError?.('加载基础信息失败，请稍后重试', err)
    } finally {
      setLoading(false)
    }
  }, [onError, selectedSteamUID])

  const refreshPathState = useCallback(async () => {
    if (!config) return
    if (checkingPaths) return
    setCheckingPaths(true)
    try {
      const resultPairs = await Promise.all(
        config.games.map(async (game) => {
          let exists = false
          try {
            exists = await checkSavePath(game.path, selectedSteamUID ?? null)
          } catch (err) {
            console.error(err)
          }
          return [game.name, { exists, resolved: resolveTemplate(game.path) } as PathState]
        })
      )
      setPathState(Object.fromEntries(resultPairs))
    } finally {
      setCheckingPaths(false)
    }
  }, [config, resolveTemplate, selectedSteamUID, checkingPaths])

  const applyOrder = useCallback(
    async (names: string[]) => {
      try {
        const cfg = await reorderGames(names)
        setConfig(cfg)
      } catch (err) {
        console.error(err)
        onError?.('保存排序失败', err)
      }
    },
    [onError]
  )

  const moveGameUp = useCallback(
    async (game: GameEntry) => {
      if (!config) return
      const names = config.games.map((g) => g.name)
      const idx = names.indexOf(game.name)
      if (idx <= 0) return
      ;[names[idx - 1], names[idx]] = [names[idx], names[idx - 1]]
      await applyOrder(names)
    },
    [applyOrder, config]
  )

  const moveGameDown = useCallback(
    async (game: GameEntry) => {
      if (!config) return
      const names = config.games.map((g) => g.name)
      const idx = names.indexOf(game.name)
      if (idx < 0 || idx >= names.length - 1) return
      ;[names[idx], names[idx + 1]] = [names[idx + 1], names[idx]]
      await applyOrder(names)
    },
    [applyOrder, config]
  )

  const pinGameTop = useCallback(
    async (game: GameEntry) => {
      if (!config) return
      const names = config.games.map((g) => g.name)
      const idx = names.indexOf(game.name)
      if (idx <= 0) return
      names.splice(idx, 1)
      names.unshift(game.name)
      await applyOrder(names)
    },
    [applyOrder, config]
  )

  return {
    // state
    loading,
    checkingPaths,
    config,
    setConfig,
    userFolder,
    steamDir,
    steamUIDs,
    selectedSteamUID,
    setSelectedSteamUID,
    pathState,
    hasSteam,
    // helpers
    resolveTemplate,
    refreshBaseInfo,
    refreshPathState,
    moveGameUp,
    moveGameDown,
    pinGameTop,
  }
}

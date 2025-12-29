import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  App as AntApp,
  Button,
  Divider,
  Flex,
  Layout,
  Select,
  Space,
  Typography,
  message,
  Segmented,
  Modal,
} from 'antd'
import { openPath } from '@tauri-apps/plugin-opener'
import { GameCard } from './components/GameCard'
import BackupModal from './components/BackupModal'
import BackupListModal from './components/BackupListModal'
import EditRemarkModal from './components/EditRemarkModal'
import RestoreOverlay, { RestoreStepState, RestoreStepKey } from './components/RestoreOverlay'
import { AppConfig, BackupEntry, BackupResponse, GameEntry, PathState, RestoreResponse } from './types'
import './App.scss'
import MainPage from './pages/MainPage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'

const { Title, Text } = Typography

function App() {
  const [messageApi, contextHolder] = message.useMessage()
  const [loading, setLoading] = useState(true)
  const [checkingPaths, setCheckingPaths] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [userFolder, setUserFolder] = useState('')
  const [steamDir, setSteamDir] = useState<string | null>(null)
  const [steamUIDs, setSteamUIDs] = useState<string[]>([])
  const [selectedSteamUID, setSelectedSteamUID] = useState<string | undefined>(undefined)
  const [pathState, setPathState] = useState<Record<string, PathState>>({})
  const [backupModalOpen, setBackupModalOpen] = useState(false)
  const [backupTarget, setBackupTarget] = useState<GameEntry | null>(null)
  const [backupListOpen, setBackupListOpen] = useState(false)
  const [backupListLoading, setBackupListLoading] = useState(false)
  const [backupList, setBackupList] = useState<BackupEntry[]>([])
  const [backupListTarget, setBackupListTarget] = useState<GameEntry | null>(null)
  const [editRemarkOpen, setEditRemarkOpen] = useState(false)
  const [editRemarkTarget, setEditRemarkTarget] = useState<BackupEntry | null>(null)
  const [useRelativeTime, setUseRelativeTime] = useState(true)
  const [restoreExtraBackup, setRestoreExtraBackup] = useState(true)
  const [activePage, setActivePage] = useState<'main' | 'settings' | 'about'>('main')
  const [backendVersion, setBackendVersion] = useState<string | undefined>(undefined)
  const [restoreState, setRestoreState] = useState<{
    open: boolean
    steps: RestoreStepState[]
    result: 'success' | 'error' | null
    note: string
    detail?: string
    gameName?: string
    backupName?: string
  }>({
    open: false,
    steps: [],
    result: null,
    note: '',
  })

  const restoreStepOrder: RestoreStepKey[] = ['check', 'extra', 'delete', 'extract', 'update']

  const buildInitialRestoreSteps = (): RestoreStepState[] => [
    { key: 'check', title: '校验路径与备份文件', status: 'wait' },
    { key: 'extra', title: '复原前额外备份', status: 'wait' },
    { key: 'delete', title: '删除现有存档', status: 'wait' },
    { key: 'extract', title: '解压所选备份', status: 'wait' },
    { key: 'update', title: '更新记录', status: 'wait' },
  ]

  const mapStageCode = (code: string): RestoreStepKey | null => {
    switch (code.toUpperCase()) {
      case 'CHECK':
        return 'check'
      case 'EXTRA_BACKUP':
        return 'extra'
      case 'DELETE':
        return 'delete'
      case 'EXTRACT':
        return 'extract'
      case 'UPDATE_CONFIG':
        return 'update'
      default:
        return null
    }
  }

  const parseRestoreError = (text: string): { stage: RestoreStepKey | null; detail: string } => {
    const raw = text?.toString?.() ?? '复原失败'
    const msg = raw.replace(/^Error:\s*/, '')
    const matched = msg.match(/^\[(.+?)\]\s*(.*)$/)
    if (!matched) return { stage: null, detail: msg }
    const stage = mapStageCode(matched[1])
    const detail = matched[2] && matched[2].length > 0 ? matched[2] : msg
    return { stage, detail }
  }

  const openRestoreOverlay = (gameName: string, backupName: string) => {
    const steps = buildInitialRestoreSteps()
    if (steps[0]) steps[0].status = 'process'
    setRestoreState({
      open: true,
      steps,
      result: null,
      note: '正在复原，请不要关闭窗口或重复操作…',
      gameName,
      backupName,
    })
  }

  const markRestoreSuccess = () => {
    setRestoreState((prev) => ({
      ...prev,
      result: 'success',
      note: '复原完成，可关闭窗口',
      steps: buildInitialRestoreSteps().map((s) => ({ ...s, status: 'finish' as const })),
    }))
  }

  const markRestoreFailure = (stage: RestoreStepKey | null, detail: string) => {
    const idx = stage ? restoreStepOrder.indexOf(stage) : -1
    const steps = buildInitialRestoreSteps().map((s, i) => {
      if (idx >= 0) {
        if (i < idx) return { ...s, status: 'finish' as const }
        if (i === idx) return { ...s, status: 'error' as const }
      }
      return s
    })

    setRestoreState((prev) => ({
      ...prev,
      result: 'error',
      detail,
      steps,
      note: '复原失败，请查看提示',
    }))
  }

  const closeRestoreOverlay = () => {
    if (!restoreState.result) return
    setRestoreState({
      open: false,
      steps: buildInitialRestoreSteps(),
      result: null,
      note: '',
      detail: '',
      gameName: '',
      backupName: '',
    })
  }

  const hasSteam = useMemo(() => Boolean(steamDir), [steamDir])

  const resolveTemplate = (template: string) => {
    let result = template
    if (userFolder) {
      result = result.replaceAll('{AppData}', `${userFolder}\\AppData`)
      result = result.replaceAll('{UserFolder}', userFolder)
      result = result.replaceAll('{Home}', userFolder)
    }
    if (steamDir) result = result.replaceAll('{Steam}', steamDir)
    if (selectedSteamUID) result = result.replaceAll('{SteamUID}', selectedSteamUID)
    return result
  }

  const refreshBaseInfo = async () => {
    setLoading(true)
    try {
      const [cfg, userPath, steamPath, uidList] = await Promise.all([
        invoke<AppConfig>('load_config'),
        invoke<string>('get_user_folder'),
        invoke<string | null>('get_steam_install_dir'),
        invoke<string[]>('get_steam_uid_list'),
      ])

      setConfig(cfg)
      setUserFolder(userPath)
      setSteamDir(steamPath)
      setSteamUIDs(uidList)
      const pref = (cfg.settings as any)?.useRelativeTime
      if (typeof pref === 'boolean') {
        setUseRelativeTime(pref)
      } else {
        setUseRelativeTime(true)
      }
      const restorePref = (cfg.settings as any)?.restoreExtraBackup
      if (typeof restorePref === 'boolean') {
        setRestoreExtraBackup(restorePref)
      } else {
        setRestoreExtraBackup(true)
      }
      if (!selectedSteamUID && uidList.length > 0) {
        setSelectedSteamUID(uidList[0])
      }
    } catch (err) {
      console.error(err)
      messageApi.error('加载基础信息失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const refreshPathState = async () => {
    if (!config) return
    setCheckingPaths(true)
    try {
      const resultPairs = await Promise.all(
        config.games.map(async (game) => {
          let exists = false
          try {
            // console.log('game.path', game.path)
            // console.log('selectedSteamUID', selectedSteamUID)
            // const resolvedPath = await invoke<boolean>('resolve_template_path', {
            //   template: game.path,
            //   steamUid: selectedSteamUID ?? null,
            // })
            // console.log('resolvedPath', resolvedPath)
            exists = await invoke<boolean>('check_save_path', {
              path: game.path,
              steamUid: selectedSteamUID ?? null,
            })
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
  }

  useEffect(() => {
    refreshBaseInfo()
  }, [])

  useEffect(() => {
    // 获取后端版本
    ;(async () => {
      try {
        const mod = await import('@tauri-apps/api/app')
        if (mod && typeof mod.getVersion === 'function') {
          const v = await mod.getVersion()
          setBackendVersion(v)
        }
      } catch (_) {
        // 调用失败时不影响前端运行
      }
    })()
  }, [])

  useEffect(() => {
    if (config) {
      refreshPathState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, selectedSteamUID, steamDir, userFolder])

  const openBackupModal = (game: GameEntry) => {
    setBackupTarget(game)
    setBackupModalOpen(true)
  }

  const submitBackup = async (remark: string) => {
    if (!backupTarget) return
    const payloadRemark = remark.trim()
    const result = await invoke<BackupResponse>('backup_game', {
      gameName: backupTarget.name,
      pathTemplate: backupTarget.path,
      steamUid: selectedSteamUID ?? null,
      remark: payloadRemark.length > 0 ? payloadRemark : null,
    })
    setConfig(result.config)
    messageApi.success('备份完成')
    setBackupModalOpen(false)
  }

  const openBackupList = async (game: GameEntry) => {
    setBackupListTarget(game)
    setBackupList([])
    setBackupListOpen(true)
    setBackupListLoading(true)
    try {
      const list = await invoke<BackupEntry[]>('list_backups', { gameName: game.name })
      setBackupList(list)
    } catch (err) {
      console.error(err)
      messageApi.error('读取备份列表失败，请稍后重试')
    } finally {
      setBackupListLoading(false)
    }
  }

  const openEditRemark = (item: BackupEntry) => {
    setEditRemarkTarget(item)
    setEditRemarkOpen(true)
  }

  const submitEditRemark = async (newRemark: string) => {
    if (!backupListTarget || !editRemarkTarget) return
    await invoke('update_backup_remark', {
      gameName: backupListTarget.name,
      fileName: editRemarkTarget.fileName,
      remark: newRemark,
    })
    messageApi.success('备注已保存')
    setBackupList((prev) =>
      prev.map((b) => (b.fileName === editRemarkTarget.fileName ? { ...b, remark: newRemark } : b))
    )
    setEditRemarkOpen(false)
  }

  const performRestore = async (item: BackupEntry) => {
    if (!backupListTarget) return

    openRestoreOverlay(backupListTarget.name, item.fileName)

    try {
      const res = await invoke<RestoreResponse>('restore_backup', {
        gameName: backupListTarget.name,
        pathTemplate: backupListTarget.path,
        backupPath: item.filePath,
        steamUid: selectedSteamUID ?? null,
      })

      setConfig(res.config)
      markRestoreSuccess()
      messageApi.success('复原完成')
      refreshPathState()
    } catch (err: any) {
      const raw = err?.toString?.() ?? '复原失败'
      const { stage, detail } = parseRestoreError(raw)
      markRestoreFailure(stage, detail)
      messageApi.error(detail || '复原失败，请检查提示')
    }
  }

  const handleRestore = (item: BackupEntry) => {
    if (!backupListTarget) return

    Modal.confirm({
      title: `确认复原 ${backupListTarget.name} ？`,
      content: '复原会删除当前存档并解压所选备份，建议确保备份可靠。',
      okText: '开始复原',
      okButtonProps: { danger: true },
      cancelText: '取消',
      centered: true,
      onOk: () => {
        performRestore(item)
      },
    })
  }

  // 重新排序 名称顺序传给后端然后刷新配置
  const applyOrder = async (names: string[]) => {
    try {
      const cfg = await invoke<AppConfig>('reorder_games', { order: names })
      setConfig(cfg)
    } catch (err) {
      console.error(err)
      messageApi.error('保存排序失败')
    }
  }

  const moveGameUp = async (game: GameEntry) => {
    if (!config) return
    const names = config.games.map((g) => g.name)
    const idx = names.indexOf(game.name)
    if (idx <= 0) return
    ;[names[idx - 1], names[idx]] = [names[idx], names[idx - 1]]
    await applyOrder(names)
  }

  const moveGameDown = async (game: GameEntry) => {
    if (!config) return
    const names = config.games.map((g) => g.name)
    const idx = names.indexOf(game.name)
    if (idx < 0 || idx >= names.length - 1) return
    ;[names[idx], names[idx + 1]] = [names[idx + 1], names[idx]]
    await applyOrder(names)
  }

  const pinGameTop = async (game: GameEntry) => {
    if (!config) return
    const names = config.games.map((g) => g.name)
    const idx = names.indexOf(game.name)
    if (idx <= 0) return
    names.splice(idx, 1)
    names.unshift(game.name)
    await applyOrder(names)
  }

  const renderGameCard = (game: GameEntry) => {
    const state = pathState[game.name]
    const noSteam = game.type === 'steam' && !hasSteam
    const unknown = state === undefined
    const missingSave = state ? !state.exists : false
    const disabled = noSteam || unknown || missingSave
    const statusText = noSteam
      ? '没有检测到 steam'
      : unknown
      ? '正在检测存档路径'
      : missingSave
      ? '没有检测到游戏存档'
      : ''

    return (
      <div key={game.name} className="cards-grid-item">
        <GameCard
          game={game}
          pathState={state}
          resolvedPath={resolveTemplate(game.path)}
          disabled={disabled}
          checkingPaths={checkingPaths}
          statusText={statusText}
          onBackup={openBackupModal}
          onViewBackups={openBackupList}
          onMoveUp={moveGameUp}
          onMoveDown={moveGameDown}
          onPinTop={pinGameTop}
          useRelativeTime={useRelativeTime}
        />
      </div>
    )
  }

  const openBackupFolder = async () => {
    try {
      const dir = await invoke<string>('get_backup_dir')
      await openPath(dir)
    } catch (err) {
      console.error(err)
      messageApi.error('打开备份目录失败')
    }
  }

  const updateTimePreference = async (checked: boolean) => {
    try {
      const cfg = await invoke<AppConfig>('set_setting', { key: 'useRelativeTime', value: checked })
      setConfig(cfg)
      setUseRelativeTime(checked)
    } catch (err) {
      console.error(err)
      messageApi.error('保存时间偏好失败')
    }
  }

  const updateRestorePreference = async (checked: boolean) => {
    try {
      const cfg = await invoke<AppConfig>('set_setting', { key: 'restoreExtraBackup', value: checked })
      setConfig(cfg)
      setRestoreExtraBackup(checked)
    } catch (err) {
      console.error(err)
      messageApi.error('保存复原安全设置失败')
    }
  }

  return (
    <AntApp message={{ maxCount: 1 }}>
      {contextHolder}
      <Layout className="app-shell">
        <Layout.Header className="app-header">
          <Flex align="center" justify="space-between" className="header-content">
            <Flex justify="center" align="center" gap={4} className="header-content__left">
              <Title level={3} className="brand">
                游戏存档助手
              </Title>
              <Segmented
                className="page-switch"
                value={activePage}
                onChange={(val) => setActivePage(val as 'main' | 'settings' | 'about')}
                options={[
                  { label: '主界面', value: 'main' },
                  { label: '配置', value: 'settings' },
                  { label: '软件信息', value: 'about' },
                ]}
              />
            </Flex>
            <Space size="middle" align="center" className="header-content__right">
              <div className="pill">
                <Text strong>Steam UID</Text>
                <Divider orientation="vertical" />
                <Select
                  placeholder="未检测到 steam"
                  style={{ minWidth: 200 }}
                  value={selectedSteamUID}
                  onChange={setSelectedSteamUID}
                  disabled={!hasSteam || steamUIDs.length === 0}
                  options={steamUIDs.map((id) => ({ label: id, value: id }))}
                />
              </div>
              <Button onClick={refreshBaseInfo}>重新加载</Button>
              <Button type="primary" onClick={refreshPathState} loading={checkingPaths}>
                重新检测路径
              </Button>
            </Space>
          </Flex>
        </Layout.Header>
        <Layout.Content className="app-body">
          <div className="page-holder">
            {activePage === 'main' && <MainPage loading={loading} config={config} renderGameCard={renderGameCard} />}
            {activePage === 'settings' && (
              <SettingsPage
                useRelativeTime={useRelativeTime}
                restoreExtraBackup={restoreExtraBackup}
                onToggleRelativeTime={updateTimePreference}
                onToggleRestoreExtraBackup={updateRestorePreference}
              />
            )}
            {activePage === 'about' && (
              <AboutPage
                frontendVersion={__APP_VERSION__}
                backendVersion={backendVersion}
                onOpenURL={(URL: string) => openPath(URL)}
              />
            )}
          </div>
        </Layout.Content>
      </Layout>

      <BackupModal
        open={backupModalOpen}
        game={backupTarget}
        resolvedPath={backupTarget ? resolveTemplate(backupTarget.path) : null}
        onCancel={() => setBackupModalOpen(false)}
        onSubmit={submitBackup}
      />

      <BackupListModal
        open={backupListOpen}
        gameName={backupListTarget?.name ?? null}
        loading={backupListLoading}
        items={backupList}
        onCancel={() => setBackupListOpen(false)}
        onEdit={openEditRemark}
        onOpenDir={openBackupFolder}
        onRestore={handleRestore}
        useRelativeTime={useRelativeTime}
      />

      <EditRemarkModal
        open={editRemarkOpen}
        item={editRemarkTarget}
        onCancel={() => setEditRemarkOpen(false)}
        onSave={submitEditRemark}
      />

      <RestoreOverlay
        open={restoreState.open}
        steps={restoreState.steps.length ? restoreState.steps : buildInitialRestoreSteps()}
        note={restoreState.note}
        detail={restoreState.detail}
        result={restoreState.result}
        gameName={restoreState.gameName}
        backupName={restoreState.backupName}
        onClose={closeRestoreOverlay}
      />
    </AntApp>
  )
}

export default App

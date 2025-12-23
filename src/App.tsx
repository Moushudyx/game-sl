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
} from 'antd'
import { openPath } from '@tauri-apps/plugin-opener'
import { GameCard } from './components/GameCard'
import BackupModal from './components/BackupModal'
import BackupListModal from './components/BackupListModal'
import EditRemarkModal from './components/EditRemarkModal'
import { AppConfig, BackupEntry, BackupResponse, GameEntry, PathState } from './types'
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
  const [activePage, setActivePage] = useState<'main' | 'settings' | 'about'>('main')

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

  return (
    <AntApp message={{ maxCount: 1 }}>
      {contextHolder}
      <Layout className="app-shell">
        <Layout.Header className="app-header">
          <Flex align="center" justify="space-between" className="header-content">
            <Flex justify="center" align='center' gap={4} className="header-content__left">
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
            {activePage === 'main' && (
              <MainPage loading={loading} config={config} renderGameCard={renderGameCard} />
            )}
            {activePage === 'settings' && (
              <SettingsPage useRelativeTime={useRelativeTime} onToggle={updateTimePreference} />
            )}
            {activePage === 'about' && <AboutPage />}
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
        useRelativeTime={useRelativeTime}
      />

      <EditRemarkModal
        open={editRemarkOpen}
        item={editRemarkTarget}
        onCancel={() => setEditRemarkOpen(false)}
        onSave={submitEditRemark}
      />
    </AntApp>
  )
}

export default App

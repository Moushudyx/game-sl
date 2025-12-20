import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  App as AntApp,
  Button,
  Divider,
  Empty,
  Flex,
  Layout,
  Select,
  Space,
  Spin,
  Tabs,
  Typography,
  message,
} from 'antd'
import { GameCard } from './components/GameCard'
import { AppConfig, GameEntry, PathState } from './types'
import './App.scss'

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
      const [cfg, userPath, steamPath, uids] = await Promise.all([
        invoke<AppConfig>('load_config'),
        invoke<string>('get_user_folder'),
        invoke<string | null>('get_steam_install_dir'),
        invoke<string[]>('get_steam_uid_list'),
      ])

      setConfig(cfg)
      setUserFolder(userPath)
      setSteamDir(steamPath)
      setSteamUIDs(uids)
      if (!selectedSteamUID && uids.length > 0) {
        setSelectedSteamUID(uids[0])
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
        />
      </div>
    )
  }

  const renderMainTab = () => {
    if (loading) {
      return (
        <Flex align="center" justify="center" style={{ height: '60vh' }}>
          <Spin tip="正在加载游戏列表" />
        </Flex>
      )
    }

    if (!config || config.games.length === 0) {
      return <Empty description="还没有配置任何游戏" />
    }

    return <div className="cards-grid">{config.games.map(renderGameCard)}</div>
  }

  return (
    <AntApp message={{ maxCount: 1 }}>
      {contextHolder}
      <Layout className="app-shell">
        <Layout.Header className="app-header">
          <Flex align="center" justify="space-between" className="header-content">
            <Flex vertical gap={4}>
              <Title level={3} className="brand">
                游戏存档助手
              </Title>
              {/* <Text type="secondary">按需检测存档路径，备份/复原入口预留</Text> */}
            </Flex>
            <Space size="middle" align="center">
              <div className="pill">
                <Text strong>Steam UID</Text>
                <Divider type="vertical" />
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
          <Tabs
            defaultActiveKey="main"
            items={[
              { key: 'main', label: '主界面', children: renderMainTab() },
              { key: 'settings', label: '配置', children: <Empty description="配置页面待实现" /> },
              { key: 'about', label: '软件信息', children: <Empty description="软件信息页面待实现" /> },
            ]}
          />
        </Layout.Content>
      </Layout>
    </AntApp>
  )
}

export default App

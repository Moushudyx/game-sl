import { Button, Divider, Flex, Layout, Segmented, Select, Space, Typography } from 'antd'

const { Title, Text } = Typography

/**
 * 顶部导航栏组件：负责页面切换、Steam UID 选择与刷新操作
 */
export type HeaderBarProps = {
  activePage: 'main' | 'settings' | 'about'
  onChangePage: (page: 'main' | 'settings' | 'about') => void
  hasSteam: boolean
  steamUIDs: string[]
  selectedSteamUID?: string
  onSelectSteamUID: (uid?: string) => void
  onReload: () => void
  onRefreshPaths: () => void
  refreshingPaths: boolean
}

/** 顶部导航栏 */
export function HeaderBar({
  activePage,
  onChangePage,
  hasSteam,
  steamUIDs,
  selectedSteamUID,
  onSelectSteamUID,
  onReload,
  onRefreshPaths,
  refreshingPaths,
}: HeaderBarProps) {
  return (
    <Layout.Header className="app-header">
      <Flex align="center" justify="space-between" className="header-content">
        <Flex justify="center" align="center" gap={4} className="header-content__left">
          <Title level={3} className="brand">
            游戏存档助手
          </Title>
          <Segmented
            className="page-switch"
            value={activePage}
            onChange={(val) => onChangePage(val as HeaderBarProps['activePage'])}
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
              onChange={onSelectSteamUID}
              disabled={!hasSteam || steamUIDs.length === 0}
              options={steamUIDs.map((id) => ({ label: id, value: id }))}
            />
          </div>
          <Button onClick={onReload}>重新加载</Button>
          <Button type="primary" onClick={onRefreshPaths} loading={refreshingPaths}>
            重新检测路径
          </Button>
        </Space>
      </Flex>
    </Layout.Header>
  )
}

export default HeaderBar

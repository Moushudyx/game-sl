import { Button, Card, Flex, Space, Tag, Typography } from 'antd'
import { GameEntry, PathState } from '../types'
import './GameCard.scss'

const { Title, Text } = Typography

type Props = {
  game: GameEntry
  pathState?: PathState
  resolvedPath: string
  disabled: boolean
  checkingPaths: boolean
  statusText: string
}

export function GameCard({ game, pathState, resolvedPath, disabled, checkingPaths, statusText }: Props) {
  const formatTimestamp = (value?: number) => {
    if (!value) return '暂无备份'
    const date = new Date(value)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
  }

  return (
    <Card
      key={game.name}
      className="game-card"
      title={
        <Flex align="center" justify="flex-start" gap={8} className="card-title">
          <Title level={4} className="card-title-text">
            {game.name}
          </Title>
          <Text className="card-title-time" type="secondary" title={formatTimestamp(game.lastSave)}>
            {formatTimestamp(game.lastSave)}
          </Text>
        </Flex>
      }
      extra={
        <div>
          <Button type="link" size="small" disabled={checkingPaths}>
            前移
          </Button>
          <Button type="link" size="small" disabled={checkingPaths}>
            后移
          </Button>
        </div>
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {statusText && (
          <Tag color="orange" bordered={false}>
            {statusText}
          </Tag>
        )}
        {/* 存档路径 */}
        <Text className="path-text">{pathState?.resolved || resolvedPath}</Text>
        <Space size="small">
          <Button type="primary" disabled={disabled || checkingPaths} ghost>
            备份
          </Button>
          <Button disabled={disabled || checkingPaths}>查看备份</Button>
          <Button disabled={checkingPaths} danger>
            删除游戏
          </Button>
        </Space>
      </Space>
    </Card>
  )
}

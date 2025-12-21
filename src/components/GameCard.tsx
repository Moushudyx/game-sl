import { Button, Card, Flex, Space, Tag, Typography } from 'antd'
import { GameEntry, PathState } from '../types'
import './GameCard.scss'
import RelativeTime from './RelativeTime'

const { Title, Text } = Typography

type Props = {
  game: GameEntry
  pathState?: PathState
  resolvedPath: string
  disabled: boolean
  checkingPaths: boolean
  statusText: string
  onBackup: (game: GameEntry) => void
  onViewBackups: (game: GameEntry) => void
  useRelativeTime: boolean
}

export function GameCard({
  game,
  pathState,
  resolvedPath,
  disabled,
  checkingPaths,
  statusText,
  onBackup,
  onViewBackups,
  useRelativeTime,
}: Props) {
  return (
    <Card
      key={game.name}
      className="game-card"
      title={
        <Flex align="center" justify="flex-start" gap={8} className="card-title">
          <Title level={4} className="card-title-text">
            {game.name}
          </Title>
          <RelativeTime
            value={game.lastSave}
            className="card-title-time"
            mode={useRelativeTime ? 'relative' : 'absolute'}
          />
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
        {/* TODO 存档路径 后边改成可配置的 */}
        <Text className="path-text">{pathState?.resolved || resolvedPath}</Text>
        <Space size="small">
          <Button type="primary" disabled={disabled || checkingPaths} ghost onClick={() => onBackup(game)}>
            备份
          </Button>
          <Button disabled={disabled || checkingPaths} onClick={() => onViewBackups(game)}>
            查看备份
          </Button>
          <Button disabled={checkingPaths} danger>
            删除游戏
          </Button>
        </Space>
      </Space>
    </Card>
  )
}

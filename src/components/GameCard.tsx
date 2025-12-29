import { Button, Card, Flex, Space, Tag, Typography } from 'antd'
import { GameEntry, PathState } from '../types'
import './GameCard.scss'
import RelativeTime from './RelativeTime'
import defaultIcon from '../assets/default-game-icon.svg'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, StarOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

/**
 * 游戏卡片：展示单个游戏的基础信息、路径与操作
 */
type Props = {
  game: GameEntry
  pathState?: PathState
  resolvedPath: string
  disabled: boolean
  checkingPaths: boolean
  statusText: string
  onBackup: (game: GameEntry) => void
  onViewBackups: (game: GameEntry) => void
  onMoveUp: (game: GameEntry) => void
  onMoveDown: (game: GameEntry) => void
  onPinTop: (game: GameEntry) => void
  useRelativeTime: boolean
}

/** 游戏卡片组件 */
export function GameCard({
  game,
  pathState,
  resolvedPath,
  disabled,
  checkingPaths,
  statusText,
  onBackup,
  onViewBackups,
  onMoveUp,
  onMoveDown,
  onPinTop,
  useRelativeTime,
}: Props) {
  const resolveIconSrc = (icon?: string) => {
    if (!icon || icon.trim().length === 0) return defaultIcon
    const val = icon.trim()
    if (val.startsWith('data:') || val.startsWith('http://') || val.startsWith('https://')) return val
    // 兜底：当传入裸 base64 时按 png 处理
    return `data:image/png;base64,${val}`
  }

  return (
    <Card key={game.name} className="game-card">
      <div className="game-card__inner">
        <div className="game-card__icon">
          <img src={resolveIconSrc(game.icon)} alt={game.name} />
        </div>
        <div className="game-card__content">
          <div className="game-card__header">
            <Flex align="center" gap={8} className="card-title">
              <Title level={4} className="card-title-text">
                {game.name}
              </Title>
              <RelativeTime
                value={game.lastSave}
                className="card-title-time"
                mode={useRelativeTime ? 'relative' : 'absolute'}
              />
            </Flex>
            <div className="card-actions">
              <Button
                color="default"
                variant="text"
                size="small"
                icon={<ArrowUpOutlined />}
                title="前移"
                disabled={checkingPaths}
                onClick={() => onMoveUp(game)}
              >
                {/* 前移 */}
              </Button>
              <Button
                color="default"
                variant="text"
                size="small"
                icon={<ArrowDownOutlined />}
                title="后移"
                disabled={checkingPaths}
                onClick={() => onMoveDown(game)}
              >
                {/* 后移 */}
              </Button>
              <Button
                color="default"
                variant="text"
                size="small"
                icon={<StarOutlined />}
                title="置顶"
                disabled={checkingPaths}
                onClick={() => onPinTop(game)}
              >
                {/* 置顶 */}
              </Button>
            </div>
          </div>

          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {statusText && (
              <Tag color="orange" variant="filled">
                {statusText}
              </Tag>
            )}
            <Text className="path-text" title={pathState?.resolved || resolvedPath}>
              {pathState?.resolved || resolvedPath}
            </Text>
            <Space size="small">
              <Button type="primary" disabled={disabled || checkingPaths} ghost onClick={() => onBackup(game)}>
                备份
              </Button>
              <Button disabled={disabled || checkingPaths} onClick={() => onViewBackups(game)}>
                查看备份
              </Button>
              <Button disabled={checkingPaths} icon={<DeleteOutlined />} danger type="text">
                {/* 删除游戏 */}
              </Button>
            </Space>
          </Space>
        </div>
      </div>
    </Card>
  )
}

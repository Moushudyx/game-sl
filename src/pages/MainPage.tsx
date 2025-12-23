import { Empty, Flex, Spin } from 'antd'
import { AppConfig, GameEntry } from '../types'
import React from 'react'

type Props = {
  loading: boolean
  config: AppConfig | null
  renderGameCard: (game: GameEntry) => React.ReactNode
}

export default function MainPage({ loading, config, renderGameCard }: Props) {
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

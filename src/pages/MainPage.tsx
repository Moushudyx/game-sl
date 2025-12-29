import { Empty, Flex, Spin } from 'antd'
import { AppConfig, GameEntry } from '../types'
import React from 'react'

/**
 * 主页面：负责渲染游戏卡片列表，接受渲染函数以降低耦合
 */
type Props = {
  loading: boolean
  config: AppConfig | null
  renderGameCard: (game: GameEntry) => React.ReactNode
}

/** 主页面组件 */
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

import { useEffect, useState } from 'react'
import { Modal, Input, Space, Typography } from 'antd'
import { GameEntry } from '../types'

const { Text } = Typography

type Props = {
  open: boolean
  game: GameEntry | null
  resolvedPath: string | null
  onCancel: () => void
  onSubmit: (remark: string) => Promise<void>
}

export default function BackupModal({ open, game, resolvedPath, onCancel, onSubmit }: Props) {
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 每次打开或切换游戏时重置备注
    if (open) setRemark('')
  }, [open, game?.name])

  const handleOk = async () => {
    setLoading(true)
    try {
      await onSubmit(remark)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={game ? `备份 ${game.name}` : '备份存档'}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okText="开始备份"
      cancelText="取消"
      centered
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* <Text type="secondary">备注（可选）：</Text> */}
        <Input.TextArea
          rows={4}
          placeholder="请输入备注，留空则不写入备注文件"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
        />
        {game && resolvedPath && <Text type="secondary">备份源路径：{resolvedPath}</Text>}
      </Space>
    </Modal>
  )
}

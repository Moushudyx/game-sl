import { Flex, Space, Switch, Typography } from 'antd'

type Props = {
  useRelativeTime: boolean
  restoreExtraBackup: boolean
  onToggleRelativeTime: (checked: boolean) => void
  onToggleRestoreExtraBackup: (checked: boolean) => void
}

const { Text } = Typography

export default function SettingsPage({
  useRelativeTime,
  restoreExtraBackup,
  onToggleRelativeTime,
  onToggleRestoreExtraBackup,
}: Props) {
  return (
    <Flex vertical gap={16} style={{ padding: 16 }}>
      <Flex align="center" gap={12}>
        <Text strong>时间显示方式</Text>
        <Space>
          <Text type="secondary">使用相对时间</Text>
          <Switch checked={useRelativeTime} onChange={onToggleRelativeTime} />
        </Space>
      </Flex>

      <Flex align="center" gap={12}>
        <Text strong>复原前额外备份</Text>
        <Space>
          <Text type="secondary">安全兜底（建议开启）</Text>
          <Switch checked={restoreExtraBackup} onChange={onToggleRestoreExtraBackup} />
        </Space>
      </Flex>
    </Flex>
  )
}

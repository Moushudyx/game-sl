import { Flex, Space, Switch, Typography } from 'antd'

type Props = {
  useRelativeTime: boolean
  onToggle: (checked: boolean) => void
}

const { Text } = Typography

export default function SettingsPage({ useRelativeTime, onToggle }: Props) {
  return (
    <Flex vertical gap={16} style={{ padding: 16 }}>
      <Flex align="center" gap={12}>
        <Text strong>时间显示方式</Text>
        <Space>
          <Text type="secondary">使用相对时间</Text>
          <Switch checked={useRelativeTime} onChange={onToggle} />
        </Space>
      </Flex>
    </Flex>
  )
}

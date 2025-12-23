import { Button, Divider, Flex, Space, Typography } from 'antd'

type Props = {
  frontendVersion?: string
  backendVersion?: string
  onOpenURL?: (URL: string) => void
}

const { Title, Text } = Typography as any

export default function AboutPage({ frontendVersion, backendVersion /*, onOpenURL */ }: Props) {
  return (
    <Flex vertical gap={16} style={{ padding: 16 }}>
      <Title level={4} style={{ margin: 0 }}>
        软件信息
      </Title>
      <Space orientation="vertical" size={8}>
        <Text>
          <Text strong>前端版本：</Text>
          {frontendVersion ?? '未知'}
        </Text>
        <Text>
          <Text strong>后端版本：</Text>
          {backendVersion ?? '未知'}
        </Text>
        <Text>
          <Text strong>GitHub 开源：</Text>
          <a href={'https://github.com/Moushudyx/game-sl'} target="_blank" rel="noreferrer">
            {'Moushudyx/game-sl'}
          </a>
        </Text>
      </Space>
      <Divider size="small" />
      <Space orientation="vertical" size={8}>
        <Text>
          <Text strong>开发框架：</Text>
          <a href={'https://tauri.app/'} target="_blank" rel="noreferrer">
            tauri
          </a>
        </Text>
        <Text>
          <Text strong>默认游戏图标：</Text>
          <a href={'https://www.svgrepo.com/svg/480458/game-controller'} target="_blank" rel="noreferrer">
            www.svgrepo.com
          </a>
        </Text>
      </Space>
      {/* <Space>
        <Button type="primary" onClick={onOpenRepo}>打开 GitHub</Button>
      </Space> */}
    </Flex>
  )
}

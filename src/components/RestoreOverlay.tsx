import { Alert, Button, Modal, Space, Steps, Typography } from 'antd'

/** 复原流程步骤键 */
export type RestoreStepKey = 'check' | 'extra' | 'delete' | 'extract' | 'update'
/** 复原流程步骤状态 */
export type RestoreStepState = {
  key: RestoreStepKey
  title: string
  status: 'wait' | 'process' | 'finish' | 'error'
}

/**
 * 复原流程覆盖层：展示复原进度、提示与关闭动作
 */
type Props = {
  open: boolean
  steps: RestoreStepState[]
  note: string
  detail?: string
  result: 'success' | 'error' | null
  gameName?: string
  backupName?: string
  onClose: () => void
}

const { Text } = Typography

/** 复原流程覆盖层 */
export default function RestoreOverlay({ open, steps, note, detail, result, gameName, backupName, onClose }: Props) {
  const canClose = result !== null
  const statusType = result === 'error' ? 'error' : 'info'
  const processingIndex = steps.findIndex((s) => s.status === 'process')
  const currentIndex =
    processingIndex >= 0
      ? processingIndex
      : steps.findIndex((s) => s.status === 'error') >= 0
      ? steps.findIndex((s) => s.status === 'error')
      : 0

  return (
    <Modal
      open={open}
      title="正在复原备份"
      width="100%"
      style={{ maxWidth: '1200px' }}
      footer={
        canClose ? (
          <Button type="primary" onClick={onClose}>
            {result === 'success' ? '完成' : '关闭'}
          </Button>
        ) : null
      }
      closable={false}
      maskClosable={false}
      centered
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Space orientation="vertical" size={4}>
          <Text>
            <Text strong>游戏：</Text>
            {gameName || '未知'}
          </Text>
          <Text>
            <Text strong>备份文件：</Text>
            {backupName || '未知'}
          </Text>
        </Space>

        <Steps
          current={currentIndex < 0 ? 0 : currentIndex}
          items={steps.map((step) => ({
            key: step.key,
            title: step.title,
            status: step.status,
          }))}
        />

        <Alert type={statusType} showIcon title={note} description={detail} style={{ marginTop: 8 }} />
      </Space>
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Alert, Form, Input, Modal, Space, Typography } from 'antd'
import { GameEntry } from '../types'
import { GameCard } from './GameCard'

const { Text } = Typography

const INVALID_NAME = /[\\/:*?"<>|]/
const INVALID_PATH = /["<>|?*]/

export type GameFormValues = {
  name: string
  path: string
  icon: string
}

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  initialValue?: GameEntry | null
  existingNames: string[]
  resolveTemplate: (template: string) => string
  onCancel: () => void
  onSubmit: (values: GameFormValues, originalName?: string | null) => Promise<void>
}

const noop = () => {}

function inferType(path: string): 'steam' | 'userdata' {
  const lower = path.toLowerCase()
  return lower.includes('{steam}') || lower.includes('{steamuid}') ? 'steam' : 'userdata'
}

export function GameEditorModal({
  open,
  mode,
  initialValue,
  existingNames,
  resolveTemplate,
  onCancel,
  onSubmit,
}: Props) {
  const [form] = Form.useForm<GameFormValues>()
  const [loading, setLoading] = useState(false)

  const name = Form.useWatch('name', form) ?? ''
  const path = Form.useWatch('path', form) ?? ''
  const icon = Form.useWatch('icon', form) ?? ''

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        name: initialValue?.name ?? '',
        path: initialValue?.path ?? '',
        icon: initialValue?.icon ?? '',
      })
    }
  }, [form, initialValue?.icon, initialValue?.name, initialValue?.path, open])

  const previewGame: GameEntry = useMemo(
    () => ({
      name: name || '未命名游戏',
      path: path || '{AppData}',
      icon: icon,
      lastSave: initialValue?.lastSave,
      type: inferType(path),
    }),
    [icon, initialValue?.lastSave, name, path]
  )

  const resolvedPath = useMemo(() => resolveTemplate(path || '{AppData}'), [path, resolveTemplate])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await onSubmit(
        {
          name: values.name.trim(),
          path: values.path.trim(),
          icon: values.icon.trim(),
        },
        initialValue?.name ?? null
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增游戏' : '编辑游戏'}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okText={mode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      width={820}
      centered
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Form layout="vertical" form={form} autoComplete="off">
          <Form.Item
            label="游戏名称"
            name="name"
            rules={[
              // { required: true, message: '请输入游戏名称' },
              {
                validator: (_, value) => {
                  const trimmed = (value ?? '').trim()
                  if (!trimmed) return Promise.reject('请输入游戏名称')
                  if (INVALID_NAME.test(trimmed)) return Promise.reject('名称不能包含 \\ / : * ? " < > |')
                  if (existingNames.includes(trimmed) && trimmed !== initialValue?.name) {
                    return Promise.reject('已存在同名游戏，请更换')
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input maxLength={64} placeholder="输入游戏名称" allowClear />
          </Form.Item>

          <Form.Item
            label="存档路径模板"
            name="path"
            rules={[
              // { required: true, message: '请输入存档路径' },
              {
                validator: (_, value) => {
                  const trimmed = (value ?? '').trim()
                  if (!trimmed) return Promise.reject('请输入存档路径')
                  if (INVALID_PATH.test(trimmed)) return Promise.reject('路径中不能包含 " < > | ? *')
                  return Promise.resolve()
                },
              },
            ]}
            extra={
              <Text type="secondary">
                可用占位符: {`{AppData}`} / {`{Home}`} / {`{Steam}`} / {`{SteamUID}`}
              </Text>
            }
          >
            <Input placeholder="例如 {Steam}\\userdata\\{SteamUID}\\123456\\remote" allowClear />
          </Form.Item>

          <Form.Item label="图标 URL 或 Base64" name="icon">
            <Input placeholder="留空使用默认图标" allowClear />
          </Form.Item>
        </Form>

        <Alert type="info" showIcon title="预览" description="创建前请仔细检查并确认" />

        <GameCard
          game={previewGame}
          resolvedPath={resolvedPath}
          disabled={false}
          checkingPaths={false}
          statusText=""
          onBackup={noop}
          onViewBackups={noop}
          onMoveUp={noop}
          onMoveDown={noop}
          onPinTop={noop}
          useRelativeTime={true}
          showHeaderActions={false}
          showActionButtons={false}
        />
      </Space>
    </Modal>
  )
}

export default GameEditorModal

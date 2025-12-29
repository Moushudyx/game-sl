import { Button, Empty, List, Modal, Space, Spin, Tag, Typography } from 'antd'
import { BackupEntry } from '../types'
import RelativeTime from './RelativeTime'

const { Text } = Typography

type Props = {
  open: boolean
  gameName: string | null
  loading: boolean
  items: BackupEntry[]
  onCancel: () => void
  onEdit: (item: BackupEntry) => void
  onRestore: (item: BackupEntry) => void
  onOpenDir: () => void
  useRelativeTime: boolean
}

export default function BackupListModal({
  open,
  gameName,
  loading,
  items,
  onCancel,
  onEdit,
  onRestore,
  onOpenDir,
  useRelativeTime,
}: Props) {
  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
    return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  return (
    <Modal
      open={open}
      title={
        <>
          {gameName ? `${gameName} 的备份` : '备份列表'} &nbsp;
          <Button size="small" type="dashed" onClick={onOpenDir}>
            打开备份文件夹
          </Button>
        </>
      }
      onCancel={onCancel}
      footer={null}
      width={760}
      centered
    >
      <Spin spinning={loading} tip="正在读取备份列表">
        {items.length === 0 ? (
          <Empty description={loading ? '正在加载…' : '暂无备份'} style={{ margin: '24px 0' }} />
        ) : (
          <List
            dataSource={items}
            rowKey={(item) => item.fileName}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button size="small" key="edit" onClick={() => onEdit(item)}>
                    编辑
                  </Button>,
                  <Button size="small" key="delete" disabled color="danger">
                    删除
                  </Button>,
                  <Button size="small" key="restore" type="primary" onClick={() => onRestore(item)}>
                    复原
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{item.fileName}</Text>
                      <Tag color={item.timeSource === 'file-name' ? 'blue' : 'gold'} variant="filled">
                        {item.timeSource === 'file-name'
                          ? '标准备份文件'
                          : item.timeSource === 'modified-time'
                          ? '其他备份文件'
                          : '未知时间'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space orientation="vertical" size={0}>
                      <Text type="secondary">
                        时间：
                        <RelativeTime value={item.timestamp} mode={useRelativeTime ? 'relative' : 'absolute'} />
                      </Text>
                      <Text type="secondary">大小：{formatSize(item.size)}</Text>
                      <Text type="secondary">备注：{item.remark || '无'}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Spin>
    </Modal>
  )
}

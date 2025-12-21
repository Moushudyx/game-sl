import { useEffect, useState } from 'react'
import { Input, Modal } from 'antd'
import { BackupEntry } from '../types'

type Props = {
  open: boolean
  item: BackupEntry | null
  onCancel: () => void
  onSave: (newRemark: string) => Promise<void>
}

export default function EditRemarkModal({ open, item, onCancel, onSave }: Props) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setValue(item?.remark || '')
  }, [open, item?.fileName])

  const handleOk = async () => {
    setLoading(true)
    try {
      await onSave(value)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="编辑备注"
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      centered
    >
      <Input.TextArea
        rows={4}
        placeholder="输入备注内容，留空将删除备注文件"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Modal>
  )
}

import BackupModal from '../../components/BackupModal'
import BackupListModal from '../../components/BackupListModal'
import EditRemarkModal from '../../components/EditRemarkModal'
import { BackupEntry, GameEntry } from '../../types'

/**
 * 备份特性组件：集中承载备份对话框、备份列表与备注编辑
 * 通过 props 接收外层 hook 的状态与动作，提升复用性
 */
type Props = {
  // backup modal
  backupModalOpen: boolean
  backupTarget: GameEntry | null
  onBackupCancel: () => void
  onBackupSubmit: (remark: string) => Promise<void>
  // backup list
  backupListOpen: boolean
  backupListLoading: boolean
  backupListItems: BackupEntry[]
  backupListTarget: GameEntry | null
  onBackupListCancel: () => void
  onEditRemark: (item: BackupEntry) => void
  onRestore: (item: BackupEntry) => void
  onDelete: (item: BackupEntry) => void
  deletingKey?: string | null
  onOpenDir: () => Promise<void> | void
  // edit remark
  editRemarkOpen: boolean
  editRemarkTarget: BackupEntry | null
  onEditRemarkCancel: () => void
  onEditRemarkSave: (newRemark: string) => Promise<void>
  // display
  useRelativeTime: boolean
  resolveTemplate: (template: string) => string
}
/** 备份相关的逻辑抽离到这里 */
export default function BackupFeature({
  backupModalOpen,
  backupTarget,
  onBackupCancel,
  onBackupSubmit,
  backupListOpen,
  backupListLoading,
  backupListItems,
  backupListTarget,
  onBackupListCancel,
  onEditRemark,
  onRestore,
  onDelete,
  deletingKey,
  onOpenDir,
  editRemarkOpen,
  editRemarkTarget,
  onEditRemarkCancel,
  onEditRemarkSave,
  useRelativeTime,
  resolveTemplate,
}: Props) {
  return (
    <>
      <BackupModal
        open={backupModalOpen}
        game={backupTarget}
        resolvedPath={backupTarget ? resolveTemplate(backupTarget.path) : null}
        onCancel={onBackupCancel}
        onSubmit={onBackupSubmit}
      />

      <BackupListModal
        open={backupListOpen}
        gameName={backupListTarget?.name ?? null}
        loading={backupListLoading}
        items={backupListItems}
        onCancel={onBackupListCancel}
        onEdit={onEditRemark}
        onOpenDir={onOpenDir}
        onRestore={onRestore}
        onDelete={onDelete}
        deletingKey={deletingKey}
        useRelativeTime={useRelativeTime}
      />

      <EditRemarkModal open={editRemarkOpen} item={editRemarkTarget} onCancel={onEditRemarkCancel} onSave={onEditRemarkSave} />
    </>
  )
}

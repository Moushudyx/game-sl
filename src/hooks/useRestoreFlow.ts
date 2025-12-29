import { useState } from 'react'
import { RestoreStepKey, RestoreStepState } from '../components/RestoreOverlay'

type RestoreResult = 'success' | 'error' | null

type RestoreState = {
  open: boolean
  steps: RestoreStepState[]
  result: RestoreResult
  note: string
  detail?: string
  gameName?: string
  backupName?: string
}

// 负责复原流程的状态管理与错误解析，避免 App 组件过度膨胀
export function useRestoreFlow() {
  const restoreStepOrder: RestoreStepKey[] = ['check', 'extra', 'delete', 'extract', 'update']

  const buildInitialRestoreSteps = (): RestoreStepState[] => [
    { key: 'check', title: '校验路径与备份文件', status: 'wait' },
    { key: 'extra', title: '复原前额外备份', status: 'wait' },
    { key: 'delete', title: '删除现有存档', status: 'wait' },
    { key: 'extract', title: '解压所选备份', status: 'wait' },
    { key: 'update', title: '更新记录', status: 'wait' },
  ]

  const [state, setState] = useState<RestoreState>({
    open: false,
    steps: buildInitialRestoreSteps(),
    result: null,
    note: '',
    detail: '',
    gameName: '',
    backupName: '',
  })

  const mapStageCode = (code: string): RestoreStepKey | null => {
    switch (code.toUpperCase()) {
      case 'CHECK':
        return 'check'
      case 'EXTRA_BACKUP':
        return 'extra'
      case 'DELETE':
        return 'delete'
      case 'EXTRACT':
        return 'extract'
      case 'UPDATE_CONFIG':
        return 'update'
      default:
        return null
    }
  }

  const parseRestoreError = (text: string): { stage: RestoreStepKey | null; detail: string } => {
    const raw = text?.toString?.() ?? '复原失败'
    const msg = raw.replace(/^Error:\s*/, '')
    const matched = msg.match(/^\[(.+?)\]\s*(.*)$/)
    if (!matched) return { stage: null, detail: msg }
    const stage = mapStageCode(matched[1])
    const detail = matched[2] && matched[2].length > 0 ? matched[2] : msg
    return { stage, detail }
  }

  const openRestoreOverlay = (gameName: string, backupName: string) => {
    const steps = buildInitialRestoreSteps()
    if (steps[0]) steps[0].status = 'process'
    setState({
      open: true,
      steps,
      result: null,
      note: '正在复原，请不要关闭窗口或重复操作…',
      detail: '',
      gameName,
      backupName,
    })
  }

  const markRestoreSuccess = () => {
    setState((prev) => ({
      ...prev,
      result: 'success',
      note: '复原完成，可关闭窗口',
      steps: buildInitialRestoreSteps().map((s) => ({ ...s, status: 'finish' as const })),
    }))
  }

  const markRestoreFailure = (stage: RestoreStepKey | null, detail: string) => {
    const idx = stage ? restoreStepOrder.indexOf(stage) : -1
    const steps = buildInitialRestoreSteps().map((s, i) => {
      if (idx >= 0) {
        if (i < idx) return { ...s, status: 'finish' as const }
        if (i === idx) return { ...s, status: 'error' as const }
      }
      return s
    })

    setState((prev) => ({
      ...prev,
      result: 'error',
      detail,
      steps,
      note: '复原失败，请查看提示',
    }))
  }

  const closeRestoreOverlay = () => {
    if (!state.result) return
    setState({
      open: false,
      steps: buildInitialRestoreSteps(),
      result: null,
      note: '',
      detail: '',
      gameName: '',
      backupName: '',
    })
  }

  return {
    state,
    buildInitialRestoreSteps,
    openRestoreOverlay,
    markRestoreSuccess,
    markRestoreFailure,
    closeRestoreOverlay,
    parseRestoreError,
  }
}

import { useEffect, useState } from 'react'
import { App as AntApp, Layout, message } from 'antd'
import { openPath } from '@tauri-apps/plugin-opener'
import { GameCard } from './components/GameCard'
// 备份相关弹层改由特性组件集中管理
import RestoreOverlay from './components/RestoreOverlay.tsx'
import { GameEntry } from './types'
import { useSettings } from './hooks/useSettings'
import './App.scss'
import MainPage from './pages/MainPage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'
import { useRestoreFlow } from './hooks/useRestoreFlow'
// 备份相关服务调用移动到 useBackups 内部
import { useAppState } from './hooks/useAppState'
import HeaderBar from './components/HeaderBar'
import BackupFeature from './features/backups/BackupFeature'
import { useBackups } from './features/backups/useBackups'
import { useAppVersion } from './hooks/useAppVersion'

function App() {
  const [messageApi, contextHolder] = message.useMessage()
  // 使用 App.useApp() 提供的 modal，保证跟随主题（夜间模式等）
  const { modal } = AntApp.useApp()

  const {
    state: restoreState,
    buildInitialRestoreSteps,
    openRestoreOverlay,
    markRestoreSuccess,
    markRestoreFailure,
    closeRestoreOverlay,
    parseRestoreError,
  } = useRestoreFlow()

  const {
    loading,
    checkingPaths,
    config,
    setConfig,
    steamUIDs,
    selectedSteamUID,
    setSelectedSteamUID,
    pathState,
    hasSteam,
    resolveTemplate,
    refreshBaseInfo,
    refreshPathState,
    moveGameUp,
    moveGameDown,
    pinGameTop,
  } = useAppState({ onError: (msg) => messageApi.error(msg) })

  const {
    useRelativeTime,
    restoreExtraBackup,
    updateUseRelativeTime,
    updateRestoreExtraBackup,
  } = useSettings((msg) => messageApi.error(msg))
  const {
    backupModalOpen,
    backupTarget,
    backupListOpen,
    backupListLoading,
    backupList,
    backupListTarget,
    editRemarkOpen,
    editRemarkTarget,
    deletingBackupKey,
    openBackupModal,
    closeBackupModal,
    submitBackup,
    openBackupList,
    closeBackupList,
    openEditRemark,
    closeEditRemark,
    submitEditRemark,
    handleDeleteBackup,
    handleRestore,
    openBackupFolder,
  } = useBackups({
    setConfig,
    selectedSteamUID: selectedSteamUID ?? null,
    resolveTemplate,
    refreshPathState,
    messageApi,
    modal,
    parseRestoreError,
    openRestoreOverlay,
    markRestoreSuccess,
    markRestoreFailure,
  })
  const [activePage, setActivePage] = useState<'main' | 'settings' | 'about'>('main')
  const { backendVersion } = useAppVersion()


  useEffect(() => {
    refreshBaseInfo()
  }, [])

  useEffect(() => {
    // 仅在本地尚未有路径状态时自动触发一次检测，避免重复扫描
    if (config && Object.keys(pathState).length === 0) {
      refreshPathState()
    }
  }, [config, selectedSteamUID, pathState])

  const renderGameCard = (game: GameEntry) => {
    const state = pathState[game.name]
    const noSteam = game.type === 'steam' && !hasSteam
    const unknown = state === undefined
    const missingSave = state ? !state.exists : false
    const disabled = noSteam || unknown || missingSave
    const statusText = noSteam
      ? '没有检测到 steam'
      : unknown
      ? '正在检测存档路径'
      : missingSave
      ? '没有检测到游戏存档'
      : ''

    return (
      <div key={game.name} className="cards-grid-item">
        <GameCard
          game={game}
          pathState={state}
          resolvedPath={resolveTemplate(game.path)}
          disabled={disabled}
          checkingPaths={checkingPaths}
          statusText={statusText}
          onBackup={openBackupModal}
          onViewBackups={openBackupList}
          onMoveUp={moveGameUp}
          onMoveDown={moveGameDown}
          onPinTop={pinGameTop}
          useRelativeTime={useRelativeTime}
        />
      </div>
    )
  }





  return (
    <>
      {contextHolder}
      <Layout className="app-shell">
        <HeaderBar
          activePage={activePage}
          onChangePage={(page) => setActivePage(page)}
          hasSteam={hasSteam}
          steamUIDs={steamUIDs}
          selectedSteamUID={selectedSteamUID}
          onSelectSteamUID={setSelectedSteamUID}
          onReload={refreshBaseInfo}
          onRefreshPaths={refreshPathState}
          refreshingPaths={checkingPaths}
        />
        <Layout.Content className="app-body">
          <div className="page-holder">
            {activePage === 'main' && <MainPage loading={loading} config={config} renderGameCard={renderGameCard} />}
            {activePage === 'settings' && (
              <SettingsPage
                useRelativeTime={useRelativeTime}
                restoreExtraBackup={restoreExtraBackup}
                onToggleRelativeTime={updateUseRelativeTime}
                onToggleRestoreExtraBackup={updateRestoreExtraBackup}
              />
            )}
            {activePage === 'about' && (
              <AboutPage
                frontendVersion={__APP_VERSION__}
                backendVersion={backendVersion}
                onOpenURL={(URL: string) => openPath(URL)}
              />
            )}
          </div>
        </Layout.Content>
      </Layout>

      <BackupFeature
        backupModalOpen={backupModalOpen}
        backupTarget={backupTarget}
        onBackupCancel={closeBackupModal}
        onBackupSubmit={submitBackup}
        backupListOpen={backupListOpen}
        backupListLoading={backupListLoading}
        backupListItems={backupList}
        backupListTarget={backupListTarget}
        onBackupListCancel={closeBackupList}
        onEditRemark={openEditRemark}
        onRestore={handleRestore}
        onDelete={handleDeleteBackup}
        deletingKey={deletingBackupKey}
        onOpenDir={openBackupFolder}
        editRemarkOpen={editRemarkOpen}
        editRemarkTarget={editRemarkTarget}
        onEditRemarkCancel={closeEditRemark}
        onEditRemarkSave={submitEditRemark}
        useRelativeTime={useRelativeTime}
        resolveTemplate={resolveTemplate}
      />

      <RestoreOverlay
        open={restoreState.open}
        steps={restoreState.steps.length ? restoreState.steps : buildInitialRestoreSteps()}
        note={restoreState.note}
        detail={restoreState.detail}
        result={restoreState.result}
        gameName={restoreState.gameName}
        backupName={restoreState.backupName}
        onClose={closeRestoreOverlay}
      />
    </>
  )
}

export default App

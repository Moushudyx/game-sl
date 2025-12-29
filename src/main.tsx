import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntdApp, ConfigProvider, theme } from 'antd'
import App from './App'
import 'antd/dist/reset.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4d92ce',
          colorInfo: '#4d92ce',
          colorError: '#e4585a',
          colorWarning: '#e4aa37',
          colorSuccess: '#68c937',
          borderRadius: 4,
        },
        components: {
          Modal: {
            motionDurationSlow: '0.24s',
            motionDurationMid: '0.12s',
          },
          Notification: {
            motionDurationMid: '0.12s',
            motionDurationSlow: '0.24s',
          },
        },
        algorithm: theme.darkAlgorithm,
      }}
    >
      {/* App 组件内部需要 useApp，所以把 Antd App Provider 放在更外层 */}
      <AntdApp message={{ maxCount: 1 }}>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
)

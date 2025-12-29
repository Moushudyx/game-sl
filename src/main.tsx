import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
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
      <App />
    </ConfigProvider>
  </React.StrictMode>
)

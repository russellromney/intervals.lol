import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import IntervalTimer from './IntervalTimer'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <IntervalTimer />
    </BrowserRouter>
  </React.StrictMode>,
)

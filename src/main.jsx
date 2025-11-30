import { render } from 'preact'
import { BrowserRouter } from 'react-router-dom'
import IntervalTimer from './IntervalTimer'

render(
  <BrowserRouter>
    <IntervalTimer />
  </BrowserRouter>,
  document.getElementById('root'),
)

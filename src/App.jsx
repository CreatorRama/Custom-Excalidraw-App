import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
// import './App.css'
import KonvaApp from './components/conva'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
     <KonvaApp />
    </>
  )
}

export default App

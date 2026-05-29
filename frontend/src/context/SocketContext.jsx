import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
const SocketContext = createContext(null)
export const SocketProvider = ({ children }) => {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState([])
  useEffect(() => {
    if (!user) { socketRef.current?.disconnect(); socketRef.current = null; setConnected(false); return }
    const token = localStorage.getItem('accessToken')
    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000', { auth:{ token }, transports:['websocket'] })
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    const events = ['order:new','order:confirmed','order:in_kitchen','order:ready','order:bill_requested','order:billed','kitchen:new_order','bar:new_order','table:available']
    events.forEach(evt => socket.on(evt, data => setNotifications(prev => [{ id:Date.now(), event:evt, data, read:false, at:new Date() }, ...prev.slice(0,49)])))
    socketRef.current = socket
    return () => socket.disconnect()
  }, [user])
  const markRead  = (id) => setNotifications(p => p.map(n => n.id===id ? {...n,read:true} : n))
  const clearAll  = ()   => setNotifications([])
  const unreadCount = notifications.filter(n => !n.read).length
  return (
    <SocketContext.Provider value={{ socket:socketRef.current, connected, notifications, unreadCount, markRead, clearAll }}>
      {children}
    </SocketContext.Provider>
  )
}
export const useSocket = () => useContext(SocketContext)

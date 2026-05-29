import { useState, useEffect, useCallback } from 'react'
import { ordersAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
export function useOrders(filters={}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const { socket } = useSocket()
  const fetchOrders = useCallback(async () => {
    try { setLoading(true); setOrders(await ordersAPI.getAll(filters)) } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => {
    if (!socket) return
    const upd = u => setOrders(p => { const ex=p.find(o=>o.id===u.id); return ex ? p.map(o=>o.id===u.id?{...o,...u}:o) : [u,...p] })
    const evts = ['order:new','order:confirmed','order:in_kitchen','order:ready','order:delivered','order:billed']
    evts.forEach(e => socket.on(e,upd))
    return () => evts.forEach(e => socket.off(e,upd))
  }, [socket])
  const updateStatus = async (id, status) => { const u = await ordersAPI.updateStatus(id,status); setOrders(p => p.map(o=>o.id===id?{...o,...u}:o)); return u }
  return { orders, loading, fetchOrders, updateStatus }
}

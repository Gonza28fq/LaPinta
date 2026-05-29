import { useState, useEffect, useCallback } from 'react'
import { tablesAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
export function useTables() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const { socket } = useSocket()
  const fetchTables = useCallback(async () => {
    try { setLoading(true); setTables(await tablesAPI.getAll()) } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchTables() }, [fetchTables])
  useEffect(() => {
    if (!socket) return
    const upd = u => setTables(p => p.map(t => t.id===u.id ? {...t,...u} : t))
    const newOrd = o => { if(!o.table_id) return; setTables(p => p.map(t => t.id===o.table_id ? {...t,status:'occupied',active_order_id:o.id,order_status:o.status,waiter_name:o.waiter_name} : t)) }
    const free = ({tableId}) => setTables(p => p.map(t => t.id===tableId ? {...t,status:'available',active_order_id:null,order_status:null} : t))
    socket.on('table:status_changed',upd); socket.on('order:new',newOrd); socket.on('table:available',free)
    return () => { socket.off('table:status_changed',upd); socket.off('order:new',newOrd); socket.off('table:available',free) }
  }, [socket])
  const updateStatus = async (id, status) => { await tablesAPI.updateStatus(id,status); setTables(p => p.map(t => t.id===id ? {...t,status} : t)) }
  return { tables, loading, fetchTables, updateStatus }
}

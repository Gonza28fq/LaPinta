import { useSocket } from '../../context/SocketContext'
const CFG = {
  'order:new':{label:'Nuevo pedido',color:'var(--order-pending)',icon:'◎'},
  'order:confirmed':{label:'Pedido confirmado',color:'var(--order-confirmed)',icon:'◈'},
  'order:in_kitchen':{label:'En cocina',color:'var(--order-kitchen)',icon:'◇'},
  'order:ready':{label:'¡Listo para servir!',color:'var(--order-ready)',icon:'◆'},
  'order:bill_requested':{label:'Piden la cuenta',color:'var(--warning)',icon:'△'},
  'order:billed':{label:'Pedido cobrado',color:'var(--success)',icon:'✓'},
  'table:available':{label:'Mesa disponible',color:'var(--success)',icon:'⊞'},
}
export default function NotificationPanel({ onClose }) {
  const { notifications, markRead, clearAll, unreadCount } = useSocket()
  return (
    <div style={{position:'absolute',top:48,right:12,width:300,maxHeight:420,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',zIndex:200,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 8px 24px rgba(0,0,0,.3)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>
        <span>Notificaciones {unreadCount>0&&<span style={{background:'var(--danger)',color:'#fff',fontSize:10,fontWeight:700,width:18,height:18,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',marginLeft:6}}>{unreadCount}</span>}</span>
        <div style={{display:'flex',gap:8}}>
          {notifications.length>0&&<button onClick={clearAll} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:12}}>Limpiar</button>}
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:12}}>✕</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {notifications.length===0&&<div style={{padding:24,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Sin notificaciones</div>}
        {notifications.map(n=>{const c=CFG[n.event]||{label:n.event,color:'var(--text-muted)',icon:'◎'};return(
          <div key={n.id} onClick={()=>markRead(n.id)} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border-light)',cursor:'pointer',opacity:n.read?.55:1}}>
            <span style={{color:c.color,fontSize:16,marginTop:1}}>{c.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:500,color:'var(--text-primary)'}}>{c.label}</div>
              {n.data?.table_number&&<div style={{fontSize:11,color:'var(--text-secondary)'}}>Mesa {n.data.table_number}</div>}
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>{new Date(n.at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            {!n.read&&<span style={{width:7,height:7,borderRadius:'50%',background:'var(--accent)',flexShrink:0,marginTop:4}}/>}
          </div>
        )})}
      </div>
    </div>
  )
}

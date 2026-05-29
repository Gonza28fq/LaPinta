import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { customersAPI } from '../services/api'
import toast from 'react-hot-toast'
import './Clientes.css'

function ClienteModal({cliente,onClose,onSave}) {
  const [form,setForm]=useState(cliente||{name:'',phone:'',email:'',notes:''})
  const [saving,setSaving]=useState(false)
  const h=(k,v)=>setForm(f=>({...f,[k]:v}))
  const handleSubmit=async()=>{
    if(!form.name){toast.error('El nombre es requerido');return}
    setSaving(true)
    try{
      const data=cliente?await customersAPI.update(cliente.id,form):await customersAPI.create(form)
      onSave(data);toast.success(cliente?'Cliente actualizado':'Cliente registrado');onClose()
    }catch{toast.error('Error')}finally{setSaving(false)}
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="emp-modal">
        <div className="modal-header"><h2 className="modal-title">{cliente?'Editar cliente':'Nuevo cliente'}</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="emp-modal-body">
          <div className="form-row"><label>Nombre</label><input value={form.name} onChange={e=>h('name',e.target.value)} placeholder="Nombre del cliente"/></div>
          <div className="form-grid-2">
            <div className="form-row"><label>Teléfono</label><input value={form.phone||''} onChange={e=>h('phone',e.target.value)} placeholder="+54 9 381..."/></div>
            <div className="form-row"><label>Email</label><input value={form.email||''} onChange={e=>h('email',e.target.value)} placeholder="email@..."/></div>
          </div>
          <div className="form-row"><label>Notas</label><textarea rows={2} value={form.notes||''} onChange={e=>h('notes',e.target.value)} placeholder="Preferencias, alergias..."/></div>
        </div>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Guardar'}</button></div>
      </div>
    </div>
  )
}

export default function Clientes() {
  const [clientes,setClientes]=useState([]);const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('');const [showNew,setShowNew]=useState(false);const [editing,setEditing]=useState(null)
  useEffect(()=>{customersAPI.getAll().then(setClientes).catch(()=>{}).finally(()=>setLoading(false))},[])
  const filtered=clientes.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||(c.phone&&c.phone.includes(search))||(c.email&&c.email.toLowerCase().includes(search.toLowerCase())))
  const handleSave=(saved)=>setClientes(prev=>{const ex=prev.find(c=>c.id===saved.id);return ex?prev.map(c=>c.id===saved.id?saved:c):[saved,...prev]})
  return (
    <Layout>
      <div className="cli-page">
        <div className="cli-header">
          <div><h1 className="emp-title">Clientes</h1><p className="emp-subtitle">{clientes.length} registrados</p></div>
          <button className="btn btn-primary" onClick={()=>setShowNew(true)}>+ Cliente</button>
        </div>
        <input className="prod-search" style={{maxWidth:320,marginBottom:16}} placeholder="Buscar por nombre, teléfono o email..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {loading?<div className="emp-loading">Cargando clientes...</div>:(
          <div className="cli-grid">
            {filtered.map(c=>(
              <div key={c.id} className="cli-card card">
                <div className="cli-avatar">{c.name[0].toUpperCase()}</div>
                <div className="cli-info">
                  <div className="emp-name">{c.name}</div>
                  {c.phone&&<div className="emp-email">📞 {c.phone}</div>}
                  {c.email&&<div className="emp-email">✉ {c.email}</div>}
                  {c.notes&&<div className="cli-notes">{c.notes}</div>}
                </div>
                <div className="cli-stats">
                  <div className="cli-stat"><span className="cli-stat-val">{c.visit_count}</span><span className="cli-stat-lbl">visitas</span></div>
                  <div className="cli-stat"><span className="cli-stat-val accent">${Number(c.total_spent||0).toLocaleString('es-AR')}</span><span className="cli-stat-lbl">gastado</span></div>
                </div>
                <button className="cli-action-btn" onClick={()=>setEditing(c)}>Editar</button>
              </div>
            ))}
            {filtered.length===0&&<div className="emp-loading">No se encontraron clientes</div>}
          </div>
        )}
      </div>
      {(showNew||editing)&&<ClienteModal cliente={editing} onClose={()=>{setShowNew(false);setEditing(null)}} onSave={handleSave}/>}
    </Layout>
  )
}

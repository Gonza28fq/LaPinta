import { useAuth } from '../../context/AuthContext'
const THEMES = [{id:'slate_blue',dot:'#C8A96A',label:'Azul'},{id:'green_black',dot:'#4daa4d',label:'Verde'},{id:'dark_bw',dot:'#fff',label:'B&N'}]
export default function ThemeToggle() {
  const { user, changeTheme } = useAuth()
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 4px'}}>
      <span style={{fontSize:11,color:'var(--text-muted)'}}>Tema</span>
      <div style={{display:'flex',gap:6}}>
        {THEMES.map(t=>(
          <button key={t.id} title={t.label} onClick={()=>changeTheme(t.id)}
            style={{width:14,height:14,borderRadius:'50%',background:t.dot,border:`2px solid ${user?.theme===t.id?'var(--text-primary)':'transparent'}`,cursor:'pointer',transform:user?.theme===t.id?'scale(1.2)':'scale(1)',transition:'transform .15s'}}/>
        ))}
      </div>
    </div>
  )
}

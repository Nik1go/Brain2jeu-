export function Brain({className=''}:{className?:string}) {
  return <svg className={className} viewBox="0 0 340 270" fill="none" aria-hidden="true">
    <defs><linearGradient id="brain" x1="160" y1="60" x2="205" y2="200" gradientUnits="userSpaceOnUse"><stop stopColor="#FFD2CA"/><stop offset="1" stopColor="#FF9EA5"/></linearGradient><linearGradient id="cube" x2="1" y2="1"><stop stopColor="#E5D8FF"/><stop offset="1" stopColor="#C6B2FA"/></linearGradient></defs>
    <ellipse cx="183" cy="239" rx="76" ry="10" fill="#E9E3D9"/>
    <path d="m145 197-8 28-18 5m91-33 12 28 15 6" stroke="#292343" strokeWidth="10" strokeLinecap="round"/>
    <path d="m112 151-30 21-14-6m169-24 26-23 9 1" stroke="#292343" strokeWidth="8" strokeLinecap="round"/>
    <path d="M171 62c-17-23-53-11-57 12-27-2-44 22-36 45-23 20-7 51 13 56-3 27 26 44 48 35 16 20 40 17 50 2 26 18 52 1 52-17 27-3 37-28 23-48 18-24 3-50-20-54 2-26-23-40-42-31-10-14-22-15-31 0Z" fill="url(#brain)" stroke="#F18C9A" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M174 70c-10 18 4 27 2 40m-42-30c-15-5-27 7-22 21m-14 17c-5 16 9 26 22 19m-9 24c-15 5-12 22-2 25m31-88c12-2 22 6 18 20m52-37c18-7 29 5 25 17m-34 16c-7-12-23-8-23 5m53 24c14-6 26 5 23 18m-25 20c14 2 15 18 4 24m-49-9c-15 5-14 21-1 26m-36-17c-10-6-21 0-21 11" stroke="#ED8998" strokeWidth="4" strokeLinecap="round"/>
    <path d="M136 148c0-12 15-12 15 0m39 0c0-12 15-12 15 0" stroke="#322942" strokeWidth="5" strokeLinecap="round"/>
    <ellipse cx="131" cy="161" rx="10" ry="6" fill="#F17B91" opacity=".6"/><ellipse cx="209" cy="161" rx="10" ry="6" fill="#F17B91" opacity=".6"/>
    <path d="M160 164c5 11 17 11 23 0" stroke="#322942" strokeWidth="4" strokeLinecap="round"/>
    <path d="m70 65-9-11m48-23-3-15m133 19 9-13m32 51 15-7" stroke="#EABC4E" strokeWidth="5" strokeLinecap="round"/>
    <path d="m50 125 4 10 11 2-10 5-1 11-6-10-11-1 10-6z" fill="#A48AEE"/>
    <path d="m288 183 5 12 13 2-11 8-1 13-8-11-13-1 11-9z" fill="#F4C758"/>
    <rect x="28" y="195" width="33" height="33" rx="10" transform="rotate(-14 28 195)" fill="url(#cube)"/><path d="m40 207 8 8m-9 2 10-10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="286" cy="37" r="5" fill="#AED7B2"/><circle cx="77" cy="216" r="4" fill="#F8BAAB"/>
  </svg>;
}
export function MirrorsArt({large=false}:{large?:boolean}) {
  return <svg viewBox="0 0 320 205" className={large?'mirrors-art large':'mirrors-art'} fill="none" aria-hidden="true">
    <defs><linearGradient id="panel" x1="90" y1="10" x2="250" y2="210" gradientUnits="userSpaceOnUse"><stop stopColor="#F4EFFF"/><stop offset="1" stopColor="#BEA6F4"/></linearGradient><linearGradient id="ball" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FFEAA2"/><stop offset=".5" stopColor="#FFBF53"/><stop offset="1" stopColor="#F49036"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="5"/></filter></defs>
    <ellipse cx="164" cy="185" rx="96" ry="8" fill="#9271C8" opacity=".16" filter="url(#soft)"/>
    <g transform="translate(70 18) rotate(-7 90 82)"><rect x="0" y="5" width="183" height="161" rx="14" fill="#AC8DDE"/><rect width="183" height="158" rx="14" fill="url(#panel)" stroke="white" strokeWidth="3"/>
    {[1,2,3].map(i=><g key={i} stroke="white" strokeWidth="1.8" opacity=".8"><path d={`M${i*45.75} 0v158`}/><path d={`M0 ${i*39.5}h183`}/></g>)}
    {[[32,27,58,52],[111,64,137,39],[68,119,94,94],[123,119,149,144]].map(([x,y,a,b],i)=><g key={i}><path d={`M${x} ${y+3} ${a} ${b+3}`} stroke="#AA86D9" strokeWidth="9" strokeLinecap="round"/><path d={`M${x} ${y} ${a} ${b}`} stroke="#7850C7" strokeWidth="8" strokeLinecap="round"/><path d={`M${x} ${y-1} ${a} ${b-1}`} stroke="#F5EFFF" strokeWidth="4.5" strokeLinecap="round"/></g>)}
    <circle cx="157" cy="20" r="14" fill="#F8AD43" opacity=".3" filter="url(#soft)"/><circle cx="157" cy="20" r="11" fill="url(#ball)"/><ellipse cx="154" cy="16" rx="4" ry="3" fill="#FFF7D2"/>
    </g><path d="m53 55-7-7m218 88 9 2m-26 42 5 7" stroke="#9F7BD5" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}
export function TrainArt() {
  return <svg viewBox="0 0 320 205" aria-hidden="true" fill="none">
    <ellipse cx="160" cy="165" rx="112" ry="30" fill="#9DD3A7" opacity=".4"/>
    <path d="M51 143h170c55 0 57-70 11-70H119c-34 0-38 42-5 42h87" stroke="#4A7C68" strokeWidth="15"/>
    <path d="M51 143h170c55 0 57-70 11-70H119c-34 0-38 42-5 42h87" stroke="#C5D5AC" strokeWidth="9" strokeDasharray="3 8"/>
    {[[51,87],[268,133],[69,40],[249,36]].map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}><path d="M0 8v27" stroke="#618D61" strokeWidth="5"/><path d="M0-13c-19 11-17 34 0 32 18 2 20-23 0-32Z" fill={i%2?'#79B789':'#5DAF78'}/><path d="M0-5v20" stroke="#8BC799" strokeWidth="2"/></g>)}
    <g transform="translate(173 103) rotate(4)"><rect x="-10" y="19" width="62" height="12" rx="4" fill="#D8734B"/><rect x="-7" y="2" width="42" height="23" rx="8" fill="#F19C62"/><rect x="18" y="-15" width="27" height="39" rx="5" fill="#E88357"/><rect x="23" y="-10" width="16" height="15" rx="3" fill="#FFF2CC"/><rect x="13" y="-19" width="36" height="8" rx="4" fill="#BC634F"/><rect x="-3" y="-7" width="8" height="14" rx="2" fill="#A45E51"/><circle cx="3" cy="29" r="9" fill="#3D514C"/><circle cx="35" cy="29" r="9" fill="#3D514C"/><circle cx="3" cy="29" r="4" fill="#D8C79F"/><circle cx="35" cy="29" r="4" fill="#D8C79F"/></g>
    <g transform="translate(95 31)"><path d="m-5 19 28-18 29 18" stroke="#8E70BF" strokeWidth="8" strokeLinejoin="round"/><rect x="0" y="19" width="46" height="33" rx="5" fill="#C4A5E6"/><path d="M18 52V33h13v19" fill="#8162AB"/><rect x="5" y="26" width="7" height="9" rx="2" fill="#F2E5FC"/></g><path d="M158 78c-12-8-2-19 5-14-2-9 13-14 18-6" stroke="#EFF5E3" strokeWidth="6" strokeLinecap="round" opacity=".8"/>
  </svg>;
}
export function MathArt() {return <svg viewBox="0 0 320 205" aria-hidden="true"><defs><filter id="mathshadow"><feDropShadow dx="0" dy="5" stdDeviation="0" floodColor="#C5A03F" floodOpacity=".25"/></filter></defs><g filter="url(#mathshadow)" fontFamily="system-ui" fontWeight="800" fontSize="48" textAnchor="middle"><g transform="translate(64 46) rotate(-13)"><rect width="66" height="77" rx="13" fill="#FFFCEE"/><text x="33" y="56" fill="#33334C">7</text></g><g transform="translate(151 30) rotate(9)"><rect width="59" height="59" rx="12" fill="#EB8D9E"/><text x="29" y="45" fill="white">+</text></g><g transform="translate(225 83) rotate(13)"><rect width="52" height="60" rx="12" fill="#8AA5EB"/><text x="26" y="45" fill="white">3</text></g><g transform="translate(130 115) rotate(-5)"><rect width="67" height="67" rx="13" fill="#FFFBED"/><text x="33" y="47" fill="#33334C" fontSize="36">10</text></g><g transform="translate(56 136) rotate(-13)"><rect width="48" height="45" rx="10" fill="#70C4AB"/><text x="24" y="34" fill="white" fontSize="35">=</text></g></g><g stroke="#D9A641" strokeWidth="3" strokeLinecap="round"><path d="m237 44 9-13m4 24 15-5m-33 111 11 10"/></g></svg>}
export function ZipArt() {return <svg viewBox="0 0 320 205" aria-hidden="true" fill="none"><path d="M70 60c27-47 141-23 167 17 35 55-118 8-120 55s93 9 121 27" stroke="#91B4A3" strokeWidth="16" strokeLinecap="round"/><path d="M70 60c27-47 141-23 167 17 35 55-118 8-120 55s93 9 121 27" stroke="#FFF5E9" strokeWidth="4" strokeDasharray="2 11" strokeLinecap="round"/>{[[70,60,'1'],[161,42,'2'],[234,78,'3'],[117,132,'4'],[238,159,'5']].map(([x,y,n],i)=><g key={i}><circle cx={x} cy={y} r="19" fill={i===0?'#476B61':'#FFF9F1'}/><text x={x} y={Number(y)+6} textAnchor="middle" fill={i===0?'white':'#425751'} fontFamily="system-ui" fontWeight="800" fontSize="18">{n}</text></g>)}<path d="m52 140 2 7 8 1-6 5 1 8-7-4-6 4 1-8-6-5 8-1z" fill="#E0A980"/><circle cx="274" cy="124" r="6" fill="#DFA98C"/><path d="m263 40 3 9 9 1-7 6 1 9-7-5-8 5 2-9-7-6 9-1z" fill="#EDBD94"/></svg>}

type Props = { id: string };

const outline = { stroke: '#253d3e', strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Creature({ id }: { id: string }) {
  switch (id) {
    case 'bulbasaur':
    case 'ivysaur':
      return <>
        <path d="M8 39 14 32 27 31 34 36 37 47 33 52 27 51 25 44 20 44 18 52 12 52 12 43Z" fill="#79b978" {...outline} />
        <path d="M15 33 18 24 28 20 36 24 38 34 33 40 19 39Z" fill="#8fd28a" {...outline} />
        <path d={id === 'ivysaur' ? 'M25 24 19 17 20 10 27 15 30 7 35 14 42 11 40 20 35 25Z' : 'M25 25 23 17 27 12 30 18 34 11 38 17 36 25Z'} fill={id === 'ivysaur' ? '#d880a4' : '#568d50'} {...outline} />
        <path d="M19 36h3m9 0h3" stroke="#f7f3d0" strokeWidth="3" strokeLinecap="round" />
        <circle cx="21" cy="35" r="1.5" fill="#253d3e" /><circle cx="32" cy="35" r="1.5" fill="#253d3e" />
      </>;
    case 'squirtle':
    case 'wartortle':
      return <>
        <path d={id === 'wartortle' ? 'M9 31 4 24 6 18 11 24 16 20 18 31M47 31l5-8-2-6-6 7-4-4-2 11' : 'M9 34 4 29 6 25 13 29M48 34l7-5-2-4-8 4'} fill="#85c5dc" {...outline} />
        <path d="M13 40q2-13 12-13t14 13l-4 8H17Z" fill="#9b6d42" {...outline} />
        <path d="M18 38q7-6 15 0m-15 5q7-5 15 0" fill="none" stroke="#e4bd79" strokeWidth="2" />
        <path d="M16 31 18 22 27 18 36 22 39 31 34 37 20 37Z" fill="#8ed2e5" {...outline} />
        <path d="M18 47 14 52h9l3-5m8 0 4 5h-9l-3-5" fill="#78b9d0" {...outline} />
        {id === 'wartortle' && <path d="M16 23q-8-5-7-12 8 1 12 9m16 3q8-5 7-12-8 1-12 9" fill="#e7f3f3" {...outline} />}
        <circle cx="21" cy="28" r="1.5" fill="#20383c" /><circle cx="33" cy="28" r="1.5" fill="#20383c" />
      </>;
    case 'lapras':
      return <>
        <path d="M12 44q1-10 13-11l9 3 6 8-6 7H17Z" fill="#75b9ce" {...outline} />
        <path d="M31 38 30 25 33 15 39 12 45 17 42 22 38 21 37 34" fill="#82c9dd" {...outline} />
        <path d="M18 39q7-9 16 0l-3 8H20Z" fill="#8a9874" {...outline} />
        <path d="m21 39 4-4 4 4 4-3m-12 7 5-4 5 4 4-3" fill="none" stroke="#d9d7ae" strokeWidth="1.8" />
        <path d="M17 45 12 52l9-2m15-4 7 6-9-1" fill="#76b9cf" {...outline} />
        <path d="m36 15-3-6 4 2 3-5 1 8" fill="#dceef0" {...outline} />
        <circle cx="40" cy="17" r="1.4" fill="#20383c" />
      </>;
    case 'geodude':
      return <>
        <path d="M14 29 7 26 3 30 5 39 14 40m36-11 7-3 4 5-2 9-9 1" fill="#a67b50" {...outline} />
        <path d="M15 21 21 15 31 13 41 17 48 26 47 39 40 48 27 51 17 45 12 35Z" fill="#b69161" {...outline} />
        <path d="m19 23 7-4 5 3-5 4-8 1m15-3 6-4 5 5-7 3" fill="none" stroke="#876441" strokeWidth="2" />
        <path d="M20 32q4-4 8 0m4 0q4-4 8 0" fill="none" stroke="#253d3e" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M27 40q4 3 8 0" fill="none" stroke="#633f3c" strokeWidth="2" strokeLinecap="round" />
      </>;
    case 'pikachu':
      return <>
        <path d="M14 25 10 5 23 16 28 14 38 16 51 5 49 27 45 34 18 34Z" fill="#f3ce45" {...outline} />
        <path d="m12 8 8 8-6 1Zm36 0-8 8 6 1Z" fill="#473a36" />
        <path d="M21 29q1-9 11-9t12 9l-3 18q-9 8-19 0Z" fill="#f5d54b" {...outline} />
        <path d="m40 42 8-3-3-6 7-2-4-7 9 2-4 10 6 5-9 1-3 8-5-6Z" fill="#e2a72d" {...outline} />
        <circle cx="25" cy="28" r="2" fill="#26373c" /><circle cx="39" cy="28" r="2" fill="#26373c" />
        <circle cx="19" cy="35" r="3" fill="#dc6659" /><circle cx="45" cy="35" r="3" fill="#dc6659" />
      </>;
    case 'meowth':
      return <>
        <path d="M13 25 9 8 23 17 28 14 39 17 53 8 49 28 43 35 19 35Z" fill="#eee4c5" {...outline} />
        <path d="m12 12 8 7-5 1Zm38 0-8 7 5 1Z" fill="#cf8472" />
        <path d="M21 31q1-9 10-9t12 9l-3 17q-8 7-17 0Z" fill="#f4edcf" {...outline} />
        <path d="M30 20q-4-5 1-9 6 4 2 10" fill="#e7bc47" {...outline} />
        <path d="m21 32-9-2m9 6-10 2m32-6 9-2m-9 6 10 2" stroke="#73675d" strokeWidth="1.5" />
        <circle cx="26" cy="29" r="1.7" fill="#26373c" /><circle cx="38" cy="29" r="1.7" fill="#26373c" />
        <path d="M30 35h4m-2-2 2 2-2 2" fill="none" stroke="#9a5b60" strokeWidth="1.7" />
      </>;
    case 'vulpix':
    case 'ninetales':
      return <>
        <path d={id === 'ninetales' ? 'M34 40q15-3 18-17 8 3 5 15 0-12 5-17 6 12-2 22 6-12 11-12 1 14-11 21 7-10 11-8-1 13-14 18-9 4-19-2Z' : 'M35 41q12-5 14-18 8 6 3 15 7-4 10-11 6 14-9 24-8 4-17-1Z'} fill={id === 'ninetales' ? '#f0e5c3' : '#e5b86a'} {...outline} />
        <path d="M12 40q2-10 13-13l10 4 6 10-5 8H18Z" fill={id === 'ninetales' ? '#efe5c8' : '#d9874f'} {...outline} />
        <path d="M15 30 12 19 20 24 28 21 34 29 31 37 19 38Z" fill={id === 'ninetales' ? '#f5ebd4' : '#e69b5a'} {...outline} />
        <path d="m14 21 1-8 6 9m7 1 5-8 1 11" fill={id === 'ninetales' ? '#e9dfc7' : '#c97948'} {...outline} />
        <circle cx="20" cy="29" r="1.4" fill="#253d3e" />
      </>;
    case 'charmander':
      return <>
        <path d="M16 38 19 31 28 29 35 33 39 43 35 50H20Z" fill="#e78b4d" {...outline} />
        <path d="M20 31 17 22 22 15 31 14 38 20 36 29 31 34 23 33Z" fill="#f09a56" {...outline} />
        <path d="M37 44q10 3 11-7 2-5 7-4-5 4-3 10-2 9-14 9Z" fill="#e78b4d" {...outline} />
        <path d="M50 35q-4-6 1-12 1 5 5 6 3 6-4 9Z" fill="#ef694d" {...outline} />
        <path d="M52 34q-2-3 1-6 1 3 2 4 0 3-3 4Z" fill="#ffd85c" />
        <path d="M22 45q6-4 12 0v7H22Z" fill="#f4d28b" />
        <circle cx="23" cy="22" r="1.5" fill="#253d3e" /><circle cx="32" cy="22" r="1.5" fill="#253d3e" />
      </>;
    case 'charizard-mega-x':
      return <>
        <path d="M24 23 5 12 11 31 6 40 22 36m18-13 19-11-6 19 5 9-16-4" fill="#283b59" {...outline} />
        <path d="m10 17 10 13-5 1Zm44 0L44 30l5 1Z" fill="#52b9ba" />
        <path d="M22 29 27 21 37 20 43 29 40 39 35 43 35 51 28 51 28 42 23 38Z" fill="#354b6b" {...outline} />
        <path d="M26 23 27 13 32 18 37 12 39 23" fill="#344862" {...outline} />
        <path d="m38 42 9 2 7-4-3 8-13 4" fill="#2f4565" {...outline} />
        <path d="M49 48q-5 4-3 10 2-3 6-3 5-3 2-8" fill="#42d5cc" {...outline} />
        <circle cx="29" cy="27" r="1.4" fill="#43e0d2" /><circle cx="37" cy="27" r="1.4" fill="#43e0d2" />
      </>;
    default:
      return <>
        <path d="M32 9 49 19v20L32 55 15 39V19Z" fill="#d8e7df" {...outline} />
        <text x="32" y="38" textAnchor="middle" fill="#253d3e" fontFamily="sans-serif" fontSize="22" fontWeight="900">{id.slice(0, 1).toUpperCase()}</text>
      </>;
  }
}

export default function SpeciesPortrait({ id }: Props) {
  return <span className="species-portrait" aria-hidden="true">
    <svg viewBox="0 0 64 64" role="presentation" focusable="false">
      <Creature id={id} />
    </svg>
  </span>;
}

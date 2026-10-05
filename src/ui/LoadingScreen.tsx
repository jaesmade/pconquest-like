export default function LoadingScreen({ label = 'Loading run', detail = 'Preparing your next adventure…' }: { label?: string; detail?: string }) {
  return <main className="loading-screen" role="status" aria-live="polite"><section className="loading-card"><div className="loading-pips" aria-hidden="true"><i /><i /><i /></div><h2>{label}</h2><p>{detail}</p></section></main>;
}

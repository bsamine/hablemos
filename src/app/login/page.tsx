export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="stack center">
      <h1 className="logo">¡Hablemos!</h1>
      <p className="muted">Ton espagnol, 15 minutes par jour.</p>
      <form action="/api/login" method="post" className="stack">
        <input name="code" type="password" placeholder="Code d'accès" autoComplete="current-password" required />
        {e && <p className="error">Code incorrect.</p>}
        <button className="primary big" type="submit">Entrer</button>
      </form>
    </div>
  );
}

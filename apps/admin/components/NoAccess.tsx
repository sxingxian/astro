export function NoAccess() {
  return (
    <section className="panel p-6 flex flex-col gap-2" aria-labelledby="noaccess">
      <h1 id="noaccess" className="m-0 text-[22px] font-semibold">You don&apos;t have access to this page</h1>
      <p className="m-0 text-sm text-muted">Your role doesn&apos;t include it. Ask the owner if you need it.</p>
    </section>
  );
}

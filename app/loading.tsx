// Zatímco server skládá stránku, ukáže se hned po kliknutí obrys obsahu.
// Menu vlevo zůstává, takže je vidět, že appka reaguje.
export default function Loading() {
  return (
    <div aria-busy="true" className="animate-pulse">
      <div className="mb-6 h-9 w-64 rounded-xl bg-haze/70" />
      <div className="flex flex-col gap-3">
        <div className="h-24 rounded-2xl bg-haze/50" />
        <div className="h-24 rounded-2xl bg-haze/40" />
        <div className="h-24 rounded-2xl bg-haze/30" />
      </div>
    </div>
  );
}

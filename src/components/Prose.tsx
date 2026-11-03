export default function Prose({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-4xl font-black tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-slate-700 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </div>
  );
}

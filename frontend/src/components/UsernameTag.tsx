export default function UsernameTag({ name }: { name: string }) {
  return (
    <div className="inline-block rounded-tl-md rounded-tr-md px-2 py-1 text-[11px] font-medium bg-neutral-700 text-white">
      {name}
    </div>
  );
}

export default function UsernameTag({ name }: { name: string }) {
  return (
    <div className="inline-block rounded-tl-md rounded-tr-md bg-gray-400 px-2 py-1 text-[11px] font-medium text-gray-700">
      {name}
    </div>
  );
}

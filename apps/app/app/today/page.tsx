export const metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-6 px-5 py-10">
      <p className="eyebrow">Today</p>
      <h1 className="m-0 font-display text-4xl font-medium">Your daily reading</h1>
    </div>
  );
}

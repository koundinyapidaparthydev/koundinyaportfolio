import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-2 px-6 py-4 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-slate-900 hover:text-slate-600"
        >
          Koundinya Pidaparthy
        </Link>

        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <a
            href="mailto:koundinyapidaparthy@gmail.com"
            className="hover:text-slate-900 hover:underline"
          >
            Email
          </a>
          <a
            href="tel:5512298660"
            className="hover:text-slate-900 hover:underline"
          >
            Phone
          </a>
          <a
            href="https://linkedin.com/in/koundinyap"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 hover:underline"
          >
            LinkedIn
          </a>
          <a
            href="https://github.com/koundinyapidaparthy2"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 hover:underline"
          >
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
}

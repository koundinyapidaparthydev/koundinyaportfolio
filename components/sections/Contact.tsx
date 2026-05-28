"use client";

/**
 * Contact.tsx — Dark contact section.
 *
 * Left: clickable contact info cards (email, phone, LinkedIn, GitHub)
 * Right: react-hook-form + zod contact form → POST /api/contact
 *        with success / error toast feedback
 */

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

// ─── Contact info ─────────────────────────────────────────────────────────────

const CONTACT_ITEMS = [
  {
    id: "email",
    label: "Email",
    value: "koundinyapidaparthy@gmail.com",
    href: "mailto:koundinyapidaparthy@gmail.com",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  {
    id: "phone",
    label: "Phone",
    value: "551-229-8660",
    href: "tel:5512298660",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    value: "linkedin.com/in/koundinyap",
    href: "https://linkedin.com/in/koundinyap",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    id: "github",
    label: "GitHub",
    value: "github.com/koundinyapidaparthy2",
    href: "https://github.com/koundinyapidaparthy2",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
] as const;

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { type: "success" | "error"; message: string } | null;

function Toast({ toast }: { toast: ToastState }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.type + toast.message}
          initial={{ opacity: 0, y: -12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          role="alert"
          className={[
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300",
          ].join(" ")}
        >
          {toast.type === "success" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          )}
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Contact form ─────────────────────────────────────────────────────────────

function ContactForm() {
  const [toast, setToast] = useState<ToastState>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const showToast = (t: ToastState) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  };

  const onSubmit = async (data: ContactFormData) => {
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Server error");

      showToast({
        type: "success",
        message: "Message sent! I'll get back to you soon.",
      });
      reset();
    } catch {
      showToast({
        type: "error",
        message: "Something went wrong. Please try emailing directly.",
      });
    }
  };

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-indigo-500/70 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-600";
  const errorCls = "mt-1.5 text-xs text-red-400";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="contact-name" className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400">
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          {...register("name")}
          className={inputCls}
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className={errorCls}>{errors.name.message}</p>}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400">
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register("email")}
          className={inputCls}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className={errorCls}>{errors.email.message}</p>}
      </div>

      {/* Message */}
      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={5}
          placeholder="Tell me about your project or just say hi!"
          {...register("message")}
          className={[inputCls, "resize-none"].join(" ")}
          aria-invalid={!!errors.message}
        />
        {errors.message && <p className={errorCls}>{errors.message.message}</p>}
      </div>

      {/* Toast */}
      <Toast toast={toast} />

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        {isSubmitting ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Sending…
          </>
        ) : (
          <>
            Send message
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m22 2-7 20-4-9-9-4 20-7z" />
              <path d="M22 2 11 13" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Contact() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section ref={ref} id="contact" className="aurora-25 relative bg-slate-50 py-24 px-6 dark:bg-[#060606]">
      {/* Top aurora radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-30 dark:opacity-100"
        style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(124,58,237,0.15) 0%, transparent 65%)" }}
      />
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Get In Touch
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-indigo-500" />
          <p className="mx-auto mt-4 max-w-md text-sm text-gray-500 dark:text-slate-500">
            Have a project in mind or just want to connect? I&apos;d love to
            hear from you.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid gap-10 lg:grid-cols-2">
          {/* ── Left: contact cards ── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-600">
              Contact details
            </p>
            {CONTACT_ITEMS.map(({ id, label, value, href, icon }, i) => (
              <motion.a
                key={id}
                href={href}
                target={id === "linkedin" || id === "github" ? "_blank" : undefined}
                rel={id === "linkedin" || id === "github" ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.45, delay: 0.15 + i * 0.08, ease: "easeOut" }}
                className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/8 dark:bg-white/3 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/8"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 transition-colors group-hover:bg-indigo-500/25 group-hover:text-indigo-300">
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-600">{label}</p>
                  <p className="mt-0.5 truncate text-sm text-gray-600 group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-white">
                    {value}
                  </p>
                </div>
                {/* Arrow */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="ml-auto h-4 w-4 shrink-0 text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </motion.a>
            ))}
          </motion.div>

          {/* ── Right: form ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-white/8 dark:bg-white/3 dark:shadow-none"
          >
            <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-slate-600">
              Send a message
            </p>
            <ContactForm />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

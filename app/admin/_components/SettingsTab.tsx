"use client";

import { glass, glassCn } from "@/lib/glass";
import { AdminPageHeader, AdminSection } from "./AdminShell";

/**
 * SettingsTab — change the admin password.
 * Calls PATCH /api/auth/password with current + new password.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm the new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

type ToastState = { type: "success" | "error"; message: string } | null;

export default function SettingsTab() {
  const [toast, setToast] = useState<ToastState>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const showToast = (t: ToastState) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const msg =
          typeof payload?.error === "string"
            ? payload.error
            : "Failed to change password.";
        showToast({ type: "error", message: msg });
        return;
      }

      showToast({ type: "success", message: "Password changed successfully." });
      reset();
    } catch {
      showToast({
        type: "error",
        message: "Network error — please try again.",
      });
    }
  };

  const inputCls = "glass-input text-white placeholder:text-slate-600";
  const labelCls = "mb-1.5 block text-xs font-medium text-slate-500";
  const errorCls = "mt-1.5 text-xs text-red-400";

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Settings" subtitle="Manage your admin account." />

      <AdminSection title="Change admin password">
      <div className={glassCn(glass.panel, "max-w-md p-6")}>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className={labelCls}>Current password</label>
            <input
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
              className={inputCls}
            />
            {errors.currentPassword && (
              <p className={errorCls}>{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>New password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
              className={inputCls}
            />
            {errors.newPassword && (
              <p className={errorCls}>{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className={inputCls}
            />
            {errors.confirmPassword && (
              <p className={errorCls}>{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Toast */}
          {toast && (
            <div
              className={[
                "rounded-xl border px-4 py-3 text-sm font-medium",
                toast.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300",
              ].join(" ")}
            >
              {toast.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="glass-btn-primary w-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
      </AdminSection>

      <AdminSection title="Account">
      <div className={glassCn(glass.panel, "max-w-md p-5")}>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="flex items-center justify-between">
            <span>Email</span>
            <span className="text-slate-400">
              {process.env.NEXT_PUBLIC_ADMIN_EMAIL_HINT ?? "configured via env"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Role</span>
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-300">
              admin
            </span>
          </div>
        </div>
      </div>
      </AdminSection>
    </div>
  );
}

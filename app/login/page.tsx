"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// ─── Form schema ──────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── Inner form (uses useSearchParams – must be inside Suspense) ──────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        setServerError("Invalid email or password. Please try again.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  };

  return (
    <Card className="border-slate-700 bg-slate-800/80 shadow-2xl backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold text-white">
          Welcome back
        </CardTitle>
        <CardDescription className="text-center text-slate-400">
          Sign in to manage your portfolio
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          id="login-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
        >
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
            >
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              <p className="text-sm text-red-400">{serverError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-slate-300">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/30"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-slate-300">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/30"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <Button
          type="submit"
          form="login-form"
          disabled={isSubmitting}
          className="w-full gap-2 bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                />
              </svg>
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <a
          href="/"
          className="text-center text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          ← Back to portfolio
        </a>
      </CardFooter>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-900/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-900/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 overflow-hidden rounded-full ring-2 ring-indigo-500/50 shadow-lg">
            <Image
              src="/kp-photo.png"
              alt="Koundinya Pidaparthy"
              width={56}
              height={56}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <p className="text-sm font-medium text-slate-400">Portfolio Admin</p>
        </div>

        <Suspense
          fallback={
            <div className="h-80 animate-pulse rounded-xl bg-slate-800/80" />
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-600">
          This area is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
